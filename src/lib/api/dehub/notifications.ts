/**
 * Fansite Notifications — Supabase-backed
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import type { DeHubUser, DeHubNFT } from './types';

export type NotificationType =
  | 'like' | 'comment' | 'comment_reply' | 'comment_like' | 'mention'
  | 'following' | 'follow_request' | 'tip' | 'subscription' | 'ppv_purchase'
  | 'video_milestone' | 'livestream_start' | 'video_removal'
  | 'post_like' | 'post_comment' | 'follow'
  | 'governance_comment' | 'governance_vote'
  | 'feature_request_like' | 'feature_request_comment'
  | 'fraction_offer' | 'fraction_offer_accepted' | 'fraction_offer_rejected';

export type NotificationCategory = 'engagement' | 'social' | 'monetization' | 'content' | 'system';
export type NotificationPostType = 'video' | 'feed-images' | 'feed-simple';

export interface DeHubNotification {
  _id: string;
  id: string;
  address: string;
  type: NotificationType;
  category: NotificationCategory;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  actorAddress?: string;
  actorUsername?: string;
  actorAvatar?: string;
  tokenId?: number;
  tokenTitle?: string;
  tokenThumbnail?: string;
  postType?: NotificationPostType;
  aggregatedCount?: number;
  latestActorNames?: string[];
  amount?: number;
  currency?: string;
  actor?: DeHubUser;
  post?: DeHubNFT;
}

function categorizeType(type: string): NotificationCategory {
  if (['post_like', 'like', 'comment', 'post_comment', 'comment_reply', 'comment_like', 'mention'].includes(type)) return 'engagement';
  if (['follow', 'following', 'follow_request'].includes(type)) return 'social';
  if (['tip', 'subscription', 'ppv_purchase', 'fraction_offer', 'fraction_offer_accepted', 'fraction_offer_rejected'].includes(type)) return 'monetization';
  return 'system';
}

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

export async function getNotifications(
  page: number = 1,
  limit: number = 30,
  category?: NotificationCategory,
  unreadOnly: boolean = false
): Promise<{ items: DeHubNotification[]; totalCount: number; hasMore: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { items: [], totalCount: 0, hasMore: false };

  const from = (page - 1) * limit;
  let query = supabase.from('custom_notifications').select('*', { count: 'exact' })
    .eq('recipient_address', wallet.toLowerCase())
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (unreadOnly) query = query.eq('read', false);

  const { data, count } = await withWalletHeader(query, wallet);
  
  const items: DeHubNotification[] = (data || []).map((n: any) => ({
    _id: n.id,
    id: n.id,
    address: n.recipient_address,
    type: n.type as NotificationType,
    category: categorizeType(n.type),
    content: n.content || '',
    read: n.read,
    createdAt: n.created_at,
    updatedAt: n.created_at,
    actorAddress: n.actor_address,
    actorUsername: n.actor_username,
    actorAvatar: n.actor_avatar,
    tokenId: n.reference_id ? Number(n.reference_id) : undefined,
    tokenTitle: n.reference_title,
  }));

  if (category) {
    const filtered = items.filter(i => i.category === category);
    return { items: filtered, totalCount: filtered.length, hasMore: false };
  }

  return { items, totalCount: count || 0, hasMore: (count || 0) > page * limit };
}

export interface UnreadNotificationCount {
  total: number;
  byCategory: { engagement: number; social: number; monetization: number; content: number; system: number };
}

export async function getUnreadNotificationCount(): Promise<UnreadNotificationCount> {
  const wallet = getWallet();
  if (!wallet) return { total: 0, byCategory: { engagement: 0, social: 0, monetization: 0, content: 0, system: 0 } };

  const { count } = await withWalletHeader(
    supabase.from('custom_notifications').select('*', { count: 'exact', head: true })
      .eq('recipient_address', wallet.toLowerCase()).eq('read', false),
    wallet
  );

  return { total: count || 0, byCategory: { engagement: 0, social: 0, monetization: 0, content: 0, system: 0 } };
}

export async function markNotificationAsRead(notificationId: string): Promise<{ message: string }> {
  const wallet = getWallet();
  if (!wallet) return { message: 'Not authenticated' };
  await withWalletHeader(
    supabase.from('custom_notifications').update({ read: true }).eq('id', notificationId),
    wallet
  );
  return { message: 'Marked as read' };
}

export async function markAllNotificationsAsRead(category?: NotificationCategory): Promise<{ message: string; count: number }> {
  const wallet = getWallet();
  if (!wallet) return { message: 'Not authenticated', count: 0 };
  const { count } = await withWalletHeader(
    supabase.from('custom_notifications').update({ read: true })
      .eq('recipient_address', wallet.toLowerCase()).eq('read', false),
    wallet
  );
  return { message: 'All marked as read', count: count || 0 };
}
