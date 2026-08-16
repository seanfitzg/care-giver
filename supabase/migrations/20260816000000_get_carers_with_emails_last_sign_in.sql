-- Extend get_carers_with_emails with last_sign_in_at for the web admin dashboard
-- (issue #28). Additive column — existing callers that only read id/user_id/role/email
-- are unaffected.
DROP FUNCTION IF EXISTS public.get_carers_with_emails(uuid);

CREATE OR REPLACE FUNCTION public.get_carers_with_emails(p_care_recipient_id uuid)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  role              user_role,
  email             text,
  last_sign_in_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_for(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT ur.id, ur.user_id, ur.role, u.email::text, u.last_sign_in_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;
