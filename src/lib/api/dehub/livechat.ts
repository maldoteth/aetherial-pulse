/**
 * Fansite LiveChat — Supabase-backed public chat
 * Uses community_chat_messages table with a "public" community fallback
 */
import { supabase } from '@/integrations/supabase/client';

export interface LiveChatRoom {
  id: string;
  roomId?: string;
  name?: string;
  topic?: string;
  description?: string;
  roomType?: string;
  participantCount?: number;
  activeUsers?: number;
  messageCount?: number;
  createdAt?: string;
  settings?: Record<string, unknown>;
  moderators?: string[];
  slowMode?: boolean;
  slowModeSeconds?: number;
  subscribersOnly?: boolean;
  minStakeRequired?: number;
  pinnedMessages?: string[];
}

export interface LiveChatMessage {
  id: string;
  roomId: string;
  content: string;
  type?: 'text' | 'image' | 'gif';
  messageType?: string;
  imageUrl?: string;
  sender: {
    address: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    avatarImageUrl?: string;
    isModerator?: boolean;
    isBanned?: boolean;
    followers?: number;
    followings?: number;
    badgeBalance?: number;
  };
  reactions?: Record<string, unknown>;
  isPinned?: boolean;
  createdAt: string;
}

export interface LiveChatUserProfile {
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  isBanned?: boolean;
  isModerator?: boolean;
}

// Use a fixed "general" community ID for public chat — will be created on first use
const PUBLIC_CHAT_COMMUNITY_ID = 'general';

export async function getLiveChatRooms(): Promise<LiveChatRoom[]> {
  return [{ id: 'general', name: 'General', topic: 'Fansite Community Chat' }];
}

export async function getLiveChatRoom(roomId: string): Promise<LiveChatRoom> {
  return { id: roomId, name: 'Chat Room', topic: 'Fansite Community Chat' };
}

export async function getLiveChatMessages(
  _roomId: string,
  params?: { page?: number; limit?: number; before?: string; after?: string }
): Promise<LiveChatMessage[]> {
  // For now return empty — public chat will be wired to community_chat_messages later
  return [];
}

export async function getLiveChatUserProfile(address: string): Promise<LiveChatUserProfile> {
  const { data } = await supabase.from('profiles').select('username, display_name, avatar_url')
    .eq('wallet_address', address.toLowerCase()).maybeSingle();
  return {
    address,
    username: data?.username || undefined,
    displayName: data?.display_name || undefined,
    avatarImageUrl: data?.avatar_url || undefined,
  };
}

export async function getLiveChatOnlineCount(): Promise<number> {
  return 0;
}

export async function getLiveChatStatus(): Promise<Record<string, unknown>> {
  return {};
}

export async function sendLiveChatMessage(
  roomId: string,
  content: string,
  type: 'text' | 'image' | 'gif' | 'voice' = 'text',
  imageUrl?: string
): Promise<LiveChatMessage> {
  // Stub — will be wired to Supabase realtime later
  return {
    id: `temp-${Date.now()}`,
    roomId,
    content,
    messageType: type,
    sender: { address: '' },
    createdAt: new Date().toISOString(),
  };
}

export async function pinLiveChatMessage(_roomId: string, messageId: string): Promise<void> {}
export async function unpinLiveChatMessage(_roomId: string, messageId: string): Promise<void> {}
export async function banLiveChatUser(_roomId: string, userAddress: string): Promise<void> {}
export async function unbanLiveChatUser(_roomId: string, userAddress: string): Promise<void> {}
export async function addLiveChatModerator(_roomId: string, userAddress: string): Promise<void> {}

export async function createTopicRoom(params: { topic: string; description?: string }): Promise<LiveChatRoom> {
  return { id: 'topic-' + Date.now(), name: params.topic };
}

export async function updateLiveChatRoomSettings(
  _roomId: string,
  settings: Record<string, unknown>
): Promise<LiveChatRoom> {
  return { id: _roomId, name: 'Chat Room' };
}
