/**
 * DeHub Platform API — DMs (incl. paid metadata), Stages (audio spaces), Calls.
 * Auth: x-wallet-address + x-dehub-token (api.dehub.io account_info).
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wallet-address, x-dehub-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-request-id, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_DM_CONTENT_LEN = 12_000;
const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_DM_MSG_TYPES = new Set(["msg", "media", "gif", "voice", "tip"]);

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

function isEthAddress(s: string): boolean {
  return typeof s === "string" && ETH_ADDR.test(s);
}

async function getDmConversation(
  admin: SupabaseClient,
  conversationId: string,
): Promise<{ id: string; participant_a: string; participant_b: string } | null> {
  const { data } = await admin.from("dm_conversations").select("id, participant_a, participant_b").eq(
    "id",
    conversationId,
  ).maybeSingle();
  return data;
}

function isDmParticipant(
  conv: { participant_a: string; participant_b: string },
  wallet: string,
): boolean {
  const w = wallet.toLowerCase();
  return conv.participant_a.toLowerCase() === w || conv.participant_b.toLowerCase() === w;
}

async function recountStageParticipants(admin: SupabaseClient, spaceId: string): Promise<void> {
  const { count: listenerCount } = await admin.from("space_participants").select("*", {
    count: "exact",
    head: true,
  }).eq("space_id", spaceId).eq("role", "listener").is("left_at", null);

  const { count: speakerCount } = await admin.from("space_participants").select("*", {
    count: "exact",
    head: true,
  }).eq("space_id", spaceId).in("role", ["host", "speaker"]).is("left_at", null);

  await admin.from("audio_spaces").update({
    listener_count: listenerCount ?? 0,
    speaker_count: Math.max(1, speakerCount ?? 1),
  }).eq("id", spaceId);
}

// Actions that don't require authentication (public reads)
const PUBLIC_ACTIONS = new Set(["stage.list", "stage.participants.list"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

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

  // Skip auth for public actions
  let wallet = "";
  if (!PUBLIC_ACTIONS.has(action)) {
    const rawWallet = req.headers.get("x-wallet-address")?.toLowerCase() || "";
    const dehubToken = req.headers.get("x-dehub-token") || "";
    if (!rawWallet) return json({ ok: false, error: "x-wallet-address required" }, 401);
    if (!dehubToken) return json({ ok: false, error: "x-dehub-token required" }, 401);
    if (!(await validateDeHubToken(dehubToken, rawWallet))) {
      return json({ ok: false, error: "Invalid or expired token" }, 401);
    }
    wallet = rawWallet;
  }

  try {
    switch (action) {
      // ─── DM ─────────────────────────────────────────────────────────────

      case "dm.conversations.list": {
        const page = Number(body.page ?? 0);
        const limit = Math.min(Number(body.limit ?? 50), 100);
        const offset = page * limit;

        const { data: convRows, error: convErr } = await admin
          .from("dm_conversations")
          .select("*")
          .or(`participant_a.eq.${wallet},participant_b.eq.${wallet}`)
          .order("last_message_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (convErr) throw convErr;
        if (!convRows || convRows.length === 0) return json({ ok: true, items: [] });

        // Fetch other participants' profiles
        const otherAddresses = convRows.map((c) =>
          c.participant_a.toLowerCase() === wallet ? c.participant_b : c.participant_a
        );

        const { data: profiles } = await admin
          .from("profiles")
          .select("wallet_address, username, display_name, avatar_url, is_verified")
          .in("wallet_address", otherAddresses);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.wallet_address.toLowerCase(), p])
        );

        // Build conversations with last message + unread count
        const items = await Promise.all(
          convRows.map(async (conv: any) => {
            const otherAddr =
              conv.participant_a.toLowerCase() === wallet ? conv.participant_b : conv.participant_a;
            const profile = profileMap.get(otherAddr.toLowerCase());

            const [{ count: unreadCount }, { data: lastMsgs }] = await Promise.all([
              admin
                .from("dm_messages")
                .select("id", { count: "exact", head: true })
                .eq("conversation_id", conv.id)
                .neq("sender_address", wallet)
                .eq("is_read", false),
              admin
                .from("dm_messages")
                .select("id, conversation_id, sender_address, content, msg_type, media_url, created_at")
                .eq("conversation_id", conv.id)
                .eq("is_deleted", false)
                .order("created_at", { ascending: false })
                .limit(1),
            ]);

            const lastMsg = lastMsgs?.[0] ?? null;

            return {
              id: conv.id,
              participant_a: conv.participant_a,
              participant_b: conv.participant_b,
              other_address: otherAddr,
              other_profile: profile ?? null,
              last_message: lastMsg,
              unread_count: unreadCount ?? 0,
              created_at: conv.created_at,
              updated_at: conv.updated_at,
              last_message_at: conv.last_message_at,
            };
          })
        );

        return json({ ok: true, items });
      }

      case "dm.conversation.create": {
        const raw = String(body.recipientAddress || "").trim();
        if (!isEthAddress(raw)) return json({ ok: false, error: "Invalid recipientAddress" }, 400);
        const other = raw.toLowerCase();
        if (other === wallet) return json({ ok: false, error: "Cannot DM yourself" }, 400);
        const [a, b] = [wallet, other].sort();
        const { data, error } = await admin.from("dm_conversations").upsert(
          { participant_a: a, participant_b: b },
          { onConflict: "participant_a,participant_b" },
        ).select().single();
        if (error) throw error;
        return json({ ok: true, conversation: data });
      }

      case "dm.message.send": {
        const conversationId = String(body.conversationId || "");
        if (!UUID_RE.test(conversationId)) {
          return json({ ok: false, error: "Invalid conversationId" }, 400);
        }
        const conv = await getDmConversation(admin, conversationId);
        if (!conv) return json({ ok: false, error: "Conversation not found" }, 404);
        if (!isDmParticipant(conv, wallet)) {
          return json({ ok: false, error: "Not a participant" }, 403);
        }

        let content = String(body.content ?? "");
        if (content.length > MAX_DM_CONTENT_LEN) {
          return json({ ok: false, error: `Message too long (max ${MAX_DM_CONTENT_LEN})` }, 400);
        }

        const msgTypeRaw = String(body.msgType || "msg");
        if (!ALLOWED_DM_MSG_TYPES.has(msgTypeRaw)) {
          return json({ ok: false, error: "Invalid msgType" }, 400);
        }

        const mediaUrl = body.mediaUrl != null ? String(body.mediaUrl) : null;
        const replyToId = body.replyToId != null ? String(body.replyToId) : null;
        if (replyToId && !UUID_RE.test(replyToId)) {
          return json({ ok: false, error: "Invalid replyToId" }, 400);
        }

        let tipAmount: number | null = null;
        if (body.tipAmount != null) {
          const n = Number(body.tipAmount);
          if (!Number.isFinite(n) || n < 0) {
            return json({ ok: false, error: "Invalid tipAmount" }, 400);
          }
          tipAmount = n;
        }

        let voiceDuration: number | null = null;
        if (body.voiceDuration != null) {
          const v = Number(body.voiceDuration);
          if (!Number.isFinite(v) || v < 0) {
            return json({ ok: false, error: "Invalid voiceDuration" }, 400);
          }
          voiceDuration = v;
        }

        // body.paymentTxHash reserved for future on-chain verification / extra column

        const { data: row, error } = await admin.from("dm_messages").insert({
          conversation_id: conversationId,
          sender_address: wallet,
          content,
          msg_type: msgTypeRaw,
          media_url: mediaUrl,
          voice_duration: voiceDuration,
          reply_to_id: replyToId,
          tip_amount: tipAmount,
        }).select().single();
        if (error) throw error;

        await admin.from("dm_conversations").update({ last_message_at: new Date().toISOString() }).eq(
          "id",
          conversationId,
        );

        return json({ ok: true, message: row });
      }

      case "dm.messages.list": {
        const conversationId = String(body.conversationId || "");
        if (!UUID_RE.test(conversationId)) {
          return json({ ok: false, error: "Invalid conversationId" }, 400);
        }
        const conv = await getDmConversation(admin, conversationId);
        if (!conv) return json({ ok: false, error: "Conversation not found" }, 404);
        if (!isDmParticipant(conv, wallet)) {
          return json({ ok: false, error: "Not a participant" }, 403);
        }

        const page = Number(body.page ?? 0);
        const limit = Math.min(Number(body.limit ?? 30), 100);
        const offset = page * limit;

        const { data: msgRows, error: msgErr, count } = await admin
          .from("dm_messages")
          .select("*", { count: "exact" })
          .eq("conversation_id", conversationId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (msgErr) throw msgErr;

        // Fetch sender profiles
        const senderAddresses = [...new Set((msgRows || []).map((m: any) => m.sender_address))];
        const { data: profiles } = senderAddresses.length
          ? await admin
              .from("profiles")
              .select("wallet_address, username, display_name, avatar_url")
              .in("wallet_address", senderAddresses)
          : { data: [] };

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.wallet_address.toLowerCase(), p])
        );

        const items = (msgRows || []).map((row: any) => {
          const profile = profileMap.get(row.sender_address.toLowerCase());
          return { ...row, sender_profile: profile ?? null };
        });

        return json({
          ok: true,
          items,
          totalCount: count ?? 0,
          hasMore: (count ?? 0) > offset + limit,
          myAddress: wallet,
        });
      }

      case "dm.conversation.get": {
        const conversationId = String(body.conversationId || "");
        if (!UUID_RE.test(conversationId)) {
          return json({ ok: false, error: "Invalid conversationId" }, 400);
        }
        const conv = await getDmConversation(admin, conversationId);
        if (!conv) return json({ ok: false, error: "Conversation not found" }, 404);
        if (!isDmParticipant(conv, wallet)) {
          return json({ ok: false, error: "Not a participant" }, 403);
        }

        const otherAddr = conv.participant_a.toLowerCase() === wallet ? conv.participant_b : conv.participant_a;
        const { data: profile } = await admin
          .from("profiles")
          .select("wallet_address, username, display_name, avatar_url, is_verified")
          .eq("wallet_address", otherAddr)
          .maybeSingle();

        return json({ ok: true, conversation: conv, other_profile: profile ?? null });
      }

      case "dm.messages.markRead": {
        const conversationId = String(body.conversationId || "");
        if (!UUID_RE.test(conversationId)) {
          return json({ ok: false, error: "Invalid conversationId" }, 400);
        }
        const conv = await getDmConversation(admin, conversationId);
        if (!conv) return json({ ok: false, error: "Conversation not found" }, 404);
        if (!isDmParticipant(conv, wallet)) {
          return json({ ok: false, error: "Not a participant" }, 403);
        }
        await admin.from("dm_messages").update({ is_read: true }).eq("conversation_id", conversationId).neq(
          "sender_address",
          wallet,
        ).eq("is_read", false);
        return json({ ok: true, success: true });
      }

      // ─── Calls ──────────────────────────────────────────────────────────

      case "call.start": {
        const recipient = String(body.recipientAddress || "").toLowerCase();
        if (!isEthAddress(recipient)) {
          return json({ ok: false, error: "Invalid recipientAddress" }, 400);
        }
        if (recipient === wallet) {
          return json({ ok: false, error: "Cannot call yourself" }, 400);
        }
        const callType = body.callType === "video" ? "video" : "audio";
        const { data: session, error } = await admin.from("call_sessions").insert({
          caller_address: wallet,
          recipient_address: recipient,
          call_type: callType,
          status: "ringing",
        }).select().single();
        if (error) throw error;
        return json({ ok: true, session });
      }

      case "call.updateStatus": {
        const callId = String(body.callId || "");
        if (!UUID_RE.test(callId)) return json({ ok: false, error: "Invalid callId" }, 400);
        const status = String(body.status || "");
        if (status !== "connected" && status !== "ended") {
          return json({ ok: false, error: "status must be connected or ended" }, 400);
        }

        const { data: row } = await admin.from("call_sessions").select("*").eq("id", callId).maybeSingle();
        if (!row) return json({ ok: false, error: "Call not found" }, 404);

        const caller = String(row.caller_address).toLowerCase();
        const recipient = String(row.recipient_address).toLowerCase();
        if (caller !== wallet && recipient !== wallet) {
          return json({ ok: false, error: "Not a party to this call" }, 403);
        }

        if (status === "connected") {
          if (recipient !== wallet) {
            return json({ ok: false, error: "Only recipient can accept" }, 403);
          }
          if (row.status !== "ringing") {
            return json({ ok: false, error: "Call is not ringing" }, 409);
          }
        }

        if (status === "ended") {
          if (row.status === "ended") {
            return json({ ok: true, session: row });
          }
        }

        const { data: updated, error } = await admin.from("call_sessions").update({ status }).eq("id", callId)
          .select().single();
        if (error) throw error;
        return json({ ok: true, session: updated });
      }

      // ─── Stages ─────────────────────────────────────────────────────────

      case "stage.list": {
        // Public — no auth required. Returns live stages ordered by most recent.
        const { data: spaces, error: spacesErr } = await admin
          .from("audio_spaces")
          .select("*")
          .eq("status", "live")
          .order("started_at", { ascending: false });
        if (spacesErr) throw spacesErr;
        return json({ ok: true, items: spaces || [] });
      }

      case "stage.participants.list": {
        // Public — anyone can see who is in a live stage.
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        const { data: participants, error: pErr } = await admin
          .from("space_participants")
          .select("*")
          .eq("space_id", spaceId)
          .is("left_at", null);
        if (pErr) throw pErr;
        return json({ ok: true, items: participants || [] });
      }

      case "stage.handrequests.list": {
        // Host-only — requires auth
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        const { data: space } = await admin
          .from("audio_spaces")
          .select("host_wallet_address")
          .eq("id", spaceId)
          .maybeSingle();
        if (!space) return json({ ok: false, error: "Stage not found" }, 404);
        if (String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can view hand requests" }, 403);
        }
        const { data: requests, error: rErr } = await admin
          .from("raise_hand_requests")
          .select("*")
          .eq("space_id", spaceId)
          .eq("status", "pending");
        if (rErr) throw rErr;
        return json({ ok: true, items: requests || [] });
      }

      case "stage.create": {
        const title = String(body.title || "").trim();
        if (!title) return json({ ok: false, error: "title required" }, 400);
        if (title.length > 200) return json({ ok: false, error: "title too long" }, 400);
        const description = body.description != null ? String(body.description).slice(0, 2000) : null;

        const channelName = `stage_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const { data: space, error: e1 } = await admin.from("audio_spaces").insert({
          channel_name: channelName,
          title,
          description,
          host_wallet_address: wallet,
          host_username: body.hostUsername != null ? String(body.hostUsername).slice(0, 100) : null,
          host_avatar: body.hostAvatar != null ? String(body.hostAvatar).slice(0, 2000) : null,
          status: "live",
          speaker_count: 1,
          listener_count: 0,
        }).select().single();
        if (e1) throw e1;

        const { error: e2 } = await admin.from("space_participants").insert({
          space_id: space.id,
          wallet_address: wallet,
          username: body.hostUsername != null ? String(body.hostUsername).slice(0, 100) : null,
          avatar: body.hostAvatar != null ? String(body.hostAvatar).slice(0, 2000) : null,
          role: "host",
          is_muted: true,
        });
        if (e2) {
          await admin.from("audio_spaces").update({ status: "ended" }).eq("id", space.id);
          throw e2;
        }

        return json({ ok: true, space });
      }

      case "stage.join": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);

        const { data: space } = await admin.from("audio_spaces").select("*").eq("id", spaceId).maybeSingle();
        if (!space) return json({ ok: false, error: "Stage not found" }, 404);
        if (space.status !== "live") {
          return json({ ok: false, error: "Stage is not live" }, 409);
        }

        const hostWallet = String(space.host_wallet_address).toLowerCase();
        const isHost = hostWallet === wallet;

        const { data: existingParticipant } = await admin.from("space_participants").select("role").eq(
          "space_id",
          spaceId,
        ).eq("wallet_address", wallet).is("left_at", null).maybeSingle();

        const rejoiningRole = isHost
          ? "host"
          : existingParticipant?.role === "speaker" || existingParticipant?.role === "host"
          ? "speaker"
          : "listener";

        const { error: upErr } = await admin.from("space_participants").upsert({
          space_id: spaceId,
          wallet_address: wallet,
          username: body.username != null ? String(body.username).slice(0, 100) : null,
          avatar: body.avatar != null ? String(body.avatar).slice(0, 2000) : null,
          role: rejoiningRole,
          is_muted: true,
          left_at: null,
        }, { onConflict: "space_id,wallet_address" });
        if (upErr) throw upErr;

        await recountStageParticipants(admin, spaceId);

        const { data: freshSpace } = await admin.from("audio_spaces").select("*").eq("id", spaceId).single();
        return json({ ok: true, space: freshSpace, role: rejoiningRole });
      }

      case "stage.leave": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        await admin.from("space_participants").update({ left_at: new Date().toISOString() }).eq(
          "space_id",
          spaceId,
        ).eq("wallet_address", wallet);
        await recountStageParticipants(admin, spaceId);
        return json({ ok: true, success: true });
      }

      case "stage.end": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address").eq("id", spaceId)
          .maybeSingle();
        if (!space) return json({ ok: false, error: "Stage not found" }, 404);
        if (String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can end stage" }, 403);
        }
        const { error } = await admin.from("audio_spaces").update({
          status: "ended",
          ended_at: new Date().toISOString(),
        }).eq("id", spaceId);
        if (error) throw error;
        return json({ ok: true, success: true });
      }

      case "stage.recording.save": {
        const spaceId = String(body.spaceId || "");
        const recordingUrl = String(body.recordingUrl || "").trim();
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        if (!recordingUrl.startsWith("http")) {
          return json({ ok: false, error: "Invalid recordingUrl" }, 400);
        }
        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address").eq("id", spaceId)
          .maybeSingle();
        if (!space) return json({ ok: false, error: "Stage not found" }, 404);
        if (String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can save recording" }, 403);
        }
        const { error } = await admin.from("audio_spaces").update({ recording_url: recordingUrl }).eq(
          "id",
          spaceId,
        );
        if (error) throw error;
        return json({ ok: true, success: true });
      }

      case "stage.setMuted": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        if (typeof body.isMuted !== "boolean") {
          return json({ ok: false, error: "isMuted boolean required" }, 400);
        }
        const { data: p } = await admin.from("space_participants").select("id, role").eq("space_id", spaceId).eq(
          "wallet_address",
          wallet,
        ).is("left_at", null).maybeSingle();
        if (!p) return json({ ok: false, error: "Not in this stage" }, 403);
        if (p.role !== "host" && p.role !== "speaker") {
          return json({ ok: false, error: "Listeners cannot set mute state" }, 403);
        }
        const { error } = await admin.from("space_participants").update({ is_muted: body.isMuted }).eq(
          "id",
          p.id,
        );
        if (error) throw error;
        return json({ ok: true, success: true });
      }

      case "stage.raiseHand": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        const { data: p } = await admin.from("space_participants").select("role").eq("space_id", spaceId).eq(
          "wallet_address",
          wallet,
        ).is("left_at", null).maybeSingle();
        if (!p || p.role !== "listener") {
          return json({ ok: false, error: "Only listeners can raise hand" }, 403);
        }
        const { data: pending } = await admin.from("raise_hand_requests").select("id").eq("space_id", spaceId).eq(
          "wallet_address",
          wallet,
        ).eq("status", "pending").maybeSingle();
        if (pending) return json({ ok: true, success: true, duplicate: true });

        const { error } = await admin.from("raise_hand_requests").insert({
          space_id: spaceId,
          wallet_address: wallet,
          username: body.username != null ? String(body.username).slice(0, 100) : null,
          avatar: body.avatar != null ? String(body.avatar).slice(0, 2000) : null,
          status: "pending",
        });
        if (error) throw error;
        return json({ ok: true, success: true });
      }

      case "stage.lowerHand": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        await admin.from("raise_hand_requests").update({
          status: "rejected",
          resolved_at: new Date().toISOString(),
        }).eq("space_id", spaceId).eq("wallet_address", wallet).eq("status", "pending");
        return json({ ok: true, success: true });
      }

      case "stage.approveSpeaker": {
        const spaceId = String(body.spaceId || "");
        const targetWallet = String(body.targetWallet || "").toLowerCase();
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        if (!isEthAddress(targetWallet)) return json({ ok: false, error: "Invalid targetWallet" }, 400);

        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address, id").eq(
          "id",
          spaceId,
        ).maybeSingle();
        if (!space || String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can approve" }, 403);
        }

        await admin.from("raise_hand_requests").update({
          status: "approved",
          resolved_at: new Date().toISOString(),
        }).eq("space_id", spaceId).eq("wallet_address", targetWallet).eq("status", "pending");

        await admin.from("space_participants").update({ role: "speaker" }).eq("space_id", spaceId).eq(
          "wallet_address",
          targetWallet,
        ).is("left_at", null);

        await recountStageParticipants(admin, spaceId);
        return json({ ok: true, success: true });
      }

      case "stage.removeSpeaker": {
        const spaceId = String(body.spaceId || "");
        const targetWallet = String(body.targetWallet || "").toLowerCase();
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        if (!isEthAddress(targetWallet)) return json({ ok: false, error: "Invalid targetWallet" }, 400);

        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address").eq("id", spaceId)
          .maybeSingle();
        if (!space || String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can remove speaker" }, 403);
        }
        if (targetWallet === String(space.host_wallet_address).toLowerCase()) {
          return json({ ok: false, error: "Cannot demote host" }, 400);
        }

        const { data: tp } = await admin.from("space_participants").select("role").eq("space_id", spaceId).eq(
          "wallet_address",
          targetWallet,
        ).is("left_at", null).maybeSingle();
        if (!tp || tp.role !== "speaker") {
          return json({ ok: false, error: "Target is not a speaker" }, 409);
        }

        await admin.from("space_participants").update({ role: "listener" }).eq("space_id", spaceId).eq(
          "wallet_address",
          targetWallet,
        );

        await recountStageParticipants(admin, spaceId);
        return json({ ok: true, success: true });
      }

      case "stage.inviteSpeaker": {
        const spaceId = String(body.spaceId || "");
        const targetWallet = String(body.targetWallet || "").toLowerCase();
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        if (!isEthAddress(targetWallet)) return json({ ok: false, error: "Invalid targetWallet" }, 400);

        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address").eq("id", spaceId)
          .maybeSingle();
        if (!space || String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Only host can invite" }, 403);
        }

        const { data: tp } = await admin.from("space_participants").select("role").eq("space_id", spaceId).eq(
          "wallet_address",
          targetWallet,
        ).is("left_at", null).maybeSingle();
        if (!tp || tp.role !== "listener") {
          return json({ ok: false, error: "Target must be a listener" }, 409);
        }

        await admin.from("space_participants").update({ role: "speaker" }).eq("space_id", spaceId).eq(
          "wallet_address",
          targetWallet,
        );

        await recountStageParticipants(admin, spaceId);
        return json({ ok: true, success: true });
      }

      case "stage.rollbackCreate": {
        const spaceId = String(body.spaceId || "");
        if (!UUID_RE.test(spaceId)) return json({ ok: false, error: "Invalid spaceId" }, 400);
        const { data: space } = await admin.from("audio_spaces").select("host_wallet_address, status").eq(
          "id",
          spaceId,
        ).maybeSingle();
        if (!space) return json({ ok: true, success: true });
        if (String(space.host_wallet_address).toLowerCase() !== wallet) {
          return json({ ok: false, error: "Forbidden" }, 403);
        }
        await admin.from("audio_spaces").update({ status: "ended" }).eq("id", spaceId);
        return json({ ok: true, success: true });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dehub-platform-api]", action, e);
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ ok: false, error: msg }, 500);
  }
});
