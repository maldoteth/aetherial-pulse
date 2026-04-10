-- Batch increment view counts for edge function (service role)
CREATE OR REPLACE FUNCTION public.increment_post_views_batch(p_token_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token_ids IS NULL OR array_length(p_token_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE token_id = ANY(p_token_ids);
END;
$$;
