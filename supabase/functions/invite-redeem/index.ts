// invite-redeem — public, validates and consumes an invite code
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
    const body = await req.json().catch(() => ({}));
    const rawCode = String(body?.code ?? "").trim().toUpperCase();
    const sessionId = String(body?.sessionId ?? "").slice(0, 200);

    if (!rawCode || rawCode.length < 4 || rawCode.length > 32) {
      return json({ ok: false, reason: "invalid_format" }, 400);
    }
    if (!sessionId) {
      return json({ ok: false, reason: "missing_session" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch the code
    const { data: codeRow, error: fetchErr } = await supabase
      .from("invite_codes")
      .select("code, max_uses, use_count, is_active")
      .eq("code", rawCode)
      .maybeSingle();

    if (fetchErr) {
      console.error("[invite-redeem] fetch error", fetchErr);
      return json({ ok: false, reason: "server_error" }, 500);
    }
    if (!codeRow) {
      return json({ ok: false, reason: "not_found" });
    }
    if (!codeRow.is_active) {
      return json({ ok: false, reason: "inactive" });
    }

    // Check if this session has already redeemed this code (idempotency)
    const { data: existingUse } = await supabase
      .from("invite_code_uses")
      .select("id")
      .eq("code", rawCode)
      .eq("used_by_session", sessionId)
      .maybeSingle();

    if (existingUse) {
      return json({ ok: true, alreadyRedeemed: true });
    }

    if (codeRow.use_count >= codeRow.max_uses) {
      return json({ ok: false, reason: "exhausted" });
    }

    // Conditionally bump use_count using optimistic concurrency
    const { data: bumped, error: bumpErr } = await supabase
      .from("invite_codes")
      .update({ use_count: codeRow.use_count + 1 })
      .eq("code", rawCode)
      .eq("use_count", codeRow.use_count)
      .select()
      .maybeSingle();

    if (bumpErr || !bumped) {
      console.error("[invite-redeem] bump error", bumpErr);
      return json({ ok: false, reason: "race_retry" });
    }

    // Log the use
    await supabase.from("invite_code_uses").insert({
      code: rawCode,
      used_by_session: sessionId,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("[invite-redeem] exception", err);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
