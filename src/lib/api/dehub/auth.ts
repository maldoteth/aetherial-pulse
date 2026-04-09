/**
 * Fansite Auth — Stub
 * Auth is handled via Web3Auth/Wagmi; these functions are stubs.
 */
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
  console.warn('[Fansite] checkUsernameAvailability — stub');
  return { status: true, available: true };
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
