-- Fix: "Service role full access agents" policy had no role restriction,
-- allowing ALL users (not just service_role) to read every agent's API key.

-- Drop the broken open-access policies
DROP POLICY IF EXISTS "Service role full access agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Service role full access rate limits" ON public.ai_agent_rate_limits;

-- Re-create with TO service_role so only edge functions (service key) get full access
CREATE POLICY "Service role full access agents" ON public.ai_agents
  FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access rate limits" ON public.ai_agent_rate_limits
  FOR ALL TO service_role USING (true);
