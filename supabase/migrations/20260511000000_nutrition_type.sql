-- Add nutrition_type enum for multi-modality nutrition support (bolus, oral self, oral carer).
-- Reworks nutrition_sessions to track all_consumed and actual bolus rest chosen at session start.

CREATE TYPE nutrition_type AS ENUM ('bolus', 'oral_self', 'oral_carer');

ALTER TABLE scheduled_items
  ADD COLUMN nutrition_type nutrition_type;

UPDATE scheduled_items
  SET nutrition_type = 'bolus'
  WHERE type = 'nutrition';

ALTER TABLE scheduled_items
  DROP COLUMN bolus_rounds;

ALTER TABLE nutrition_sessions
  ADD COLUMN all_consumed boolean NOT NULL DEFAULT false,
  ADD COLUMN bolus_rest_minutes integer,
  DROP COLUMN bolus_rounds_completed;
