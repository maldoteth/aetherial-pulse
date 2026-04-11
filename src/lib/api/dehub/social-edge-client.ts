/**
 * Invokes the `dehub-social-api` edge function for posting, engagement,
 * follow mutations, and profile/privacy updates. Requires wallet + DeHub JWT.
 */
import { supabase } from '@/integrations/supabase/client';
import { getAuthToken } from './core';

export class SocialEdgeError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'SocialEdgeError';
  }
}

export async function invokeDehubSocialApi<T = Record<string, unknown>>(
  body: Record<string, unknown>
): Promise<T> {
  const wallet = localStorage.getItem('dehub_wallet');
  const token = getAuthToken();
  if (!wallet) throw new SocialEdgeError('Authentication required');
  if (!token) throw new SocialEdgeError('Authentication required');

  const { data, error } = await supabase.functions.invoke('dehub-social-api', {
    body,
    headers: {
      'x-wallet-address': wallet.toLowerCase(),
      'x-dehub-token': token,
    },
  });

  if (error) {
    throw new SocialEdgeError(error.message || 'Edge function failed');
  }

  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload && typeof payload === 'object' && payload.ok === false && payload.error) {
    throw new SocialEdgeError(String(payload.error));
  }

  return data as T;
}
