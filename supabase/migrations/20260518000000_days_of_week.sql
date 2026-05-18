-- Add day-of-week recurrence support to scheduled_items.
-- NULL = every day (backward compatible; existing rows stay NULL).
-- Day numbering: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (matches JS Date.getDay()).
ALTER TABLE public.scheduled_items
  ADD COLUMN IF NOT EXISTS days_of_week integer[];

-- Replace mark_missed_events with DOW guard and explicit GMT timezone.
CREATE OR REPLACE FUNCTION public.mark_missed_events()
RETURNS TABLE(
  inserted_id       uuid,
  item_id           uuid,
  item_care_recipient_id uuid,
  item_event_type   text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL timezone TO 'GMT';

  RETURN QUERY
  WITH overdue AS (
    SELECT
      si.id                                                                        AS scheduled_item_id,
      si.care_recipient_id,
      si.type::text                                                                AS event_type_text,
      (CURRENT_DATE + si.time_of_day + (si.overdue_window_minutes * interval '1 minute')) AS missed_at
    FROM scheduled_items si
    WHERE si.time_of_day IS NOT NULL
      -- Day-of-week guard: skip items not scheduled for today
      AND (si.days_of_week IS NULL OR EXTRACT(DOW FROM CURRENT_DATE)::int = ANY(si.days_of_week))
      -- Threshold has passed today
      AND (CURRENT_DATE + si.time_of_day + (si.overdue_window_minutes * interval '1 minute')) < now()
      -- No completed or skipped event exists for this item today
      AND NOT EXISTS (
        SELECT 1 FROM event_log el
        WHERE el.scheduled_item_id = si.id
          AND el.status IN ('completed', 'skipped')
          AND el.occurred_at >= CURRENT_DATE
          AND el.occurred_at < CURRENT_DATE + interval '1 day'
      )
      -- Idempotency: skip if a missed entry already exists today
      AND NOT EXISTS (
        SELECT 1 FROM event_log el
        WHERE el.scheduled_item_id = si.id
          AND el.status = 'missed'
          AND el.occurred_at >= CURRENT_DATE
          AND el.occurred_at < CURRENT_DATE + interval '1 day'
      )
  ),
  inserted AS (
    INSERT INTO event_log (care_recipient_id, event_type, scheduled_item_id, carer_id, occurred_at, status)
    SELECT
      o.care_recipient_id,
      o.event_type_text::event_type,
      o.scheduled_item_id,
      NULL::uuid,   -- automated entry; no carer
      o.missed_at,
      'missed'::event_status
    FROM overdue o
    RETURNING id, scheduled_item_id, care_recipient_id, event_type::text
  )
  SELECT i.id, i.scheduled_item_id, i.care_recipient_id, i.event_type
  FROM inserted i;
END;
$$;
