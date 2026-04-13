const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token',
};
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.600.0';

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') ?? '';
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') ?? '';
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();
  console.log('[r2-upload] Request received');

  try {
    // --- ENV check ---
    console.log('[r2-upload] ENV check:', {
      hasAccountId: !!R2_ACCOUNT_ID,
      hasAccessKey: !!R2_ACCESS_KEY_ID,
      hasSecretKey: !!R2_SECRET_ACCESS_KEY,
      hasBucket: !!R2_BUCKET_NAME,
      hasPublicUrl: !!R2_PUBLIC_URL,
      endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 'MISSING',
      bucket: R2_BUCKET_NAME || 'MISSING',
    });

    const walletAddress = req.headers.get('x-wallet-address')?.toLowerCase() || '';
    const dehubToken = req.headers.get('x-dehub-token') || '';

    if (!walletAddress || !dehubToken) {
      console.warn('[r2-upload] Missing auth headers');
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[r2-upload] Auth headers present, wallet:', walletAddress.slice(0, 10) + '...');

    // --- Parse FormData ---
    console.log('[r2-upload] Parsing formData...');
    const formData = await req.formData();
    console.log(`[r2-upload] formData parsed (${Date.now() - t0}ms)`);

    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      console.error('[r2-upload] No file in formData');
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[r2-upload] File info:', { name: file.name, type: file.type, size: file.size, folder });

    // --- Generate key ---
    const ext = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const key = `${folder}/${timestamp}-${random}.${ext}`;
    const contentType = file.type || 'application/octet-stream';

    console.log('[r2-upload] Key:', key, '| ContentType:', contentType);

    // --- Read file ---
    console.log('[r2-upload] Reading arrayBuffer...');
    const arrayBuffer = await file.arrayBuffer();
    console.log(`[r2-upload] arrayBuffer ready, ${arrayBuffer.byteLength} bytes (${Date.now() - t0}ms)`);

    // --- S3 client ---
    console.log('[r2-upload] Creating S3 client...');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // --- Upload ---
    console.log('[r2-upload] Sending PutObjectCommand...');
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: new Blob([arrayBuffer], { type: contentType }),
      ContentType: contentType,
    }));
    console.log(`[r2-upload] S3 upload done (${Date.now() - t0}ms)`);

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    console.log('[r2-upload] Public URL:', publicUrl);

    return new Response(JSON.stringify({ url: publicUrl, key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[r2-upload] Error after ${Date.now() - t0}ms:`, error);
    console.error('[r2-upload] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(JSON.stringify({ error: 'Upload failed', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
