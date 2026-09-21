-- pgTAP tests for get_carers_with_emails RPC.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(6);

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

-- ============================================================
-- Helpers (duplicated from auth_roles_test.sql — pgTAP runs
-- each file in its own transaction so helpers don't carry over)
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
-- seed.sql only creates auth.users rows (no care_recipient/user_roles —
-- the app starts from zero patient assignments), so this file creates its
-- own care_recipient and role assignments inline, scoped to this
-- transaction (rolled back at the end).

DO $$
DECLARE
  v_admin_id  uuid;
  v_carer_id  uuid;
  v_senior_id uuid;
  v_cr_id     uuid;
BEGIN
  SELECT id INTO v_admin_id  FROM auth.users WHERE email = 'user1@test.local';
  SELECT id INTO v_carer_id  FROM auth.users WHERE email = 'user2@test.local';
  SELECT id INTO v_senior_id FROM auth.users WHERE email = 'user3@test.local';

  INSERT INTO care_recipients (name, date_of_birth)
  VALUES ('Test Recipient', '2020-01-01')
  RETURNING id INTO v_cr_id;

  INSERT INTO user_roles (user_id, care_recipient_id, role) VALUES
    (v_admin_id,  v_cr_id, 'admin'),
    (v_carer_id,  v_cr_id, 'carer'),
    (v_senior_id, v_cr_id, 'senior_carer');

  PERFORM set_config('tests.admin_id', v_admin_id::text, false);
  PERFORM set_config('tests.carer_id', v_carer_id::text, false);
  PERFORM set_config('tests.cr_id',    v_cr_id::text,    false);
END;
$$;

-- ============================================================
-- 1. Admin receives all three carers with emails
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

CREATE TEMP TABLE carer_results AS
  SELECT * FROM get_carers_with_emails(current_setting('tests.cr_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM carer_results),
  3,
  'admin gets all 3 carers from get_carers_with_emails'
);

SELECT ok(
  (SELECT count(*)::int FROM carer_results WHERE email IS NOT NULL) = 3,
  'all returned rows have non-null emails'
);

SELECT ok(
  EXISTS (SELECT 1 FROM carer_results WHERE email = 'user1@test.local'),
  'user1@test.local appears in results with correct email'
);

SELECT lives_ok(
  'SELECT last_sign_in_at FROM carer_results',
  'last_sign_in_at column is present on get_carers_with_emails results'
);

SELECT is(
  (SELECT name FROM carer_results WHERE email = 'user1@test.local'),
  'Olivia Bennett',
  'name resolves from raw_user_meta_data, not just the email fallback'
);

-- ============================================================
-- 2. Non-admin (carer) cannot call the function
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT throws_ok(
  format(
    'SELECT * FROM get_carers_with_emails(%L::uuid)',
    current_setting('tests.cr_id')
  ),
  'Permission denied',
  'non-admin calling get_carers_with_emails raises permission denied'
);

SELECT tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
