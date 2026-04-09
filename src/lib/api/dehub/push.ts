/**
 * Fansite Push Notifications — Stub
 */

export interface PushDevice { deviceId: string; platform: string; token: string; createdAt: string; lastUsedAt?: string; }
export interface PushPreferences {
  likes: boolean; comments: boolean; follows: boolean; mentions: boolean;
  directMessages: boolean; liveStreams: boolean; tips: boolean; subscriptions: boolean;
  [key: string]: boolean;
}

export async function registerPushToken(params: any): Promise<{ result: boolean }> { return { result: true }; }
export async function unregisterPushToken(deviceId: string): Promise<{ result: boolean }> { return { result: true }; }
export async function unregisterAllPushTokens(): Promise<{ result: boolean }> { return { result: true }; }
export async function getRegisteredDevices(): Promise<PushDevice[]> { return []; }
export async function getPushPreferences(): Promise<PushPreferences> {
  return { likes: true, comments: true, follows: true, mentions: true, directMessages: true, liveStreams: true, tips: true, subscriptions: true };
}
export async function updatePushPreferences(preferences: Partial<PushPreferences>): Promise<{ result: boolean }> { return { result: true }; }
export async function resetPushPreferences(): Promise<{ result: boolean }> { return { result: true }; }
