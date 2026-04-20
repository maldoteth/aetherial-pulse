/**
 * On-chain ERC20 metadata fallback
 * =================================
 * Reads `name()`, `symbol()`, `decimals()` directly from a Base RPC when
 * external aggregators (DexScreener, CMC, CoinGecko) don't recognise a token.
 * Lets the app surface ANY ERC20 deployed on Base — even brand-new pools, or
 * tokens with no listed liquidity — so the Uniswap Instant Swap drawer can
 * still attempt a quote.
 */

const BASE_RPCS = [
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
];

// 4-byte function selectors
const SEL_NAME = '0x06fdde03';
const SEL_SYMBOL = '0x95d89b41';
const SEL_DECIMALS = '0x313ce567';

function isHexAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
}

/** Decodes an ABI-encoded `string` from an `eth_call` hex result. */
function decodeString(hex: string | null): string | null {
  if (!hex || hex === '0x' || hex.length < 130) return null;
  try {
    const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
    // Layout: [offset:32][length:32][data:padded]
    const lenHex = raw.slice(64, 128);
    const len = parseInt(lenHex, 16);
    if (!len || len > 200) return null;
    const dataHex = raw.slice(128, 128 + len * 2);
    let out = '';
    for (let i = 0; i < dataHex.length; i += 2) {
      out += String.fromCharCode(parseInt(dataHex.slice(i, i + 2), 16));
    }
    return out.trim();
  } catch {
    return null;
  }
}

function decodeUint8(hex: string | null): number | null {
  if (!hex || hex === '0x') return null;
  try {
    const n = parseInt(hex.slice(-2), 16);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

interface RpcCall { to: string; data: string }

async function rpcBatch(calls: RpcCall[]): Promise<(string | null)[]> {
  const body = calls.map((c, i) => ({
    jsonrpc: '2.0',
    id: i,
    method: 'eth_call',
    params: [{ to: c.to, data: c.data }, 'latest'],
  }));

  for (const url of BASE_RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (!Array.isArray(json)) continue;
      const out: (string | null)[] = new Array(calls.length).fill(null);
      for (const item of json) {
        if (typeof item.id === 'number' && item.result) out[item.id] = item.result;
      }
      return out;
    } catch {
      // try next RPC
    }
  }
  return new Array(calls.length).fill(null);
}

export interface OnChainErc20 {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Reads basic ERC20 metadata for a token deployed on Base. Returns null if
 * the address is malformed, the contract isn't ERC20, or all RPCs fail.
 */
export async function fetchBaseErc20Metadata(address: string): Promise<OnChainErc20 | null> {
  if (!isHexAddress(address)) return null;
  const to = address.toLowerCase();

  const [nameHex, symbolHex, decimalsHex] = await rpcBatch([
    { to, data: SEL_NAME },
    { to, data: SEL_SYMBOL },
    { to, data: SEL_DECIMALS },
  ]);

  const symbol = decodeString(symbolHex);
  if (!symbol) return null; // not a standard ERC20

  return {
    address: to,
    name: decodeString(nameHex) || symbol,
    symbol,
    decimals: decodeUint8(decimalsHex) ?? 18,
  };
}
