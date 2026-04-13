/**
 * Fansite Feed — Live Supabase Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import type {
  DeHubNFT, DeHubCategory, PaginatedResponse,
  SearchNFTsParams, UniversalSearchParams, UniversalSearchResponse,
  SearchSuggestionsParams, SearchSuggestion, SearchLogParams,
} from './types';

function postToNFT(p: any): DeHubNFT {
  const meta = (p.metadata || {}) as Record<string, unknown>;
  const cf = (meta.cloudflare || {}) as Record<string, unknown>;
  const hlsUrl = typeof cf.hlsUrl === 'string' ? cf.hlsUrl : '';
  const isLive = p.media_type === 'live' || cf.is_live === true;
  const videoUrl =
    p.media_type === 'live'
      ? (hlsUrl || (typeof p.media_url === 'string' ? p.media_url : undefined))
      : p.media_type === 'video'
        ? p.media_url
        : undefined;

  const prof = p.creator;

  return {
    tokenId: p.token_id,
    name: p.title || '',
    description: p.description || '',
    imageUrl: p.media_type === 'image' ? p.media_url : p.thumbnail_url || '',
    videoUrl,
    audioUrl: p.media_type === 'audio' ? p.media_url : undefined,
    postType: (isLive ? 'video' : p.media_type) || 'text',
    minter: p.creator_wallet_address,
    minterDisplayName: prof?.display_name,
    minterUsername: prof?.username,
    minterAvatarUrl: prof?.avatar_url,
    creator: prof ? {
      id: prof.wallet_address,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      is_verified: prof.is_verified,
    } : undefined,
    createdAt: p.created_at,
    likes: p.like_count,
    views: p.view_count,
    commentCount: p.comment_count,
    category: p.category,
    is_live: isLive,
    stream: cf.uid
      ? {
          streamId: String(cf.liveInputUid || cf.uid),
          playbackId: String(cf.uid),
          streamKey: typeof cf.streamKey === 'string' ? cf.streamKey : undefined,
          playbackUrl: typeof hlsUrl === 'string' ? hlsUrl : undefined,
        }
      : undefined,
  };
}

function getWallet(): string | null {
  return localStorage.getItem('dehub_wallet');
}

export async function searchNFTs(params: SearchNFTsParams = {}): Promise<PaginatedResponse<DeHubNFT>> {
  const page = params.page || 0;
  const limit = (params as any).limit || params.unit || 20;
  const from = page * limit;

  // Fetch posts with a manual join strategy for reliable profile lookup
  let query = supabase.from('posts').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (params.category) query = query.ilike('category', `%${params.category}%`);
  if (params.postType) query = query.eq('media_type', params.postType);
  if (params.address) query = query.eq('creator_wallet_address', params.address.toLowerCase());
  if (params.search) query = query.textSearch('search_vector', params.search);

  const { data: rawPosts, count } = await query;

  if (!rawPosts?.length) {
    return { data: [], total: count || 0, page, limit, has_more: false };
  }

  // Fetch associated profiles for the creators of these posts
  const creatorAddresses = [...new Set(rawPosts.map(p => p.creator_wallet_address.toLowerCase()))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet_address, username, display_name, avatar_url, is_verified')
    .in('wallet_address', creatorAddresses);

  const profileMap = new Map((profiles || []).map(p => [p.wallet_address.toLowerCase(), p]));

  // Map each post to its NFT format, including the looked-up creator profile
  const data = rawPosts.map(p => {
    const creator = profileMap.get(p.creator_wallet_address.toLowerCase());
    return postToNFT({ ...p, creator });
  });

  return {
    data,
    total: count || 0,
    page,
    limit,
    has_more: (count || 0) > (page + 1) * limit,
  };
}

export async function universalSearch(params: UniversalSearchParams): Promise<UniversalSearchResponse> {
  // Search posts
  const { data: posts } = await supabase.from('posts').select('*')
    .textSearch('search_vector', params.q || '')
    .limit(20);

  // Search profiles
  const { data: profiles } = await supabase.from('profiles').select('*')
    .or(`username.ilike.%${params.q}%,display_name.ilike.%${params.q}%`)
    .limit(10);

  return {
    accounts: (profiles || []).map((p: any) => ({
      id: p.id,
      address: p.wallet_address,
      username: p.username || '',
      displayName: p.display_name,
      avatarImageUrl: p.avatar_url,
    })),
    videos: (posts || []).filter((p: any) => p.media_type === 'video').map(postToNFT),
    livestreams: [],
    total: (posts?.length || 0) + (profiles?.length || 0),
    has_more: false,
  };
}

export async function getSearchSuggestions(params: SearchSuggestionsParams): Promise<SearchSuggestion[]> {
  const { data } = await supabase.from('profiles').select('username, display_name, avatar_url, wallet_address')
    .or(`username.ilike.%${params.q}%,display_name.ilike.%${params.q}%`)
    .limit(5);
  return (data || []).map((p: any) => ({
    type: 'account' as const,
    text: p.username || p.display_name || p.wallet_address,
    address: p.wallet_address,
    avatarUrl: p.avatar_url,
  }));
}

export async function logSearchAnalytics(params: SearchLogParams): Promise<void> {}

export async function getNFTInfo(tokenId: string): Promise<DeHubNFT> {
  const { data } = await supabase.from('posts').select('*').eq('token_id', Number(tokenId)).maybeSingle();
  if (data) return postToNFT(data);
  return { tokenId: Number(tokenId), name: '', imageUrl: '', postType: 'image', minter: '', createdAt: '' };
}

export async function recordView(tokenId: string): Promise<void> {
  // Increment view count
  const { data: post } = await supabase.from('posts').select('id, view_count').eq('token_id', Number(tokenId)).maybeSingle();
  if (post) {
    await supabase.from('posts').update({ view_count: (post.view_count || 0) + 1 }).eq('id', post.id);
  }
}

export async function recordListen(tokenId: string): Promise<void> {
  return recordView(tokenId);
}

export interface SavePostResponse { result: boolean; saved: boolean; message?: string; }

export async function toggleSavePost(tokenId: string | number): Promise<SavePostResponse> {
  const wallet = getWallet();
  if (!wallet) return { result: false, saved: false };

  const { data: post } = await supabase.from('posts').select('id').eq('token_id', Number(tokenId)).maybeSingle();
  if (!post) return { result: false, saved: false };

  // Check if already bookmarked
  const { data: existing } = await withWalletHeader(
    supabase.from('bookmarks').select('id').eq('post_id', post.id).eq('wallet_address', wallet.toLowerCase()),
    wallet
  );

  if (existing && existing.length > 0) {
    await withWalletHeader(
      supabase.from('bookmarks').delete().eq('post_id', post.id).eq('wallet_address', wallet.toLowerCase()),
      wallet
    );
    return { result: true, saved: false };
  } else {
    await withWalletHeader(
      supabase.from('bookmarks').insert({ post_id: post.id, wallet_address: wallet.toLowerCase() }),
      wallet
    );
    return { result: true, saved: true };
  }
}

export async function getSavedPosts(page?: number, limit?: number, address?: string): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  const wallet = address || getWallet();
  if (!wallet) return { result: [] };

  const p = page || 0;
  const l = limit || 20;

  const { data } = await withWalletHeader(
    supabase.from('bookmarks').select('post_id, posts(*)').eq('wallet_address', wallet.toLowerCase())
      .order('created_at', { ascending: false }).range(p * l, p * l + l - 1),
    wallet
  );

  const nfts = (data || []).map((b: any) => b.posts ? postToNFT(b.posts) : null).filter(Boolean);
  return { result: nfts };
}

export async function getLikedPosts(page?: number | string, limit?: number): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  const wallet = getWallet();
  if (!wallet) return { result: [] };

  const p = typeof page === 'string' ? parseInt(page) : (page || 0);
  const l = limit || 20;

  const { data } = await withWalletHeader(
    supabase.from('post_likes').select('post_id, posts(*)').eq('wallet_address', wallet.toLowerCase())
      .order('created_at', { ascending: false }).range(p * l, p * l + l - 1),
    wallet
  );

  const nfts = (data || []).map((b: any) => b.posts ? postToNFT(b.posts) : null).filter(Boolean);
  return { result: nfts };
}

export async function getWatchHistory(page?: number, limit?: number, address?: string): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function getCategories(): Promise<DeHubCategory[]> {
  const { data } = await supabase.from('trending_categories').select('*').order('post_count', { ascending: false }).limit(20);
  return (data || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.name.toLowerCase().replace(/\s+/g, '-'), nft_count: c.post_count }));
}

export async function getServerTime(): Promise<{ time: string }> {
  return { time: new Date().toISOString() };
}

export async function claimBounty(tokenId: number | string): Promise<{ result: boolean; message?: string }> {
  return { result: false, message: 'Not implemented' };
}

export async function getUnlockedNFTs(page?: number, limit?: number): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function recordBatchViews(tokenIds: number[]): Promise<{ result: boolean }> {
  return { result: true };
}

export async function getMyPosts(params?: any): Promise<PaginatedResponse<DeHubNFT> & { result?: DeHubNFT[] }> {
  const wallet = getWallet();
  if (!wallet) return { data: [], result: [], total: 0, page: 0, limit: 20, has_more: false };

  const page = params?.page || 0;
  const limit = params?.limit || 20;
  const from = page * limit;

  const { data, count } = await supabase.from('posts').select('*', { count: 'exact' })
    .eq('creator_wallet_address', wallet.toLowerCase())
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  const nfts = (data || []).map(postToNFT);
  return { data: nfts, result: nfts, total: count || 0, page, limit, has_more: (count || 0) > (page + 1) * limit };
}

/** Live tab — sessions joined with posts + creator profiles (Supabase only). */
export async function getLiveStreams(params: {
  page?: number;
  unit?: number;
  category?: string;
  sortMode?: 'viewers' | 'recent' | 'popular';
} = {}): Promise<{ result: unknown[] }> {
  const limit = params.unit ?? 15;
  const page = params.page ?? 1;
  const offset = (page - 1) * limit;

  const { data: sessions } = await supabase
    .from('live_stream_sessions')
    .select('token_id, stream_id, address, started_at')
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!sessions?.length) return { result: [] };

  const tokenNums = sessions
    .map((s) => parseInt(s.token_id, 10))
    .filter((n) => !Number.isNaN(n));

  const { data: posts } = await supabase.from('posts').select('*').in('token_id', tokenNums);

  const byToken = new Map((posts || []).map((row: { token_id: number }) => [row.token_id, row]));

  const addrs = [...new Set(sessions.map((s) => s.address.toLowerCase()))];
  const { data: profiles } = await supabase.from('profiles').select('*').in('wallet_address', addrs);

  const byAddr = new Map(
    (profiles || []).map((p: { wallet_address: string }) => [p.wallet_address.toLowerCase(), p]),
  );

  const result = sessions.map((s) => {
    const post = byToken.get(parseInt(s.token_id, 10)) as Record<string, unknown> | undefined;
    const prof = byAddr.get(s.address.toLowerCase()) as Record<string, unknown> | undefined;
    const meta = (post?.metadata || {}) as Record<string, unknown>;
    const cf = (meta.cloudflare || {}) as Record<string, unknown>;
    const thumb = (post?.thumbnail_url as string) || '';
    return {
      _id: s.stream_id || cf.uid || s.token_id,
      streamId: s.stream_id || cf.uid,
      streamer: (prof?.display_name as string) || (prof?.username as string) || 'Live',
      thumbnailUrl: thumb,
      thumbnail: thumb,
      account: {
        address: s.address,
        displayName: prof?.display_name,
        username: prof?.username,
        avatarImageUrl: prof?.avatar_url,
        avatarUrl: prof?.avatar_url,
      },
      name: (post?.title as string) || 'Live',
      title: post?.title,
      totalViews: (post?.view_count as number) ?? 0,
      categories: post?.category ? [post.category] : [],
      playbackId: cf.uid,
    };
  });

  return { result };
}
