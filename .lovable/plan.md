## Goal
Seamlessly link the invite code a user entered to their wallet the moment they log in — no second prompt, attribution works for inviter rewards/stats.

## Current state
- `PasswordGate` stores the redeemed code in `localStorage` + cookie as `dehub_access_code` and a random `dehub_access_session` ID.
- `invite-redeem` writes `{ code, used_by_session }` into `invite_code_uses` — **wallet is never recorded** because login happens after the gate.
- `invite-stats` tries to look up the user's joining code via `used_by_wallet`, which is always empty → inviter attribution is silently broken.

## Fix: attach wallet to the prior redemption on first login

### 1. New edge function `invite-attach-wallet`
- Input: `{ sessionId, wallet }` (wallet validated via `x-wallet-address` header, same pattern as `invite-stats`).
- Looks up the most recent `invite_code_uses` row for that `sessionId` where `used_by_wallet IS NULL`.
- Updates it with `used_by_wallet = lower(wallet)`.
- Idempotent: if already set or no row found, returns `{ ok: true, attached: false }`.
- Uses service role so it can update regardless of RLS.

### 2. Client hook: call it once after auth
- In the auth flow (where the wallet address becomes available after Web3Auth/external wallet login — likely `AuthContext` or `WalletProviders`), add a one-shot effect:
  - Read `dehub_access_session` from localStorage/cookie (helpers already exist in `PasswordGate`).
  - If a session ID exists and we haven't already attached for this wallet (track via `dehub_access_attached_<wallet>` flag), call `invite-attach-wallet`.
  - On success, set the flag so we never call again.

### 3. No UI changes
- The gate already remembers the user permanently (10-year cookie + localStorage), so they never see the code prompt again.
- Login flow stays untouched from the user's perspective — attribution happens silently in the background.

## Result
- User enters code once → cookie remembers forever (already working).
- First login after redemption → wallet silently attached to that redemption row.
- `invite-stats` `joinedWith` lookup now actually returns the inviter, enabling rewards/tracking.

## Technical notes
- `invite_code_uses.used_by_wallet` column already exists (per `types.ts`).
- Edge function needs CORS + the same `x-wallet-address` header pattern used by `invite-stats`.
- Add `verify_jwt = false` is default for Lovable-managed functions; no config.toml change needed.
- Helper to expose session ID read from `PasswordGate` (extract `getSessionId()` to a small shared util like `src/lib/invite-session.ts` so both gate and auth hook share it without circular imports).