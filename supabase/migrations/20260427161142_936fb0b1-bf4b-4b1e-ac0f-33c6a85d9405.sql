UPDATE public.invite_codes SET use_count = 0 WHERE created_by IS NULL;
DELETE FROM public.invite_code_uses WHERE code IN (SELECT code FROM public.invite_codes WHERE created_by IS NULL);