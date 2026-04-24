/**
 * Fansite Content — Live Supabase + R2 Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import type { DeHubNFT } from './types';
import { invokeDehubSocialApi } from './social-edge-client';

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

const DIRECT_UPLOAD_THRESHOLD = 10 * 1024 * 1024; // 10 MB — above this, use presigned URL

/**
 * Upload a file to R2.
 * Small files go through the edge function (simple).
 * Large files (>10 MB) use a presigned URL so the upload goes browser→R2 directly,
 * bypassing the edge function's memory limit.
 */
async function uploadToR2(file: File | Blob, folder: string): Promise<string> {
  const walletAddress = localStorage.getItem('dehub_wallet') || '';
  const dehubToken = localStorage.getItem('dehub_token') || '';
  const authHeaders = { 'x-wallet-address': walletAddress, 'x-dehub-token': dehubToken };

  if (file.size > DIRECT_UPLOAD_THRESHOLD) {
    // Get presigned URL from edge function
    const filename = file instanceof File ? file.name : `upload.bin`;
    const contentType = file.type || 'application/octet-stream';

    const { data, error } = await supabase.functions.invoke('r2-upload/presign', {
      body: { folder, filename, contentType },
      headers: authHeaders,
    });
    if (error) throw new Error(`Presign failed: ${error.message}`);
    if (!data?.presignedUrl) throw new Error('No presigned URL returned');

    // Upload directly to R2
    const res = await fetch(data.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!res.ok) throw new Error(`Direct R2 upload failed: ${res.status}`);
    return data.publicUrl as string;
  }

  // Small file — buffer through edge function as before
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const { data, error } = await supabase.functions.invoke('r2-upload', {
    body: formData,
    headers: authHeaders,
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

  const res = await invokeDehubSocialApi<{ ok: boolean; post?: { id: string; token_id: number }; error?: string }>({
    action: 'post.create',
    title: params.name || '',
    description: params.description || '',
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl,
    media_type: mediaType,
    category: params.category?.join(',') || null,
    is_ppv: isPPV,
    ppv_amount: ppvAmount,
    ppv_currency: isPPV ? (streamInfo.payPerViewTokenSymbol || 'Coins') : null,
    is_subscribers_only: isSubscribersOnly,
    visibility: 'public',
    ...(metadata ? { metadata } : {}),
  });

  const post = res.post;
  if (!post?.token_id) {
    console.error('[mintPost] Insert failed:', res);
    throw new Error(res.error || 'Failed to create post');
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

  const res = await invokeDehubSocialApi<{ post?: Record<string, unknown> }>({
    action: 'post.create',
    title: data.title || '',
    description: data.description || '',
    media_url: data.media_url,
    thumbnail_url: data.thumbnail_url,
    media_type: data.media_type,
    category: data.category || null,
    is_ppv: data.is_ppv ?? false,
    ppv_amount: data.ppv_price || null,
    visibility: 'public',
  });

  const post = res.post as Record<string, unknown> | undefined;
  if (!post) throw new Error('Failed to create post');

  return {
    tokenId: post.token_id as number,
    name: post.title as string,
    description: (post.description as string) || '',
    imageUrl: post.media_type === 'image' ? (post.media_url as string) : (post.thumbnail_url as string) || '',
    videoUrl: post.media_type === 'video' ? (post.media_url as string) : undefined,
    postType: ((post.media_type as string) || 'image') as 'video' | 'image' | 'audio',
    minter: post.creator_wallet_address as string,
    createdAt: post.created_at as string,
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

  await invokeDehubSocialApi({
    action: 'post.update',
    tokenId: Number(tokenId),
    ...params,
  });
  return { result: true, data: { tokenId: Number(tokenId), ...params } };
}

export async function deletePost(tokenId: number | string): Promise<{ result: boolean }> {
  const wallet = getWallet();
  if (!wallet) throw new Error('Authentication required');

  await invokeDehubSocialApi({
    action: 'post.delete',
    tokenId: Number(tokenId),
  });
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

  await invokeDehubSocialApi({
    action: 'post.setVisibility',
    tokenId: Number(tokenId),
    visibility,
  });

  return {
    status: true,
    message: `Visibility updated to ${visibility}`,
    result: { tokenId: Number(tokenId), visibility },
  };
}
