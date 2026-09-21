-- Adds a DELETE policy letting a user leave a Care Recipient's care team by
-- deleting their own non-admin user_roles row, and tightens the existing
-- admin-managed DELETE and UPDATE policies so an admin can never remove or
-- demote another admin.
--
-- Postgres combines multiple permissive policies for the same command with
-- OR, so a DELETE succeeds if either policy's USING clause passes.

-- Leave: a non-admin can delete their own role assignment.
CREATE POLICY "user_roles_leave"
  ON user_roles FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND role != 'admin');

-- Admin-managed removal: recreate with the added restriction that the
-- target row's role isn't admin. Previously only user_id != auth.uid() was
-- checked, which permitted an admin to remove another admin.
DROP POLICY "user_roles_delete" ON user_roles;

CREATE POLICY "user_roles_delete"
  ON user_roles FOR DELETE TO authenticated
  USING (is_admin_for(care_recipient_id) AND user_id != auth.uid() AND role != 'admin');

-- Admin-managed role changes: recreate with the same target-isn't-admin
-- restriction on the existing row. Without this, an admin could demote
-- another admin to a non-admin role via UPDATE and then delete them via the
-- policy above — an UPDATE-then-DELETE bypass of the DELETE restriction.
DROP POLICY "user_roles_update" ON user_roles;

CREATE POLICY "user_roles_update"
  ON user_roles FOR UPDATE TO authenticated
  USING (is_admin_for(care_recipient_id) AND role != 'admin')
  WITH CHECK (is_admin_for(care_recipient_id));
