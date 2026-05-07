-- pgTAP tests for activity recording: completion writes correct event log entry, log immutability.
-- Run with: npx supabase test db
-- Requires: npx supabase db reset (seed data must be present)

BEGIN;
SELECT plan(7);

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

-- Seed UUIDs (from seed.sql)
-- Carer:            00000000-0000-0000-0000-000000000002
-- Care recipient:   aaaaaaaa-0000-0000-0000-000000000001
-- Stander Time:     bbbbbbbb-0000-0000-0000-000000000004

-- ============================================================
-- 1. A team member can insert an activity completion
-- ============================================================

SELECT tests.set_auth_user('00000000-0000-0000-0000-000000000002');

INSERT INTO public.event_log (
  care_recipient_id, event_type, scheduled_item_id,
  carer_id, occurred_at, status
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'activity',
  'bbbbbbbb-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000002',
  now(),
  'completed'
);

SELECT ok(true, 'carer can insert activity completion');

-- ============================================================
-- 2. The inserted row has correct field values
-- ============================================================

SELECT is(
  (SELECT event_type::text FROM public.event_log
   WHERE scheduled_item_id = 'bbbbbbbb-0000-0000-0000-000000000004'
     AND status = 'completed'
     AND carer_id = '00000000-0000-0000-0000-000000000002'
   ORDER BY created_at DESC LIMIT 1),
  'activity',
  'event_type is activity'
);

SELECT is(
  (SELECT status::text FROM public.event_log
   WHERE scheduled_item_id = 'bbbbbbbb-0000-0000-0000-000000000004'
     AND carer_id = '00000000-0000-0000-0000-000000000002'
   ORDER BY created_at DESC LIMIT 1),
  'completed',
  'status is completed'
);

SELECT is(
  (SELECT carer_id FROM public.event_log
   WHERE scheduled_item_id = 'bbbbbbbb-0000-0000-0000-000000000004'
     AND status = 'completed'
   ORDER BY created_at DESC LIMIT 1),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'carer_id matches the recording carer'
);

-- ============================================================
-- 3. Optional notes are stored
-- ============================================================

INSERT INTO public.event_log (
  care_recipient_id, event_type, scheduled_item_id,
  carer_id, occurred_at, status, notes
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'activity',
  'bbbbbbbb-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000002',
  now(),
  'completed',
  'full session completed'
);

SELECT is(
  (SELECT notes FROM public.event_log
   WHERE scheduled_item_id = 'bbbbbbbb-0000-0000-0000-000000000004'
     AND notes IS NOT NULL
   ORDER BY created_at DESC LIMIT 1),
  'full session completed',
  'notes are stored on the event log row'
);

-- ============================================================
-- 4. Log immutability — UPDATE is denied
-- ============================================================

SELECT throws_ok(
  $$UPDATE public.event_log SET notes = 'tampered' WHERE care_recipient_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'UPDATE on event_log is denied (no policy grants it)'
);

-- ============================================================
-- 5. Log immutability — DELETE is denied
-- ============================================================

SELECT throws_ok(
  $$DELETE FROM public.event_log WHERE care_recipient_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'DELETE on event_log is denied (no policy grants it)'
);

SELECT tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
