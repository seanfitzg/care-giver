-- pgTAP tests for get_carers_with_emails RPC.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(4);

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

-- ============================================================
-- Fixtures
-- ============================================================

DO $$
BEGIN
  PERFORM set_config('tests.admin_id',
    (SELECT id::text FROM auth.users WHERE email = 'admin@test.local'), false);
  PERFORM set_config('tests.carer_id',
    (SELECT id::text FROM auth.users WHERE email = 'carer@test.local'), false);
  PERFORM set_config('tests.cr_id',
    (SELECT id::text FROM care_recipients WHERE name = 'Dev Person'), false);
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
  EXISTS (SELECT 1 FROM carer_results WHERE email = 'admin@test.local'),
  'admin@test.local appears in results with correct email'
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
