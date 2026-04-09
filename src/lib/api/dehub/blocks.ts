/**
 * Fansite Blocks — Stub (no external API needed)
 * Block list stored locally for now; will be migrated to a DB table if needed.
 */

export interface BlockedUser {
  blockId: string;
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  reason?: string;
  blockedAt?: string;
}

export interface BlockedByUser {
  blockId: string;
  address: string;
  username?: string;
  displayName?: string;
  avatarImageUrl?: string;
  blockedAt?: string;
}

export interface BlockListResponse {
  status: boolean;
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: BlockedUser[];
}

export interface BlockedByResponse {
  status: boolean;
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: BlockedByUser[];
}

export interface BlockStatusResponse {
  isBlocked: boolean;
  isBlockedBy: boolean;
  youBlocked: boolean;
  blockedYou: boolean;
}

export interface BlockResult {
  status: boolean;
  message: string;
  blockId?: string;
  blocked?: {
    address: string;
    username?: string;
    displayName?: string;
  };
  address?: string;
}

export async function blockUser(address: string, reason?: string): Promise<BlockResult> {
  return { status: true, message: 'Blocked' };
}

export async function unblockUser(address: string): Promise<BlockResult> {
  return { status: true, message: 'Unblocked' };
}

export async function getBlockList(): Promise<BlockedUser[]> {
  return [];
}

export async function getBlockListPaginated(page = 1, limit = 20): Promise<BlockListResponse> {
  return { status: true, total: 0, page, limit, pages: 0, items: [] };
}

export async function getBlockedBy(page = 1, limit = 20): Promise<BlockedByResponse> {
  return { status: true, total: 0, page, limit, pages: 0, items: [] };
}

export async function getBlockStatus(address: string): Promise<BlockStatusResponse> {
  return { youBlocked: false, blockedYou: false, isBlocked: false, isBlockedBy: false };
}
