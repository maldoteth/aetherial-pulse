/**
 * Invite session helpers
 * ======================
 * Shared accessors for the PasswordGate's session ID + redeemed code.
 * Mirrors the dual-storage strategy (localStorage + cookie) used in
 * `src/components/app/PasswordGate.tsx` so the auth flow can silently
 * attach the user's wallet to the redemption row on first login.
 */

const SESSION_KEY = "dehub_access_session";
const ATTACHED_PREFIX = "dehub_access_attached_";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignored — storage may be blocked
  }
}

function readCookie(key: string): string | null {
  if (typeof document === "undefined") return null;
  const encodedKey = encodeURIComponent(key);
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    const sep = part.indexOf("=");
    const name = sep >= 0 ? part.slice(0, sep) : part;
    if (name === encodedKey) {
      return decodeURIComponent(sep >= 0 ? part.slice(sep + 1) : "");
    }
  }
  return null;
}

export function getInviteSessionId(): string | null {
  return readStorage(SESSION_KEY) || readCookie(SESSION_KEY) || null;
}

export function hasAttachedInvite(wallet: string): boolean {
  const key = ATTACHED_PREFIX + wallet.toLowerCase();
  return readStorage(key) === "true";
}

export function markInviteAttached(wallet: string) {
  const key = ATTACHED_PREFIX + wallet.toLowerCase();
  writeStorage(key, "true");
}
