-- RLS security fixes from pre-release audit (issue #17).
--
-- Finding 1 (Medium): event_log INSERT allowed carer_id to be set to any UUID,
-- enabling a tenant member to impersonate another carer in the audit log.
-- Fix: enforce carer_id IS NULL (automated entries via mark_missed_events, which
-- is SECURITY DEFINER and bypasses this policy) or carer_id = auth.uid().
--
-- Finding 2 (Low/Best Practice): UPDATE policies on scheduled_items, user_roles,
-- as_needed_medications, and nutrition_sessions had USING but no explicit WITH CHECK.
-- PostgreSQL's implicit behaviour (apply USING to the new row) is correct, but
-- making it explicit improves auditability.

-- =============================================================
-- Finding 1: event_log INSERT — enforce carer_id ownership
-- =============================================================

DROP POLICY IF EXISTS "event_log_insert" ON event_log;

CREATE POLICY "event_log_insert"
  ON event_log FOR INSERT TO authenticated
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id IS NULL OR carer_id = auth.uid())
  );

-- =============================================================
-- Finding 2: explicit WITH CHECK on UPDATE policies
-- =============================================================

-- scheduled_items
DROP POLICY IF EXISTS "scheduled_items_update" ON scheduled_items;
CREATE POLICY "scheduled_items_update"
  ON scheduled_items FOR UPDATE TO authenticated
  USING (has_elevated_role(care_recipient_id))
  WITH CHECK (has_elevated_role(care_recipient_id));

-- user_roles
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update"
  ON user_roles FOR UPDATE TO authenticated
  USING (is_admin_for(care_recipient_id))
  WITH CHECK (is_admin_for(care_recipient_id));

-- as_needed_medications
DROP POLICY IF EXISTS "as_needed_medications_update" ON as_needed_medications;
CREATE POLICY "as_needed_medications_update"
  ON as_needed_medications FOR UPDATE TO authenticated
  USING (has_elevated_role(care_recipient_id))
  WITH CHECK (has_elevated_role(care_recipient_id));

-- nutrition_sessions
DROP POLICY IF EXISTS "nutrition_sessions_update" ON nutrition_sessions;
CREATE POLICY "nutrition_sessions_update"
  ON nutrition_sessions FOR UPDATE TO authenticated
  USING (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  )
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );
