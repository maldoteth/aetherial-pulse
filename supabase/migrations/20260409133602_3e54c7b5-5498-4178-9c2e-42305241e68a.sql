
-- =============================================
-- DM Conversations
-- =============================================
CREATE TABLE public.dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a text NOT NULL,
  participant_b text NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_conversations_participants_unique UNIQUE (participant_a, participant_b)
);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON public.dm_conversations FOR SELECT
  USING (lower(participant_a) = get_request_wallet_address() OR lower(participant_b) = get_request_wallet_address());

CREATE POLICY "Users can create conversations"
  ON public.dm_conversations FOR INSERT
  WITH CHECK (lower(participant_a) = get_request_wallet_address() OR lower(participant_b) = get_request_wallet_address());

CREATE POLICY "Participants can update their conversations"
  ON public.dm_conversations FOR UPDATE
  USING (lower(participant_a) = get_request_wallet_address() OR lower(participant_b) = get_request_wallet_address());

-- =============================================
-- DM Messages
-- =============================================
CREATE TABLE public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_address text NOT NULL,
  content text NOT NULL DEFAULT '',
  msg_type text NOT NULL DEFAULT 'text',
  media_url text,
  voice_duration integer,
  reply_to_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  tip_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_dm_participant(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_conversations
    WHERE id = _conversation_id
      AND (lower(participant_a) = get_request_wallet_address() OR lower(participant_b) = get_request_wallet_address())
  );
$$;

CREATE POLICY "Participants can view messages"
  ON public.dm_messages FOR SELECT
  USING (public.is_dm_participant(conversation_id));

CREATE POLICY "Participants can send messages"
  ON public.dm_messages FOR INSERT
  WITH CHECK (public.is_dm_participant(conversation_id) AND lower(sender_address) = get_request_wallet_address());

CREATE POLICY "Participants can update messages"
  ON public.dm_messages FOR UPDATE
  USING (public.is_dm_participant(conversation_id));

CREATE POLICY "Sender can delete messages"
  ON public.dm_messages FOR DELETE
  USING (lower(sender_address) = get_request_wallet_address());

-- Enable realtime for DM messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;

-- =============================================
-- User Blocks
-- =============================================
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_address text NOT NULL,
  blocked_address text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_address, blocked_address)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blocks"
  ON public.user_blocks FOR SELECT
  USING (lower(blocker_address) = get_request_wallet_address() OR lower(blocked_address) = get_request_wallet_address());

CREATE POLICY "Users can block others"
  ON public.user_blocks FOR INSERT
  WITH CHECK (lower(blocker_address) = get_request_wallet_address());

CREATE POLICY "Users can unblock"
  ON public.user_blocks FOR DELETE
  USING (lower(blocker_address) = get_request_wallet_address());

-- =============================================
-- Reports
-- =============================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_address text NOT NULL,
  target_type text NOT NULL DEFAULT 'post',
  target_id text NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports"
  ON public.reports FOR INSERT
  WITH CHECK (lower(reporter_address) = get_request_wallet_address());

CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (lower(reporter_address) = get_request_wallet_address());

-- =============================================
-- Subscription Plans
-- =============================================
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address text NOT NULL,
  name text NOT NULL,
  description text,
  duration integer NOT NULL DEFAULT 30,
  tier integer NOT NULL DEFAULT 1,
  benefits jsonb DEFAULT '[]'::jsonb,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'DHB',
  is_active boolean NOT NULL DEFAULT true,
  subscriber_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Creators can create plans"
  ON public.subscription_plans FOR INSERT
  WITH CHECK (lower(creator_address) = get_request_wallet_address());

CREATE POLICY "Creators can update their plans"
  ON public.subscription_plans FOR UPDATE
  USING (lower(creator_address) = get_request_wallet_address());

CREATE POLICY "Creators can delete their plans"
  ON public.subscription_plans FOR DELETE
  USING (lower(creator_address) = get_request_wallet_address());

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Subscriptions
-- =============================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  subscriber_address text NOT NULL,
  creator_address text NOT NULL,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view subscriptions"
  ON public.subscriptions FOR SELECT
  USING (lower(subscriber_address) = get_request_wallet_address() OR lower(creator_address) = get_request_wallet_address());

CREATE POLICY "Users can subscribe"
  ON public.subscriptions FOR INSERT
  WITH CHECK (lower(subscriber_address) = get_request_wallet_address());

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (lower(subscriber_address) = get_request_wallet_address());

-- Trigger to update updated_at on dm_conversations
CREATE TRIGGER update_dm_conversations_updated_at
  BEFORE UPDATE ON public.dm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
