/**
 * Fansite Auth — Stub
 * Auth is handled via Web3Auth/Wagmi; these functions are stubs.
 */
import { supabase } from '@/integrations/supabase/client';
import { setAuthToken, setRefreshToken, setTokenExpiresAt, getRefreshToken, getAuthToken, clearAuthSession } from './core';
import type { AuthResponse } from './types';

export interface UsernameCheckResponse {
  status: boolean;
  available: boolean;
  message?: string;
}

export interface Web3AuthMeta {
  email?: string;
  name?: string;
  profileImage?: string;
  typeOfLogin?: string;
  verifier?: string;
  verifierId?: string;
  aggregateVerifier?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function checkUsernameAvailability(username: string): Promise<UsernameCheckResponse> {
  if (!username || username.length < 3) {
    return { status: true, available: false, message: 'Username too short' };
  }

  // 1. Try via Edge Function (for consistency with profile.update)
  try {
    const response = await invokeDehubSocialApi<{ ok: boolean; available: boolean }>({
      action: 'profile.check_username',
      username: username.toLowerCase(),
    });

    if (response) {
      return { 
        status: true, 
        available: !!response.available, 
        message: response.available ? 'Available' : 'Username taken' 
      };
    }
  } catch (err) {
    console.warn('[Auth] Edge check failed, falling back to direct DB check:', err);
  }

  // 2. Fallback to direct Supabase check if Edge Function is missing or fails (auth issues)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Direct username check failed:', error);
      return { status: false, available: false, message: 'Database error' };
    }

    return { 
      status: true, 
      available: !data, 
      message: !data ? 'Available' : 'Username already taken' 
    };
  } catch (err) {
    console.error('[Auth] Username check exception:', err);
    return { status: false, available: false, message: 'Internal error' };
  }
}

export async function checkUsernameAvailabilityPost(username: string): Promise<UsernameCheckResponse> {
  return checkUsernameAvailability(username);
}

export async function authenticateWallet(
  address: string,
  signature: string,
  message: string,
  isMobile?: boolean,
  web3AuthMeta?: Web3AuthMeta,
): Promise<AuthResponse> {
  console.warn('[Fansite] authenticateWallet — stub');
  return {
    status: true,
    token: '',
    user: { address },
    result: { address, isMobile: !!isMobile, lastLoginTimestamp: Date.now(), tokenExpiry: '' },
    message: 'Stub auth',
  };
}

export async function refreshAccessToken(): Promise<RefreshTokenResponse | null> {
  console.warn('[Fansite] refreshAccessToken — stub');
  return null;
}

export async function logoutFromServer(): Promise<void> {
  clearAuthSession();
}

export async function logoutAllSessions(): Promise<void> {
  clearAuthSession();
}
