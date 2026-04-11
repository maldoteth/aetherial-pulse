/**
 * Fansite Users — Live Supabase Implementation
 */
import { supabase } from '@/integrations/supabase/client';
import { invokeDehubSocialApi } from './social-edge-client';
import type { DeHubUser, DeHubNFT, PaginatedResponse } from './types';
import type { ApiCommentResponse } from './comments';

export interface UpdateProfileData {
  username?: string;
  displayName?: string;
  bio?: string;
  aboutMe?: string;
  avatarImageUrl?: string;
  coverImageUrl?: string;
  avatarImg?: File | null;
  coverImg?: File | null;
  isPrivate?: boolean;
  customs?: Record<string, unknown>;
  dmSettings?: { disables?: string[]; minTipDhb?: number };
  twitterLink?: string;
  discordLink?: string;
  instagramLink?: string;
  tiktokLink?: string;
  telegramLink?: string;
  youtubeLink?: string;
  facebookLink?: string;
}

export interface SearchUsersParams { q?: string; query?: string; page?: number; limit?: number; }

export interface UserCommentsResponse {
  result: ApiCommentResponse[];
  data?: ApiCommentResponse[];
  total?: number;
  page?: number;
  has_more?: boolean;
  pagination?: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
}

export interface SuggestedAccount {
  address: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  avatarImageUrl?: string;
  followerCount?: number;
  badgeBalance?: number;
  likes?: number;
  isFollowing?: boolean;
}

function profileToUser(p: any): DeHubUser {
  return {
    address: p.wallet_address,
    username: p.username || '',
    displayName: p.display_name || '',
    bio: p.bio || '',
    aboutMe: p.about_me || '',
    avatarImageUrl: p.avatar_url || '',
    coverImageUrl: p.cover_url || '',
    isVerified: p.is_verified || false,
    isPrivate: p.is_private || false,
    followerCount: p.follower_count || 0,
    followingCount: p.following_count || 0,
    postCount: p.post_count || 0,
    subscriberCount: p.subscriber_count || 0,
    likes: p.like_count || 0,
    twitterLink: p.twitter_link || '',
    discordLink: p.discord_link || '',
    instagramLink: p.instagram_link || '',
    tiktokLink: p.tiktok_link || '',
    telegramLink: p.telegram_link || '',
    youtubeLink: p.youtube_link || '',
    facebookLink: p.facebook_link || '',
    customs: p.customs || {},
    dmSettings: p.dm_settings || {},
  } as DeHubUser;
}

export async function getAccountInfo(userId: string, address?: string): Promise<DeHubUser> {
  const { data } = await supabase.from('profiles').select('*').eq('wallet_address', userId.toLowerCase()).maybeSingle();
  if (data) return profileToUser(data);
  return { address: userId } as DeHubUser;
}

export async function getAccountByUsername(username: string, address?: string): Promise<DeHubUser> {
  const { data } = await supabase.from('profiles').select('*').ilike('username', username).maybeSingle();
  if (data) return profileToUser(data);
  return { username } as DeHubUser;
}

export async function updateProfile(data: UpdateProfileData): Promise<{ result: boolean }> {
  const wallet = localStorage.getItem('dehub_wallet');
  if (!wallet) return { result: false };

  const payload: Record<string, unknown> = { action: 'profile.update' };
  if (data.username !== undefined) payload.username = data.username;
  if (data.displayName !== undefined) payload.display_name = data.displayName;
  if (data.bio !== undefined) payload.bio = data.bio;
  if (data.aboutMe !== undefined) payload.about_me = data.aboutMe;
  if (data.avatarImageUrl !== undefined) payload.avatar_url = data.avatarImageUrl;
  if (data.coverImageUrl !== undefined) payload.cover_url = data.coverImageUrl;
  if (data.isPrivate !== undefined) payload.is_private = data.isPrivate;
  if (data.customs !== undefined) payload.customs = data.customs;
  if (data.dmSettings !== undefined) payload.dm_settings = data.dmSettings;
  if (data.twitterLink !== undefined) payload.twitter_link = data.twitterLink;
  if (data.discordLink !== undefined) payload.discord_link = data.discordLink;
  if (data.instagramLink !== undefined) payload.instagram_link = data.instagramLink;
  if (data.tiktokLink !== undefined) payload.tiktok_link = data.tiktokLink;
  if (data.telegramLink !== undefined) payload.telegram_link = data.telegramLink;
  if (data.youtubeLink !== undefined) payload.youtube_link = data.youtubeLink;
  if (data.facebookLink !== undefined) payload.facebook_link = data.facebookLink;

  try {
    await invokeDehubSocialApi(payload);
    return { result: true };
  } catch {
    return { result: false };
  }
}

export async function getUserNFTs(
  address: string, page?: number, limit?: number,
  params?: { postType?: string; status?: string }
): Promise<PaginatedResponse<DeHubNFT>> {
  const p = page || 0;
  const l = limit || 20;
  const from = p * l;
  const to = from + l - 1;

  let query = supabase.from('posts').select('*', { count: 'exact' })
    .eq('creator_wallet_address', address.toLowerCase())
    .order('created_at', { ascending: false })
    .range(from, to);

  if (params?.postType) {
    query = query.eq('media_type', params.postType);
  }

  const { data, count } = await query;
  const nfts: DeHubNFT[] = (data || []).map((p: any) => ({
    tokenId: p.token_id,
    name: p.title || '',
    description: p.description || '',
    imageUrl: p.media_type === 'image' ? p.media_url : p.thumbnail_url || '',
    videoUrl: p.media_type === 'video' ? p.media_url : undefined,
    audioUrl: p.media_type === 'audio' ? p.media_url : undefined,
    postType: p.media_type || 'text',
    minter: p.creator_wallet_address,
    createdAt: p.created_at,
    likes: p.like_count,
    views: p.view_count,
    commentCount: p.comment_count,
    category: p.category,
  }));

  return { data: nfts, total: count || 0, page: p, limit: l, has_more: (count || 0) > (p + 1) * l };
}

export async function getUsersCount(): Promise<number> {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  return count || 0;
}

export async function searchUsers(params: SearchUsersParams): Promise<PaginatedResponse<DeHubUser>> {
  const q = params.q || params.query || '';
  const page = params.page || 0;
  const limit = params.limit || 20;
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase.from('profiles').select('*', { count: 'exact' }).range(from, to);
  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data, count } = await query;
  return {
    data: (data || []).map(profileToUser),
    total: count || 0,
    page,
    limit,
    has_more: (count || 0) > (page + 1) * limit,
  };
}

export async function getUserComments(address: string, page?: number, limit?: number): Promise<UserCommentsResponse> {
  const p = page || 0;
  const l = limit || 20;
  const { data } = await supabase.from('post_comments').select('*')
    .eq('wallet_address', address.toLowerCase())
    .order('created_at', { ascending: false })
    .range(p * l, p * l + l - 1);
  return { result: (data || []).map((c: any) => ({
    id: c.id, tokenId: 0, address: c.wallet_address, content: c.content,
    imageUrl: null, replyIds: [], parentId: null, createdAt: c.created_at, updatedAt: c.updated_at,
    writor: { username: c.username || '' },
  })) };
}

export async function getSuggestedAccounts(limit: number = 10, page: number = 1): Promise<{ items: SuggestedAccount[]; hasMore: boolean }> {
  const from = (page - 1) * limit;
  const { data, count } = await supabase.from('profiles').select('*', { count: 'exact' })
    .order('follower_count', { ascending: false })
    .range(from, from + limit - 1);

  return {
    items: (data || []).map((p: any) => ({
      address: p.wallet_address,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      avatarImageUrl: p.avatar_url,
      followerCount: p.follower_count,
      likes: p.like_count,
    })),
    hasMore: (count || 0) > page * limit,
  };
}

export async function getCachedSuggestedProfiles(limit: number = 10, offset: number = 0): Promise<{ items: SuggestedAccount[]; hasMore: boolean }> {
  return getSuggestedAccounts(limit, Math.floor(offset / limit) + 1);
}
