/**
 * Fansite Push Notification Preferences — Supabase-backed
 * Preferences are stored in profiles.customs.notificationPreferences (JSONB).
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';

export interface PushDevice {
  deviceId: string;
  platform: string;
  token: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PushPreferences {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  directMessages: boolean;
  liveStreams: boolean;
  tips: boolean;
  subscriptions: boolean;
  [key: string]: boolean;
}

const DEFAULT_PREFERENCES: PushPreferences = {
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  directMessages: true,
  liveStreams: true,
  tips: true,
  subscriptions: true,
};

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

export async function getPushPreferences(): Promise<PushPreferences> {
  const wallet = getWallet();
  if (!wallet) return { ...DEFAULT_PREFERENCES };

  const { data } = await withWalletHeader(
    supabase
      .from('profiles')
      .select('customs')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle(),
    wallet,
  );

  const stored = (data?.customs as Record<string, unknown> | null)?.notificationPreferences;
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PREFERENCES };

  // Merge stored values over defaults so new preference keys always have a value
  return { ...DEFAULT_PREFERENCES, ...(stored as Partial<PushPreferences>) };
}

export async function updatePushPreferences(
  preferences: Partial<PushPreferences>,
): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };

  // Read current customs to avoid overwriting other keys
  const { data } = await withWalletHeader(
    supabase
      .from('profiles')
      .select('customs')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle(),
    wallet,
  );

  const existingCustoms = (data?.customs as Record<string, unknown>) ?? {};
  const existingPrefs =
    typeof existingCustoms.notificationPreferences === 'object' &&
    existingCustoms.notificationPreferences !== null
      ? (existingCustoms.notificationPreferences as Record<string, boolean>)
      : {};

  const merged = { ...DEFAULT_PREFERENCES, ...existingPrefs, ...preferences };

  const { error } = await withWalletHeader(
    supabase
      .from('profiles')
      .upsert(
        {
          wallet_address: wallet.toLowerCase(),
          customs: { ...existingCustoms, notificationPreferences: merged },
        },
        { onConflict: 'wallet_address' },
      ),
    wallet,
  );

  return { result: !error };
}

// The following functions are stubs — device token push (FCM/APNs) is not yet implemented.
export async function registerPushToken(_params: unknown): Promise<{ result: boolean }> {
  return { result: true };
}
export async function unregisterPushToken(_deviceId: string): Promise<{ result: boolean }> {
  return { result: true };
}
export async function unregisterAllPushTokens(): Promise<{ result: boolean }> {
  return { result: true };
}
export async function getRegisteredDevices(): Promise<PushDevice[]> {
  return [];
}
export async function resetPushPreferences(): Promise<{ result: boolean }> {
  return updatePushPreferences({ ...DEFAULT_PREFERENCES });
}
