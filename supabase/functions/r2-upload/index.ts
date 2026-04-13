const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token',
};
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.600.0';

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

/**
 * Validate a DeHub JWT by calling the account_info endpoint.
 * (Consistent with dm-upload-media security)
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
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate DeHub session
    const isValid = await validateDeHubToken(dehubToken, walletAddress);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique key
    const ext = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const key = `${folder}/${timestamp}-${random}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
    }));

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;

    return new Response(JSON.stringify({ url: publicUrl, key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('R2 upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
