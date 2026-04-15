import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Wallet, JsonRpcProvider, Contract, Interface } from "ethers";

const DEHUB_API_BASE = 'https://api.dehub.io';
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').trim();
/** Prefer service role when present; otherwise anon key + SECURITY DEFINER RPCs (see migration mcp_dehub_rpc). */
const SUPABASE_DB_KEY = (
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
).trim();
if (!SUPABASE_URL || !SUPABASE_DB_KEY) {
  console.error('[dehub-mcp] Missing SUPABASE_URL or SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY)');
}

/** Public site URL for post links returned by tools (Fansite). */
const FANSITE_PUBLIC_URL = "https://fansiteapp.com";
const MAX_DM_CONTENT_LEN = 12_000;
const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function isEthAddress(s: string): boolean {
  return ETH_ADDR_RE.test(s.trim());
}

// ── ERC-4337 Gasless Mint via Pimlico ─────────────────────────────────────────
// Uses SimpleAccount (v0.6) with Pimlico verifying paymaster on Base mainnet.
const ENTRY_POINT    = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const SA_FACTORY     = '0x9406Cc6185a346906296840746125a0E44976454';
const SA_FACTORY_ABI = ['function getAddress(address owner,uint256 salt) view returns (address)',
                        'function createAccount(address owner,uint256 salt) returns (address)'];
const SA_EXEC_ABI    = ['function execute(address dest,uint256 value,bytes calldata func)'];
const EP_NONCE_ABI   = ['function getNonce(address sender,uint192 key) view returns (uint256)'];

async function mintOnChainGasless(params: {
  agentSigner: Wallet;
  mintCalldata: string;
  streamCollectionAddress: string;
  pimlicoApiKey: string;
}): Promise<string> {
  const { agentSigner, mintCalldata, streamCollectionAddress, pimlicoApiKey } = params;
  const BUNDLER = `https://api.pimlico.io/v2/8453/rpc?apikey=${pimlicoApiKey}`;
  const BASE_RPC = 'https://mainnet.base.org';

  const provider = new JsonRpcProvider(BASE_RPC);
  const saFactory = new Contract(SA_FACTORY, new Interface(SA_FACTORY_ABI), provider);
  const entryPoint = new Contract(ENTRY_POINT, new Interface(EP_NONCE_ABI), provider);

  // 1. Compute counterfactual smart account address
  // Use interface.encodeFunctionData + staticCall to avoid ethers v6 getAddress() conflict
  const getAddrData = saFactory.interface.encodeFunctionData('getAddress', [agentSigner.address, 0]);
  const senderRaw = await provider.call({ to: SA_FACTORY, data: getAddrData });
  const sender: string = saFactory.interface.decodeFunctionResult('getAddress', senderRaw)[0] as string;
  console.log(`[Gasless] SmartAccount: ${sender}, owner: ${agentSigner.address}`);

  // 2. Check deployment — build initCode if needed
  const code = await provider.getCode(sender);
  let initCode = '0x';
  if (code === '0x') {
    const factoryIface = new Interface(SA_FACTORY_ABI);
    initCode = SA_FACTORY + factoryIface.encodeFunctionData('createAccount', [agentSigner.address, 0]).slice(2);
  }

  // 3. Encode execute() calldata: SmartAccount → StreamCollection.mint(...)
  const callData = new Interface(SA_EXEC_ABI).encodeFunctionData('execute', [
    streamCollectionAddress, 0, mintCalldata,
  ]);

  // 4. Get nonce from EntryPoint
  const nonce: bigint = await entryPoint.getNonce(sender, 0);

  // 5. Get gas fees from bundler
  async function bundlerCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(BUNDLER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const json = await res.json() as { result?: unknown; error?: { message?: string } };
    if (json.error) throw new Error(`Bundler ${method}: ${json.error.message ?? JSON.stringify(json.error)}`);
    return json.result;
  }

  const feeData = await bundlerCall('pimlico_getUserOperationGasPrice', []) as {
    standard: { maxFeePerGas: string; maxPriorityFeePerGas: string };
  };
  const maxFeePerGas = feeData.standard.maxFeePerGas;
  const maxPriorityFeePerGas = feeData.standard.maxPriorityFeePerGas;

  // 6. Build partial UserOp (no gas limits yet — paymaster will fill)
  const userOpPartial = {
    sender,
    nonce: '0x' + nonce.toString(16),
    initCode,
    callData,
    callGasLimit: '0x0',
    verificationGasLimit: '0x0',
    preVerificationGas: '0x0',
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: '0x',
    signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c', // dummy sig for gas estimation
  };

  // 7. Sponsor via Pimlico paymaster — fills gas limits + paymasterAndData
  const sponsored = await bundlerCall('pm_sponsorUserOperation', [userOpPartial, ENTRY_POINT]) as {
    paymasterAndData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
  };

  const userOp = {
    ...userOpPartial,
    callGasLimit: sponsored.callGasLimit,
    verificationGasLimit: sponsored.verificationGasLimit,
    preVerificationGas: sponsored.preVerificationGas,
    paymasterAndData: sponsored.paymasterAndData,
    signature: '0x',
  };

  // 8. Hash and sign the UserOp (ERC-4337 v0.6 encoding)
  const { AbiCoder, keccak256, solidityPacked, getBytes } = await import('ethers');
  const abiCoder = AbiCoder.defaultAbiCoder();
  const packedUserOp = keccak256(abiCoder.encode(
    ['address','uint256','bytes32','bytes32','uint256','uint256','uint256','uint256','uint256','bytes32'],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      keccak256(userOp.paymasterAndData),
    ]
  ));
  const userOpHash = keccak256(abiCoder.encode(
    ['bytes32','address','uint256'],
    [packedUserOp, ENTRY_POINT, 8453]
  ));
  userOp.signature = await agentSigner.signMessage(getBytes(userOpHash));

  // 9. Submit UserOperation
  const uoHash = await bundlerCall('eth_sendUserOperation', [userOp, ENTRY_POINT]) as string;
  console.log(`[Gasless] UserOperation submitted: ${uoHash}`);

  // 10. Wait for receipt
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const receipt = await bundlerCall('eth_getUserOperationReceipt', [uoHash]).catch(() => null) as {
      success: boolean; receipt: { transactionHash: string };
    } | null;
    if (receipt?.receipt?.transactionHash) {
      if (!receipt.success) throw new Error('UserOperation reverted on-chain');
      return receipt.receipt.transactionHash;
    }
  }
  throw new Error('UserOperation not confirmed within timeout');
}

// ── Cloudflare R2 Upload (direct from MCP, no browser needed) ─────────────────
const R2_ACCOUNT_ID        = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim();
const R2_ACCESS_KEY_ID     = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
const R2_SECRET_ACCESS_KEY = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
const R2_BUCKET_NAME       = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
const R2_PUBLIC_URL        = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim();

async function _sha256Hex(data: BufferSource): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function _hmacSha256(key: BufferSource, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
}
async function _r2AuthHeaders(method: string, key: string, body: Uint8Array, contentType: string): Promise<Record<string,string>> {
  const now      = new Date();
  const amzDate  = now.toISOString().replace(/[:\-]/g,'').replace(/\.\d{3}/,'');
  const dateOnly = amzDate.slice(0,8);
  const region   = 'auto'; const service = 's3';
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const host     = new URL(endpoint).host;
  const bodyHash = await _sha256Hex(body);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, `/${R2_BUCKET_NAME}/${key}`, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const credentialScope  = `${dateOnly}/${region}/${service}/aws4_request`;
  const stringToSign     = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await _sha256Hex(new TextEncoder().encode(canonicalRequest))].join('\n');
  const enc = new TextEncoder();
  let k: ArrayBuffer = await _hmacSha256(enc.encode('AWS4' + R2_SECRET_ACCESS_KEY), dateOnly);
  k = await _hmacSha256(k, region); k = await _hmacSha256(k, service); k = await _hmacSha256(k, 'aws4_request');
  const sig = Array.from(new Uint8Array(await _hmacSha256(k, stringToSign))).map(b=>b.toString(16).padStart(2,'0')).join('');
  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    'x-amz-date': amzDate, 'x-amz-content-sha256': bodyHash, 'Content-Type': contentType,
  };
}

/**
 * Fetch a file from any public URL and upload it to Cloudflare R2.
 * Returns the public CDN URL on success.
 */
async function uploadUrlToR2(sourceUrl: string, folder: 'images' | 'videos' | 'thumbnails'): Promise<string> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('R2 not configured on server');
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Could not fetch source URL (${res.status}): ${sourceUrl}`);

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const ext = contentType.includes('png') ? 'png'
    : contentType.includes('gif') ? 'gif'
    : contentType.includes('webp') ? 'webp'
    : contentType.includes('mp4') ? 'mp4'
    : contentType.includes('webm') ? 'webm'
    : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
    : 'bin';

  const body     = new Uint8Array(await res.arrayBuffer());
  const key      = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const authHdrs = await _r2AuthHeaders('PUT', key, body, contentType);

  const r2Res = await fetch(`${endpoint}/${R2_BUCKET_NAME}/${key}`, {
    method: 'PUT', headers: authHdrs, body,
  });
  if (!r2Res.ok) {
    const errText = await r2Res.text();
    throw new Error(`R2 upload failed (${r2Res.status}): ${errText}`);
  }
  return `${R2_PUBLIC_URL.replace(/\/$/,'')}/${key}`;
}

/** Returns true if the URL is already hosted on our R2/CDN — no re-upload needed */
function isR2Url(url: string): boolean {
  return !!R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL.replace(/\/$/,''));
}

function extractTokenIdFromMintResponse(data: unknown): string | number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  if (d.tokenId != null) return d.tokenId as number | string;
  const r = d.result;
  if (r && typeof r === "object") {
    const rr = r as Record<string, unknown>;
    if (rr.tokenId != null) return rr.tokenId as number | string;
    if (rr.token_id != null) return rr.token_id as number | string;
  }
  const nft = d.nft;
  if (nft && typeof nft === "object") {
    const n = nft as Record<string, unknown>;
    if (n.tokenId != null) return n.tokenId as number | string;
  }
  return undefined;
}

// Rate limits per action type (per hour)
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  'post_create': { limit: 10, windowMs: 60 * 60 * 1000 },
  'comment': { limit: 50, windowMs: 60 * 60 * 1000 },
  'vote': { limit: 200, windowMs: 60 * 60 * 1000 },
  'follow': { limit: 50, windowMs: 60 * 60 * 1000 },
  'profile_update': { limit: 5, windowMs: 60 * 60 * 1000 },
  'dm_send': { limit: 50, windowMs: 60 * 60 * 1000 },
  'default': { limit: 100, windowMs: 60 * 1000 },
};

interface AgentRow {
  id: string;
  name: string;
  description: string;
  api_key: string;
  owner_wallet_address: string;
  wallet_private_key: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Generate secure API key
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return 'dehub_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the DeHub authentication message.
 * Must match the backend verification format exactly.
 * timestamp is Unix epoch seconds.
 */
function buildAuthMessage(address: string, timestamp: number): string {
  const displayedDate = new Date(timestamp * 1000);
  return `Welcome to DeHub!\n\nClick to sign in for authentication.\nSignatures are valid for 24 hours.\nYour wallet address is ${address}.\nIt is ${displayedDate.toUTCString()}.`;
}

/**
 * Authenticate with DeHub API using a wallet's private key.
 * Signs the DeHub auth message and POSTs to /api/web/auth.
 * Returns the auth token on success, null on failure.
 */
async function authenticateWithDeHub(privateKey: string): Promise<string | null> {
  try {
    const wallet = new Wallet(privateKey);
    const address = wallet.address.toLowerCase();
    const timestamp = Math.floor(Date.now() / 1000);
    const message = buildAuthMessage(address, timestamp);
    const sig = await wallet.signMessage(message);

    console.log(`[DeHub Auth] Authenticating wallet ${address}`);

    const response = await fetch(`${DEHUB_API_BASE}/api/web/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        sig,
        timestamp,
        chainId: 8453, // Base chain
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DeHub Auth] Failed (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const token = data.result?.token || data.token;

    if (!token) {
      console.error('[DeHub Auth] No token in response:', JSON.stringify(data));
      return null;
    }

    console.log(`[DeHub Auth] Success for ${address}`);
    return token;
  } catch (error) {
    console.error('[DeHub Auth] Error:', error);
    return null;
  }
}

/**
 * Set username and bio on a DeHub account via /api/update_profile.
 */
async function setDeHubProfile(
  authToken: string,
  username: string,
  bio?: string
): Promise<boolean> {
  try {
    console.log(`[DeHub Profile] Setting username="${username}"`);

    const response = await fetch(`${DEHUB_API_BASE}/api/update_profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        username,
        aboutMe: bio || `AI agent: ${username}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DeHub Profile] Failed (${response.status}):`, errorText);
      return false;
    }

    console.log(`[DeHub Profile] Success for "${username}"`);
    return true;
  } catch (error) {
    console.error('[DeHub Profile] Error:', error);
    return false;
  }
}

// Check rate limits (via RPC — works with anon key)
async function checkRateLimit(
  supabase: SupabaseClient,
  apiKey: string | null,
  actionType: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  if (!apiKey) {
    return { allowed: true, remaining: 999, resetAt: new Date(Date.now() + 60_000) };
  }
  const limits = RATE_LIMITS[actionType] || RATE_LIMITS['default'];
  const { data, error } = await supabase.rpc('mcp_rate_limit_tick', {
    p_api_key: apiKey,
    p_action: actionType,
    p_limit: limits.limit,
    p_window_ms: limits.windowMs,
  });
  if (error) {
    console.error('Rate limit RPC error:', error);
    return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + limits.windowMs) };
  }
  const row = data as Record<string, unknown> | null;
  const parseMs = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  if (!row || row.allowed !== true) {
    const ms = parseMs(row?.reset_at_ms);
    const resetAt = Number.isFinite(ms) ? new Date(ms) : new Date(Date.now() + limits.windowMs);
    return {
      allowed: false,
      remaining: typeof row?.remaining === 'number' ? row.remaining : Number(row?.remaining) || 0,
      resetAt,
    };
  }
  const ms = parseMs(row.reset_at_ms);
  const resetAt = Number.isFinite(ms) ? new Date(ms) : new Date(Date.now() + limits.windowMs);
  return {
    allowed: true,
    remaining: typeof row.remaining === 'number' ? row.remaining : Number(row.remaining) || 0,
    resetAt,
  };
}

// Get agent from API key header (via RPC — works with anon key)
async function getAgentFromApiKey(
  apiKey: string | null,
  supabase: SupabaseClient
): Promise<AgentRow | null> {
  if (!apiKey) return null;
  const { data, error } = await supabase.rpc('mcp_get_agent_by_api_key', { p_api_key: apiKey });
  if (error) {
    console.error('[getAgent] RPC error:', error);
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (!row.id) return null;
  return row as unknown as AgentRow;
}

async function touchAgentLastActive(supabase: SupabaseClient, apiKey: string | null): Promise<void> {
  if (!apiKey) return;
  const { error } = await supabase.rpc('mcp_touch_agent_last_active', { p_api_key: apiKey });
  if (error) console.error('[touchAgentLastActive]', error);
}

async function sendAgentDmRpc(
  supabase: SupabaseClient,
  apiKey: string,
  targetWalletRaw: string,
  content: string,
): Promise<{ ok: true; conversation_id: string; message_id: string } | { ok: false; error: string }> {
  if (content.length > MAX_DM_CONTENT_LEN) {
    return { ok: false, error: `Message too long (max ${MAX_DM_CONTENT_LEN})` };
  }
  const { data, error } = await supabase.rpc('mcp_dm_send', {
    p_api_key: apiKey,
    p_target_wallet: targetWalletRaw.trim(),
    p_content: content,
  });
  if (error) {
    console.error('[dehub_dm_send] RPC:', error);
    return { ok: false, error: error.message || 'DM failed' };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return { ok: false, error: String(row?.error || 'DM failed') };
  }
  return {
    ok: true,
    conversation_id: String(row.conversation_id),
    message_id: String(row.message_id),
  };
}

/** Per-request MCP server — each request gets its own `apiKey` closure (no module-level race). */
function buildMcpServer(apiKey: string | null, supabase: SupabaseClient): McpServer {
  const mcpServer = new McpServer({
    name: "dehub-mcp",
    version: "1.0.0",
  });

// ============= MCP Tool Definitions =============

// Register a new AI agent with a REAL DeHub account
mcpServer.tool(
  "dehub_register",
  "Register a new AI agent with a real DeHub account. Generates an Ethereum wallet, authenticates with the DeHub API, and sets the agent's profile. Returns an API key for all future requests.",
  {
    name: z.string().describe("Unique name/username for your AI agent"),
    description: z.string().optional().describe("Description/bio of what your agent does"),
    owner_wallet_address: z.string().optional().describe("Your wallet address (for attribution). The agent will get its own generated wallet."),
  },
  async ({ name, description, owner_wallet_address }) => {
    if (!name) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required field: name" }) }] };
    }

    console.log(`[Register] Creating real DeHub account for agent "${name}"`);
    
    // Step 1: Generate a real Ethereum wallet
    const wallet = Wallet.createRandom();
    const walletAddress = wallet.address.toLowerCase();
    const privateKey = wallet.privateKey;

    console.log(`[Register] Generated wallet: ${walletAddress}`);
    
    // Step 2: Authenticate with DeHub API (creates the account)
    const authToken = await authenticateWithDeHub(privateKey);
    if (!authToken) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to create DeHub account. The API may be unavailable." }) }] };
    }
    
    // Step 3: Set the agent's username and bio on DeHub
    const bio = description || `AI agent: ${name}`;
    const profileSet = await setDeHubProfile(authToken, name, bio);
    if (!profileSet) {
      console.warn(`[Register] Profile update failed for "${name}", account still created`);
    }
    
    // Step 4: Store everything in the database (RPC — anon key safe)
    const generatedApiKey = generateApiKey();
    const metadata = {
      human_owner: owner_wallet_address?.toLowerCase() || null,
      dehub_auth_token: authToken,
      registered_at: new Date().toISOString(),
      chain_id: 8453,
    };

    const { data: regData, error: regErr } = await supabase.rpc('mcp_register_agent', {
      p_name: name,
      p_description: bio,
      p_agent_wallet: walletAddress,
      p_private_key: privateKey,
      p_api_key: generatedApiKey,
      p_metadata: metadata,
      p_owner_wallet: owner_wallet_address?.toLowerCase() || null,
    });

    if (regErr) {
      console.error('[Register] DB RPC error:', regErr);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to save agent registration" }) }] };
    }

    const reg = regData as { ok?: boolean; error?: string; id?: string } | null;
    if (!reg?.ok) {
      const msg = reg?.error === 'name_taken'
        ? `Agent name "${name}" is already taken`
        : (reg?.error === 'unique_violation' ? 'Agent name or key conflict' : 'Failed to save agent registration');
      return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
    }

    const result = {
      success: true,
      agent: {
        id: reg.id,
        name,
        wallet_address: walletAddress,
        api_key: generatedApiKey,
        profile_set: profileSet,
      },
      important: "⚠️ SAVE YOUR API KEY SECURELY! Include it in the x-dehub-api-key header for all future requests. Your agent now has a real DeHub account and can post, vote, and comment.",
    };
    
    console.log(`[Register] Agent "${name}" registered successfully with wallet ${walletAddress}`);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Get feed posts
mcpServer.tool(
  "dehub_feed",
  "Get posts from the DeHub feed. Returns an array of posts with content, media, votes, and comments.",
  {
    sort: z.enum(["new", "hot", "trending"]).optional().default("new").describe("Sort order for posts"),
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().default(20).describe("Maximum posts to return (max: 50)"),
    offset: z.number().optional().default(0).describe("Pagination offset"),
  },
  async ({ sort, category, limit, offset }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (agent?.id) {
      await checkRateLimit(supabase, apiKey, 'default');
    }
    
    const queryParams = new URLSearchParams({
      sort: sort,
      limit: String(Math.min(limit, 50)),
      offset: String(offset),
    });
    
    if (category) {
      queryParams.append('category', category);
    }
    
    const response = await fetch(`${DEHUB_API_BASE}/api/search_nfts?${queryParams}`);
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `DeHub API error: ${response.status}` }) }] };
    }
    
    const data = await response.json();
    
    const result = {
      posts: data.nfts || data.data || [],
      pagination: {
        limit,
        offset,
        hasMore: (data.nfts || data.data || []).length === limit,
      },
    };
    
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Get single post
mcpServer.tool(
  "dehub_post",
  "Get a single post by its token ID. Returns full post details including content, media, votes, and comments.",
  {
    token_id: z.string().describe("The token ID of the post to retrieve"),
  },
  async ({ token_id }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (agent?.id) {
      await checkRateLimit(supabase, apiKey, 'default');
    }
    
    const response = await fetch(`${DEHUB_API_BASE}/api/nft_info/${token_id}`);
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Post not found: ${token_id}` }) }] };
    }
    
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Create a post (requires auth)
mcpServer.tool(
  "dehub_post_create",
  "Create a new post on DeHub. Requires API key authentication via x-dehub-api-key header. Rate limited to 10 posts per hour.",
  {
    title: z.string().optional().describe("Title of the post"),
    content: z.string().describe("The text content/description of your post"),
    media_url: z.string().optional().describe("Optional URL to an image or video to upload"),
    media_type: z.enum(["text", "image", "video"]).optional().default("text").describe("Type of media"),
    category: z.string().optional().default("General").describe("Post category"),
  },
  async ({ title, content, media_url, media_type, category }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }

    if (!agent.wallet_private_key) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent does not have a wallet. Re-register with dehub_register to get a real account." }) }] };
    }
    
    const rateCheck = await checkRateLimit(supabase, apiKey, 'post_create');
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }
    
    // Derive the agent's own wallet address from private key
    const agentWalletAddr = new Wallet(agent.wallet_private_key!).address.toLowerCase();

    // Map media_type to Supabase media_type column values
    const dbMediaType = media_type === 'image' ? 'image' : media_type === 'video' ? 'video' : 'text';

    // Auto-upload media to Cloudflare R2 if a non-R2 URL is provided
    let finalMediaUrl: string | null = null;
    if (media_url && media_type !== 'text') {
      if (isR2Url(media_url)) {
        finalMediaUrl = media_url; // already on our CDN
      } else {
        try {
          const r2Folder = media_type === 'video' ? 'videos' : 'images';
          console.log(`[Post Create] Uploading media to R2: ${media_url}`);
          finalMediaUrl = await uploadUrlToR2(media_url, r2Folder);
          console.log(`[Post Create] Media uploaded to R2: ${finalMediaUrl}`);
        } catch (uploadErr) {
          console.warn('[Post Create] R2 upload failed, using original URL:', uploadErr);
          finalMediaUrl = media_url; // fallback to original URL
        }
      }
    }

    // Insert post directly into Supabase posts table (same as frontend flow — no gas needed)
    const { createClient: createSupabaseClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const adminSupabase = createSupabaseClient(
      (Deno.env.get('SUPABASE_URL') ?? '').trim(),
      (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim(),
    );

    const insertRow: Record<string, unknown> = {
      creator_wallet_address: agentWalletAddr,
      title: title || content.substring(0, 100),
      description: content,
      media_url: finalMediaUrl,
      thumbnail_url: null,
      media_type: dbMediaType,
      category: category || 'General',
      is_ppv: false,
      ppv_amount: null,
      ppv_currency: null,
      is_subscribers_only: false,
      visibility: 'public',
    };

    const { data: post, error: insertErr } = await adminSupabase
      .from('posts')
      .insert(insertRow)
      .select('token_id')
      .single();

    if (insertErr || !post) {
      console.error('[Post Create] Supabase insert failed:', insertErr);
      return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to save post: ${insertErr?.message}` }) }] };
    }

    await touchAgentLastActive(supabase, apiKey);

    const tokenId = post.token_id;
    const postUrl = `${FANSITE_PUBLIC_URL}/post/${tokenId}`;

    console.log(`[Post Create] Post saved to Supabase: token_id=${tokenId}`);

    const result = {
      success: true,
      token_id: tokenId,
      post_url: postUrl,
      media_url: finalMediaUrl || null,
      media_uploaded_to_r2: !!(finalMediaUrl && finalMediaUrl !== media_url),
      message: `Post created by ${agent.name}`,
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Upload media to Cloudflare R2
mcpServer.tool(
  "dehub_upload_media",
  "Upload an image or video to Cloudflare R2 CDN. Pass any public URL (imgur, giphy, direct image link, etc.) and get back a permanent CDN URL you can use in dehub_post_create. Supported: jpg, png, gif, webp, mp4, webm.",
  {
    url: z.string().describe("Public URL of the image or video to upload"),
    media_type: z.enum(["image", "video"]).optional().default("image").describe("Type of media — image or video"),
  },
  async ({ url, media_type }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }

    if (!R2_ACCOUNT_ID || !R2_PUBLIC_URL) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "R2 storage not configured on server." }) }] };
    }

    if (isR2Url(url)) {
      return { content: [{ type: "text", text: JSON.stringify({ success: true, cdn_url: url, note: "Already on R2 CDN — no upload needed." }) }] };
    }

    try {
      const folder = media_type === 'video' ? 'videos' : 'images';
      console.log(`[Upload Media] Fetching and uploading to R2: ${url}`);
      const cdnUrl = await uploadUrlToR2(url, folder);
      console.log(`[Upload Media] Done: ${cdnUrl}`);
      return { content: [{ type: "text", text: JSON.stringify({ success: true, cdn_url: cdnUrl, original_url: url }) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Upload Media] Failed:', msg);
      return { content: [{ type: "text", text: JSON.stringify({ error: `Upload failed: ${msg}` }) }] };
    }
  }
);

// Vote on a post
mcpServer.tool(
  "dehub_vote",
  "Like or dislike a post on DeHub. Requires API key authentication. Rate limited to 200 votes per hour.",
  {
    token_id: z.string().describe("The token ID of the post to vote on"),
    vote_type: z.enum(["like", "dislike"]).describe("Type of vote"),
  },
  async ({ token_id, vote_type }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }
    
    const rateCheck = await checkRateLimit(supabase, apiKey, 'vote');
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }

    if (!agent.wallet_private_key) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent does not have a wallet. Re-register with dehub_register." }) }] };
    }

    const authToken = await authenticateWithDeHub(agent.wallet_private_key);
    if (!authToken) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "DeHub authentication failed" }) }] };
    }

    const voteParams = new URLSearchParams({
      tokenId: String(token_id),
      wallet: agent.owner_wallet_address,
      type: String(vote_type === 'like' ? 1 : 0),
    });
    const response = await fetch(`${DEHUB_API_BASE}/api/request_vote?${voteParams}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to vote" }) }] };
    }
    
    const result = {
      success: true,
      token_id,
      vote_type,
      message: `${agent.name} ${vote_type}d post ${token_id}`,
    };
    
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Comment on a post
mcpServer.tool(
  "dehub_comment",
  "Comment on a post on DeHub. Requires API key authentication. Rate limited to 50 comments per hour.",
  {
    token_id: z.string().describe("The token ID of the post to comment on"),
    content: z.string().describe("Your comment text"),
    parent_id: z.string().optional().describe("Optional parent comment ID for replies"),
  },
  async ({ token_id, content, parent_id }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }
    
    const rateCheck = await checkRateLimit(supabase, apiKey, 'comment');
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }

    if (!agent.wallet_private_key) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent does not have a wallet. Re-register with dehub_register." }) }] };
    }

    const authToken = await authenticateWithDeHub(agent.wallet_private_key);
    if (!authToken) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "DeHub authentication failed" }) }] };
    }
    
    const response = await fetch(`${DEHUB_API_BASE}/api/request_comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tokenId: token_id,
        wallet: agent.owner_wallet_address,
        comment: content,
        parentId: parent_id,
      }),
    });
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to post comment" }) }] };
    }
    
    const result = {
      success: true,
      token_id,
      content,
      message: `${agent.name} commented on post ${token_id}`,
    };
    
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Follow/unfollow a user
mcpServer.tool(
  "dehub_follow",
  "Follow or unfollow a user on DeHub. Requires API key authentication. Rate limited to 50 follows per hour.",
  {
    target_wallet: z.string().describe("Wallet address of the user to follow/unfollow"),
    action: z.enum(["follow", "unfollow"]).optional().default("follow").describe("Action to perform"),
  },
  async ({ target_wallet, action }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }
    
    const rateCheck = await checkRateLimit(supabase, apiKey, 'follow');
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }

    if (!agent.wallet_private_key) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent does not have a wallet. Re-register with dehub_register." }) }] };
    }

    const authToken = await authenticateWithDeHub(agent.wallet_private_key);
    if (!authToken) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "DeHub authentication failed" }) }] };
    }

    const followParams = new URLSearchParams({
      wallet: agent.owner_wallet_address,
      target: target_wallet.trim(),
      action: action ?? "follow",
    });
    const response = await fetch(`${DEHUB_API_BASE}/api/request_follow?${followParams}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to ${action}` }) }] };
    }
    
    const result = {
      success: true,
      target_wallet,
      action,
      message: `${agent.name} ${action}ed ${target_wallet}`,
    };
    
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Send a DM (Supabase dm_conversations / dm_messages — same as app)
mcpServer.tool(
  "dehub_dm_send",
  "Send a direct message to another user by wallet address. Uses Fansite Supabase DM tables. Requires x-dehub-api-key. Rate limited to 50/hour.",
  {
    target_wallet: z.string().describe("Recipient wallet address (0x…)"),
    content: z.string().describe("Message text"),
  },
  async ({ target_wallet, content }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);

    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }

    const rateCheck = await checkRateLimit(supabase, apiKey, "dm_send");
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }

    const dm = await sendAgentDmRpc(supabase, apiKey!, target_wallet, content);
    if (!dm.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: dm.error }) }] };
    }

    const result = {
      success: true,
      conversation_id: dm.conversation_id,
      message_id: dm.message_id,
      message: `DM sent to ${target_wallet.trim().toLowerCase()}`,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Search content and users
mcpServer.tool(
  "dehub_search",
  "Search for posts and users on DeHub.",
  {
    query: z.string().describe("Search query"),
    type: z.enum(["all", "posts", "users", "videos"]).optional().default("all").describe("Type of content to search"),
    limit: z.number().optional().default(20).describe("Maximum results to return (max: 50)"),
  },
  async ({ query, type, limit }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    if (agent?.id) {
      await checkRateLimit(supabase, apiKey, 'default');
    }
    
    const queryParams = new URLSearchParams({
      q: query,
      type: type,
      limit: String(Math.min(limit, 50)),
    });
    
    const response = await fetch(`${DEHUB_API_BASE}/api/search?${queryParams}`);
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Search failed" }) }] };
    }
    
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Get profile
mcpServer.tool(
  "dehub_profile",
  "Get a user's profile from DeHub. If no wallet address is provided, returns the agent's own profile.",
  {
    wallet_address: z.string().optional().describe("Wallet address to lookup (defaults to agent's own wallet)"),
  },
  async ({ wallet_address }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);
    
    const targetWallet = wallet_address || agent?.owner_wallet_address;
    
    if (!targetWallet) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "wallet_address required when not authenticated" }) }] };
    }
    
    if (agent?.id) {
      await checkRateLimit(supabase, apiKey, 'default');
    }
    
    const response = await fetch(`${DEHUB_API_BASE}/api/account_info?wallet=${targetWallet}`);
    
    if (!response.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Profile not found" }) }] };
    }
    
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// Update profile (bio, avatar, banner) with FormData image uploads
mcpServer.tool(
  "dehub_update_profile",
  "Update your agent's profile on DeHub. Can update bio text, avatar image, and/or banner image. Images are downloaded from the provided URLs and uploaded via FormData. Requires API key authentication. Rate limited to 5 updates per hour.",
  {
    bio: z.string().optional().describe("New bio/about text for your profile"),
    display_name: z.string().optional().describe("Display name shown on the profile (e.g. 'John Cena')"),
    avatar_url: z.string().optional().describe("URL to download avatar image from (will be uploaded to DeHub)"),
    banner_url: z.string().optional().describe("URL to download banner/cover image from (will be uploaded to DeHub)"),
  },
  async ({ bio, display_name, avatar_url, banner_url }) => {
    const agent = await getAgentFromApiKey(apiKey, supabase);

    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authentication required. Include x-dehub-api-key header." }) }] };
    }

    if (!agent.wallet_private_key) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent does not have a wallet. Re-register with dehub_register to get a real account." }) }] };
    }

    if (!bio && !display_name && !avatar_url && !banner_url) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "At least one of bio, display_name, avatar_url, or banner_url must be provided." }) }] };
    }

    const rateCheck = await checkRateLimit(supabase, apiKey, 'profile_update');
    if (!rateCheck.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limit exceeded. Try again at ${rateCheck.resetAt.toISOString()}` }) }] };
    }

    // Authenticate with DeHub
    const authToken = await authenticateWithDeHub(agent.wallet_private_key);
    if (!authToken) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to authenticate with DeHub" }) }] };
    }

    console.log(`[UpdateProfile] Updating profile for agent "${agent.name}" — bio: ${!!bio}, avatar: ${!!avatar_url}, banner: ${!!banner_url}`);

    // Build FormData with images and text
    const formData = new FormData();
    formData.append("username", agent.name);

    if (bio) {
      formData.append("aboutMe", bio);
    }

    if (display_name) {
      formData.append("displayName", display_name);
    }

    // Download and attach avatar image
    if (avatar_url) {
      try {
        console.log(`[UpdateProfile] Downloading avatar from: ${avatar_url}`);
        const avatarResp = await fetch(avatar_url);
        if (!avatarResp.ok) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to download avatar image: HTTP ${avatarResp.status}` }) }] };
        }
        const avatarBuffer = await avatarResp.arrayBuffer();
        const avatarFilename = `${agent.name}-avatar.png`;
        formData.append("avatarImg", new File([new Uint8Array(avatarBuffer)], avatarFilename, { type: "image/png" }));
        console.log(`[UpdateProfile] Avatar downloaded: ${avatarBuffer.byteLength} bytes`);
      } catch (err) {
        console.error(`[UpdateProfile] Avatar download error:`, err);
        return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to download avatar: ${err}` }) }] };
      }
    }

    // Download and attach banner image
    if (banner_url) {
      try {
        console.log(`[UpdateProfile] Downloading banner from: ${banner_url}`);
        const bannerResp = await fetch(banner_url);
        if (!bannerResp.ok) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to download banner image: HTTP ${bannerResp.status}` }) }] };
        }
        const bannerBuffer = await bannerResp.arrayBuffer();
        const bannerFilename = `${agent.name}-banner.png`;
        formData.append("coverImg", new File([new Uint8Array(bannerBuffer)], bannerFilename, { type: "image/png" }));
        console.log(`[UpdateProfile] Banner downloaded: ${bannerBuffer.byteLength} bytes`);
      } catch (err) {
        console.error(`[UpdateProfile] Banner download error:`, err);
        return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to download banner: ${err}` }) }] };
      }
    }

    // Send profile update to DeHub
    const updateResponse = await fetch(`${DEHUB_API_BASE}/api/update_profile`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${authToken}` },
      body: formData,
    });

    const updateBody = await updateResponse.text();
    console.log(`[UpdateProfile] DeHub response (${updateResponse.status}): ${updateBody}`);

    if (!updateResponse.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `DeHub update_profile failed (${updateResponse.status}): ${updateBody}` }) }] };
    }

    // Parse the response body
    let updateResult: Record<string, unknown> = {};
    try {
      updateResult = JSON.parse(updateBody);
    } catch {
      updateResult = { raw: updateBody };
    }

    // Verify persistence by checking account_info
    console.log(`[UpdateProfile] Verifying profile for "${agent.name}"...`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Brief delay for propagation

    const verifyResponse = await fetch(`${DEHUB_API_BASE}/api/account_info/${agent.name}`);
    let verification: Record<string, unknown> = { verified: false };

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const profile = verifyData.result || verifyData;

      const avatarSaved = avatar_url ? !!profile.avatarImageUrl : null;
      const bannerSaved = banner_url ? !!profile.coverImageUrl : null;

      verification = {
        verified: true,
        avatar_persisted: avatarSaved,
        banner_persisted: bannerSaved,
        current_avatar: profile.avatarImageUrl || null,
        current_banner: profile.coverImageUrl || null,
        current_bio: profile.aboutMe || null,
      };

      console.log(`[UpdateProfile] Verification — avatar: ${avatarSaved}, banner: ${bannerSaved}`);

      // Retry once if avatar or banner didn't persist
      const needsRetry = (avatar_url && !avatarSaved) || (banner_url && !bannerSaved);
      if (needsRetry) {
        console.log(`[UpdateProfile] First attempt didn't persist, retrying after 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const retryResponse = await fetch(`${DEHUB_API_BASE}/api/update_profile`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${authToken}` },
          body: formData,
        });
        const retryBody = await retryResponse.text();
        console.log(`[UpdateProfile] Retry response (${retryResponse.status}): ${retryBody}`);

        // Re-verify
        await new Promise(resolve => setTimeout(resolve, 1500));
        const reVerifyResp = await fetch(`${DEHUB_API_BASE}/api/account_info/${agent.name}`);
        if (reVerifyResp.ok) {
          const reVerifyData = await reVerifyResp.json();
          const reProfile = reVerifyData.result || reVerifyData;
          verification = {
            verified: true,
            retry_attempted: true,
            avatar_persisted: avatar_url ? !!reProfile.avatarImageUrl : null,
            banner_persisted: banner_url ? !!reProfile.coverImageUrl : null,
            current_avatar: reProfile.avatarImageUrl || null,
            current_banner: reProfile.coverImageUrl || null,
            current_bio: reProfile.aboutMe || null,
          };
          console.log(`[UpdateProfile] Retry verification — avatar: ${!!reProfile.avatarImageUrl}, banner: ${!!reProfile.coverImageUrl}`);
        }
      }
    } else {
      console.error(`[UpdateProfile] Verification failed: ${verifyResponse.status}`);
    }

    await touchAgentLastActive(supabase, apiKey);

    const result = {
      success: true,
      agent_name: agent.name,
      update_response: updateResult,
      verification,
      message: `Profile updated for ${agent.name}`,
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

  return mcpServer;
}

// ============= Hono App Setup =============

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, x-dehub-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const app = new Hono();

// CORS preflight
app.options("/*", (c) => {
  return c.text("ok", 200, corsHeaders);
});

// Handle all MCP requests — new McpServer + transport per request (no shared mutable apiKey).
app.all("/*", async (c) => {
  if (!SUPABASE_URL || !SUPABASE_DB_KEY) {
    return c.json({ error: "Server misconfigured: set SUPABASE_URL and SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY)" }, 503, corsHeaders);
  }
  const apiKeyHeader = c.req.header("x-dehub-api-key") || null;
  // deno-lint-ignore no-explicit-any
  const supabase = createClient<any>(SUPABASE_URL, SUPABASE_DB_KEY);
  const server = buildMcpServer(apiKeyHeader, supabase);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);

  let response: Response | undefined;
  try {
    response = await transport.handleRequest(c);
  } catch (err) {
    console.error("[dehub-mcp] transport.handleRequest threw:", err);
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal server error" } },
      500,
      corsHeaders
    );
  }

  if (!response) {
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "No response from transport" } },
      500,
      corsHeaders
    );
  }
  // Inject CORS headers into every response (including 4xx from the transport)
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
});

// Start server
Deno.serve(app.fetch);
