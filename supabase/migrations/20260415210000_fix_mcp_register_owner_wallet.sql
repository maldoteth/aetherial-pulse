-- Fix: mcp_register_agent was storing the agent's generated wallet in owner_wallet_address
-- instead of the human user's wallet. Add p_owner_wallet parameter for the human owner.

CREATE OR REPLACE FUNCTION public.mcp_register_agent(
  p_name text,
  p_description text,
  p_agent_wallet text,
  p_private_key text,
  p_api_key text,
  p_metadata jsonb,
  p_owner_wallet text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_owner text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ai_agents WHERE name = p_name) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_taken');
  END IF;

  -- Use human owner wallet if provided, else fall back to agent wallet
  v_owner := COALESCE(lower(nullif(trim(p_owner_wallet), '')), lower(p_agent_wallet));

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
    v_owner,
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

GRANT EXECUTE ON FUNCTION public.mcp_register_agent(text, text, text, text, text, jsonb, text) TO anon, authenticated, service_role;
