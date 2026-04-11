/**
 * DeHub Social API — posting, engagement (likes), follow, profile/privacy mutations.
 * Auth: x-wallet-address + x-dehub-token (validated against api.dehub.io).
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-request-id, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

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

async function assertOwnPost(
  admin: SupabaseClient,
  wallet: string,
  tokenId: number,
): Promise<{ id: string; token_id: number } | null> {
  const { data } = await admin
    .from("posts")
    .select("id, token_id")
    .eq("token_id", tokenId)
    .eq("creator_wallet_address", wallet)
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const wallet = req.headers.get("x-wallet-address")?.toLowerCase() || "";
  const dehubToken = req.headers.get("x-dehub-token") || "";

  if (!wallet) {
    return json({ ok: false, error: "x-wallet-address required" }, 401);
  }
  if (!dehubToken) {
    return json({ ok: false, error: "x-dehub-token required" }, 401);
  }

  const valid = await validateDeHubToken(dehubToken, wallet);
  if (!valid) {
    return json({ ok: false, error: "Invalid or expired token" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "");

  try {
    switch (action) {
      case "post.create": {
        const insertRow: Record<string, unknown> = {
          creator_wallet_address: wallet,
          title: String(body.title ?? ""),
          description: String(body.description ?? ""),
          media_url: body.media_url ?? null,
          thumbnail_url: body.thumbnail_url ?? null,
          media_type: String(body.media_type ?? "text"),
          category: typeof body.category === "string" ? body.category : null,
          is_ppv: Boolean(body.is_ppv),
          ppv_amount: body.ppv_amount ?? null,
          ppv_currency: body.ppv_currency ?? null,
          is_subscribers_only: Boolean(body.is_subscribers_only),
          visibility: String(body.visibility ?? "public"),
        };
        if (body.metadata && typeof body.metadata === "object") {
          insertRow.metadata = body.metadata;
        }
        const { data: post, error } = await admin
          .from("posts")
          .insert(insertRow as any)
          .select("*")
          .single();
        if (error) throw error;
        return json({ ok: true, post });
      }

      case "post.update": {
        const tokenId = Number(body.tokenId);
        if (!Number.isFinite(tokenId)) {
          return json({ ok: false, error: "tokenId required" }, 400);
        }
        const row = await assertOwnPost(admin, wallet, tokenId);
        if (!row) return json({ ok: false, error: "Post not found" }, 404);

        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.title = String(body.name);
        if (body.description !== undefined) updates.description = String(body.description);
        if (Array.isArray(body.category)) {
          updates.category = (body.category as string[]).join(",");
        }
        const { error } = await admin.from("posts").update(updates).eq("id", row.id);
        if (error) throw error;
        return json({ ok: true, result: true, data: { tokenId, ...updates } });
      }

      case "post.delete": {
        const tokenId = Number(body.tokenId);
        if (!Number.isFinite(tokenId)) {
          return json({ ok: false, error: "tokenId required" }, 400);
        }
        const row = await assertOwnPost(admin, wallet, tokenId);
        if (!row) return json({ ok: false, error: "Post not found" }, 404);
        const { error } = await admin.from("posts").delete().eq("id", row.id);
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "post.setVisibility": {
        const tokenId = Number(body.tokenId);
        const visibility = String(body.visibility || "");
        if (!Number.isFinite(tokenId) || !visibility) {
          return json({ ok: false, error: "tokenId and visibility required" }, 400);
        }
        const row = await assertOwnPost(admin, wallet, tokenId);
        if (!row) return json({ ok: false, error: "Post not found" }, 404);
        const { error } = await admin.from("posts").update({ visibility }).eq("id", row.id);
        if (error) throw error;
        return json({
          ok: true,
          status: true,
          message: `Visibility updated to ${visibility}`,
          result: { tokenId, visibility },
        });
      }

      case "engagement.vote": {
        const tokenId = Number(body.tokenId);
        const voteType = body.voteType === "against" ? "against" : "for";
        if (!Number.isFinite(tokenId)) {
          return json({ ok: false, error: "tokenId required" }, 400);
        }
        const { data: post } = await admin.from("posts").select("id").eq("token_id", tokenId).maybeSingle();
        if (!post) {
          return json({ ok: true, success: false, tokenId, voteType: null });
        }
        if (voteType === "for") {
          const { error } = await admin.from("post_likes").insert({
            post_id: post.id,
            wallet_address: wallet,
          });
          if (error) {
            if (String(error.code) === "23505") {
              return json({ ok: true, success: true, tokenId, voteType: "for" });
            }
            throw error;
          }
          return json({ ok: true, success: true, tokenId, voteType: "for" });
        }
        const { error } = await admin.from("post_likes").delete().eq("post_id", post.id).eq(
          "wallet_address",
          wallet,
        );
        if (error) throw error;
        return json({ ok: true, success: true, tokenId, voteType: null });
      }

      case "follow.follow": {
        const target = String(body.targetAddress || "").toLowerCase();
        if (!target || target === wallet) {
          return json({ ok: false, error: "targetAddress required" }, 400);
        }
        const { error } = await admin.from("follows").insert({
          follower_address: wallet,
          following_address: target,
          status: "accepted",
        });
        if (error) {
          if (String(error.code) === "23505") {
            return json({ ok: true, result: true });
          }
          throw error;
        }
        return json({ ok: true, result: true });
      }

      case "follow.unfollow": {
        const target = String(body.targetAddress || "").toLowerCase();
        if (!target) return json({ ok: false, error: "targetAddress required" }, 400);
        const { error } = await admin.from("follows").delete().eq("follower_address", wallet).eq(
          "following_address",
          target,
        );
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "follow.approveRequest": {
        const requestId = String(body.requestId || "");
        if (!requestId) return json({ ok: false, error: "requestId required" }, 400);
        const { data: row } = await admin.from("follows").select("id, following_address").eq("id", requestId)
          .maybeSingle();
        if (!row || String(row.following_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Request not found" }, 404);
        }
        const { error } = await admin.from("follows").update({ status: "accepted" }).eq("id", requestId);
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "follow.rejectRequest": {
        const requestId = String(body.requestId || "");
        if (!requestId) return json({ ok: false, error: "requestId required" }, 400);
        const { data: row } = await admin.from("follows").select("id, following_address").eq("id", requestId)
          .maybeSingle();
        if (!row || String(row.following_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Request not found" }, 404);
        }
        const { error } = await admin.from("follows").delete().eq("id", requestId);
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "follow.acceptAll": {
        const { error } = await admin.from("follows").update({ status: "accepted" }).eq(
          "following_address",
          wallet,
        ).eq("status", "pending");
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "follow.rejectAll": {
        const { error } = await admin.from("follows").delete().eq("following_address", wallet).eq(
          "status",
          "pending",
        );
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      case "profile.update": {
        const { data: existing } = await admin.from("profiles").select("customs").eq("wallet_address", wallet)
          .maybeSingle();

        const updateData: Record<string, unknown> = { wallet_address: wallet };

        const str = (k: string, v: unknown) => {
          if (v !== undefined) updateData[k] = v;
        };

        str("username", body.username);
        str("display_name", body.display_name);
        str("bio", body.bio);
        str("about_me", body.about_me);
        str("avatar_url", body.avatar_url);
        str("cover_url", body.cover_url);
        str("is_private", body.is_private);
        str("dm_settings", body.dm_settings);
        str("twitter_link", body.twitter_link);
        str("discord_link", body.discord_link);
        str("instagram_link", body.instagram_link);
        str("tiktok_link", body.tiktok_link);
        str("telegram_link", body.telegram_link);
        str("youtube_link", body.youtube_link);
        str("facebook_link", body.facebook_link);

        if (body.customs !== undefined && typeof body.customs === "object") {
          const prev = (existing?.customs && typeof existing.customs === "object")
            ? existing.customs as Record<string, unknown>
            : {};
          updateData.customs = { ...prev, ...(body.customs as Record<string, unknown>) };
        }

        const { error } = await admin.from("profiles").upsert(updateData as any, {
          onConflict: "wallet_address",
        });
        if (error) throw error;
        return json({ ok: true, result: true });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dehub-social-api]", action, e);
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ ok: false, error: msg }, 500);
  }
});
