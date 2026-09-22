-- pgTAP tests for activity recording: completion writes correct event log entry, log immutability.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(7);

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
-- own care_recipient, carer role assignment, and scheduled activity item
-- inline, scoped to this transaction (rolled back at the end).

DO $$
DECLARE
  v_carer_id uuid;
  v_cr_id    uuid;
  v_item_id  uuid;
BEGIN
  SELECT id INTO v_carer_id FROM auth.users WHERE email = 'user2@test.local';

  INSERT INTO care_recipients (name, date_of_birth)
  VALUES ('Test Recipient', '2020-01-01')
  RETURNING id INTO v_cr_id;

  INSERT INTO user_roles (user_id, care_recipient_id, role)
  VALUES (v_carer_id, v_cr_id, 'carer');

  INSERT INTO scheduled_items (
    care_recipient_id, type, name,
    time_of_day,
    overdue_window_minutes,
    is_compulsory, bolus_rest_minutes, nutrition_type,
    created_by
  ) VALUES (
    v_cr_id,
    'activity', 'Stander Time',
    '10:00', 120, true, null, null,
    v_carer_id
  )
  RETURNING id INTO v_item_id;

  PERFORM set_config('tests.carer_id', v_carer_id::text, false);
  PERFORM set_config('tests.cr_id',    v_cr_id::text,    false);
  PERFORM set_config('tests.item_id',  v_item_id::text,  false);
END;
$$;

-- ============================================================
-- 1. A team member can insert an activity completion
-- ============================================================

SELECT tests.set_auth_user(current_setting('tests.carer_id')::uuid);

INSERT INTO public.event_log (
  care_recipient_id, event_type, scheduled_item_id,
  carer_id, occurred_at, status
) VALUES (
  current_setting('tests.cr_id')::uuid,
  'activity',
  current_setting('tests.item_id')::uuid,
  current_setting('tests.carer_id')::uuid,
  now(),
  'completed'
);

SELECT ok(true, 'carer can insert activity completion');

-- ============================================================
-- 2. The inserted row has correct field values
-- ============================================================

SELECT is(
  (SELECT event_type::text FROM public.event_log
   WHERE scheduled_item_id = current_setting('tests.item_id')::uuid
     AND status = 'completed'
     AND carer_id = current_setting('tests.carer_id')::uuid
   ORDER BY created_at DESC LIMIT 1),
  'activity',
  'event_type is activity'
);

SELECT is(
  (SELECT status::text FROM public.event_log
   WHERE scheduled_item_id = current_setting('tests.item_id')::uuid
     AND carer_id = current_setting('tests.carer_id')::uuid
   ORDER BY created_at DESC LIMIT 1),
  'completed',
  'status is completed'
);

SELECT is(
  (SELECT carer_id FROM public.event_log
   WHERE scheduled_item_id = current_setting('tests.item_id')::uuid
     AND status = 'completed'
   ORDER BY created_at DESC LIMIT 1),
  current_setting('tests.carer_id')::uuid,
  'carer_id matches the recording carer'
);

-- ============================================================
-- 3. Optional notes are stored
-- ============================================================

INSERT INTO public.event_log (
  care_recipient_id, event_type, scheduled_item_id,
  carer_id, occurred_at, status, notes
) VALUES (
  current_setting('tests.cr_id')::uuid,
  'activity',
  current_setting('tests.item_id')::uuid,
  current_setting('tests.carer_id')::uuid,
  now(),
  'completed',
  'full session completed'
);

SELECT is(
  (SELECT notes FROM public.event_log
   WHERE scheduled_item_id = current_setting('tests.item_id')::uuid
     AND notes IS NOT NULL
   ORDER BY created_at DESC LIMIT 1),
  'full session completed',
  'notes are stored on the event log row'
);

-- ============================================================
-- 4. Log immutability — UPDATE is denied
-- ============================================================

SELECT throws_ok(
  format(
    'UPDATE public.event_log SET notes = ''tampered'' WHERE care_recipient_id = %L::uuid',
    current_setting('tests.cr_id')
  ),
  '42501',
  NULL,
  'UPDATE on event_log is denied (no policy grants it)'
);

-- ============================================================
-- 5. Log immutability — DELETE is denied
-- ============================================================

SELECT throws_ok(
  format(
    'DELETE FROM public.event_log WHERE care_recipient_id = %L::uuid',
    current_setting('tests.cr_id')
  ),
  '42501',
  NULL,
  'DELETE on event_log is denied (no policy grants it)'
);

SELECT tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
