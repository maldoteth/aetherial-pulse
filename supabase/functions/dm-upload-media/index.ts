import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.600.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL')!;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validate a DeHub JWT by calling the account_info endpoint.
 */
async function validateDeHubToken(token: string, address: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.dehub.io/api/account_info/${address}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase() || '';
    const dehubToken = req.headers.get('x-dehub-token') || '';

    if (!walletAddress || !dehubToken) {
      return jsonResponse({ ok: false, error: 'Authentication required' }, 401);
    }

    // Validate DeHub session
    const isValid = await validateDeHubToken(dehubToken, walletAddress);
    if (!isValid) {
      return jsonResponse({ ok: false, error: 'Invalid session' }, 401);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'dm-media';

    if (!file) {
      return jsonResponse({ ok: false, error: 'No file provided' }, 400);
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${folder}/${walletAddress}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    
    // Upload to R2
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;
    console.log(`[dm-upload-media] Uploaded to R2: ${publicUrl}`);

    return jsonResponse({ ok: true, url: publicUrl });
  } catch (err) {
    console.error('[dm-upload-media] Error:', err);
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
