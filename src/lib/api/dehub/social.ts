/**
 * Fansite Social — Live Supabase Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import { getAuthToken } from './core';
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
  const query = supabase.from('follows').insert({
    follower_address: wallet.toLowerCase(),
    following_address: walletAddress.toLowerCase(),
    status: 'accepted',
  });
  const { error } = await withWalletHeader(query, wallet);
  return { result: !error };
}

export async function unfollowUser(walletAddress: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  const query = supabase.from('follows').delete()
    .eq('follower_address', wallet.toLowerCase())
    .eq('following_address', walletAddress.toLowerCase());
  const { error } = await withWalletHeader(query, wallet);
  return { result: !error };
}

export async function getFollowRequests(): Promise<FollowRequestItem[]> {
  const wallet = getWallet();
  if (!wallet) return [];
  const query = supabase.from('follows').select('*, profiles!follows_follower_address_fkey(*)').eq('following_address', wallet.toLowerCase()).eq('status', 'pending');
  // No FK join available yet — use simpler approach
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
  const { error } = await withWalletHeader(
    supabase.from('follows').update({ status: 'accepted' }).eq('id', requestId),
    wallet
  );
  return { result: !error };
}

export async function rejectFollowRequest(requestId: string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  const { error } = await withWalletHeader(
    supabase.from('follows').delete().eq('id', requestId),
    wallet
  );
  return { result: !error };
}

export async function acceptAllFollowRequests(): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  const { error } = await withWalletHeader(
    supabase.from('follows').update({ status: 'accepted' }).eq('following_address', wallet.toLowerCase()).eq('status', 'pending'),
    wallet
  );
  return { result: !error };
}

export async function rejectAllFollowRequests(): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  const { error } = await withWalletHeader(
    supabase.from('follows').delete().eq('following_address', wallet.toLowerCase()).eq('status', 'pending'),
    wallet
  );
  return { result: !error };
}

export async function getFollowList(
  address: string,
  type: 'followers' | 'following',
  options?: { page?: number; limit?: number; search?: string }
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
  const items: FollowListItem[] = (data || []).map((f: any) => ({
    address: type === 'followers' ? f.follower_address : f.following_address,
  }));

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

  // Find post by token_id
  const { data: post } = await supabase.from('posts').select('id').eq('token_id', params.tokenId).maybeSingle();
  if (!post) return { success: false, tokenId: params.tokenId, voteType: null };

  if (params.voteType === 'for') {
    const { error } = await withWalletHeader(
      supabase.from('post_likes').insert({ post_id: post.id, wallet_address: wallet.toLowerCase() }),
      wallet
    );
    return { success: !error, tokenId: params.tokenId, voteType: error ? null : 'for' };
  } else {
    const { error } = await withWalletHeader(
      supabase.from('post_likes').delete().eq('post_id', post.id).eq('wallet_address', wallet.toLowerCase()),
      wallet
    );
    return { success: !error, tokenId: params.tokenId, voteType: error ? null : null };
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
