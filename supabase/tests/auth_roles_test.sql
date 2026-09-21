-- pgTAP tests for user_roles RLS: role assignment, role change, and access revocation.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(15);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

-- ============================================================
-- Helpers
-- ============================================================

-- Set the Postgres session to act as a given user for RLS checks.
CREATE OR REPLACE FUNCTION tests.set_auth_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated, anon;

-- ============================================================
-- Fixtures
-- ============================================================
-- seed.sql only creates auth.users rows (no care_recipient/user_roles —
-- the app starts from zero patient assignments), so this file creates its
-- own care_recipient and role assignments inline, scoped to this
-- transaction (rolled back at the end). Uses 4 of seed.sql's 5 test users;
-- user5@test.local is left unassigned.

DO $$
DECLARE
  v_admin_id        uuid;
  v_carer_id        uuid;
  v_senior_id       uuid;
  v_second_admin_id uuid;
  v_cr_id           uuid;
BEGIN
  SELECT id INTO v_admin_id        FROM auth.users WHERE email = 'user1@test.local';
  SELECT id INTO v_carer_id        FROM auth.users WHERE email = 'user2@test.local';
  SELECT id INTO v_senior_id       FROM auth.users WHERE email = 'user3@test.local';
  SELECT id INTO v_second_admin_id FROM auth.users WHERE email = 'user4@test.local';

  INSERT INTO care_recipients (name, date_of_birth)
  VALUES ('Test Recipient', '2020-01-01')
  RETURNING id INTO v_cr_id;

  INSERT INTO user_roles (user_id, care_recipient_id, role) VALUES
    (v_admin_id,  v_cr_id, 'admin'),
    (v_carer_id,  v_cr_id, 'carer'),
    (v_senior_id, v_cr_id, 'senior_carer'),
    (v_second_admin_id, v_cr_id, 'admin');

  -- Store for use across test blocks.
  PERFORM set_config('tests.admin_id',        v_admin_id::text,        false);
  PERFORM set_config('tests.carer_id',        v_carer_id::text,        false);
  PERFORM set_config('tests.senior_id',       v_senior_id::text,       false);
  PERFORM set_config('tests.second_admin_id', v_second_admin_id::text, false);
  PERFORM set_config('tests.cr_id',           v_cr_id::text,           false);
END;
$$;

-- ============================================================
-- 1. Role assignment: seed roles are present
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = current_setting('tests.admin_id')::uuid
      AND care_recipient_id = current_setting('tests.cr_id')::uuid
      AND role = 'admin'
  ),
  'user1@test.local has admin role for the test recipient'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = current_setting('tests.carer_id')::uuid
      AND care_recipient_id = current_setting('tests.cr_id')::uuid
      AND role = 'carer'
  ),
  'user2@test.local has carer role for the test recipient'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = current_setting('tests.senior_id')::uuid
      AND care_recipient_id = current_setting('tests.cr_id')::uuid
      AND role = 'senior_carer'
  ),
  'user3@test.local has senior_carer role for the test recipient'
);

-- ============================================================
-- 2. RLS: admin can read all roles for their care_recipient
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE care_recipient_id = current_setting('tests.cr_id')::uuid),
  4,
  'admin sees all 4 user_roles rows via RLS'
);

-- ============================================================
-- 3. RLS: regular carer can also read roles (for duty screen)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE care_recipient_id = current_setting('tests.cr_id')::uuid),
  4,
  'carer also sees all user_roles rows via RLS'
);

-- ============================================================
-- 4. RLS: carer cannot change another user's role (UPDATE denied)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE user_id = current_setting('tests.senior_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid
     AND role = 'senior_carer'),
  1,
  'senior_carer role unchanged before carer update attempt'
);

-- Attempt to promote senior to admin as a carer — should silently affect 0 rows.
UPDATE user_roles
  SET role = 'admin'
  WHERE user_id = current_setting('tests.senior_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT role::text FROM user_roles
   WHERE user_id = current_setting('tests.senior_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  'senior_carer',
  'carer cannot change another user''s role (RLS UPDATE blocked)'
);

-- ============================================================
-- 5. Role change: admin can change a carer's role
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

UPDATE user_roles
  SET role = 'senior_carer'
  WHERE user_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT role::text FROM user_roles
   WHERE user_id = current_setting('tests.carer_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  'senior_carer',
  'admin successfully changed carer role to senior_carer'
);

-- Reset for subsequent tests.
UPDATE user_roles
  SET role = 'carer'
  WHERE user_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

-- ============================================================
-- 6. Access revocation: admin can delete a carer's role
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

DELETE FROM user_roles
  WHERE user_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE user_id = current_setting('tests.carer_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  0,
  'admin can delete a carer''s user_roles row (access revoked)'
);

-- ============================================================
-- 7. Revoked carer loses data access
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_id')::uuid),
  0,
  'revoked carer cannot read care_recipients via RLS'
);

SELECT is(
  (SELECT count(*)::int FROM scheduled_items
   WHERE care_recipient_id = current_setting('tests.cr_id')::uuid),
  0,
  'revoked carer cannot read scheduled_items via RLS'
);

-- ============================================================
-- 8. Admin cannot delete their own role (lockout prevention)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

DELETE FROM user_roles
  WHERE user_id = current_setting('tests.admin_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE user_id = current_setting('tests.admin_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  1,
  'admin cannot delete their own role (lockout prevention)'
);

-- ============================================================
-- 9. Leave: a non-admin can delete their own role (senior_carer)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.senior_id')::uuid);

DELETE FROM user_roles
  WHERE user_id = current_setting('tests.senior_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE user_id = current_setting('tests.senior_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  0,
  'senior_carer can leave by deleting their own user_roles row'
);

-- ============================================================
-- 10. Admin cannot demote or delete another admin's role
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

-- Attempt to demote the second admin first — if this succeeded it would
-- reopen the delete path closed below (demote, then delete as a non-admin).
UPDATE user_roles
  SET role = 'carer'
  WHERE user_id = current_setting('tests.second_admin_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT role::text FROM user_roles
   WHERE user_id = current_setting('tests.second_admin_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  'admin',
  'admin cannot demote another admin''s role (RLS UPDATE blocked)'
);

DELETE FROM user_roles
  WHERE user_id = current_setting('tests.second_admin_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid;

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE user_id = current_setting('tests.second_admin_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid),
  1,
  'admin cannot delete another admin''s user_roles row'
);

SELECT tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
