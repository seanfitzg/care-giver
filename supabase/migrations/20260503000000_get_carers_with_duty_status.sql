-- Returns all carers for a care recipient with their current on-duty status.
-- Accessible to all care team members (not admin-only) so carers can see handover state.
-- Admins are always considered on duty regardless of duty_sessions.
CREATE OR REPLACE FUNCTION public.get_carers_with_duty_status(p_care_recipient_id uuid)
RETURNS TABLE (
  user_id      uuid,
  role         user_role,
  email        text,
  is_on_duty   boolean,
  checked_in_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_care_recipient_role(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT
      ur.user_id,
      ur.role,
      u.email::text,
      (ur.role = 'admin' OR ds.id IS NOT NULL) AS is_on_duty,
      ds.session_checked_in_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN LATERAL (
      SELECT duty_sessions.id, duty_sessions.checked_in_at AS session_checked_in_at
      FROM public.duty_sessions
      WHERE duty_sessions.carer_id = ur.user_id
        AND duty_sessions.care_recipient_id = p_care_recipient_id
        AND duty_sessions.checked_out_at IS NULL
      ORDER BY duty_sessions.checked_in_at DESC
      LIMIT 1
    ) ds ON true
    WHERE ur.care_recipient_id = p_care_recipient_id
    ORDER BY is_on_duty DESC, ur.role;
END;
$$;
