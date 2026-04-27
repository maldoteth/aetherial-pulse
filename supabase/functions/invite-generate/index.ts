// invite-generate — authenticated user (via x-wallet-address) creates a new code
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wallet-address",
};

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DAILY_LIMIT = 20;

function generateCode(): string {
  let p1 = "", p2 = "";
  for (let i = 0; i < 4; i++) p1 += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  for (let i = 0; i < 4; i++) p2 += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return `${p1}-${p2}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const wallet = (req.headers.get("x-wallet-address") ?? "").toLowerCase().trim();
    if (!wallet || !/^0x[0-9a-f]{40}$/.test(wallet)) {
      return json({ ok: false, reason: "missing_wallet" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Daily rate limit
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("invite_codes")
      .select("code", { count: "exact", head: true })
      .ilike("created_by", wallet)
      .gte("created_at", since);

    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ ok: false, reason: "rate_limited", limit: DAILY_LIMIT });
    }

    // Insert with retries on collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from("invite_codes")
        .insert({
          code,
          created_by: wallet,
          max_uses: 1,
          use_count: 0,
          is_active: true,
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        return json({ ok: true, code });
      }
      // Unique violation? retry
      if (error && (error as { code?: string }).code !== "23505") {
        console.error("[invite-generate] insert error", error);
        return json({ ok: false, reason: "server_error" }, 500);
      }
    }

    return json({ ok: false, reason: "collision_retry" }, 500);
  } catch (err) {
    console.error("[invite-generate] exception", err);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
