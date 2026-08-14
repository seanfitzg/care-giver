-- Enable Supabase Realtime for event_log so the Today timeline receives live
-- updates when events are inserted (by carers or by the mark_missed_events cron).
-- Without this, postgres_changes subscriptions on this table silently receive nothing
-- in production (local dev auto-includes all tables; cloud requires explicit inclusion).
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_log;
