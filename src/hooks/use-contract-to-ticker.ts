import { useQuery } from '@tanstack/react-query';
import { fetchBaseErc20Metadata } from '@/lib/onchain-erc20';

/**
 * Resolves a contract address to a token symbol.
 * Tries DexScreener first (multi-chain) then falls back to on-chain ERC20
 * metadata from a Base RPC for tokens with no listed liquidity.
 * Returns the symbol prefixed with $ (e.g. "$Coins") or null.
 */
async function resolveContractToSymbol(address: string): Promise<string | null> {
  // 1) DexScreener (any chain)
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/${address}`);
    if (res.ok) {
      const pairs = await res.json();
      if (Array.isArray(pairs) && pairs.length > 0) {
        pairs.sort((a: any, b: any) => {
          const aBase = a.chainId === 'base' ? 1 : 0;
          const bBase = b.chainId === 'base' ? 1 : 0;
          if (aBase !== bBase) return bBase - aBase;
          return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
        });
        const symbol = pairs[0]?.baseToken?.symbol;
        if (symbol) return `$${symbol.toUpperCase()}`;
      }
    }
  } catch {
    // fall through
  }

  // 2) On-chain ERC20 metadata on Base
  const meta = await fetchBaseErc20Metadata(address);
  return meta?.symbol ? `$${meta.symbol.toUpperCase()}` : null;
}

export function useContractToTicker(query: string) {
  const trimmed = query.trim().toLowerCase();
  const isContractAddress = /^0x[a-f0-9]{40}$/i.test(trimmed);

  const { data: resolvedTicker, isLoading } = useQuery({
    queryKey: ['contract-to-ticker', trimmed],
    queryFn: () => resolveContractToSymbol(trimmed),
    enabled: isContractAddress,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    isContractAddress,
    resolvedTicker: isContractAddress ? resolvedTicker ?? null : null,
    isResolving: isContractAddress && isLoading,
  };
}
