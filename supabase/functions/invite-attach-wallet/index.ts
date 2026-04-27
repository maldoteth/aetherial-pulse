// invite-attach-wallet — silently link a redeemed code to the user's wallet on first login
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

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "").slice(0, 200);
    if (!sessionId) {
      return json({ ok: false, reason: "missing_session" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the most recent redemption row for this session that is still unattached.
    const { data: row, error: findErr } = await supabase
      .from("invite_code_uses")
      .select("id, code, used_by_wallet")
      .eq("used_by_session", sessionId)
      .is("used_by_wallet", null)
      .order("used_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("[invite-attach-wallet] find error", findErr);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    if (!row) {
      return json({ ok: true, attached: false, reason: "no_pending_redemption" });
    }

    const { error: updateErr } = await supabase
      .from("invite_code_uses")
      .update({ used_by_wallet: wallet })
      .eq("id", row.id);

    if (updateErr) {
      console.error("[invite-attach-wallet] update error", updateErr);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    return json({ ok: true, attached: true, code: row.code });
  } catch (err) {
    console.error("[invite-attach-wallet] exception", err);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
