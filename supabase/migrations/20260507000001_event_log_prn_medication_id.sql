ALTER TABLE event_log
  ADD COLUMN prn_medication_id uuid REFERENCES as_needed_medications(id);
