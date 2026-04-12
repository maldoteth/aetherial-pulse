/**
 * AuthContext — thin wagmi-sync bridge
 * =====================================
 * Auth STATE lives in Zustand (src/stores/authStore.ts).
 * This provider only:
 *   1. Boots the store on mount (restores localStorage session + handles Web3Auth redirect)
 *   2. Watches wagmi connection events and applies wallet sessions to the store
 *   3. Patches `initiateWalletConnect` and `disconnect` in the store with real wagmi fns
 *
 * useAuth() re-exports the Zustand store so all existing call sites
 * (import { useAuth } from '@/contexts/AuthContext') keep working with no changes.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAuthStore, type SocialProvider, type WalletChoice } from '@/stores/authStore';
import { clearAuthSession } from '@/lib/api/dehub/core';

export type { SocialProvider, WalletChoice };

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  // Boot once — restore localStorage session + handle Web3Auth post-redirect
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    useAuthStore.getState().boot();
  }, []);

  // Track whether a wallet connect was initiated from our UI
  const wagmiAuthIntentRef = useRef(false);

  // Patch store actions with real wagmi functions
  useEffect(() => {
    useAuthStore.setState({
      initiateWalletConnect: async (wallet: WalletChoice) => {
        useAuthStore.setState({ isConnecting: true });
        try {
          const connector = connectors.find(
            (c) => c.id.toLowerCase().includes(wallet) || c.name.toLowerCase().includes(wallet)
          );
          if (!connector) throw new Error(`Wallet connector not found: ${wallet}`);
          wagmiAuthIntentRef.current = true;
          await connectAsync({ connector });
          // Session is applied by the wagmi watcher below
        } catch (error) {
          wagmiAuthIntentRef.current = false;
          console.error('[Auth] wallet connect failed', error);
          useAuthStore.setState({ isConnecting: false });
          throw error;
        }
      },
      disconnect: async () => {
        try {
          await disconnectAsync().catch(() => undefined);
        } finally {
          clearAuthSession();
          localStorage.removeItem('dehub_user');
          localStorage.removeItem('dehub_wallet');
          localStorage.removeItem('dehub_connection_source');
          useAuthStore.setState({
            user: null,
            walletAddress: null,
            isAuthenticated: false,
            requiresUsername: false,
            isConnecting: false,
          });
        }
      },
    });
  }, [connectors, connectAsync, disconnectAsync]);

  // Watch wagmi connection — when wallet connects via our UI, apply session
  const prevConnected = useRef(false);
  useEffect(() => {
    const justConnected = isConnected && !prevConnected.current;
    prevConnected.current = isConnected;

    if (justConnected && address && wagmiAuthIntentRef.current) {
      wagmiAuthIntentRef.current = false;
      useAuthStore
        .getState()
        .applySession(address.toLowerCase(), 'wallet')
        .then(() => {
          useAuthStore.setState({ isLoginModalOpen: false, isConnecting: false });
        })
        .catch((err) => {
          console.error('[Auth] wallet connect finalize failed', err);
          useAuthStore.setState({ isConnecting: false });
        });
    }
  }, [isConnected, address]);

  return <>{children}</>;
}

/**
 * useAuth — same public API as the old Context-based hook, now backed by Zustand.
 * All 150+ existing call sites work without any import changes.
 */
export function useAuth() {
  const store = useAuthStore();

  return {
    // State
    user: store.user,
    walletAddress: store.walletAddress,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isConnecting: store.isConnecting,
    needsSignature: store.needsSignature,
    isLoginModalOpen: store.isLoginModalOpen,
    requiresUsername: store.requiresUsername,

    // Modal controls
    openLoginModal: store.openLoginModal,
    closeLoginModal: store.closeLoginModal,
    setRequiresUsername: store.setRequiresUsername,
    /** @deprecated — wagmi intent is now internal to the store */
    setWagmiAuthIntent: (_v: boolean) => { /* no-op */ },

    // Auth actions
    connect: store.openLoginModal,
    disconnect: store.disconnect,
    refreshUser: store.refreshUser,
    patchUser: store.patchUser,
    connectWithProvider: store.connectWithProvider,
    connectWithEmail: store.connectWithEmail,
    connectWithSMS: store.connectWithSMS,
    connectWithWallet: (wallet: WalletChoice) => store.initiateWalletConnect(wallet),
  };
}
