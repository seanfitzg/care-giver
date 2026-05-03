-- Returns event_log rows enriched with the carer's email and scheduled item name.
-- Scoped to the caller's care recipient (RLS still applies to event_log reads;
-- this function only resolves the email lookup which requires auth.users access).
-- Any authenticated member of the care recipient's team can call this.

CREATE OR REPLACE FUNCTION public.get_event_log_with_details(
  p_care_recipient_id uuid,
  p_since             timestamptz DEFAULT (now() - interval '30 days'),
  p_until             timestamptz DEFAULT now()
)
RETURNS TABLE (
  id                  uuid,
  event_type          event_type,
  scheduled_item_id   uuid,
  scheduled_item_name text,
  carer_id            uuid,
  carer_email         text,
  occurred_at         timestamptz,
  status              event_status,
  notes               text,
  bulk_confirmed      boolean
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
      el.id,
      el.event_type,
      el.scheduled_item_id,
      si.name::text            AS scheduled_item_name,
      el.carer_id,
      u.email::text            AS carer_email,
      el.occurred_at,
      el.status,
      el.notes,
      el.bulk_confirmed
    FROM public.event_log el
    LEFT JOIN public.scheduled_items si ON si.id = el.scheduled_item_id
    LEFT JOIN auth.users u              ON u.id  = el.carer_id
    WHERE el.care_recipient_id = p_care_recipient_id
      AND el.occurred_at BETWEEN p_since AND p_until
    ORDER BY el.occurred_at DESC;
END;
$$;

-- Same pattern for feeding_sessions.
CREATE OR REPLACE FUNCTION public.get_feeding_sessions_with_details(
  p_care_recipient_id uuid,
  p_since             timestamptz DEFAULT (now() - interval '30 days'),
  p_until             timestamptz DEFAULT now()
)
RETURNS TABLE (
  id                     uuid,
  scheduled_item_id      uuid,
  scheduled_item_name    text,
  carer_id               uuid,
  carer_email            text,
  started_at             timestamptz,
  completed_at           timestamptz,
  bolus_rounds_completed integer,
  notes                  text,
  bulk_confirmed         boolean
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
      fs.id,
      fs.scheduled_item_id,
      si.name::text            AS scheduled_item_name,
      fs.carer_id,
      u.email::text            AS carer_email,
      fs.started_at,
      fs.completed_at,
      fs.bolus_rounds_completed,
      fs.notes,
      fs.bulk_confirmed
    FROM public.feeding_sessions fs
    LEFT JOIN public.scheduled_items si ON si.id = fs.scheduled_item_id
    LEFT JOIN auth.users u              ON u.id  = fs.carer_id
    WHERE fs.care_recipient_id = p_care_recipient_id
      AND fs.started_at BETWEEN p_since AND p_until
    ORDER BY fs.started_at DESC;
END;
$$;
