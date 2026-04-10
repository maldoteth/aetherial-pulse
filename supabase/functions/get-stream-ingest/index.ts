/**
 * Cloudflare Stream — live input credentials (RTMP ingest + HLS playback)
 *
 * POST / GET body or query: { tokenId: string } — posts.token_id (serial)
 *
 * Requires: x-wallet-address must match posts.creator_wallet_address for that token.
 *
 * Secrets (Supabase Edge → Settings):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_STREAM_API_TOKEN  (Stream:Edit)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wallet-address, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-request-id, prefer",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

interface CfLiveInputResult {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  webRTC?: { url?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let tokenId: string | null = null;
    if (req.method === "GET") {
      tokenId = new URL(req.url).searchParams.get("tokenId");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      tokenId = body?.tokenId != null ? String(body.tokenId) : null;
    }

    if (!tokenId) {
      return new Response(
        JSON.stringify({ error: "tokenId is required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const wallet = req.headers.get("x-wallet-address")?.toLowerCase() || "";
    if (!wallet) {
      return new Response(
        JSON.stringify({ error: "x-wallet-address header required" }),
        { status: 401, headers: corsHeaders },
      );
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
    if (!accountId || !cfToken) {
      console.error("[get-stream-ingest] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_STREAM_API_TOKEN");
      return new Response(
        JSON.stringify({
          error: "Stream not configured",
          message: "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN on this Edge Function.",
        }),
        { status: 503, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const numeric = Number(tokenId);
    if (Number.isNaN(numeric)) {
      return new Response(JSON.stringify({ error: "Invalid tokenId" }), { status: 400, headers: corsHeaders });
    }

    const { data: post, error: postErr } = await supabase
      .from("posts")
      .select("id, token_id, creator_wallet_address, title, metadata")
      .eq("token_id", numeric)
      .maybeSingle();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers: corsHeaders });
    }

    if (!post.creator_wallet_address || post.creator_wallet_address.toLowerCase() !== wallet) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const existingMeta = (post.metadata || {}) as Record<string, unknown>;
    const existingCf = existingMeta.cloudflare as Record<string, unknown> | undefined;
    if (existingCf?.uid && existingCf?.rtmpsUrl && existingCf?.streamKey) {
      const uid = String(existingCf.uid);
      const hlsUrl = String(existingCf.hlsUrl || `https://videodelivery.net/${uid}/manifest/video.m3u8`);
      return new Response(
        JSON.stringify({
          ingestUrl: existingCf.rtmpsUrl,
          streamKey: existingCf.streamKey,
          hlsUrl,
          playbackUrl: existingCf.playbackUrl || `/post/${tokenId}`,
          streamId: uid,
          uid,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    const title = (post as { title?: string }).title || `live-${tokenId}`;
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meta: { name: title.slice(0, 120) },
          recording: { mode: "automatic" },
        }),
      },
    );

    const cfJson = await cfRes.json();
    if (!cfRes.ok || !cfJson?.success) {
      console.error("[get-stream-ingest] Cloudflare error:", cfRes.status, cfJson);
      return new Response(
        JSON.stringify({
          error: "Cloudflare Stream API error",
          message: cfJson?.errors?.[0]?.message || cfJson?.message || "Unknown",
        }),
        { status: 502, headers: corsHeaders },
      );
    }

    const result = cfJson.result as CfLiveInputResult;
    const uid = result.uid;
    const rtmps = result.rtmps;
    const ingestUrl = rtmps?.url || "";
    const streamKey = rtmps?.streamKey || "";
    if (!ingestUrl || !streamKey) {
      return new Response(
        JSON.stringify({ error: "Stream not ready", message: "Missing RTMP URL or stream key from Cloudflare" }),
        { status: 502, headers: corsHeaders },
      );
    }

    const hlsUrl = `https://videodelivery.net/${uid}/manifest/video.m3u8`;

    const nextMetadata = {
      ...existingMeta,
      cloudflare: {
        uid,
        liveInputUid: uid,
        rtmpsUrl: ingestUrl,
        streamKey,
        hlsUrl,
        is_live: true,
        createdAt: new Date().toISOString(),
      },
    };

    await supabase.from("posts").update({ metadata: nextMetadata }).eq("id", post.id);

    return new Response(
      JSON.stringify({
        ingestUrl,
        streamKey,
        hlsUrl,
        playbackUrl: `/post/${tokenId}`,
        streamId: uid,
        uid,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[get-stream-ingest]", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
