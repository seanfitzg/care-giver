-- Expose carer emails to admins. auth.users is not directly accessible via RLS,
-- so SECURITY DEFINER is required. The admin check prevents non-admins from
-- reading emails via this function.
CREATE OR REPLACE FUNCTION public.get_carers_with_emails(p_care_recipient_id uuid)
RETURNS TABLE (id uuid, user_id uuid, role user_role, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_for(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT ur.id, ur.user_id, ur.role, u.email::text
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;
