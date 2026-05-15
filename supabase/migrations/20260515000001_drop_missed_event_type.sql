-- 'missed' was never written to event_type — the mark_missed_events function uses the
-- scheduled item's actual type. Status='missed' on event_status is the correct signal.
ALTER TYPE event_type RENAME TO event_type_old;
CREATE TYPE event_type AS ENUM ('medication_scheduled', 'as_needed_medication', 'nutrition', 'activity');
ALTER TABLE event_log ALTER COLUMN event_type TYPE event_type USING event_type::text::event_type;
DROP TYPE event_type_old;
