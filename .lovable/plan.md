# Invite Code System

Replace the demo "ends in 01–05" gate with a real invite-code system backed by the database. Every code is unique, single-use (or capped), tracks who created it and who used it, and lets any logged-in user generate codes from their profile.

## What you get

1. **100 random codes** seeded into the database, owned by "system" — these work out of the gate so existing users/testers can get in.
2. **Real password gate** that checks the entered code against the database via an Edge Function.
3. **Invite page** at `/invite` (and a "Invite friends" button on the profile page) where any logged-in user can:
   - Generate new codes (one click → new code added to their list)
   - See all codes they've created
   - See how many were used + who used them
4. **Inviter leaderboard** — count of successful invites per user, surfaced on the invite page.

## Database (new tables)

```text
invite_codes
  code              text PK         -- e.g. "AETH-7K9P-2X4M"
  created_by        text NULL       -- wallet address of inviter (NULL = system seed)
  created_at        timestamptz
  max_uses          int default 1   -- system codes can be higher
  use_count         int default 0
  is_active         bool default true

invite_code_uses
  id                uuid PK
  code              text → invite_codes.code
  used_by_wallet    text NULL       -- filled in once user connects wallet (optional)
  used_by_session   text            -- anonymous browser session id
  used_at           timestamptz
```

RLS:
- `invite_codes`: anyone can SELECT their own codes (`created_by = wallet header`); INSERT only via Edge Function.
- `invite_code_uses`: read-only for the code's owner; writes only via Edge Function.

## Edge functions

1. **`invite-redeem`** (public, no JWT) — input: `{ code, sessionId }`. Validates code is active and `use_count < max_uses`, increments `use_count`, inserts row in `invite_code_uses`, returns `{ ok: true }` or `{ ok: false, reason }`.
2. **`invite-generate`** (requires wallet header) — generates a new unique code owned by the caller, returns `{ code }`. Rate-limited to e.g. 20 codes per user per day.
3. **`invite-stats`** (requires wallet header) — returns `{ codes: [...], totalInvites: N }` for the calling user.

## Frontend

- **`PasswordGate.tsx`** — replace local string check with a `fetch` to `invite-redeem`. On success, store `{ unlocked: true, sessionId, codeUsed }` in localStorage so we don't re-prompt and can attribute later sign-ups.
- **`/invite` page** — new page, gated behind login, lists user's codes with copy buttons, "Generate new code" button, and a "You've invited X people" stat.
- **Profile page** — small "Invite friends" link/button that routes to `/invite`.
- **Optional**: when a user signs up after redeeming a code, attach their wallet to `invite_code_uses.used_by_wallet` so the inviter sees who they brought in.

## Code format

`XXXX-XXXX` (8 chars, A–Z + 2–9, no ambiguous chars like 0/O/1/I). ~1.6 trillion combinations — collisions handled by DB unique constraint + retry.

## 100 seed codes

Generated server-side and inserted via migration with `created_by = NULL` and `max_uses = 1`. I'll include the full list in the migration so they're visible/auditable, and surface them to you in the chat after the migration runs so you can share them.

## Out of scope (ask if you want them)

- Tiered codes (e.g. premium-tier invite codes)
- Expiry dates
- Invite rewards / payouts
- Admin dashboard to mass-manage codes