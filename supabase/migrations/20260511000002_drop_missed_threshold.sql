-- Remove missed_threshold_minutes from scheduled_items.
-- The overdue_window_minutes column now defines the full overdue window:
-- items become overdue at their scheduled time and missed after
-- scheduled_time + overdue_window_minutes.
ALTER TABLE public.scheduled_items DROP COLUMN missed_threshold_minutes;
