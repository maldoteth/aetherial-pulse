-- Keep category_post_log synchronized directly from posts table changes.
-- This avoids relying on client/edge paths for trending category freshness.

CREATE OR REPLACE FUNCTION public.sync_category_post_log_from_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id integer;
  v_category_text text;
  v_categories text[];
  v_cat text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.token_id IS NOT NULL THEN
      DELETE FROM public.category_post_log WHERE token_id = OLD.token_id;
    END IF;
    RETURN OLD;
  END IF;

  v_token_id := NEW.token_id;
  IF v_token_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rebuild rows on insert/update to keep data accurate.
  DELETE FROM public.category_post_log WHERE token_id = v_token_id;

  v_category_text := COALESCE(NEW.category, '');
  IF btrim(v_category_text) = '' THEN
    RETURN NEW;
  END IF;

  v_categories := regexp_split_to_array(v_category_text, '\s*,\s*');

  FOREACH v_cat IN ARRAY v_categories LOOP
    v_cat := lower(trim(leading '#' FROM btrim(v_cat)));
    IF v_cat IS NULL OR v_cat = '' OR v_cat = 'general' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.category_post_log (token_id, name)
    VALUES (v_token_id, v_cat)
    ON CONFLICT (token_id, name) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_category_post_log_from_posts ON public.posts;
CREATE TRIGGER trg_sync_category_post_log_from_posts
AFTER INSERT OR UPDATE OF category OR DELETE
ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.sync_category_post_log_from_posts();

