/**
 * Hook for fetching staking page data
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { ChainId } from '@/components/app/ChainSelector';

export interface UnstakeEvent {
  wallet: string;
  amount: string;
  txHash: string;
  timestamp: number;
  chain: 'BNB' | 'Base';
}

const erc20BalanceInterface = null;

// NOTE: This is a brand-new token — no on-chain staking activity exists yet.
// All staking stats, user balances, queues, and TVL are intentionally hardcoded
// to zero until the token launches and real staking begins. Once live, restore
// the original on-chain + DB queries (see git history).

async function fetchUnstakeQueue(): Promise<UnstakeEvent[]> {
  return [];
}

export function useStakingStats() {
  return useQuery({
    queryKey: ['staking-stats'],
    queryFn: async () => ({
      bnbStaked: '0',
      baseStaked: '0',
      totalStaked: '0',
      bnbStakedRaw: BigInt(0),
      baseStakedRaw: BigInt(0),
      totalStakedRaw: BigInt(0),
    }),
    staleTime: Infinity,
  });
}

/**
 * Get user's unstaked Coins balance on a specific chain.
 * Returns 0 — token not launched yet.
 */
export async function getUserDHBBalance(_userAddress: string, _chainId: ChainId): Promise<bigint> {
  return BigInt(0);
}

export interface UserStakingData {
  // BNB
  bnbStaked: string;
  bnbStakedRaw: bigint;
  bnbBalance: string;
  bnbBalanceRaw: bigint;
  bnbEarned: string;
  bnbEarnedRaw: bigint;
  bnbAllowance: bigint;
  // Base
  baseBalance: string;
  baseBalanceRaw: bigint;
  // Combined
  totalStaked: number;
  totalUnstaked: number;
  totalUnstakeQueued: number;
  hasBNBBalance: boolean;
  hasBaseBalance: boolean;
  hasBothChains: boolean;
  userAddress: string;
}

export function useUserStakingData() {
  const { walletAddress, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['user-staking-data', walletAddress?.toLowerCase()],
    queryFn: async (): Promise<UserStakingData | null> => {
      if (!walletAddress) return null;
      return {
        bnbStaked: '0',
        bnbStakedRaw: BigInt(0),
        bnbBalance: '0',
        bnbBalanceRaw: BigInt(0),
        bnbEarned: '0',
        bnbEarnedRaw: BigInt(0),
        bnbAllowance: BigInt(0),
        baseBalance: '0',
        baseBalanceRaw: BigInt(0),
        totalStaked: 0,
        totalUnstaked: 0,
        totalUnstakeQueued: 0,
        hasBNBBalance: false,
        hasBaseBalance: false,
        hasBothChains: false,
        userAddress: walletAddress,
      };
    },
    enabled: !!walletAddress && isAuthenticated,
    staleTime: Infinity,
  });
}

// Keep backward compat
export function useUserBNBStaking() {
  const { data, ...rest } = useUserStakingData();
  return {
    data: data ? {
      staked: data.bnbStaked,
      stakedRaw: data.bnbStakedRaw,
      earned: data.bnbEarned,
      earnedRaw: data.bnbEarnedRaw,
      allowance: data.bnbAllowance,
      userAddress: data.userAddress,
    } : undefined,
    ...rest,
  };
}

export function useUnstakeQueue() {
  return useQuery({
    queryKey: ['unstake-queue'],
    queryFn: fetchUnstakeQueue,
    staleTime: Infinity,
  });
}

export function useStakingTVL() {
  return { tvl: 0, dhbPrice: 0, totalStakedNum: 0 };
}
