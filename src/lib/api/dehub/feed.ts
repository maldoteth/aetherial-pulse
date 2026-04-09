/**
 * Fansite Feed — Stub
 */
import { apiCall, getAuthToken } from './core';
import type {
  DeHubNFT,
  DeHubUser,
  DeHubCategory,
  PaginatedResponse,
  SearchNFTsParams,
  UniversalSearchParams,
  UniversalSearchResponse,
  SearchSuggestionsParams,
  SearchSuggestion,
  SearchLogParams,
} from './types';

export async function searchNFTs(params: SearchNFTsParams = {}): Promise<PaginatedResponse<DeHubNFT>> {
  return { data: [], total: 0, page: 0, limit: 20, has_more: false };
}

export async function universalSearch(params: UniversalSearchParams): Promise<UniversalSearchResponse> {
  return { accounts: [], videos: [], livestreams: [], total: 0, has_more: false };
}

export async function getSearchSuggestions(params: SearchSuggestionsParams): Promise<SearchSuggestion[]> {
  return [];
}

export async function logSearchAnalytics(params: SearchLogParams): Promise<void> {}

export async function getNFTInfo(tokenId: string): Promise<DeHubNFT> {
  return { tokenId: Number(tokenId), name: '', imageUrl: '', postType: 'image', minter: '', createdAt: '' };
}

export async function recordView(tokenId: string): Promise<void> {}
export async function recordListen(tokenId: string): Promise<void> {}

export interface SavePostResponse { result: boolean; saved: boolean; message?: string; }
export async function toggleSavePost(tokenId: string | number): Promise<SavePostResponse> {
  return { result: true, saved: true };
}

export async function getSavedPosts(page?: number, limit?: number, address?: string): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function getLikedPosts(page?: number | string, limit?: number): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function getWatchHistory(page?: number, limit?: number, address?: string): Promise<{ result: DeHubNFT[]; pagination?: any }> {
  return { result: [] };
}

export async function getCategories(): Promise<DeHubCategory[]> {
  return [];
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

export async function getMyPosts(params?: any): Promise<PaginatedResponse<DeHubNFT>> {
  return { data: [], total: 0, page: 0, limit: 20, has_more: false };
}
