-- Expose carer display names to all care recipient members.
-- Unlike get_carers_with_emails (admin-only), any team member can call this
-- so the timeline can show who recorded a medication.
CREATE OR REPLACE FUNCTION public.get_carer_names(p_care_recipient_id uuid)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_care_recipient_role(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT ur.user_id,
           COALESCE(u.raw_user_meta_data->>'name', u.email::text) AS display_name
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;
