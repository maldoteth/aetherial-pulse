

# Plan: Wire Up DMs, Subscriptions, Blocks, Reports, Live Chat, Notifications & Search

## Current State
- **Notifications**: Already live on Supabase `custom_notifications` table. Working.
- **Search**: Already live — `searchNFTs` uses `search_vector` on `posts`, `universalSearch` queries both `posts` and `profiles`. Working.
- **DMs**: Fully stubbed. The old Socket.IO-based `dm-socket.ts` and `socket.ts` connect to `DEHUB_API_BASE` which is now an empty string — completely broken.
- **Subscriptions**: Fully stubbed, throws errors on create/update/buy.
- **Blocks**: Fully stubbed, no persistence.
- **Reports**: Fully stubbed, no persistence.
- **Live Chat**: Stubbed + Socket.IO pointing to dead server.

## What's Actually Broken vs Working

**Already working (no changes needed):**
- Notifications — reads/writes to `custom_notifications`
- Search — uses `search_vector` full-text search on `posts` + profile search

**Needs new tables + code:**
- DMs, Subscriptions, Blocks, Reports

**Needs code rewrite (use existing community_chat_messages):**
- Live Chat

---

## Phase 1: Database Tables (Migration)

Create 4 new tables:

### `dm_conversations`
- `id` uuid PK
- `created_at`, `updated_at` timestamps
- `participant_a` text (wallet), `participant_b` text (wallet)
- `last_message_at` timestamp
- Unique constraint on (participant_a, participant_b) sorted
- RLS: participants can read/write their own conversations

### `dm_messages`
- `id` uuid PK
- `conversation_id` uuid FK → dm_conversations
- `sender_address` text (wallet)
- `content` text
- `msg_type` text (msg/media/voice/gif/tip)
- `media_url` text nullable
- `voice_duration` integer nullable
- `reply_to_id` uuid nullable
- `is_read` boolean default false
- `is_deleted` boolean default false
- `tip_amount` numeric nullable
- `created_at` timestamp
- RLS: conversation participants only
- Enable realtime

### `user_blocks`
- `id` uuid PK
- `blocker_address` text, `blocked_address` text
- `reason` text nullable
- `created_at` timestamp
- Unique on (blocker, blocked)
- RLS: users manage their own blocks

### `reports`
- `id` uuid PK
- `reporter_address` text
- `target_type` text (post/user)
- `target_id` text
- `reason` text
- `description` text nullable
- `status` text default 'pending'
- `created_at` timestamp
- RLS: users can insert, read own reports

### `subscription_plans`
- `id` uuid PK
- `creator_address` text
- `name` text, `description` text
- `duration` integer (days)
- `tier` integer
- `benefits` jsonb
- `price` numeric, `currency` text
- `is_active` boolean default true
- `subscriber_count` integer default 0
- `created_at`, `updated_at`
- RLS: anyone reads, creator manages

### `subscriptions`
- `id` uuid PK
- `plan_id` uuid FK
- `subscriber_address` text
- `creator_address` text
- `start_date`, `end_date` timestamps
- `is_active` boolean
- `created_at`
- RLS: participants read, subscriber creates

---

## Phase 2: Rewrite API Modules

### DMs (`dm.ts` + `dm-socket.ts`)
- Replace socket-based messaging with Supabase realtime on `dm_messages`
- `getContacts` → query `dm_conversations` joined with `profiles`
- `getMessages` → query `dm_messages` for conversation
- `createConversation` → insert into `dm_conversations`
- `sendMessage` → insert into `dm_messages`
- `markConversationAsRead` → update `dm_messages` set `is_read = true`
- Rewrite `dm-socket.ts` to use Supabase realtime channels instead of Socket.IO

### Blocks (`blocks.ts`)
- `blockUser` → insert into `user_blocks`
- `unblockUser` → delete from `user_blocks`
- `getBlockList` → select from `user_blocks` where blocker = me
- `getBlockStatus` → check both directions

### Reports (`reports.ts`)
- `submitReport` / `reportContent` / `reportUser` → insert into `reports`
- `getContentReportStatus` → check if current user reported this content

### Subscriptions (`subscriptions.ts`)
- `createPlan` → insert into `subscription_plans`
- `updatePlan` → update `subscription_plans`
- `getPlans` → select from `subscription_plans`
- `buyPlan` → insert into `subscriptions`
- `isSubscribedToCreator` → check active subscription

### Live Chat (`livechat.ts` + `socket.ts`)
- Replace Socket.IO with Supabase realtime on `community_chat_messages`
- Use a fixed "public" community for the global live chat room
- `getLiveChatMessages` → select from `community_chat_messages` where community_id = public
- `sendLiveChatMessage` → insert into `community_chat_messages`
- Subscribe to realtime changes on the table

---

## Phase 3: Hook Updates

- Update `use-messages.ts` to remove Socket.IO imports, use Supabase realtime
- Update `use-livechat.ts` to use Supabase realtime instead of socket
- Update `use-subscriptions.ts` — already wired to the API layer, will work once API is live

---

## Technical Details

- All new tables use `get_request_wallet_address()` for RLS (matching existing pattern)
- DM messages table gets realtime enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE`
- The `dm-socket.ts` Socket.IO singleton is replaced with a Supabase channel subscription
- `socket.ts` (livechat socket) is similarly replaced
- No external dependencies needed — everything runs on existing Lovable Cloud infrastructure

