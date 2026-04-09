/**
 * Fansite Users — Stub
 */
import { apiCall, getAuthToken } from './core';
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

export interface SearchUsersParams {
  q?: string;
  query?: string;
  page?: number;
  limit?: number;
}

export interface UserCommentsResponse {
  result: ApiCommentResponse[];
  data?: ApiCommentResponse[];
  total?: number;
  page?: number;
  has_more?: boolean;
  pagination?: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
}
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

export async function getAccountInfo(userId: string, address?: string): Promise<DeHubUser> {
  return { address: userId } as DeHubUser;
}

export async function getAccountByUsername(username: string, address?: string): Promise<DeHubUser> {
  return { username } as DeHubUser;
}

export async function updateProfile(data: UpdateProfileData): Promise<{ result: boolean }> {
  return { result: true };
}

export async function getUserNFTs(
  address: string,
  page?: number,
  limit?: number,
  params?: { postType?: string; status?: string }
): Promise<PaginatedResponse<DeHubNFT>> {
  return { data: [], total: 0, page: 0, limit: 20, has_more: false };
}

export async function getUsersCount(): Promise<number> {
  return 0;
}

export async function searchUsers(params: SearchUsersParams): Promise<PaginatedResponse<DeHubUser>> {
  return { data: [], total: 0, page: 0, limit: 20, has_more: false };
}

export async function getUserComments(
  address: string,
  page?: number,
  limit?: number
): Promise<UserCommentsResponse> {
  return { result: [] };
}

export async function getSuggestedAccounts(limit: number = 10, page: number = 1): Promise<{ items: SuggestedAccount[]; hasMore: boolean }> {
  return { items: [], hasMore: false };
}

export async function getCachedSuggestedProfiles(limit: number = 10, offset: number = 0): Promise<{ items: SuggestedAccount[]; hasMore: boolean }> {
  return { items: [], hasMore: false };
}
