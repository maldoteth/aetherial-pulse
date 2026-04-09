/**
 * Fansite API Core
 * ================
 * Replaces the former DeHub API layer. Media URLs now point to Cloudflare R2.
 * Auth token management is preserved for wallet-based sessions.
 */

// Cloudflare R2 public URL for media assets (set via edge function secret)
export const DEHUB_CDN_BASE = ""; // Will be replaced with R2_PUBLIC_URL

// API base — no longer used for external calls; kept for type compatibility
export const DEHUB_API_BASE = "";

/**
 * Convert relative media paths to absolute CDN URLs
 * Now a no-op passthrough since we'll use R2 URLs directly
 */
export function getMediaUrl(relativePath?: string): string | undefined {
  if (!relativePath) return undefined;
  if (relativePath.startsWith("data:") || relativePath.startsWith("blob:")) {
    return relativePath;
  }
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  // For now return the path as-is; R2 URLs will be full URLs
  return relativePath;
}

/**
 * Custom error class for authentication failures.
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ── Token Storage ──

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("dehub_token", token);
  } else {
    localStorage.removeItem("dehub_token");
  }
};

export const setRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("dehub_refresh_token", token);
  } else {
    localStorage.removeItem("dehub_refresh_token");
  }
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem("dehub_refresh_token");
};

export const setTokenExpiresAt = (expiresInSeconds: number) => {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem("dehub_token_expires_at", String(expiresAt));
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem("dehub_token");
};

export const isTokenExpired = (): boolean => {
  const expiresAt = localStorage.getItem("dehub_token_expires_at");
  if (expiresAt) {
    return Date.now() >= parseInt(expiresAt, 10);
  }
  const timestamp = localStorage.getItem("dehub_token_timestamp");
  if (!timestamp) return true;
  const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
  return Date.now() - parseInt(timestamp, 10) >= TOKEN_EXPIRY_MS;
};

export const clearAuthSession = () => {
  localStorage.removeItem("dehub_token");
  localStorage.removeItem("dehub_token_timestamp");
  localStorage.removeItem("dehub_token_expires_at");
  localStorage.removeItem("dehub_refresh_token");
  localStorage.removeItem("dehub_wallet");
};

/**
 * Stub API call — returns empty data for all endpoints.
 * Features will be progressively migrated to Lovable Cloud (Supabase).
 */
export async function apiCall<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: Record<string, unknown>;
    params?: Record<string, string | number | undefined>;
    requiresAuth?: boolean;
    _retry?: boolean;
  } = {},
): Promise<T> {
  console.warn(`[Fansite] API call to ${endpoint} — not yet migrated to Lovable Cloud`);
  // Return empty object; callers handle missing data gracefully
  return {} as T;
}
