-- Adds the user's display name to get_carers_with_emails, for the Admin
-- carer list (RN and web). Same fallback convention as get_carer_names:
-- raw_user_meta_data->>'name', falling back to email if unset.
--
-- CREATE OR REPLACE can't change a function's RETURNS TABLE shape, so this
-- drops and recreates it.

DROP FUNCTION IF EXISTS public.get_carers_with_emails(uuid);

CREATE FUNCTION public.get_carers_with_emails(p_care_recipient_id uuid)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  role              user_role,
  email             text,
  name              text,
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
    SELECT
      ur.id,
      ur.user_id,
      ur.role,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', u.email::text) AS name,
      u.last_sign_in_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;
