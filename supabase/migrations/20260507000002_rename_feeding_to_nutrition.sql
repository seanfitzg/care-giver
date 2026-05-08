ALTER TYPE scheduled_item_type RENAME VALUE 'feeding' TO 'nutrition';
ALTER TYPE event_type RENAME VALUE 'feeding' TO 'nutrition';

ALTER TABLE feeding_sessions RENAME TO nutrition_sessions;

ALTER INDEX feeding_sessions_care_recipient_started_at_idx
  RENAME TO nutrition_sessions_care_recipient_started_at_idx;

ALTER POLICY "feeding_sessions_select" ON nutrition_sessions RENAME TO "nutrition_sessions_select";
ALTER POLICY "feeding_sessions_insert" ON nutrition_sessions RENAME TO "nutrition_sessions_insert";
ALTER POLICY "feeding_sessions_update" ON nutrition_sessions RENAME TO "nutrition_sessions_update";
