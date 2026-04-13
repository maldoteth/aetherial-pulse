const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token',
};

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') ?? '';
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') ?? '';
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') ?? '';

// ── AWS Signature V4 using Web Crypto (native in Deno) ──────────────────────

async function sha256Hex(data: BufferSource): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: BufferSource, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg));
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate    = await hmacSha256(enc.encode('AWS4' + secret), date);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function buildAuthHeader(
  method: string,
  endpoint: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<Record<string, string>> {
  const now = new Date();
  // e.g. "20260413T123456Z"
  const amzDate  = now.toISOString().replace(/[:\-]/g, '').replace(/\.\d{3}/, '');
  const dateOnly = amzDate.slice(0, 8);
  const region   = 'auto';
  const service  = 's3';

  const url      = new URL(`${endpoint}/${R2_BUCKET_NAME}/${key}`);
  const host     = url.host;
  const bodyHash = await sha256Hex(body);

  // Canonical headers (must be sorted)
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${bodyHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    url.pathname,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateOnly}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join('\n');

  const signingKey  = await getSigningKey(R2_SECRET_ACCESS_KEY, dateOnly, region, service);
  const sigBuf      = await hmacSha256(signingKey, stringToSign);
  const signature   = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization':        authorization,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
    'Content-Type':         contentType,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();
  console.log('[r2-upload] Request received');

  try {
    const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase() || '';
    const dehubToken    = req.headers.get('x-dehub-token') || '';

    if (!walletAddress || !dehubToken) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[r2-upload] Parsing formData...');
    const formData = await req.formData();
    console.log(`[r2-upload] formData parsed (${Date.now() - t0}ms)`);

    const file   = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext         = file.name.split('.').pop() || 'bin';
    const key         = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = file.type || 'application/octet-stream';

    console.log(`[r2-upload] File: ${file.name} (${file.size} bytes) → key: ${key}`);

    const body     = new Uint8Array(await file.arrayBuffer());
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    console.log('[r2-upload] Signing request...');
    const authHeaders = await buildAuthHeader('PUT', endpoint, key, body, contentType);

    const uploadUrl = `${endpoint}/${R2_BUCKET_NAME}/${key}`;
    console.log(`[r2-upload] PUT ${uploadUrl}`);

    const r2Res = await fetch(uploadUrl, {
      method:  'PUT',
      headers: authHeaders,
      body:    body,
    });

    console.log(`[r2-upload] R2 response: ${r2Res.status} (${Date.now() - t0}ms)`);

    if (!r2Res.ok) {
      const errText = await r2Res.text();
      console.error('[r2-upload] R2 error body:', errText);
      throw new Error(`R2 returned ${r2Res.status}: ${errText}`);
    }

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    console.log('[r2-upload] Done. URL:', publicUrl);

    return new Response(JSON.stringify({ url: publicUrl, key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[r2-upload] Error after ${Date.now() - t0}ms:`, String(error));
    return new Response(JSON.stringify({ error: 'Upload failed', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
