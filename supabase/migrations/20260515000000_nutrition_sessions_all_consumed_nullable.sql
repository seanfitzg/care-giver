-- null = not recorded (e.g. bulk catch-up); true = fully consumed; false = not fully consumed
ALTER TABLE nutrition_sessions
  ALTER COLUMN all_consumed DROP NOT NULL,
  ALTER COLUMN all_consumed DROP DEFAULT;
