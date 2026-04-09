/**
 * Fansite Blocks — Supabase-backed
 */
import { supabase } from '@/integrations/supabase/client';

export interface BlockedUser {
  blockId: string; address: string; username?: string;
  displayName?: string; avatarImageUrl?: string; reason?: string; blockedAt?: string;
}

export interface BlockedByUser {
  blockId: string; address: string; username?: string;
  displayName?: string; avatarImageUrl?: string; blockedAt?: string;
}

export interface BlockListResponse { status: boolean; total: number; page: number; limit: number; pages: number; items: BlockedUser[]; }
export interface BlockedByResponse { status: boolean; total: number; page: number; limit: number; pages: number; items: BlockedByUser[]; }
export interface BlockStatusResponse { isBlocked: boolean; isBlockedBy: boolean; youBlocked: boolean; blockedYou: boolean; }
export interface BlockResult { status: boolean; message: string; blockId?: string; blocked?: { address: string; username?: string; displayName?: string }; address?: string; }

function getWallet(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('dehub_wallet') : null)?.toLowerCase() || '';
}

export async function blockUser(address: string, reason?: string): Promise<BlockResult> {
  const myAddr = getWallet();
  if (!myAddr) return { status: false, message: 'Not authenticated' };

  const { data, error } = await supabase
    .from('user_blocks')
    .insert({ blocker_address: myAddr, blocked_address: address.toLowerCase(), reason })
    .select()
    .single();

  if (error) return { status: false, message: error.message };
  return { status: true, message: 'Blocked', blockId: data.id, address };
}

export async function unblockUser(address: string): Promise<BlockResult> {
  const myAddr = getWallet();
  if (!myAddr) return { status: false, message: 'Not authenticated' };

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_address', myAddr)
    .eq('blocked_address', address.toLowerCase());

  if (error) return { status: false, message: error.message };
  return { status: true, message: 'Unblocked' };
}

export async function getBlockList(): Promise<BlockedUser[]> {
  const myAddr = getWallet();
  if (!myAddr) return [];

  const { data } = await supabase
    .from('user_blocks')
    .select('id, blocked_address, reason, created_at')
    .eq('blocker_address', myAddr)
    .order('created_at', { ascending: false });

  if (!data) return [];

  const addresses = data.map(b => b.blocked_address);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet_address, username, display_name, avatar_url')
    .in('wallet_address', addresses);

  const pm = new Map((profiles || []).map(p => [p.wallet_address.toLowerCase(), p]));

  return data.map(b => {
    const p = pm.get(b.blocked_address.toLowerCase());
    return {
      blockId: b.id, address: b.blocked_address,
      username: p?.username || undefined, displayName: p?.display_name || undefined,
      avatarImageUrl: p?.avatar_url || undefined, reason: b.reason || undefined,
      blockedAt: b.created_at,
    };
  });
}

export async function getBlockListPaginated(page = 1, limit = 20): Promise<BlockListResponse> {
  const items = await getBlockList();
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  return { status: true, total: items.length, page, limit, pages: Math.ceil(items.length / limit), items: paged };
}

export async function getBlockedBy(page = 1, limit = 20): Promise<BlockedByResponse> {
  const myAddr = getWallet();
  if (!myAddr) return { status: true, total: 0, page, limit, pages: 0, items: [] };

  const { data } = await supabase
    .from('user_blocks')
    .select('id, blocker_address, created_at')
    .eq('blocked_address', myAddr);

  if (!data) return { status: true, total: 0, page, limit, pages: 0, items: [] };

  const items: BlockedByUser[] = data.map(b => ({
    blockId: b.id, address: b.blocker_address, blockedAt: b.created_at,
  }));

  return { status: true, total: items.length, page, limit, pages: Math.ceil(items.length / limit), items };
}

export async function getBlockStatus(address: string): Promise<BlockStatusResponse> {
  const myAddr = getWallet();
  if (!myAddr) return { youBlocked: false, blockedYou: false, isBlocked: false, isBlockedBy: false };

  const { data: youBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_address', myAddr)
    .eq('blocked_address', address.toLowerCase())
    .maybeSingle();

  const { data: blockedYou } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_address', address.toLowerCase())
    .eq('blocked_address', myAddr)
    .maybeSingle();

  return {
    youBlocked: !!youBlocked, blockedYou: !!blockedYou,
    isBlocked: !!youBlocked, isBlockedBy: !!blockedYou,
  };
}
