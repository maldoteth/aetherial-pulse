import { supabase } from '@/integrations/supabase/client';
import type { DeHubUser, DeHubNFT } from './types';
import { getAuthToken } from './core';
import { invokeDehubPlatformApi } from './social-edge-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DMMessageType = 'text' | 'image' | 'gif' | 'audio' | 'video' | 'tip';
export type DmMsgType = 'msg' | 'media' | 'gif' | 'voice' | 'tip';

export interface GroupInfo {
  id: string; name: string; description?: string; avatarUrl?: string;
  creatorAddress: string; memberCount: number; members?: DeHubUser[];
  isPublic?: boolean; createdAt: string; updatedAt: string;
}

export interface DeHubConversation {
  id: string; participants: DeHubUser[]; lastMessage?: DeHubDMMessage;
  unreadCount: number; createdAt: string; updatedAt: string;
  otherUser?: DeHubUser; groupInfo?: GroupInfo; isGroup?: boolean;
  isBlocked?: boolean; dmFee?: DmFee;
}

export interface DeHubDMMessage {
  id: string; conversationId: string; sender: DeHubUser; content: string;
  type: DMMessageType; mediaUrl?: string; createdAt: string; readAt?: string;
  tipAmount?: number; tipCurrency?: string; duration?: number;
}

export interface DmSender {
  _id: string; username: string; address: string;
  displayName: string; avatarImageUrl: string;
}

export interface ReplyPreview {
  _id: string; content: string; msgType: DmMsgType;
  mediaUrls: Array<{ url: string; type: string; mimeType: string }>;
  voiceDuration: number | null; sender: DmSender;
}

export interface DmMessage {
  _id: string; conversation: string; sender: DmSender; content: string;
  msgType: DmMsgType; mediaUrls: Array<{ url: string; type: string; mimeType?: string }>;
  uploadStatus?: 'pending' | 'success' | 'failed' | 'simple';
  voiceDuration: number | null; isRead: boolean; isEdited: boolean;
  editedAt: string | null; isForwarded: boolean; replyTo: ReplyPreview | null;
  paymentStatus: null | 'pending' | 'confirmed'; paymentTxHash: string | null;
  tipAmount: number | null; tipSymbol: string | null; isDeleted: boolean;
  author: 'me' | 'other'; createdAt: string; updatedAt: string;
}

export interface DmFee { required: boolean; fee: number; hasFreeAccess: boolean; }

export interface DmConversation {
  _id: string; participants: Array<{ participant: DmSender; role: string }>;
  lastMessageAt: string; unreadCount: number; messages: DmMessage[];
  tips: unknown[]; dmFee?: DmFee; otherUser?: DmSender;
}

export interface UserOnlineStatus { address: string; online: boolean; lastSeen?: string; }

export interface FreeAccessUser {
  address: string; username?: string; displayName?: string;
  avatarImageUrl?: string; grantedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

function profileToUser(p: any): DeHubUser {
  return {
    _id: p.wallet_address || p.id,
    address: p.wallet_address,
    username: p.username,
    displayName: p.display_name,
    display_name: p.display_name,
    avatarImageUrl: p.avatar_url,
    avatarUrl: p.avatar_url,
    isVerified: p.is_verified,
    is_verified: p.is_verified,
  };
}

function dbMsgToDmMessage(row: any, myAddress: string): DmMessage {
  const senderAddr = (row.sender_address || '').toLowerCase();
  return {
    _id: row.id,
    conversation: row.conversation_id,
    sender: {
      _id: row.sender_address,
      username: row.sender_profile?.username || '',
      address: row.sender_address,
      displayName: row.sender_profile?.display_name || '',
      avatarImageUrl: row.sender_profile?.avatar_url || '',
    },
    content: row.content || '',
    msgType: (row.msg_type || 'msg') as DmMsgType,
    mediaUrls: row.media_url ? [{ url: row.media_url, type: 'image' }] : [],
    voiceDuration: row.voice_duration ?? null,
    isRead: row.is_read ?? false,
    isEdited: false,
    editedAt: null,
    isForwarded: false,
    replyTo: null,
    paymentStatus: null,
    paymentTxHash: null,
    tipAmount: row.tip_amount ?? null,
    tipSymbol: null,
    isDeleted: row.is_deleted ?? false,
    author: senderAddr === myAddress.toLowerCase() ? 'me' : 'other',
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

// ─── Contacts & Conversations ─────────────────────────────────────────────────

export async function getContacts(
  address: string, page: number = 0, limit: number = 50
): Promise<DeHubConversation[]> {
  if (!address) return [];

  const res = await invokeDehubPlatformApi<{ items: any[] }>({
    action: 'dm.conversations.list',
    page,
    limit,
  });

  if (!res.items?.length) return [];

  return res.items.map((item: any) => {
    const profile = item.other_profile;
    const otherUser: DeHubUser = profile
      ? profileToUser(profile)
      : { _id: item.other_address, address: item.other_address } as DeHubUser;

    const lastMsg = item.last_message;

    return {
      id: item.id,
      participants: [otherUser],
      otherUser,
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        conversationId: item.id,
        sender: otherUser,
        content: lastMsg.content,
        type: (lastMsg.msg_type === 'media' ? 'image' : lastMsg.msg_type === 'gif' ? 'gif' : 'text') as any,
        createdAt: lastMsg.created_at,
      } : undefined,
      unreadCount: item.unread_count || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  });
}

export async function getConversations(
  page: number = 0, limit: number = 20, searchQuery?: string
): Promise<{ items: DeHubConversation[]; totalCount: number; hasMore: boolean }> {
  const addr = getWallet();
  if (!addr) return { items: [], totalCount: 0, hasMore: false };
  const items = await getContacts(addr, page, limit);
  return { items, totalCount: items.length, hasMore: items.length >= limit };
}

export async function getConversation(conversationId: string): Promise<DeHubConversation> {
  if (conversationId.startsWith('new_')) {
    const address = conversationId.replace('new_', '');
    return {
      id: conversationId, participants: [{ address } as any],
      otherUser: { address } as any, unreadCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
  try {
    const res = await invokeDehubPlatformApi<{ conversation: any; other_profile: any }>({
      action: 'dm.conversation.get',
      conversationId,
    });
    const data = res.conversation;
    const profile = res.other_profile;
    const addr = getWallet();
    const otherAddr = data.participant_a.toLowerCase() === addr ? data.participant_b : data.participant_a;
    const otherUser = profile ? profileToUser(profile) : { _id: otherAddr, address: otherAddr } as DeHubUser;
    return {
      id: data.id, participants: [otherUser], otherUser, unreadCount: 0,
      createdAt: data.created_at, updatedAt: data.updated_at,
    };
  } catch {
    return { id: conversationId, participants: [], unreadCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
}

export async function createConversation(
  recipientAddress: string, recipientUser?: Partial<DeHubUser>
): Promise<DeHubConversation> {
  const myAddr = getWallet();
  const otherAddr = recipientAddress.toLowerCase();
  if (!myAddr) throw new Error('Not authenticated');

  const res = await invokeDehubPlatformApi<{ conversation: Record<string, string> }>({
    action: 'dm.conversation.create',
    recipientAddress: otherAddr,
  });
  const data = res.conversation;
  if (!data?.id) throw new Error('Failed to create conversation');

  const otherUser: DeHubUser = {
    _id: recipientAddress,
    address: recipientAddress,
    username: recipientUser?.username,
    displayName: recipientUser?.displayName || recipientUser?.display_name,
    avatarImageUrl: recipientUser?.avatarImageUrl || recipientUser?.avatarUrl,
    isVerified: recipientUser?.isVerified || recipientUser?.is_verified,
  };

  return {
    id: data.id, participants: [otherUser], otherUser, unreadCount: 0,
    createdAt: data.created_at, updatedAt: data.updated_at,
  };
}

export async function deleteConversation(dmId: string, _address?: string): Promise<{ success: boolean }> {
  // We don't actually delete — just return success
  return { success: true };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string, page: number = 0, limit: number = 30
): Promise<{ items: DmMessage[]; totalCount: number; hasMore: boolean }> {
  if (!conversationId || conversationId.startsWith('new_')) {
    return { items: [], totalCount: 0, hasMore: false };
  }

  const res = await invokeDehubPlatformApi<{
    items: any[]; totalCount: number; hasMore: boolean; myAddress: string;
  }>({
    action: 'dm.messages.list',
    conversationId,
    page,
    limit,
  });

  const myAddr = res.myAddress || getWallet();
  const items = (res.items || []).map(row => dbMsgToDmMessage(row, myAddr));
  return { items, totalCount: res.totalCount || 0, hasMore: res.hasMore || false };
}

export async function sendMessageToConversation(
  conversationId: string,
  content: string,
  msgType: DmMsgType = 'msg',
  opts?: {
    mediaUrl?: string;
    voiceDuration?: number;
    replyToId?: string;
    tipAmount?: number;
    paymentTxHash?: string;
  }
): Promise<DmMessage> {
  const myAddr = getWallet();
  if (!myAddr) throw new Error('Not authenticated');

  const res = await invokeDehubPlatformApi<{ message: Record<string, unknown> }>({
    action: 'dm.message.send',
    conversationId,
    content,
    msgType,
    mediaUrl: opts?.mediaUrl,
    voiceDuration: opts?.voiceDuration,
    replyToId: opts?.replyToId,
    tipAmount: opts?.tipAmount,
    paymentTxHash: opts?.paymentTxHash,
  });

  const row = res.message;
  if (!row) throw new Error('Failed to send message');

  return dbMsgToDmMessage(row, myAddr);
}

export async function uploadAndSendMedia(
  file: File, conversationId: string, senderId: string,
  opts?: { content?: string; msgType?: 'media' | 'voice'; voiceDuration?: number; replyTo?: string; txHash?: string }
): Promise<DmMessage> {
  const walletAddress = getWallet();
  if (!walletAddress) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file, file.name);

  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('dm-upload-media', {
    body: formData,
    headers: {
      'x-wallet-address': walletAddress,
      'x-dehub-token': token,
    },
  });

  if (error) throw error;
  if (!data?.ok || !data?.url) throw new Error(data?.error || 'Upload failed');

  return sendMessageToConversation(conversationId, opts?.content || '', opts?.msgType || 'media', {
    mediaUrl: data.url,
    voiceDuration: opts?.voiceDuration,
    replyToId: opts?.replyTo,
    paymentTxHash: opts?.txHash,
  });
}

export async function uploadChatImage(file: File): Promise<{ url: string }> {
  const walletAddress = getWallet();
  if (!walletAddress) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file, file.name);

  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('dm-upload-media', {
    body: formData,
    headers: {
      'x-wallet-address': walletAddress,
      'x-dehub-token': token,
    },
  });

  if (error) throw error;
  if (!data?.ok || !data?.url) throw new Error(data?.error || 'Upload failed');
  return { url: data.url };
}

export async function markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
  const myAddr = getWallet();
  if (!myAddr || !conversationId) return { success: false };

  try {
    await invokeDehubPlatformApi({ action: 'dm.messages.markRead', conversationId });
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchUsersForDM(
  query: string, _page: number = 0, limit: number = 10
): Promise<{ items: DeHubUser[]; hasMore: boolean }> {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) return { items: [], hasMore: false };

  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_address, username, display_name, avatar_url, is_verified')
    .or(`username.ilike.%${trimmedQuery}%,display_name.ilike.%${trimmedQuery}%,wallet_address.ilike.%${trimmedQuery}%`)
    .limit(limit);

  if (error) return { items: [], hasMore: false };
  const items = (data || []).map(profileToUser);
  return { items, hasMore: items.length >= limit };
}

// ─── Block / Unblock ──────────────────────────────────────────────────────────

export async function blockConversation(_conversationId: string): Promise<{ success: boolean }> {
  return { success: true };
}

export async function unblockConversation(_conversationId: string): Promise<{ success: boolean }> {
  return { success: true };
}

// ─── Group Chat (not supported — 1:1 only) ───────────────────────────────────

const GROUP_NOT_SUPPORTED = 'Group chat is not supported. DMs are 1:1 only.';
export async function createGroup(_n: string, _m: string[], _d?: string): Promise<DeHubConversation> { throw new Error(GROUP_NOT_SUPPORTED); }
export async function getGroupInfo(_id: string): Promise<GroupInfo> { throw new Error(GROUP_NOT_SUPPORTED); }
export async function joinGroup(_id: string): Promise<{ success: boolean }> { throw new Error(GROUP_NOT_SUPPORTED); }
export async function updateGroup(_id: string, _u: any): Promise<GroupInfo> { throw new Error(GROUP_NOT_SUPPORTED); }
export async function leaveGroup(_id: string): Promise<{ success: boolean }> { throw new Error(GROUP_NOT_SUPPORTED); }
export async function blockUserInGroup(_gid: string, _uid: string): Promise<{ success: boolean }> { throw new Error(GROUP_NOT_SUPPORTED); }

// ─── User Status ──────────────────────────────────────────────────────────────

export async function getDMContacts(_addr: string, _p?: number, _l?: number): Promise<{ items: DeHubUser[]; hasMore: boolean }> { return { items: [], hasMore: false }; }
export async function getDMUserStatus(_addr: string): Promise<{ online: boolean; lastSeen?: string }> { return { online: false }; }
export async function getUserOnlineStatus(address: string): Promise<UserOnlineStatus> { return { address, online: false }; }
export async function getDMPlanSettings(_planId: string): Promise<{ enabled: boolean }> { return { enabled: true }; }
export async function getDMVideos(_p?: number, _l?: number): Promise<{ items: DeHubNFT[]; hasMore: boolean }> { return { items: [], hasMore: false }; }
export async function grantFreeDmAccess(_addr: string): Promise<{ success: boolean }> { return { success: true }; }
export async function revokeFreeDmAccess(_addr: string): Promise<{ success: boolean }> { return { success: true }; }
export async function getFreeDmAccessList(): Promise<FreeAccessUser[]> { return []; }
