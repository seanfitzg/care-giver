-- Target bolus round count per nutrition session (optional; drives the "N of M" display).
ALTER TABLE scheduled_items ADD COLUMN bolus_rounds integer;
