import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { toast } from 'sonner';
import { AUTH_CONNECTION, connectToSocialProvider, disconnectWeb3Auth } from '@/lib/web3auth';
import { clearAuthSession, setAuthToken } from '@/lib/api/dehub/core';
import { getAccountInfo, type DeHubUser } from '@/lib/api/dehub';

type SocialProvider = 'google' | 'twitter' | 'discord';
type WalletChoice = 'metamask' | 'phantom' | 'trust';

interface AuthContextValue {
  user: DeHubUser | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  needsSignature: boolean;
  isLoginModalOpen: boolean;
  requiresUsername: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setRequiresUsername: (value: boolean) => void;
  setWagmiAuthIntent: (value: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshUser: () => Promise<void>;
  connectWithProvider: (provider: SocialProvider) => Promise<void>;
  connectWithEmail: (email: string) => Promise<void>;
  connectWithSMS: (phone: string) => Promise<void>;
  connectWithWallet: (wallet: WalletChoice) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

async function providerToAddress(provider: any): Promise<string | null> {
  if (!provider?.request) return null;
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (Array.isArray(accounts) && accounts[0]) return String(accounts[0]).toLowerCase();
  } catch {
    // noop
  }
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (Array.isArray(accounts) && accounts[0]) return String(accounts[0]).toLowerCase();
  } catch {
    // noop
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DeHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [needsSignature] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [wagmiAuthIntent, setWagmiAuthIntent] = useState(false);

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const walletAddress = useMemo(() => {
    if (address) return address.toLowerCase();
    const fromStorage = localStorage.getItem('dehub_wallet');
    return fromStorage ? fromStorage.toLowerCase() : null;
  }, [address]);

  const isAuthenticated = !!walletAddress;

  const applySession = useCallback(async (addressLower: string, source: 'web3auth' | 'wallet') => {
    const normalizedAddress = addressLower.toLowerCase();
    localStorage.setItem('dehub_wallet', normalizedAddress);
    localStorage.setItem('dehub_connection_source', source);
    localStorage.setItem('dehub_token_timestamp', String(Date.now()));
    setAuthToken(randomToken(normalizedAddress));

    try {
      const profile = await getAccountInfo(normalizedAddress);
      const normalizedUser = normalizeUser(normalizedAddress, profile);
      setUser(normalizedUser);
      localStorage.setItem('dehub_user', JSON.stringify(normalizedUser));
      const missingIdentity = !normalizedUser.username || !normalizedUser.displayName;
      setRequiresUsername(missingIdentity);
    } catch {
      const fallback = normalizeUser(normalizedAddress, null);
      setUser(fallback);
      localStorage.setItem('dehub_user', JSON.stringify(fallback));
      setRequiresUsername(true);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!walletAddress) return;
    const profile = await getAccountInfo(walletAddress);
    const normalizedUser = normalizeUser(walletAddress, profile);
    setUser(normalizedUser);
    localStorage.setItem('dehub_user', JSON.stringify(normalizedUser));
    setRequiresUsername(!normalizedUser.username || !normalizedUser.displayName);
  }, [walletAddress]);

  useEffect(() => {
    const boot = async () => {
      const storedWallet = localStorage.getItem('dehub_wallet');
      const storedUser = localStorage.getItem('dehub_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as DeHubUser;
          setUser(parsed);
          setRequiresUsername(!parsed.username || !parsed.displayName);
        } catch {
          // noop
        }
      }
      if (storedWallet) {
        await refreshUser().catch(() => {
          const fallback = normalizeUser(storedWallet.toLowerCase(), null);
          setUser(fallback);
        });
      }
      setIsLoading(false);
    };
    void boot();
  }, [refreshUser]);

  useEffect(() => {
    if (!wagmiAuthIntent || !isConnected || !address) return;
    void (async () => {
      setIsConnecting(true);
      try {
        await applySession(address.toLowerCase(), 'wallet');
        setIsLoginModalOpen(false);
        setWagmiAuthIntent(false);
      } catch (err) {
        console.error('[Auth] wallet connect finalize failed', err);
      } finally {
        setIsConnecting(false);
      }
    })();
  }, [wagmiAuthIntent, isConnected, address, applySession]);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const connect = useCallback(async () => {
    openLoginModal();
  }, [openLoginModal]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync().catch(() => undefined);
      await disconnectWeb3Auth().catch(() => undefined);
    } finally {
      clearAuthSession();
      localStorage.removeItem('dehub_user');
      localStorage.removeItem('dehub_connection_source');
      setUser(null);
      setRequiresUsername(false);
      setWagmiAuthIntent(false);
    }
  }, [disconnectAsync]);

  const connectWithProvider = useCallback(async (provider: SocialProvider) => {
    setIsConnecting(true);
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
      await applySession(socialAddress, 'web3auth');
      setIsLoginModalOpen(false);
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('[Auth] social login failed', error);
      toast.error('Login failed. Please try again.');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [applySession]);

  const connectWithEmail = useCallback(async (email: string) => {
    setIsConnecting(true);
    try {
      const authProvider = await connectToSocialProvider(AUTH_CONNECTION.EMAIL_PASSWORDLESS, email);
      const socialAddress = await providerToAddress(authProvider);
      if (!socialAddress) throw new Error('Could not fetch wallet address from email login');
      await applySession(socialAddress, 'web3auth');
      setIsLoginModalOpen(false);
      toast.success('Email login successful');
    } catch (error) {
      console.error('[Auth] email login failed', error);
      toast.error('Email login failed');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [applySession]);

  const connectWithSMS = useCallback(async (phone: string) => {
    setIsConnecting(true);
    try {
      const authProvider = await connectToSocialProvider(AUTH_CONNECTION.SMS_PASSWORDLESS, phone);
      const socialAddress = await providerToAddress(authProvider);
      if (!socialAddress) throw new Error('Could not fetch wallet address from SMS login');
      await applySession(socialAddress, 'web3auth');
      setIsLoginModalOpen(false);
      toast.success('Phone login successful');
    } catch (error) {
      console.error('[Auth] sms login failed', error);
      toast.error('SMS login failed');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [applySession]);

  const connectWithWallet = useCallback(async (wallet: WalletChoice) => {
    setIsConnecting(true);
    try {
      const connector = connectors.find((c) => c.id.includes(wallet) || c.name.toLowerCase().includes(wallet));
      if (!connector) {
        throw new Error(`Wallet connector not found: ${wallet}`);
      }
      await connectAsync({ connector });
      setWagmiAuthIntent(true);
    } catch (error) {
      console.error('[Auth] wallet connect failed', error);
      toast.error('Wallet connection failed');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, connectors]);

  const value: AuthContextValue = {
    user,
    walletAddress,
    isAuthenticated,
    isLoading,
    isConnecting,
    needsSignature,
    isLoginModalOpen,
    requiresUsername,
    openLoginModal,
    closeLoginModal,
    setRequiresUsername,
    setWagmiAuthIntent,
    connect,
    disconnect,
    refreshUser,
    connectWithProvider,
    connectWithEmail,
    connectWithSMS,
    connectWithWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

