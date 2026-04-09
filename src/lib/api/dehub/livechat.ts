/**
 * Fansite LiveChat — Supabase-backed public chat
 * Uses community_chat_messages table with a fixed "public" community.
 */
import { supabase } from '@/integrations/supabase/client';

export interface LiveChatRoom {
  id: string; roomId?: string; name?: string; topic?: string; description?: string;
  roomType?: string; participantCount?: number; activeUsers?: number; messageCount?: number;
  createdAt?: string; settings?: Record<string, unknown>; moderators?: string[];
  slowMode?: boolean; slowModeSeconds?: number; subscribersOnly?: boolean;
  minStakeRequired?: number; pinnedMessages?: string[];
}

export interface LiveChatMessage {
  id: string; roomId: string; content: string; type?: 'text' | 'image' | 'gif';
  messageType?: string; imageUrl?: string;
  sender: {
    address: string; username?: string; displayName?: string; avatarUrl?: string;
    avatarImageUrl?: string; isModerator?: boolean; isBanned?: boolean;
    followers?: number; followings?: number; badgeBalance?: number;
  };
  reactions?: Record<string, unknown>; isPinned?: boolean; createdAt: string;
}

export interface LiveChatUserProfile {
  address: string; username?: string; displayName?: string;
  avatarImageUrl?: string; isBanned?: boolean; isModerator?: boolean;
}

// Use a fixed community for public chat — we'll ensure it exists
const PUBLIC_CHAT_COMMUNITY_ID = 'general';

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

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
  const limit = params?.limit || 50;
  const page = params?.page || 0;

  // Get the public community ID
  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', 'public-chat')
    .maybeSingle();

  if (!community) return [];

  let q = supabase
    .from('community_chat_messages')
    .select('*')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (params?.before) q = q.lt('created_at', params.before);
  if (params?.after) q = q.gt('created_at', params.after);

  const { data } = await q;

  return (data || []).map(row => ({
    id: row.id,
    roomId: 'general',
    content: row.content,
    type: row.message_type as any || 'text',
    messageType: row.message_type,
    imageUrl: row.image_url || undefined,
    sender: {
      address: row.wallet_address,
      username: row.username || undefined,
      displayName: row.display_name || undefined,
      avatarUrl: row.avatar_url || undefined,
      avatarImageUrl: row.avatar_url || undefined,
      badgeBalance: row.badge_balance ? Number(row.badge_balance) : undefined,
    },
    reactions: row.reactions as any,
    createdAt: row.created_at,
  }));
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

export async function getLiveChatOnlineCount(): Promise<number> { return 0; }
export async function getLiveChatStatus(): Promise<Record<string, unknown>> { return {}; }

export async function sendLiveChatMessage(
  roomId: string, content: string,
  type: 'text' | 'image' | 'gif' | 'voice' = 'text',
  imageUrl?: string
): Promise<LiveChatMessage> {
  const myAddr = getWallet();
  if (!myAddr) throw new Error('Not authenticated');

  // Ensure public-chat community exists
  let { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('slug', 'public-chat')
    .maybeSingle();

  if (!community) {
    // Create the public chat community
    const { data: newComm } = await supabase
      .from('communities')
      .insert({
        name: 'Public Chat',
        slug: 'public-chat',
        creator_wallet_address: myAddr,
        description: 'Global public chat room',
      })
      .select()
      .single();
    community = newComm;
  }

  if (!community) throw new Error('Could not create public chat room');

  // Get profile for sender info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('wallet_address', myAddr)
    .maybeSingle();

  const { data, error } = await supabase
    .from('community_chat_messages')
    .insert({
      community_id: community.id,
      wallet_address: myAddr,
      content,
      message_type: type,
      image_url: imageUrl,
      username: profile?.username,
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    roomId,
    content: data.content,
    messageType: data.message_type,
    sender: {
      address: myAddr,
      username: profile?.username || undefined,
      displayName: profile?.display_name || undefined,
      avatarUrl: profile?.avatar_url || undefined,
    },
    createdAt: data.created_at,
  };
}

export async function pinLiveChatMessage(_roomId: string, _messageId: string): Promise<void> {}
export async function unpinLiveChatMessage(_roomId: string, _messageId: string): Promise<void> {}
export async function banLiveChatUser(_roomId: string, _userAddress: string): Promise<void> {}
export async function unbanLiveChatUser(_roomId: string, _userAddress: string): Promise<void> {}
export async function addLiveChatModerator(_roomId: string, _userAddress: string): Promise<void> {}

export async function createTopicRoom(params: { topic: string; description?: string }): Promise<LiveChatRoom> {
  return { id: 'topic-' + Date.now(), name: params.topic };
}

export async function updateLiveChatRoomSettings(
  _roomId: string, settings: Record<string, unknown>
): Promise<LiveChatRoom> {
  return { id: _roomId, name: 'Chat Room' };
}
