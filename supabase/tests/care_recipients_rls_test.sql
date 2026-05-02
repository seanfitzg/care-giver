-- pgTAP tests for care_recipient multi-tenant RLS isolation.
-- Verifies that users can only read data for care recipients they are assigned to.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;
SELECT plan(8);

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

-- ============================================================
-- Fixtures: load seed UUIDs and create a second tenant
-- ============================================================

DO $$
DECLARE
  v_carer_id  uuid;
  v_admin_id  uuid;
  v_cr_a_id   uuid;
BEGIN
  SELECT id INTO v_carer_id FROM auth.users WHERE email = 'carer@test.local';
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@test.local';
  SELECT id INTO v_cr_a_id  FROM care_recipients WHERE name = 'Dev Person';

  PERFORM set_config('tests.carer_id', v_carer_id::text, false);
  PERFORM set_config('tests.admin_id', v_admin_id::text, false);
  PERFORM set_config('tests.cr_a_id',  v_cr_a_id::text,  false);
END;
$$;

-- Create a second isolated tenant (tenant B) with its own admin.
-- Inserted directly as the superuser to bypass RLS.
DO $$
DECLARE
  v_cr_b_id    uuid := 'cccc0000-0000-0000-0000-000000000001';
  v_user_b_id  uuid := 'cccc0000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_user_b_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'tenant_b_admin@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Tenant B Admin"}',
    false, '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_b_id, v_user_b_id, 'tenant_b_admin@test.local', 'email',
    json_build_object('sub', v_user_b_id::text, 'email', 'tenant_b_admin@test.local'),
    now(), now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.care_recipients (id, name, date_of_birth)
  VALUES (v_cr_b_id, 'Tenant B Person', '2018-03-10')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, care_recipient_id, role)
  VALUES (v_user_b_id, v_cr_b_id, 'admin')
  ON CONFLICT (user_id, care_recipient_id) DO NOTHING;

  PERFORM set_config('tests.cr_b_id',   v_cr_b_id::text,   false);
  PERFORM set_config('tests.user_b_id', v_user_b_id::text, false);
END;
$$;

-- ============================================================
-- 1. Assigned carer can read their own care_recipient
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_a_id')::uuid),
  1,
  'assigned carer can read their own care_recipient'
);

-- ============================================================
-- 2. Assigned carer cannot read another tenant's care_recipient
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_b_id')::uuid),
  0,
  'carer from tenant A cannot read tenant B care_recipient'
);

-- ============================================================
-- 3. Tenant B admin cannot read tenant A care_recipient
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.user_b_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_a_id')::uuid),
  0,
  'tenant B admin cannot read tenant A care_recipient'
);

-- ============================================================
-- 4. Tenant B admin cannot read tenant A scheduled_items
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM scheduled_items
   WHERE care_recipient_id = current_setting('tests.cr_a_id')::uuid),
  0,
  'tenant B admin cannot read tenant A scheduled_items'
);

-- ============================================================
-- 5. Tenant B admin cannot read tenant A user_roles
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM user_roles
   WHERE care_recipient_id = current_setting('tests.cr_a_id')::uuid),
  0,
  'tenant B admin cannot read tenant A user_roles'
);

-- ============================================================
-- 6. Tenant B admin can read their own care_recipient
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_b_id')::uuid),
  1,
  'tenant B admin can read their own care_recipient'
);

-- ============================================================
-- 7. Tenant A admin cannot read tenant B care_recipient
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.admin_id')::uuid);

SELECT is(
  (SELECT count(*)::int FROM care_recipients
   WHERE id = current_setting('tests.cr_b_id')::uuid),
  0,
  'tenant A admin cannot read tenant B care_recipient'
);

-- ============================================================
-- 8. Tenant A admin cannot read tenant B duty_sessions
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM duty_sessions
   WHERE care_recipient_id = current_setting('tests.cr_b_id')::uuid),
  0,
  'tenant A admin cannot read tenant B duty_sessions'
);

SELECT tests.clear_auth();
SELECT * FROM finish();
ROLLBACK;
