-- MCP Edge Function (dehub-mcp) can run with anon key only:
-- privileged reads/writes go through SECURITY DEFINER RPCs (not RLS-bypass from client).

CREATE OR REPLACE FUNCTION public.mcp_get_agent_by_api_key(p_api_key text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  (SELECT to_jsonb(t) FROM (
    SELECT
      id,
      name,
      description,
      api_key,
      owner_wallet_address,
      wallet_private_key,
      is_active,
      metadata,
      last_active_at,
      created_at,
      updated_at
    FROM public.ai_agents
    WHERE api_key = p_api_key
      AND is_active = true
    LIMIT 1
  ) t);
$$;

CREATE OR REPLACE FUNCTION public.mcp_rate_limit_tick(
  p_api_key text,
  p_action text,
  p_limit int,
  p_window_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_rec public.ai_agent_rate_limits%ROWTYPE;
  v_reset timestamptz;
BEGIN
  SELECT id INTO v_agent_id
  FROM public.ai_agents
  WHERE api_key = p_api_key
    AND is_active = true
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'no_agent',
      'remaining', 0,
      'reset_at_ms', null
    );
  END IF;

  v_window_start := v_now - (p_window_ms * interval '1 millisecond');

  SELECT * INTO v_rec
  FROM public.ai_agent_rate_limits
  WHERE agent_id = v_agent_id
    AND action_type = p_action;

  IF NOT FOUND THEN
    INSERT INTO public.ai_agent_rate_limits (agent_id, action_type, count, window_start)
    VALUES (v_agent_id, p_action, 1, v_now);
    v_reset := v_now + (p_window_ms * interval '1 millisecond');
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'reset_at_ms', floor(extract(epoch from v_reset) * 1000)::bigint
    );
  END IF;

  IF v_rec.window_start < v_window_start THEN
    UPDATE public.ai_agent_rate_limits
    SET count = 1, window_start = v_now
    WHERE agent_id = v_agent_id
      AND action_type = p_action;
    v_reset := v_now + (p_window_ms * interval '1 millisecond');
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'reset_at_ms', floor(extract(epoch from v_reset) * 1000)::bigint
    );
  END IF;

  IF v_rec.count >= p_limit THEN
    v_reset := v_rec.window_start + (p_window_ms * interval '1 millisecond');
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at_ms', floor(extract(epoch from v_reset) * 1000)::bigint
    );
  END IF;

  UPDATE public.ai_agent_rate_limits
  SET count = v_rec.count + 1
  WHERE agent_id = v_agent_id
    AND action_type = p_action;

  v_reset := v_rec.window_start + (p_window_ms * interval '1 millisecond');
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_rec.count - 1,
    'reset_at_ms', floor(extract(epoch from v_reset) * 1000)::bigint
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_register_agent(
  p_name text,
  p_description text,
  p_agent_wallet text,
  p_private_key text,
  p_api_key text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ai_agents WHERE name = p_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_taken');
  END IF;

  INSERT INTO public.ai_agents (
    name,
    description,
    api_key,
    owner_wallet_address,
    wallet_private_key,
    is_active,
    metadata
  )
  VALUES (
    p_name,
    COALESCE(nullif(trim(p_description), ''), format('AI agent: %s', p_name)),
    p_api_key,
    lower(p_agent_wallet),
    p_private_key,
    true,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unique_violation');
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_touch_agent_last_active(p_api_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_agents
  SET last_active_at = now()
  WHERE api_key = p_api_key
    AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.mcp_dm_send(p_api_key text, p_target_wallet text, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_wallet text;
  v_other text;
  v_a text;
  v_b text;
  v_cid uuid;
  v_mid uuid;
BEGIN
  v_other := lower(trim(p_target_wallet));
  IF v_other !~ '^0x[0-9a-fA-F]{40}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid target_wallet');
  END IF;

  IF length(p_content) > 12000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Message too long (max 12000)');
  END IF;

  SELECT lower(owner_wallet_address) INTO v_agent_wallet
  FROM public.ai_agents
  WHERE api_key = p_api_key
    AND is_active = true
  LIMIT 1;

  IF v_agent_wallet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid api key');
  END IF;

  IF v_agent_wallet = v_other THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot DM yourself');
  END IF;

  IF v_agent_wallet < v_other THEN
    v_a := v_agent_wallet;
    v_b := v_other;
  ELSE
    v_a := v_other;
    v_b := v_agent_wallet;
  END IF;

  INSERT INTO public.dm_conversations (participant_a, participant_b)
  VALUES (v_a, v_b)
  ON CONFLICT (participant_a, participant_b) DO UPDATE
    SET updated_at = now()
  RETURNING id INTO v_cid;

  INSERT INTO public.dm_messages (
    conversation_id,
    sender_address,
    content,
    msg_type
  )
  VALUES (v_cid, v_agent_wallet, p_content, 'msg')
  RETURNING id INTO v_mid;

  UPDATE public.dm_conversations
  SET last_message_at = now()
  WHERE id = v_cid;

  UPDATE public.ai_agents
  SET last_active_at = now()
  WHERE api_key = p_api_key
    AND is_active = true;

  RETURN jsonb_build_object(
    'ok', true,
    'conversation_id', v_cid,
    'message_id', v_mid
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_get_agent_by_api_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_rate_limit_tick(text, text, int, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_register_agent(text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_touch_agent_last_active(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_dm_send(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mcp_get_agent_by_api_key(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_rate_limit_tick(text, text, int, bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_register_agent(text, text, text, text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_touch_agent_last_active(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_dm_send(text, text, text) TO anon, authenticated, service_role;
