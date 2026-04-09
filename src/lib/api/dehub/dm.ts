import { supabase } from '@/integrations/supabase/client';
import { getAuthToken } from './core';
import { getAccountInfo } from './users';
import type { DeHubUser, DeHubNFT } from './types';

// ─── Legacy types (kept for backward compat with GroupSettingsDrawer etc.) ────

export type DMMessageType = 'text' | 'image' | 'gif' | 'audio' | 'video' | 'tip';

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  creatorAddress: string;
  memberCount: number;
  members?: DeHubUser[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeHubConversation {
  id: string;
  participants: DeHubUser[];
  lastMessage?: DeHubDMMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  otherUser?: DeHubUser;
  groupInfo?: GroupInfo;
  isGroup?: boolean;
  isBlocked?: boolean;
  dmFee?: DmFee;
}

export interface DeHubDMMessage {
  id: string;
  conversationId: string;
  sender: DeHubUser;
  content: string;
  type: DMMessageType;
  mediaUrl?: string;
  createdAt: string;
  readAt?: string;
  tipAmount?: number;
  tipCurrency?: string;
  duration?: number;
}

// ─── New types (DeHub DM API v2) ──────────────────────────────────────────────

export type DmMsgType = 'msg' | 'media' | 'gif' | 'voice' | 'tip';

export interface DmSender {
  _id: string;
  username: string;
  address: string;
  displayName: string;
  avatarImageUrl: string;
}

export interface ReplyPreview {
  _id: string;
  content: string;
  msgType: DmMsgType;
  mediaUrls: Array<{ url: string; type: string; mimeType: string }>;
  voiceDuration: number | null;
  sender: DmSender;
}

export interface DmMessage {
  _id: string;
  conversation: string;
  sender: DmSender;
  content: string;
  msgType: DmMsgType;
  mediaUrls: Array<{ url: string; type: string; mimeType?: string }>;
  uploadStatus?: 'pending' | 'success' | 'failed' | 'simple';
  voiceDuration: number | null;
  isRead: boolean;
  isEdited: boolean;
  editedAt: string | null;
  isForwarded: boolean;
  replyTo: ReplyPreview | null;
  paymentStatus: null | 'pending' | 'confirmed';
  paymentTxHash: string | null;
  tipAmount: number | null;
  tipSymbol: string | null;
  isDeleted: boolean;
  author: 'me' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface DmFee {
  required: boolean;
  fee: number;
  hasFreeAccess: boolean;
}

export interface DmConversation {
  _id: string;
  participants: Array<{ participant: DmSender; role: string }>;
  lastMessageAt: string;
  unreadCount: number;
  messages: DmMessage[];
  tips: unknown[];
  dmFee?: DmFee;
  otherUser?: DmSender;
}

export interface UserOnlineStatus {
  address: string;
  online: boolean;
  lastSeen?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalizeDmSender(raw: any): DeHubUser {
  return {
    _id: raw?._id || raw?.id || '',
    address: raw?.address || '',
    username: raw?.username,
    displayName: raw?.displayName || raw?.display_name,
    display_name: raw?.display_name || raw?.displayName,
    avatarImageUrl: raw?.avatarImageUrl || raw?.avatarUrl,
    avatarUrl: raw?.avatarUrl || raw?.avatarImageUrl,
    isVerified: raw?.isVerified || raw?.is_verified,
    is_verified: raw?.is_verified || raw?.isVerified,
    badgeBalance: raw?.badgeBalance,
  };
}

function mapDmMessageToLegacy(msg: any): DeHubDMMessage {
  const msgType: DMMessageType =
    msg.msgType === 'msg' ? 'text' :
    msg.msgType === 'media' ? 'image' :
    msg.msgType === 'voice' ? 'audio' :
    (msg.msgType || msg.type || 'text') as DMMessageType;

  return {
    id: msg._id || msg.id || `msg-${Date.now()}`,
    conversationId: msg.conversation || msg.conversationId || '',
    sender: normalizeDmSender(msg.sender),
    content: msg.content || '',
    type: msgType,
    mediaUrl: msg.mediaUrls?.[0]?.url || msg.mediaUrl,
    createdAt: msg.createdAt || new Date().toISOString(),
    readAt: msg.isRead ? (msg.updatedAt || msg.createdAt) : undefined,
    tipAmount: msg.tipAmount || undefined,
    duration: msg.voiceDuration || undefined,
  };
}

/** Map a raw API conversation item to DeHubConversation for UI compatibility. */
function mapApiConversationToDeHub(item: any, myAddress: string): DeHubConversation {
  const id = item._id || item.id;

  // Participants: handle both {participant, role}[] and flat DeHubUser[]
  let participants: DeHubUser[] = [];
  if (Array.isArray(item.participants)) {
    if (item.participants[0]?.participant) {
      participants = item.participants.map((p: any) => normalizeDmSender(p.participant));
    } else {
      participants = item.participants.map((p: any) => normalizeDmSender(p));
    }
  }

  // otherUser: from field or derived from participants
  let otherUser: DeHubUser | undefined = item.otherUser
    ? normalizeDmSender(item.otherUser)
    : participants.find(p => p.address?.toLowerCase() !== myAddress.toLowerCase());

  // lastMessage: from field or derive from messages array
  let lastMessage: DeHubDMMessage | undefined;
  if (item.lastMessage) {
    lastMessage = mapDmMessageToLegacy(item.lastMessage);
  } else if (Array.isArray(item.messages) && item.messages.length > 0) {
    // messages array is newest-first or oldest-first; take the most recent
    const sorted = [...item.messages].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    lastMessage = mapDmMessageToLegacy(sorted[0]);
  }

  // Enrich/derive otherUser from message sender data when participant data is incomplete
  // The API contacts endpoint sometimes returns only 1 participant (the current user),
  // leaving otherUser undefined — recover it from message senders.
  if (Array.isArray(item.messages) && item.messages.length > 0) {
    // Find any message whose sender is NOT the current user
    const otherSenderMsg = item.messages.find(
      (m: any) => m.sender?.address?.toLowerCase() !== myAddress.toLowerCase()
    );
    if (otherSenderMsg?.sender) {
      const enriched = normalizeDmSender(otherSenderMsg.sender);
      if (!otherUser) {
        otherUser = enriched;
      } else {
        if (!otherUser.displayName && enriched.displayName) otherUser.displayName = enriched.displayName;
        if (!otherUser.display_name && enriched.display_name) otherUser.display_name = enriched.display_name;
        if (!otherUser.avatarImageUrl && enriched.avatarImageUrl) otherUser.avatarImageUrl = enriched.avatarImageUrl;
        if (otherUser.badgeBalance == null && enriched.badgeBalance != null) otherUser.badgeBalance = enriched.badgeBalance;
      }
    }
  }

  return {
    id,
    participants,
    otherUser,
    lastMessage,
    unreadCount: item.unreadCount || 0,
    createdAt: item.createdAt || item.lastMessageAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.lastMessageAt || new Date().toISOString(),
    isGroup: item.isGroup || false,
    isBlocked: item.isBlocked || false,
    groupInfo: item.groupInfo,
    dmFee: item.dmFee,
  };
}

function parseDmMessage(raw: any, myAddress: string): DmMessage {
  const msgType: DmMsgType =
    raw.msgType === 'text' ? 'msg' :
    raw.msgType === 'image' ? 'media' :
    raw.msgType === 'audio' ? 'voice' :
    (raw.msgType || 'msg') as DmMsgType;

  const senderAddr = raw.sender?.address?.toLowerCase() || '';
  const author: 'me' | 'other' = senderAddr === myAddress.toLowerCase() ? 'me' : 'other';

  return {
    _id: raw._id || raw.id || `msg-${Date.now()}`,
    conversation: raw.conversation || raw.conversationId || '',
    sender: {
      _id: raw.sender?._id || raw.sender?.id || '',
      username: raw.sender?.username || '',
      address: raw.sender?.address || '',
      displayName: raw.sender?.displayName || raw.sender?.display_name || '',
      avatarImageUrl: raw.sender?.avatarImageUrl || raw.sender?.avatarUrl || '',
    },
    content: raw.content || '',
    msgType,
    mediaUrls: Array.isArray(raw.mediaUrls) ? raw.mediaUrls : [],
    uploadStatus: raw.uploadStatus ?? undefined,
    voiceDuration: raw.voiceDuration ?? null,
    isRead: raw.isRead ?? false,
    isEdited: raw.isEdited ?? false,
    editedAt: raw.editedAt ?? null,
    isForwarded: raw.isForwarded ?? false,
    replyTo: raw.replyTo ?? null,
    paymentStatus: raw.paymentStatus ?? null,
    paymentTxHash: raw.paymentTxHash ?? null,
    tipAmount: raw.tipAmount ?? null,
    tipSymbol: raw.tipSymbol ?? null,
    isDeleted: raw.isDeleted ?? false,
    author,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

// ─── Contacts & Conversations ─────────────────────────────────────────────────
// All DM functions are stubbed — will be migrated to Lovable Cloud tables.

export async function getContacts(
  address: string,
  page: number = 0,
  limit: number = 50
): Promise<DeHubConversation[]> {
  if (!address) return [];
  console.log('[DM API] getContacts — not yet migrated, returning empty');
  return [];
}

export async function getConversations(
  page: number = 0,
  limit: number = 20,
  searchQuery?: string
): Promise<{ items: DeHubConversation[]; totalCount: number; hasMore: boolean }> {
  console.log('[DM API] getConversations — not yet migrated');
  const token = getAuthToken();
  if (!token) return { items: [], totalCount: 0, hasMore: false };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userAddress = payload.address?.toLowerCase();
    if (!userAddress) return { items: [], totalCount: 0, hasMore: false };
    const items = await getContacts(userAddress, page, limit);
    return { items, totalCount: items.length, hasMore: items.length >= limit };
  } catch {
    return { items: [], totalCount: 0, hasMore: false };
  }
}

export async function getConversation(conversationId: string): Promise<DeHubConversation> {
  if (conversationId.startsWith('new_')) {
    const address = conversationId.replace('new_', '');
    return {
      id: conversationId,
      participants: [{ address } as any],
      otherUser: { address } as any,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  // Stub — return empty conversation
  return {
    id: conversationId,
    participants: [],
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function createConversation(
  recipientAddress: string,
  recipientUser?: Partial<DeHubUser>
): Promise<DeHubConversation> {
  const otherUser: DeHubUser = recipientUser ? {
    _id: recipientUser._id || recipientAddress,
    address: recipientAddress,
    username: recipientUser.username,
    displayName: recipientUser.displayName || recipientUser.display_name,
    avatarImageUrl: recipientUser.avatarImageUrl || recipientUser.avatarUrl,
    isVerified: recipientUser.isVerified || recipientUser.is_verified,
    dmSettings: (recipientUser as any).dmSettings,
  } : {
    _id: recipientAddress,
    address: recipientAddress,
  };

  return {
    id: `new_${recipientAddress}`,
    participants: [otherUser],
    otherUser,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteConversation(
  dmId: string,
  _address?: string
): Promise<{ success: boolean }> {
  console.log('[DM API] deleteConversation — stub');
  return { success: true };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  page: number = 0,
  limit: number = 30
): Promise<{ items: DmMessage[]; totalCount: number; hasMore: boolean }> {
  console.log('[DM API] getMessages — not yet migrated');
  return { items: [], totalCount: 0, hasMore: false };
}

export async function uploadAndSendMedia(
  file: File,
  conversationId: string,
  senderId: string,
  opts?: {
    content?: string;
    msgType?: 'media' | 'voice';
    voiceDuration?: number;
    replyTo?: string;
    txHash?: string;
  }
): Promise<DmMessage> {
  console.warn('[DM API] uploadAndSendMedia — not yet migrated');
  throw new Error('DM media upload not yet migrated');
}

export async function uploadChatImage(file: File): Promise<{ url: string }> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required');

  const walletAddress = localStorage.getItem('dehub_wallet');
  if (!walletAddress) throw new Error('Wallet address not found');

  const formData = new FormData();
  formData.append('file', file, file.name);

  const { data, error } = await supabase.functions.invoke('dm-upload-media', {
    body: formData,
    headers: {
      'x-wallet-address': walletAddress.toLowerCase(),
      'x-dehub-token': token,
    },
  });

  if (error) throw error;
  if (!data?.ok || !data?.url) throw new Error(data?.error || 'Upload failed — no URL returned');

  return { url: data.url };
}

export async function markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
  return { success: true };
}

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchUsersForDM(
  query: string,
  _page: number = 0,
  limit: number = 10
): Promise<{ items: DeHubUser[]; hasMore: boolean }> {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) return { items: [], hasMore: false };

  // Search profiles table in Supabase
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_address, username, display_name, avatar_url, is_verified')
      .or(`username.ilike.%${trimmedQuery}%,display_name.ilike.%${trimmedQuery}%,wallet_address.ilike.%${trimmedQuery}%`)
      .limit(limit);

    if (error) throw error;

    const items: DeHubUser[] = (data || []).map((p: any) => ({
      _id: p.wallet_address,
      address: p.wallet_address,
      username: p.username,
      displayName: p.display_name,
      display_name: p.display_name,
      avatarImageUrl: p.avatar_url,
      avatarUrl: p.avatar_url,
      isVerified: p.is_verified,
      is_verified: p.is_verified,
    }));

    return { items, hasMore: items.length >= limit };
  } catch (error) {
    console.error('[DM API] searchUsersForDM failed:', error);
    return { items: [], hasMore: false };
  }
}

// ─── Block / Unblock ──────────────────────────────────────────────────────────

export async function blockConversation(_conversationId: string): Promise<{ success: boolean }> {
  console.log('[DM API] blockConversation — stub');
  return { success: true };
}

export async function unblockConversation(_conversationId: string): Promise<{ success: boolean }> {
  console.log('[DM API] unblockConversation — stub');
  return { success: true };
}

// ─── Group Chat ───────────────────────────────────────────────────────────────

const GROUP_NOT_SUPPORTED = 'Group chat is not supported. DMs are 1:1 only.';

export async function createGroup(
  _name: string,
  _memberAddresses: string[],
  _description?: string
): Promise<DeHubConversation> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

export async function getGroupInfo(_groupId: string): Promise<GroupInfo> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

export async function joinGroup(_groupId: string): Promise<{ success: boolean }> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

export async function updateGroup(
  _groupId: string,
  _updates: { name?: string; description?: string; avatarUrl?: string }
): Promise<GroupInfo> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

export async function leaveGroup(_groupId: string): Promise<{ success: boolean }> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

export async function blockUserInGroup(
  _groupId: string,
  _userAddress: string
): Promise<{ success: boolean }> {
  throw new Error(GROUP_NOT_SUPPORTED);
}

// ─── User Status ──────────────────────────────────────────────────────────────

export async function getDMContacts(
  _address: string,
  _page: number = 0,
  _limit: number = 10
): Promise<{ items: DeHubUser[]; hasMore: boolean }> {
  return { items: [], hasMore: false };
}

export async function getDMUserStatus(_address: string): Promise<{ online: boolean; lastSeen?: string }> {
  return { online: false };
}

export async function getUserOnlineStatus(address: string): Promise<UserOnlineStatus> {
  return { address, online: false };
}

// ─── Subscription-gated DMs ───────────────────────────────────────────────────

export async function getDMPlanSettings(_planId: string): Promise<{
  enabled: boolean;
  minTipDhb?: number;
  allowedMessageTypes?: DMMessageType[];
}> {
  return { enabled: true };
}

// ─── DM Videos ────────────────────────────────────────────────────────────────

export async function getDMVideos(
  _page: number = 0,
  _limit: number = 20
): Promise<{ items: DeHubNFT[]; hasMore: boolean }> {
  return { items: [], hasMore: false };
}

// ─── Free DM Access ───────────────────────────────────────────────────────────

export interface FreeAccessUser {
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  grantedAt?: string;
}

export async function grantFreeDmAccess(_targetAddress: string): Promise<{ success: boolean }> {
  console.log('[DM API] grantFreeDmAccess — stub');
  return { success: true };
}

export async function revokeFreeDmAccess(_targetAddress: string): Promise<{ success: boolean }> {
  console.log('[DM API] revokeFreeDmAccess — stub');
  return { success: true };
}

export async function getFreeDmAccessList(): Promise<FreeAccessUser[]> {
  return [];
}
