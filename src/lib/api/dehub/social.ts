/**
 * Fansite Social — Live Supabase Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import { getAuthToken } from './core';
import { invokeDehubSocialApi } from './social-edge-client';
import type { DeHubNFT } from './types';

export interface VoteResponse {
  success: boolean;
  tokenId: number;
  voteType: 'for' | 'against' | null;
  totalVotes?: { for: number; against: number };
}

export interface FollowResponse {
  success: boolean;
  isFollowing: boolean;
  followerCount?: number;
}

export interface FollowRequestItem {
  id: string;
  _id?: string;
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  createdAt?: string;
}

export interface FollowListItem {
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isFollowing?: boolean;
  followsYou?: boolean;
}

export interface CommentLikeResponse {
  success: boolean;
  commentId: string;
  isLiked: boolean;
  likeCount?: number;
}

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

export async function followUser(walletAddress: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.follow', targetAddress: walletAddress });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function unfollowUser(walletAddress: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.unfollow', targetAddress: walletAddress });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function getFollowRequests(): Promise<FollowRequestItem[]> {
  const wallet = getWallet();
  if (!wallet) return [];
  const { data } = await withWalletHeader(
    supabase.from('follows').select('*').eq('following_address', wallet.toLowerCase()).eq('status', 'pending'),
    wallet
  );
  return (data || []).map((f: any) => ({
    id: f.id,
    address: f.follower_address,
    createdAt: f.created_at,
  }));
}

export async function approveFollowRequest(requestId: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.approveRequest', requestId });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function rejectFollowRequest(requestId: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.rejectRequest', requestId });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function acceptAllFollowRequests(): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.acceptAll' });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function rejectAllFollowRequests(): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  try {
    await invokeDehubSocialApi({ action: 'follow.rejectAll' });
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function getFollowList(
  address: string,
  type: 'followers' | 'following',
  options?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }
): Promise<{ items: FollowListItem[]; pagination?: any }> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query;
  if (type === 'followers') {
    query = supabase.from('follows').select('follower_address, created_at', { count: 'exact' })
      .eq('following_address', address.toLowerCase()).eq('status', 'accepted').range(from, to);
  } else {
    query = supabase.from('follows').select('following_address, created_at', { count: 'exact' })
      .eq('follower_address', address.toLowerCase()).eq('status', 'accepted').range(from, to);
  }

  const { data, count } = await query;
  const addresses = (data || []).map((f: any) =>
    type === 'followers' ? f.follower_address : f.following_address
  );

  // Batch-fetch profiles for all addresses in one query
  let profileMap: Record<string, { username?: string; display_name?: string; avatar_url?: string; is_verified?: boolean }> = {};
  if (addresses.length > 0) {
    const { data: profiles } = await supabase.from('profiles')
      .select('wallet_address, username, display_name, avatar_url, is_verified')
      .in('wallet_address', addresses);
    for (const p of profiles || []) {
      profileMap[p.wallet_address] = p;
    }
  }

  const items: FollowListItem[] = addresses.map((addr: string) => {
    const p = profileMap[addr] || {};
    return {
      address: addr,
      username: p.username,
      displayName: p.display_name || p.username,
      avatarUrl: p.avatar_url,
      avatarImageUrl: p.avatar_url,
      isVerified: p.is_verified,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: (count || 0) > page * limit,
    },
  };
}

export async function isFollowing(targetAddress: string): Promise<boolean> {
  const wallet = getWallet();
  if (!wallet) return false;
  const { data } = await supabase.from('follows').select('id')
    .eq('follower_address', wallet.toLowerCase())
    .eq('following_address', targetAddress.toLowerCase())
    .eq('status', 'accepted')
    .maybeSingle();
  return !!data;
}

export async function voteOnPost(params: { tokenId: number; voteType: 'for' | 'against' }): Promise<VoteResponse> {
  const wallet = getWallet();
  if (!wallet) return { success: false, tokenId: params.tokenId, voteType: null };

  try {
    const res = await invokeDehubSocialApi<{
      success?: boolean;
      tokenId?: number;
      voteType?: 'for' | 'against' | null;
    }>({
      action: 'engagement.vote',
      tokenId: params.tokenId,
      voteType: params.voteType,
    });
    return {
      success: res.success ?? false,
      tokenId: res.tokenId ?? params.tokenId,
      voteType: (res.voteType ?? null) as 'for' | 'against' | null,
    };
  } catch {
    return { success: false, tokenId: params.tokenId, voteType: null };
  }
}

export async function toggleFollow(params: { targetAddress: string }): Promise<FollowResponse> {
  const wallet = getWallet();
  if (!wallet) return { success: false, isFollowing: false };

  const following = await isFollowing(params.targetAddress);
  if (following) {
    await unfollowUser(params.targetAddress);
    return { success: true, isFollowing: false };
  } else {
    await followUser(params.targetAddress);
    return { success: true, isFollowing: true };
  }
}

export async function toggleCommentLike(params: { commentId: string }): Promise<CommentLikeResponse> {
  // Comment likes not yet implemented as separate table — stub for now
  return { success: true, commentId: params.commentId, isLiked: true, likeCount: 0 };
}

// ============ Repost / Quote Post ============

export async function getUserReposts(address: string, page: number = 1, limit: number = 20): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function getPostReposters(
  tokenId: string | number,
  page: number = 1,
  limit: number = 50
): Promise<{ items: FollowListItem[]; pagination?: any }> {
  return { items: [] };
}

export async function repostPost(tokenId: number): Promise<{ result: boolean }> {
  return { result: false };
}

export interface QuotePostMintResponse {
  r: string; s: string; v: number; createdTokenId: string; timestamp: number; quotedTokenId: number; isQuotePost: boolean;
}

export async function quotePost(params: { quotedTokenId: number; content: string; category?: string }): Promise<QuotePostMintResponse> {
  throw new Error('Quote posts not yet migrated');
}
