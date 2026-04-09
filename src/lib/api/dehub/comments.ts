/**
 * Fansite Comments — Live Supabase Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import type { DeHubUser } from './types';

export interface ApiCommentResponse {
  id: string;
  tokenId: number;
  address: string;
  content: string;
  imageUrl: string | null;
  replyIds: number[];
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isLiked?: boolean;
  writor: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    badgeBalance?: number;
  };
}

interface CommentsApiResponse {
  result: {
    items: ApiCommentResponse[];
    totalCount: number;
    skip: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface PostCommentResponse { result?: boolean; }
export interface CommentResponse {
  id: string; tokenId: number; content: string; imageUrl?: string; address: string;
  createdAt: string; updatedAt: string; user?: DeHubUser; likeCount?: number;
  replyIds?: string[]; parentId?: string | null;
}
export interface EditCommentResponse { success: boolean; comment: CommentResponse; }

export async function getNFTComments(
  tokenId: string,
  page: number = 0,
  limit: number = 20,
  address?: string,
): Promise<ApiCommentResponse[]> {
  // Find post by token_id
  const { data: post } = await supabase.from('posts').select('id').eq('token_id', Number(tokenId)).maybeSingle();
  if (!post) return [];

  const from = page * limit;
  const to = from + limit - 1;

  const { data } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', post.id)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  return (data || []).map((c: any) => ({
    id: c.id,
    tokenId: Number(tokenId),
    address: c.wallet_address,
    content: c.content,
    imageUrl: null,
    replyIds: [],
    parentId: c.parent_id ? Number(c.parent_id) : null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    likeCount: c.like_count || 0,
    isLiked: false,
    writor: {
      username: c.username || c.wallet_address?.slice(0, 8) || '',
      displayName: undefined,
      avatarUrl: c.avatar_url || undefined,
    },
  }));
}

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

export async function postComment(tokenId: string, content: string, replyToId?: string): Promise<PostCommentResponse> {
  const wallet = getWallet();
  if (!wallet) return { result: false };

  const { data: post } = await supabase.from('posts').select('id').eq('token_id', Number(tokenId)).maybeSingle();
  if (!post) return { result: false };

  // Get profile info
  const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('wallet_address', wallet.toLowerCase()).maybeSingle();

  const insertData: any = {
    post_id: post.id,
    wallet_address: wallet.toLowerCase(),
    content,
    username: profile?.username || undefined,
    avatar_url: profile?.avatar_url || undefined,
  };
  if (replyToId) insertData.parent_id = replyToId;

  const { error } = await withWalletHeader(
    supabase.from('post_comments').insert(insertData),
    wallet
  );
  return { result: !error };
}

export async function addComment(params: { tokenId: number; content: string; parentId?: string }): Promise<CommentResponse> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Not authenticated');

  const { data: post } = await supabase.from('posts').select('id').eq('token_id', params.tokenId).maybeSingle();
  if (!post) throw new Error('Post not found');

  const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('wallet_address', wallet.toLowerCase()).maybeSingle();

  const insertData: any = {
    post_id: post.id,
    wallet_address: wallet.toLowerCase(),
    content: params.content,
    username: profile?.username || undefined,
    avatar_url: profile?.avatar_url || undefined,
  };
  if (params.parentId) insertData.parent_id = params.parentId;

  const { data, error } = await withWalletHeader(
    supabase.from('post_comments').insert(insertData).select().single(),
    wallet
  );
  if (error || !data) throw new Error(error?.message || 'Failed to add comment');
  return {
    id: data.id,
    tokenId: params.tokenId,
    content: data.content,
    address: data.wallet_address,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    likeCount: 0,
    parentId: data.parent_id,
  };
}

export async function addCommentWithImage(params: { tokenId: number; content?: string; imageUrl: string; parentId?: string }): Promise<CommentResponse> {
  return addComment({ tokenId: params.tokenId, content: params.content || params.imageUrl, parentId: params.parentId });
}

export async function editComment(params: { commentId: string; content: string }): Promise<EditCommentResponse> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Not authenticated');
  const { data, error } = await withWalletHeader(
    supabase.from('post_comments').update({ content: params.content }).eq('id', params.commentId).select().single(),
    wallet
  );
  if (error || !data) throw new Error(error?.message || 'Failed to edit');
  return {
    success: true,
    comment: { id: data.id, tokenId: 0, content: data.content, address: data.wallet_address, createdAt: data.created_at, updatedAt: data.updated_at },
  };
}

export interface VoiceCommentResponse { result: boolean; commentId: number; audioUrl: string; audioDuration: number; }

export async function addVoiceComment(params: { tokenId: number; audioFile: Blob; content?: string; parentId?: string }): Promise<VoiceCommentResponse> {
  throw new Error('Voice comments not yet migrated');
}

export async function addGifComment(params: { tokenId: number; gifUrl: string; content?: string; parentId?: string }): Promise<CommentResponse> {
  return addComment({ tokenId: params.tokenId, content: params.content || params.gifUrl, parentId: params.parentId });
}

export async function deleteComment(commentId: string | number): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) return { result: false };
  const { error } = await withWalletHeader(
    supabase.from('post_comments').delete().eq('id', String(commentId)),
    wallet
  );
  return { result: !error };
}
