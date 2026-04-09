
-- ============================================
-- PHASE 1: Core Social Layer Tables
-- ============================================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  about_me TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT false,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  twitter_link TEXT,
  discord_link TEXT,
  instagram_link TEXT,
  tiktok_link TEXT,
  telegram_link TEXT,
  youtube_link TEXT,
  facebook_link TEXT,
  customs JSONB DEFAULT '{}'::jsonb,
  dm_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (lower(wallet_address) = get_request_wallet_address());

CREATE INDEX idx_profiles_wallet ON public.profiles (lower(wallet_address));
CREATE INDEX idx_profiles_username ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. POSTS
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id SERIAL,
  creator_wallet_address TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  media_url TEXT,
  thumbnail_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'text',
  category TEXT DEFAULT '',
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  repost_count INTEGER NOT NULL DEFAULT 0,
  is_subscribers_only BOOLEAN NOT NULL DEFAULT false,
  is_ppv BOOLEAN NOT NULL DEFAULT false,
  ppv_amount NUMERIC DEFAULT 0,
  ppv_currency TEXT DEFAULT 'USD',
  visibility TEXT NOT NULL DEFAULT 'public',
  is_short BOOLEAN NOT NULL DEFAULT false,
  is_music_video BOOLEAN NOT NULL DEFAULT false,
  audio_url TEXT,
  duration NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK (lower(creator_wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (lower(creator_wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (lower(creator_wallet_address) = get_request_wallet_address());

CREATE INDEX idx_posts_creator ON public.posts (lower(creator_wallet_address));
CREATE INDEX idx_posts_created ON public.posts (created_at DESC);
CREATE INDEX idx_posts_category ON public.posts (lower(category)) WHERE category != '';
CREATE INDEX idx_posts_media_type ON public.posts (media_type);
CREATE INDEX idx_posts_token_id ON public.posts (token_id);

-- Full-text search index
ALTER TABLE public.posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED;
CREATE INDEX idx_posts_search ON public.posts USING GIN (search_vector);

-- 3. POST_LIKES
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, wallet_address)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can unlike posts" ON public.post_likes FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

CREATE INDEX idx_post_likes_post ON public.post_likes (post_id);
CREATE INDEX idx_post_likes_wallet ON public.post_likes (lower(wallet_address));

-- 4. POST_COMMENTS
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.post_comments FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can update their own comments" ON public.post_comments FOR UPDATE USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can delete their own comments" ON public.post_comments FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

CREATE INDEX idx_post_comments_post ON public.post_comments (post_id);
CREATE INDEX idx_post_comments_parent ON public.post_comments (parent_id) WHERE parent_id IS NOT NULL;

-- 5. FOLLOWS
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_address TEXT NOT NULL,
  following_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_address, following_address)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (lower(follower_address) = get_request_wallet_address());
CREATE POLICY "Users can update follow status" ON public.follows FOR UPDATE USING (lower(following_address) = get_request_wallet_address() OR lower(follower_address) = get_request_wallet_address());
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (lower(follower_address) = get_request_wallet_address());

CREATE INDEX idx_follows_follower ON public.follows (lower(follower_address));
CREATE INDEX idx_follows_following ON public.follows (lower(following_address));

-- 6. BOOKMARKS
CREATE TABLE public.bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, wallet_address)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks" ON public.bookmarks FOR SELECT USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can bookmark posts" ON public.bookmarks FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can remove bookmarks" ON public.bookmarks FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

CREATE INDEX idx_bookmarks_wallet ON public.bookmarks (lower(wallet_address));

-- ============================================
-- TRIGGERS: Auto-update counts
-- ============================================

-- Post like count
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN target_id := OLD.post_id;
  ELSE target_id := NEW.post_id;
  END IF;
  UPDATE public.posts SET like_count = (SELECT COUNT(*) FROM public.post_likes WHERE post_id = target_id) WHERE id = target_id;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_update_post_like_count AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_post_like_count();

-- Post comment count
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN target_id := OLD.post_id;
  ELSE target_id := NEW.post_id;
  END IF;
  UPDATE public.posts SET comment_count = (SELECT COUNT(*) FROM public.post_comments WHERE post_id = target_id) WHERE id = target_id;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_update_post_comment_count AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_count();

-- Follow counts on profiles
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_follower TEXT; v_following TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_follower := OLD.follower_address; v_following := OLD.following_address;
  ELSE v_follower := NEW.follower_address; v_following := NEW.following_address;
  END IF;
  UPDATE public.profiles SET following_count = (SELECT COUNT(*) FROM public.follows WHERE lower(follower_address) = lower(v_follower) AND status = 'accepted') WHERE lower(wallet_address) = lower(v_follower);
  UPDATE public.profiles SET follower_count = (SELECT COUNT(*) FROM public.follows WHERE lower(following_address) = lower(v_following) AND status = 'accepted') WHERE lower(wallet_address) = lower(v_following);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_update_follow_counts AFTER INSERT OR UPDATE OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Post count on profiles
CREATE OR REPLACE FUNCTION public.update_profile_post_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_address TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_address := OLD.creator_wallet_address;
  ELSE v_address := NEW.creator_wallet_address;
  END IF;
  UPDATE public.profiles SET post_count = (SELECT COUNT(*) FROM public.posts WHERE lower(creator_wallet_address) = lower(v_address)) WHERE lower(wallet_address) = lower(v_address);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_update_profile_post_count AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_profile_post_count();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- NOTIFICATION TRIGGERS
-- ============================================

-- Notify on new like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.custom_notifications (recipient_address, actor_address, type, content, reference_id)
  SELECT p.creator_wallet_address, NEW.wallet_address, 'post_like', '', p.token_id::text
  FROM public.posts p WHERE p.id = NEW.post_id AND lower(p.creator_wallet_address) != lower(NEW.wallet_address);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_post_like AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- Notify on new comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.custom_notifications (recipient_address, actor_address, actor_username, actor_avatar, type, content, reference_id)
  SELECT p.creator_wallet_address, NEW.wallet_address, NEW.username, NEW.avatar_url, 'post_comment', LEFT(NEW.content, 100), p.token_id::text
  FROM public.posts p WHERE p.id = NEW.post_id AND lower(p.creator_wallet_address) != lower(NEW.wallet_address);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_post_comment AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- Notify on new follow
CREATE OR REPLACE FUNCTION public.notify_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.custom_notifications (recipient_address, actor_address, type, content)
  VALUES (NEW.following_address, NEW.follower_address, 'follow', '');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_new_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_new_follow();

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
