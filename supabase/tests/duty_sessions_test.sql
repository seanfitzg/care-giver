-- pgTAP tests for duty_sessions RLS and get_carers_with_duty_status RPC.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(8);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

-- ============================================================
-- Helpers
-- ============================================================

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

DO $$
BEGIN
  PERFORM set_config('tests.admin_id',
    (SELECT id::text FROM auth.users WHERE email = 'admin@test.local'), false);
  PERFORM set_config('tests.carer_id',
    (SELECT id::text FROM auth.users WHERE email = 'carer@test.local'), false);
  PERFORM set_config('tests.senior_id',
    (SELECT id::text FROM auth.users WHERE email = 'senior@test.local'), false);
  PERFORM set_config('tests.cr_id',
    (SELECT id::text FROM care_recipients WHERE name = 'Oscar'), false);
END;
$$;

-- ============================================================
-- 1. Carer can check in (insert own duty session)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

INSERT INTO duty_sessions (carer_id, care_recipient_id)
VALUES (
  current_setting('tests.carer_id')::uuid,
  current_setting('tests.cr_id')::uuid
);

SELECT is(
  (SELECT count(*)::int FROM duty_sessions
   WHERE carer_id = current_setting('tests.carer_id')::uuid
     AND care_recipient_id = current_setting('tests.cr_id')::uuid
     AND checked_out_at IS NULL),
  1,
  'carer can insert own duty session (check-in)'
);

-- ============================================================
-- 2. get_carers_with_duty_status shows carer on duty after check-in
-- ============================================================

SELECT ok(
  (SELECT is_on_duty FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE user_id = current_setting('tests.carer_id')::uuid),
  'get_carers_with_duty_status shows carer as on-duty after check-in'
);

-- ============================================================
-- 3. Admin is always on duty (no session required)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

SELECT ok(
  (SELECT is_on_duty FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE user_id = current_setting('tests.admin_id')::uuid),
  'admin is always on duty regardless of duty sessions'
);

-- ============================================================
-- 4. Carer can check out (update own session); duty status becomes false
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

UPDATE duty_sessions
  SET checked_out_at = now()
  WHERE carer_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid
    AND checked_out_at IS NULL;

SELECT is(
  (SELECT is_on_duty FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE user_id = current_setting('tests.carer_id')::uuid),
  false,
  'get_carers_with_duty_status shows carer as off-duty after check-out'
);

-- ============================================================
-- 5. Multiple carers can be on duty simultaneously
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);
INSERT INTO duty_sessions (carer_id, care_recipient_id)
VALUES (current_setting('tests.carer_id')::uuid, current_setting('tests.cr_id')::uuid);

SELECT tests.set_auth_user(current_setting('tests.senior_id')::uuid);
INSERT INTO duty_sessions (carer_id, care_recipient_id)
VALUES (current_setting('tests.senior_id')::uuid, current_setting('tests.cr_id')::uuid);

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE is_on_duty = true AND role != 'admin'),
  2,
  'carer and senior can both be on duty simultaneously'
);

-- ============================================================
-- 6. Admin can check in another carer
-- ============================================================

-- Close existing open sessions for carer so state is clean.
UPDATE duty_sessions
  SET checked_out_at = now()
  WHERE carer_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid
    AND checked_out_at IS NULL;

INSERT INTO duty_sessions (carer_id, care_recipient_id)
VALUES (current_setting('tests.carer_id')::uuid, current_setting('tests.cr_id')::uuid);

SELECT ok(
  (SELECT is_on_duty FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE user_id = current_setting('tests.carer_id')::uuid),
  'admin can check in another carer by inserting a duty session for them'
);

-- ============================================================
-- 7. Admin can check out another carer
-- ============================================================

UPDATE duty_sessions
  SET checked_out_at = now()
  WHERE carer_id = current_setting('tests.carer_id')::uuid
    AND care_recipient_id = current_setting('tests.cr_id')::uuid
    AND checked_out_at IS NULL;

SELECT is(
  (SELECT is_on_duty FROM get_carers_with_duty_status(current_setting('tests.cr_id')::uuid)
   WHERE user_id = current_setting('tests.carer_id')::uuid),
  false,
  'admin can check out another carer by updating their duty session'
);

-- ============================================================
-- 8. Carer cannot insert a duty session for another user (RLS)
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT throws_ok(
  format(
    'INSERT INTO duty_sessions (carer_id, care_recipient_id) VALUES (%L::uuid, %L::uuid)',
    current_setting('tests.admin_id'),
    current_setting('tests.cr_id')
  ),
  'new row violates row-level security policy for table "duty_sessions"',
  'carer cannot insert a duty session on behalf of another user'
);

SELECT tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
