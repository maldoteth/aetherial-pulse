/**
 * End Stream Session — removes row from live_stream_sessions.
 * Auth: x-wallet-address must match posts.creator_wallet_address for tokenId.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-request-id, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function verifyPostOwner(
  supabase: ReturnType<typeof createClient>,
  tokenId: string,
  wallet: string,
): Promise<boolean> {
  const n = Number(tokenId);
  if (Number.isNaN(n)) return false;
  const { data } = await supabase
    .from("posts")
    .select("creator_wallet_address")
    .eq("token_id", n)
    .maybeSingle();
  return !!(data?.creator_wallet_address && data.creator_wallet_address.toLowerCase() === wallet.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const walletAddress = req.headers.get("x-wallet-address")?.toLowerCase() || "";
  if (!walletAddress) {
    return new Response(
      JSON.stringify({ error: "x-wallet-address header required" }),
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const { tokenId } = body;

    if (!tokenId || typeof tokenId !== "string") {
      return new Response(JSON.stringify({ error: "tokenId is required" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ok = await verifyPostOwner(supabase, tokenId, walletAddress);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { error } = await supabase
      .from("live_stream_sessions")
      .delete()
      .eq("token_id", String(tokenId))
      .eq("address", walletAddress);

    if (error) {
      console.error("[end-stream-session] Delete error:", error);
      return new Response(JSON.stringify({ error: "Failed to end stream session" }), { status: 500, headers: corsHeaders });
    }

    const n = Number(tokenId);
    if (!Number.isNaN(n)) {
      const { data: post } = await supabase.from("posts").select("id, metadata").eq("token_id", n).maybeSingle();
      if (post?.id) {
        const meta = (post.metadata || {}) as Record<string, unknown>;
        const cf = (meta.cloudflare || {}) as Record<string, unknown>;
        await supabase
          .from("posts")
          .update({
            metadata: {
              ...meta,
              cloudflare: { ...cf, is_live: false, endedAt: new Date().toISOString() },
            },
          })
          .eq("id", post.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[end-stream-session] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
