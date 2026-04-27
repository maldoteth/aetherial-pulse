// invite-stats — returns the caller's codes + total invites
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wallet-address",
};

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

    const { data: codes, error: codesErr } = await supabase
      .from("invite_codes")
      .select("code, created_at, max_uses, use_count, is_active")
      .ilike("created_by", wallet)
      .order("created_at", { ascending: false })
      .limit(500);

    if (codesErr) {
      console.error("[invite-stats] codes error", codesErr);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    const totalInvites = (codes ?? []).reduce((sum, c) => sum + (c.use_count ?? 0), 0);

    return json({
      ok: true,
      codes: codes ?? [],
      totalInvites,
      activeCodes: (codes ?? []).filter((c) => c.is_active && c.use_count < c.max_uses).length,
    });
  } catch (err) {
    console.error("[invite-stats] exception", err);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
