import { supabase } from '@/integrations/supabase/client';
import { getAuthToken } from './core';
import { useAuthStore } from '@/stores/authStore';

export class DehubEdgeError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'DehubEdgeError';
  }
}

/** @deprecated use DehubEdgeError */
export const SocialEdgeError = DehubEdgeError;

export async function invokeDehubEdgeFn<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  // Use Zustand store as the primary source of truth for session state
  const authState = useAuthStore.getState();
  const wallet = authState.walletAddress || localStorage.getItem('dehub_wallet');
  const token = getAuthToken(); // getAuthToken already reads from core.ts state / localStorage
  
  if (!wallet) {
    console.error('[Edge] No wallet found in Zustand or localStorage');
    throw new DehubEdgeError('Authentication required: No wallet address');
  }
  
  if (!token) {
    console.error('[Edge] No token found for wallet:', wallet);
    throw new DehubEdgeError('Authentication required: No session token');
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      ...body,
      _wallet: wallet.toLowerCase(),
      _token: token,
    },
    headers: {
      'x-wallet-address': wallet.toLowerCase(),
      'x-dehub-token': token,
    },
  });

  if (error) {
    throw new DehubEdgeError(error.message || 'Edge function failed');
  }

  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload && typeof payload === 'object' && payload.ok === false && payload.error) {
    throw new DehubEdgeError(String(payload.error));
  }

  return data as T;
}

export async function invokeDehubSocialApi<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<T> {
  return invokeDehubEdgeFn<T>('dehub-social-api', body);
}

export async function invokeDehubPlatformApi<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<T> {
  return invokeDehubEdgeFn<T>('dehub-platform-api', body);
}

/**
 * Calls the platform API without requiring authentication.
 * Only works for public actions (e.g. stage.list, stage.participants.list).
 */
export async function invokePlatformApiPublic<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('dehub-platform-api', { body });
  if (error) throw new DehubEdgeError(error.message || 'Edge function failed');
  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload && typeof payload === 'object' && payload.ok === false && payload.error) {
    throw new DehubEdgeError(String(payload.error));
  }
  return data as T;
}
