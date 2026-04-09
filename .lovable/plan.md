

# Plan: Build Core Social Layer on Lovable Cloud + R2

## Current State
- **54 database tables** already exist for communities, events, governance, stories, stages, AI, etc. — these all work.
- **Core social features are stubbed** — posts, likes, follows, comments, profiles, bookmarks, search all return empty data because they relied on the DeHub API.
- **105 files** import from `@/lib/api/dehub` — these need to be progressively rewired.
- **R2 secrets** are configured and ready.

## What's Broken (Priority Order)

| Feature | Status | What's needed |
|---------|--------|---------------|
| User Profiles | Stubbed | `profiles` table + CRUD |
| Posts/Feed | Stubbed | `posts` table + feed queries |
| Likes/Votes | Stubbed | `post_likes` table |
| Comments | Stubbed | `post_comments` table |
| Follows | Stubbed | `follows` table |
| Bookmarks | Stubbed | `bookmarks` table |
| Media Upload | Stubbed | R2 edge function |
| Search | Stubbed | Full-text search on posts/profiles |
| Notifications (social) | Stubbed | Already have `custom_notifications` table |
| DMs | Stubbed | Needs `dm_conversations` + `dm_messages` tables |

## Phased Approach

Given the scale (~105 files, ~20 API modules), this must be done in phases. Each phase produces a working app.

### Phase 1: Foundation Tables + Profiles + R2 Upload
**Database migrations:**
- `profiles` — wallet_address (PK-like unique), username, display_name, bio, avatar_url, cover_url, is_verified, is_private, follower_count, following_count, post_count, created_at
- `posts` — id, creator_wallet_address, title, description, media_url, thumbnail_url, media_type (video/image/audio), category, view_count, like_count, comment_count, visibility, created_at
- `post_likes` — post_id + wallet_address (unique), created_at
- `post_comments` — id, post_id, wallet_address, content, parent_id (for replies), created_at
- `follows` — follower_address + following_address (unique), status (accepted/pending), created_at
- `bookmarks` — post_id + wallet_address (unique), created_at

**RLS policies** using existing `get_request_wallet_address()` function (already used by 156 policies).

**R2 upload edge function** — accepts file via multipart form, uploads to R2 bucket, returns public URL.

**Rewire API modules:** Replace stubs in `core.ts`, `users.ts`, `feed.ts`, `social.ts`, `comments.ts` with Supabase queries.

### Phase 2: Feed, Hooks & UI Wiring
- Update `use-unified-feed`, `use-dehub-feed`, `use-dehub-profile` hooks to query new tables
- Wire up ActionBar (like/bookmark/repost), CommentsSection, ProfileHeader
- Post creation flow → R2 upload + insert into `posts` table

### Phase 3: Remaining Features
- Search (Postgres full-text on posts + profiles)
- DM tables + rewire messaging
- Notification triggers for likes/comments/follows
- Leaderboard integration with new tables

## Technical Details

- All tables use `wallet_address` as the identity key (matching existing 54 tables)
- RLS uses existing `get_request_wallet_address()` security definer function
- R2 edge function uses `@aws-sdk/client-s3` with the configured secrets
- `DeHubNFT` type maps to new `posts` table; `DeHubUser` maps to `profiles` table
- Existing barrel export at `@/lib/api/dehub/index.ts` stays — internal implementations change from stubs to Supabase calls

## Shall I proceed?
This is a large migration. I recommend starting with **Phase 1** (tables + R2 + core API rewiring) which will make posts, profiles, likes, follows, comments, and bookmarks functional. Phases 2-3 follow in subsequent messages.

