/**
 * Fansite Content — Live Supabase + R2 Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import type { DeHubNFT } from './types';

export interface StreamInfo {
  isLockContent?: boolean;
  lockContentContractAddress?: string;
  lockContentTokenSymbol?: string;
  lockContentAmount?: number;
  lockContentChainIds?: number[];
  isPayPerView?: boolean;
  payPerViewContractAddress?: string;
  payPerViewTokenSymbol?: string;
  payPerViewAmount?: number;
  payPerViewChainIds?: number[];
  isAddBounty?: boolean;
  addBountyTokenSymbol?: string;
  addBountyFirstXViewers?: number;
  addBountyFirstXComments?: number;
  addBountyAmount?: number;
  addBountyChainId?: number;
}

export interface MintPostParams {
  name: string;
  description: string;
  postType: 'video' | 'feed-images' | 'feed-simple' | 'live' | 'audio';
  chainId: number;
  category: string[];
  streamInfo?: StreamInfo;
  plans?: string[];
  files?: File[];
  thumbnail?: Blob;
  minterAddress: string;
}

export interface MintResponse {
  r: string;
  s: string;
  v: number;
  createdTokenId: string;
  timestamp: number;
}

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

/**
 * Upload a file to R2 via the edge function
 */
async function uploadToR2(file: File | Blob, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const { data, error } = await supabase.functions.invoke('r2-upload', {
    body: formData,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  if (!data?.url) throw new Error('Upload returned no URL');
  return data.url;
}

function postTypeToMediaType(postType: string): string {
  switch (postType) {
    case 'video': return 'video';
    case 'feed-images': return 'image';
    case 'audio':
    case 'feed-audio': return 'audio';
    case 'live': return 'live';
    default: return 'text';
  }
}

export async function mintPost(
  params: MintPostParams,
  onProgress?: (percent: number) => void
): Promise<MintResponse> {
  const wallet = params.minterAddress || getWallet();
  if (!wallet) throw new Error('Authentication required');

  onProgress?.(10);

  let mediaUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  const mediaType = postTypeToMediaType(params.postType);

  if (params.files && params.files.length > 0) {
    const mainFile = params.files[0];
    mediaUrl = await uploadToR2(mainFile, mediaType === 'video' ? 'videos' : mediaType === 'audio' ? 'audio' : 'images');
    onProgress?.(50);
  }

  if (params.thumbnail) {
    thumbnailUrl = await uploadToR2(params.thumbnail as File, 'thumbnails');
    onProgress?.(70);
  }

  const streamInfo = params.streamInfo || {};
  const isPPV = streamInfo.isPayPerView ?? false;
  const ppvAmount = isPPV ? (streamInfo.payPerViewAmount || 0) : null;
  const isSubscribersOnly = (params.plans && params.plans.length > 0) ?? false;

  const metadata =
    params.postType === 'live'
      ? { live: true as const, streamInfo: params.streamInfo || {} }
      : undefined;

  const insertRow: Record<string, unknown> = {
    creator_wallet_address: wallet.toLowerCase(),
    title: params.name || '',
    description: params.description || '',
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl,
    media_type: mediaType,
    category: params.category?.join(',') || null,
    is_ppv: isPPV,
    ppv_amount: ppvAmount,
    ppv_currency: isPPV ? (streamInfo.payPerViewTokenSymbol || 'DHB') : null,
    is_subscribers_only: isSubscribersOnly,
    visibility: 'public',
    ...(metadata ? { metadata } : {}),
  };

  const query = supabase.from('posts').insert(insertRow as any).select('id, token_id').single();

  const { data: post, error } = await withWalletHeader(query, wallet);

  if (error) {
    console.error('[mintPost] Insert failed:', error);
    throw new Error(`Failed to create post: ${error.message}`);
  }

  onProgress?.(100);
  console.log('[mintPost] Created post:', post);

  return {
    r: '',
    s: '',
    v: 0,
    createdTokenId: String(post.token_id),
    timestamp: Date.now(),
  };
}

export async function mintNFT(data: {
  title: string;
  description?: string;
  media_url: string;
  thumbnail_url?: string;
  media_type: "video" | "image" | "audio";
  category?: string;
  tags?: string[];
  is_ppv?: boolean;
  ppv_price?: number;
}): Promise<DeHubNFT> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Authentication required');

  const query = supabase.from('posts').insert({
    creator_wallet_address: wallet.toLowerCase(),
    title: data.title || '',
    description: data.description || '',
    media_url: data.media_url,
    thumbnail_url: data.thumbnail_url,
    media_type: data.media_type,
    category: data.category || null,
    is_ppv: data.is_ppv ?? false,
    ppv_amount: data.ppv_price || null,
    visibility: 'public',
  }).select('*').single();

  const { data: post, error } = await withWalletHeader(query, wallet);
  if (error) throw new Error(`Failed to create post: ${error.message}`);

  return {
    tokenId: post.token_id,
    name: post.title,
    description: post.description || '',
    imageUrl: post.media_type === 'image' ? post.media_url : post.thumbnail_url || '',
    videoUrl: post.media_type === 'video' ? post.media_url : undefined,
    postType: (post.media_type || 'image') as 'video' | 'image' | 'audio',
    minter: post.creator_wallet_address,
    createdAt: post.created_at,
    likes: 0,
    views: 0,
    commentCount: 0,
  };
}

// Edit & Delete

export interface EditPostParams {
  name?: string;
  description?: string;
  category?: string[];
}

export interface EditPostResponse {
  result: boolean;
  data?: {
    tokenId: number;
    name?: string;
    description?: string;
    category?: string[];
  };
}

export async function editPost(
  tokenId: number | string,
  params: EditPostParams
): Promise<EditPostResponse> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Authentication required');

  const updates: Record<string, unknown> = {};
  if (params.name !== undefined) updates.title = params.name;
  if (params.description !== undefined) updates.description = params.description;
  if (params.category !== undefined) updates.category = params.category.join(',');

  const query = supabase.from('posts').update(updates).eq('token_id', Number(tokenId));
  const { error } = await withWalletHeader(query, wallet);

  if (error) throw new Error(`Failed to edit post: ${error.message}`);
  return { result: true, data: { tokenId: Number(tokenId), ...params } };
}

export async function deletePost(tokenId: number | string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Authentication required');

  const query = supabase.from('posts').delete().eq('token_id', Number(tokenId));
  const { error } = await withWalletHeader(query, wallet);

  if (error) throw new Error(`Failed to delete post: ${error.message}`);
  return { result: true };
}

// Token visibility

export type TokenVisibility = 'public' | 'private' | 'unlisted';

export interface TokenVisibilityResponse {
  status: boolean;
  message?: string;
  result?: {
    tokenId: number;
    visibility: TokenVisibility;
  };
}

export async function updateTokenVisibility(
  tokenId: number | string,
  visibility: TokenVisibility
): Promise<TokenVisibilityResponse> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Authentication required');

  const query = supabase.from('posts').update({ visibility }).eq('token_id', Number(tokenId));
  const { error } = await withWalletHeader(query, wallet);

  if (error) throw new Error(`Failed to update visibility: ${error.message}`);

  return {
    status: true,
    message: `Visibility updated to ${visibility}`,
    result: { tokenId: Number(tokenId), visibility },
  };
}
