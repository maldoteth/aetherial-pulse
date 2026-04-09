/**
 * Fansite Leaderboard — Uses Supabase cache
 */

export interface LeaderboardEntry {
  account: string; total: number; username?: string; userDisplayName?: string;
  avatarUrl?: string; sentTips: number; receivedTips: number; followers?: number;
  likes?: number; subscribers?: number; delta?: number; badgeBalance?: number;
}

export interface LeaderboardResponse {
  result: { byWalletBalance: LeaderboardEntry[] };
  hasHistoricalData?: boolean;
}

export type LeaderboardSortMode = 'holdings' | 'sentTips' | 'receivedTips' | 'followers' | 'likes' | 'subscribers';
export type LeaderboardPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export async function getLeaderboard(
  sort: LeaderboardSortMode = 'holdings',
  period: LeaderboardPeriod = 'all'
): Promise<LeaderboardResponse> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase
      .from('leaderboard_cache')
      .select('data, updated_at')
      .eq('sort_mode', sort)
      .eq('period', period)
      .single();

    if (data?.data) {
      return data.data as unknown as LeaderboardResponse;
    }
  } catch (e) {
    console.warn('[Leaderboard] Cache unavailable:', e);
  }

  return { result: { byWalletBalance: [] }, hasHistoricalData: false };
}
