-- Activities require a duration. Add duration_minutes to scheduled_items.
ALTER TABLE scheduled_items ADD COLUMN duration_minutes integer;
