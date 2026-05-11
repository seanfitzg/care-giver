-- Allow scheduled items to be deleted even when historical records exist.
-- Nullifies the scheduled_item_id reference rather than blocking or cascading.
ALTER TABLE nutrition_sessions
  DROP CONSTRAINT feeding_sessions_scheduled_item_id_fkey,
  ADD CONSTRAINT feeding_sessions_scheduled_item_id_fkey
    FOREIGN KEY (scheduled_item_id) REFERENCES scheduled_items(id) ON DELETE SET NULL;

ALTER TABLE event_log
  DROP CONSTRAINT event_log_scheduled_item_id_fkey,
  ADD CONSTRAINT event_log_scheduled_item_id_fkey
    FOREIGN KEY (scheduled_item_id) REFERENCES scheduled_items(id) ON DELETE SET NULL;
