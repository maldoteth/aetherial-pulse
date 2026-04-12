/**
 * Auth Store (Zustand)
 * ====================
 * Single source of truth for authentication state.
 * Replaces React Context for auth — no more re-render waterfalls.
 *
 * AuthProvider in AuthContext.tsx is now a thin wagmi-sync bridge that
 * watches wagmi state and calls actions here.
 *
 * All components import useAuth() from @/contexts/AuthContext — same API,
 * no migration needed across 151+ files.
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import {
  AUTH_CONNECTION,
  connectToSocialProvider,
  disconnectWeb3Auth,
  hasRedirectResult,
  consumePreLoginPath,
  initWeb3Auth,
} from '@/lib/web3auth';
import { clearAuthSession, setAuthToken } from '@/lib/api/dehub/core';
import { getAccountInfo, type DeHubUser } from '@/lib/api/dehub';

export type SocialProvider = 'google' | 'twitter' | 'discord';
export type WalletChoice = 'metamask' | 'phantom' | 'trust';

export interface AuthState {
  user: DeHubUser | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  needsSignature: boolean;
  isLoginModalOpen: boolean;
  requiresUsername: boolean;

  // Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setRequiresUsername: (value: boolean) => void;

  /** Called by AuthProvider after wallet/social login to set up the session */
  applySession: (addressLower: string, source: 'web3auth' | 'wallet') => Promise<void>;

  /** Social login (Google / Twitter / Discord) */
  connectWithProvider: (
    provider: SocialProvider,
    connectAsyncFn?: () => Promise<void>
  ) => Promise<void>;

  /** Email passwordless */
  connectWithEmail: (email: string) => Promise<void>;

  /** SMS passwordless */
  connectWithSMS: (phone: string) => Promise<void>;

  /**
   * External wallet (MetaMask / Phantom / Trust).
   * Patched at runtime by AuthProvider with real wagmi connectAsync.
   */
  initiateWalletConnect: (wallet: WalletChoice) => Promise<void>;

  /**
   * Disconnect. Patched at runtime by AuthProvider with real wagmi disconnectAsync.
   */
  disconnect: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (patch: Partial<DeHubUser>) => void;

  /** Boot: restore session from localStorage + process Web3Auth redirect if present */
  boot: () => Promise<void>;
}

function randomToken(address: string) {
  return `local-${address}-${Date.now()}`;
}

function normalizeUser(address: string, profile?: DeHubUser | null): DeHubUser {
  return {
    ...profile,
    address: profile?.address || address,
    _id: profile?._id || address,
    displayName: profile?.displayName || profile?.display_name || '',
    username: profile?.username || '',
    avatarImageUrl: profile?.avatarImageUrl || profile?.avatarUrl || profile?.avatar_url || '',
  };
}

const BASE_CHAIN_HEX = '0x2105';

/** Base is required for Web3Auth + Pimlico AA; 0x1 triggers "Account Abstraction is not supported for the chain 0x1". */
async function ensureProviderOnBase(provider: { request: (a: unknown, b?: unknown) => Promise<unknown> }): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
    return;
  } catch (switchErr: unknown) {
    const code = (switchErr as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BASE_CHAIN_HEX,
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://base-rpc.publicnode.com'],
              blockExplorerUrls: ['https://basescan.org'],
            },
          ],
        });
      } catch {
        /* still try account methods */
      }
    }
  }
}

async function providerToAddress(provider: any): Promise<string | null> {
  if (!provider?.request) return null;
  await ensureProviderOnBase(provider);
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (Array.isArray(accounts) && accounts[0]) return String(accounts[0]).toLowerCase();
  } catch { /* noop */ }
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (Array.isArray(accounts) && accounts[0]) return String(accounts[0]).toLowerCase();
  } catch { /* noop */ }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  walletAddress: null,
  isAuthenticated: false,
  isLoading: true,
  isConnecting: false,
  needsSignature: false,
  isLoginModalOpen: false,
  requiresUsername: false,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  setRequiresUsername: (value) => set({ requiresUsername: value }),

  applySession: async (addressLower, source) => {
    const normalizedAddress = addressLower.toLowerCase();
    localStorage.setItem('dehub_wallet', normalizedAddress);
    localStorage.setItem('dehub_connection_source', source);
    localStorage.setItem('dehub_token_timestamp', String(Date.now()));
    setAuthToken(randomToken(normalizedAddress));
    set({ walletAddress: normalizedAddress, isAuthenticated: true });

    try {
      const profile = await getAccountInfo(normalizedAddress);
      const normalizedUser = normalizeUser(normalizedAddress, profile);
      set({ user: normalizedUser });
      localStorage.setItem('dehub_user', JSON.stringify(normalizedUser));
      set({ requiresUsername: !normalizedUser.username || !normalizedUser.displayName });
    } catch {
      const fallback = normalizeUser(normalizedAddress, null);
      set({ user: fallback, requiresUsername: true });
      localStorage.setItem('dehub_user', JSON.stringify(fallback));
    }
  },

  refreshUser: async () => {
    const { walletAddress } = get();
    if (!walletAddress) return;
    try {
      const profile = await getAccountInfo(walletAddress);
      const normalizedUser = normalizeUser(walletAddress, profile);
      set({ user: normalizedUser });
      localStorage.setItem('dehub_user', JSON.stringify(normalizedUser));
      set({ requiresUsername: !normalizedUser.username || !normalizedUser.displayName });
    } catch { /* noop */ }
  },

  patchUser: (patch) => {
    const { user } = get();
    if (!user) return;
    const patched = { ...user, ...patch };
    set({ user: patched });
    localStorage.setItem('dehub_user', JSON.stringify(patched));
  },

  connectWithProvider: async (provider) => {
    set({ isConnecting: true });
    try {
      const connection =
        provider === 'google'
          ? AUTH_CONNECTION.GOOGLE
          : provider === 'twitter'
            ? AUTH_CONNECTION.TWITTER
            : AUTH_CONNECTION.DISCORD;

      const authProvider = await connectToSocialProvider(connection);
      const socialAddress = await providerToAddress(authProvider);
      if (!socialAddress) throw new Error('Could not fetch wallet address from social provider');
      await get().applySession(socialAddress, 'web3auth');
      set({ isLoginModalOpen: false });
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('[Auth] social login failed', error);
      toast.error('Login failed. Please try again.');
      throw error;
    } finally {
      set({ isConnecting: false });
    }
  },

  connectWithEmail: async (email) => {
    set({ isConnecting: true });
    try {
      const authProvider = await connectToSocialProvider(AUTH_CONNECTION.EMAIL_PASSWORDLESS, email);
      const socialAddress = await providerToAddress(authProvider);
      if (!socialAddress) throw new Error('Could not fetch wallet address from email login');
      await get().applySession(socialAddress, 'web3auth');
      set({ isLoginModalOpen: false });
      toast.success('Email login successful');
    } catch (error) {
      console.error('[Auth] email login failed', error);
      toast.error('Email login failed');
      throw error;
    } finally {
      set({ isConnecting: false });
    }
  },

  connectWithSMS: async (phone) => {
    set({ isConnecting: true });
    try {
      const authProvider = await connectToSocialProvider(AUTH_CONNECTION.SMS_PASSWORDLESS, phone);
      const socialAddress = await providerToAddress(authProvider);
      if (!socialAddress) throw new Error('Could not fetch wallet address from SMS login');
      await get().applySession(socialAddress, 'web3auth');
      set({ isLoginModalOpen: false });
      toast.success('Phone login successful');
    } catch (error) {
      console.error('[Auth] sms login failed', error);
      toast.error('SMS login failed');
      throw error;
    } finally {
      set({ isConnecting: false });
    }
  },

  // Placeholder — patched at runtime by AuthProvider with real wagmi connectAsync
  initiateWalletConnect: async (_wallet) => {
    console.warn('[Auth] initiateWalletConnect called before AuthProvider patched it');
  },

  // Placeholder — patched at runtime by AuthProvider with real wagmi disconnectAsync
  disconnect: async () => {
    await disconnectWeb3Auth().catch(() => undefined);
    clearAuthSession();
    localStorage.removeItem('dehub_user');
    localStorage.removeItem('dehub_wallet');
    localStorage.removeItem('dehub_connection_source');
    set({
      user: null,
      walletAddress: null,
      isAuthenticated: false,
      requiresUsername: false,
      isConnecting: false,
    });
  },

  boot: async () => {
    // 1. Handle Web3Auth post-redirect result
    // hasRedirectResult() checks for URL params (works for email OTP).
    // For OAuth (Google/Twitter/etc.) the params may not be in the URL — Web3Auth
    // stores the session internally. We fall back to checking whether we saved a
    // pre-login path, which is only set immediately before a redirect is initiated.
    const hasPendingRedirect = hasRedirectResult() || !!sessionStorage.getItem('dehub_pre_login_path');
    if (hasPendingRedirect) {
      set({ isConnecting: true });
      try {
        const web3auth = await initWeb3Auth();
        if (web3auth.connected && web3auth.provider) {
          // AA provider only supports Base (0x2105). After redirect the session can be on 0x1.
          await ensureProviderOnBase(web3auth.provider as { request: (a: unknown, b?: unknown) => Promise<unknown> });
          const accounts = await web3auth.provider.request({ method: 'eth_accounts' }) as string[];
          const socialAddress = accounts?.[0]?.toLowerCase();
          if (socialAddress) {
            await get().applySession(socialAddress, 'web3auth');
            toast.success('Logged in successfully');
            const prePath = consumePreLoginPath();
            if (prePath && prePath !== '/' && window.location.pathname !== prePath) {
              window.history.replaceState(null, '', prePath);
            }
            set({ isLoading: false, isConnecting: false });
            return;
          }
        } else {
          // OAuth was cancelled or session was not created — clear the redirect marker
          // so we don't re-enter this block on every subsequent page load.
          sessionStorage.removeItem('dehub_pre_login_path');
        }
      } catch (err) {
        console.error('[Auth] redirect result processing failed:', err);
        toast.error('Login failed after redirect. Please try again.');
        // Clear the pending-redirect marker so we don't retry on every page load
        sessionStorage.removeItem('dehub_pre_login_path');
      } finally {
        set({ isConnecting: false });
      }
    }

    // 2. Restore session from localStorage
    const storedWallet = localStorage.getItem('dehub_wallet');
    const storedUser = localStorage.getItem('dehub_user');

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as DeHubUser;
        set({
          user: parsed,
          requiresUsername: !parsed.username || !parsed.displayName,
        });
      } catch { /* noop */ }
    }

    if (storedWallet) {
      set({ walletAddress: storedWallet.toLowerCase(), isAuthenticated: true });
      await get().refreshUser().catch(() => {
        const fallback = normalizeUser(storedWallet.toLowerCase(), null);
        set({ user: fallback });
      });
    }

    set({ isLoading: false });
  },
}));
