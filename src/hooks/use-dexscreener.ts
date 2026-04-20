import { useQuery } from '@tanstack/react-query';
import { CHAIN_CONFIGS, BASE_CHAIN_ID, BNB_CHAIN_ID } from '@/lib/contracts/dhb-token';

/**
 * Internal tokens we know are swappable on Base via Uniswap, even if
 * DexScreener doesn't surface a pair (e.g. no listed pool).
 * Keyed by uppercase symbol.
 */
const KNOWN_BASE_TOKENS: Record<string, { name: string; address: string; logo?: string }> = {
  DHB: {
    name: 'DeHub',
    address: CHAIN_CONFIGS[BASE_CHAIN_ID].dhbToken,
    logo: '/icons/Coins.png',
  },
  COINS: {
    name: 'DeHub',
    address: CHAIN_CONFIGS[BASE_CHAIN_ID].dhbToken,
    logo: '/icons/Coins.png',
  },
};

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string | null;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  } | null;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  } | null;
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: { url: string; label: string }[];
    socials?: { url: string; type: string }[];
  };
}

interface DexSearchResponse {
  pairs: DexPair[] | null;
}

function getH24TxnCount(pair: DexPair): number {
  return (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
}

function compareDexPairs(a: DexPair, b: DexPair) {
  const aIsBase = a.chainId === 'base' ? 1 : 0;
  const bIsBase = b.chainId === 'base' ? 1 : 0;
  if (aIsBase !== bIsBase) return bIsBase - aIsBase;

  const aVolume = a.volume?.h24 || 0;
  const bVolume = b.volume?.h24 || 0;
  if (aVolume !== bVolume) return bVolume - aVolume;

  const aTxns = getH24TxnCount(a);
  const bTxns = getH24TxnCount(b);
  if (aTxns !== bTxns) return bTxns - aTxns;

  const aLiquidity = a.liquidity?.usd || 0;
  const bLiquidity = b.liquidity?.usd || 0;
  if (aLiquidity !== bLiquidity) return bLiquidity - aLiquidity;

  const aCreated = a.pairCreatedAt || 0;
  const bCreated = b.pairCreatedAt || 0;
  return aCreated - bCreated;
}

/**
 * Build a synthetic DexPair entry for a known internal Base token so the UI
 * can render swap controls even when DexScreener has no pair for it.
 */
async function fetchKnownBasePair(symbol: string): Promise<DexPair | null> {
  const known = KNOWN_BASE_TOKENS[symbol];
  if (!known) return null;

  // Try to enrich with on-chain price/liquidity if DexScreener tokens endpoint has data.
  let priceUsd: string | null = null;
  let priceChange: DexPair['priceChange'] = null;
  let liquidity: DexPair['liquidity'] = null;
  let volume: DexPair['volume'] = undefined;
  let marketCap: number | null = null;
  let fdv: number | null = null;
  let pairAddress = '';
  let dexId = 'uniswap';
  let url = '';

  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/base/${known.address}`);
    if (r.ok) {
      const list = await r.json();
      const arr: DexPair[] = Array.isArray(list) ? list : (list?.pairs || []);
      const best = arr.sort(compareDexPairs)[0];
      if (best) {
        priceUsd = best.priceUsd;
        priceChange = best.priceChange ?? null;
        liquidity = best.liquidity ?? null;
        volume = best.volume;
        marketCap = best.marketCap ?? null;
        fdv = best.fdv ?? null;
        pairAddress = best.pairAddress;
        dexId = best.dexId;
        url = best.url;
      }
    }
  } catch {
    // ignore — fall back to static pair
  }

  return {
    chainId: 'base',
    dexId,
    url: url || `https://dexscreener.com/base/${known.address}`,
    pairAddress,
    baseToken: { address: known.address, name: known.name, symbol },
    quoteToken: { address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', symbol: 'WETH' },
    priceNative: '0',
    priceUsd,
    priceChange,
    volume,
    liquidity,
    marketCap,
    fdv,
    info: known.logo ? { imageUrl: known.logo } : undefined,
  };
}

async function searchDexScreenerMulti(query: string): Promise<DexPair[]> {
  const symbol = query.replace(/^\$/, '').toUpperCase();
  if (!symbol) return [];

  const [searchRes, knownBasePair] = await Promise.all([
    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? (r.json() as Promise<DexSearchResponse>) : null))
      .catch(() => null),
    fetchKnownBasePair(symbol),
  ]);

  const apiPairs = (searchRes?.pairs || []).filter(
    (p) => p.baseToken.symbol.toUpperCase() === symbol
  );

  // Merge: prepend the known Base pair if API didn't already include one for it.
  const exactMatches: DexPair[] = [];
  if (knownBasePair) {
    const dup = apiPairs.find(
      (p) => p.chainId === 'base' &&
        p.baseToken.address.toLowerCase() === knownBasePair.baseToken.address.toLowerCase()
    );
    exactMatches.push(dup || knownBasePair);
    for (const p of apiPairs) if (p !== dup) exactMatches.push(p);
  } else {
    exactMatches.push(...apiPairs);
  }

  if (exactMatches.length === 0) return [];

  // Sort: Base chain first, then prefer active/liquid markets over spoof pools
  exactMatches.sort(compareDexPairs);

  // Deduplicate by token address — keep best pool per unique token
  const seenTokens = new Set<string>();
  const deduped: DexPair[] = [];
  for (const pair of exactMatches) {
    const tokenKey = `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`;
    if (seenTokens.has(tokenKey)) continue;
    seenTokens.add(tokenKey);
    deduped.push(pair);
    if (deduped.length >= 4) break;
  }

  return deduped;
}

export function useDexScreenerSearch(query: string, enabled: boolean) {
  const isCashtag = query.trim().startsWith('$') && query.trim().length >= 2;

  return useQuery({
    queryKey: ['dexscreener', query.trim()],
    queryFn: async () => {
      const results = await searchDexScreenerMulti(query.trim());
      return results[0] || null;
    },
    enabled: enabled && isCashtag,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useDexScreenerSearchMulti(query: string, enabled: boolean) {
  const isCashtag = query.trim().startsWith('$') && query.trim().length >= 2;

  return useQuery({
    queryKey: ['dexscreener-multi', query.trim()],
    queryFn: () => searchDexScreenerMulti(query.trim()),
    enabled: enabled && isCashtag,
    staleTime: 30_000,
    retry: 1,
  });
}
