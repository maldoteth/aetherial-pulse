/**
 * Record post views (batch) — Supabase-backed replacement for /api/view/batch
 *
 * POST body: { tokenIds: number[] }
 * Optional header: x-wallet-address (must be present for counting to reduce spam)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wallet-address, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-request-id, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const wallet = req.headers.get("x-wallet-address")?.toLowerCase();
    if (!wallet) {
      return new Response(JSON.stringify({ error: "x-wallet-address required" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const raw = body?.tokenIds ?? body?.token_ids;
    if (!Array.isArray(raw) || raw.length === 0) {
      return new Response(JSON.stringify({ error: "tokenIds array required" }), { status: 400, headers: corsHeaders });
    }

    const tokenIds = raw
      .map((n: unknown) => (typeof n === "number" ? n : parseInt(String(n), 10)))
      .filter((n: number) => !Number.isNaN(n) && n > 0);

    if (tokenIds.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.rpc("increment_post_views_batch", { p_token_ids: tokenIds });
    if (error) {
      console.error("[record-post-views]", error);
      return new Response(JSON.stringify({ error: "Failed to record views" }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ success: true, processed: tokenIds.length }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    console.error("[record-post-views]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
