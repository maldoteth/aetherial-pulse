/**
 * Authenticated Supabase Edge Function invokes (DeHub JWT + wallet header).
 */
import { supabase } from '@/integrations/supabase/client';
import { getAuthToken } from './core';

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
  const wallet = localStorage.getItem('dehub_wallet');
  const token = getAuthToken();
  if (!wallet) throw new DehubEdgeError('Authentication required');
  if (!token) throw new DehubEdgeError('Authentication required');

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
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
