-- Seed data for local development.
-- Run via: npx supabase db reset
--
-- Test accounts (password: "password123" for all):
--   admin@test.local  — admin role
--   carer@test.local  — carer role
--   senior@test.local — senior_carer role

-- ----------------------------------------------------------------
-- Test users (inserted directly into auth schema for local dev)
-- ----------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Admin User"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'carer@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Test Carer"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'senior@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Senior Carer"}',
    false, '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'carer@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"carer@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'senior@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000003","email":"senior@test.local"}',
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- Care recipient
-- ----------------------------------------------------------------

INSERT INTO public.care_recipients (id, name, date_of_birth)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Oscar', '2020-06-15')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- User roles
-- ----------------------------------------------------------------

INSERT INTO public.user_roles (user_id, care_recipient_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'carer'),
  ('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'senior_carer')
ON CONFLICT (user_id, care_recipient_id) DO NOTHING;

-- ----------------------------------------------------------------
-- Scheduled items
-- ----------------------------------------------------------------

INSERT INTO public.scheduled_items (
  id, care_recipient_id, type, name,
  time_of_day, interval_minutes,
  overdue_window_minutes, missed_threshold_minutes,
  is_compulsory, bolus_rest_minutes, bolus_rounds,
  created_by
) VALUES
  -- Morning medication (compulsory)
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'medication_scheduled', 'Morning Meds',
    '08:00', null, 15, 60, true, null, null,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Evening medication (supplement)
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'medication_scheduled', 'Evening Supplement',
    '20:00', null, 30, 90, false, null, null,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Nutrition (every 4 hours, 20 min bolus rest, 4 bolus rounds)
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'nutrition', 'PEG Feed',
    null, 240, 30, 120, true, 20, 4,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Stander activity
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'activity', 'Stander Time',
    '10:00', null, 30, 120, true, null, null,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Physio exercises — wide missed_threshold so it stays overdue most of the day
  (
    'bbbbbbbb-0000-0000-0000-000000000005',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'activity', 'Physio Exercises',
    '07:00', null, 10, 960, true, null, null,
    '00000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  name = EXCLUDED.name,
  time_of_day = EXCLUDED.time_of_day,
  interval_minutes = EXCLUDED.interval_minutes,
  overdue_window_minutes = EXCLUDED.overdue_window_minutes,
  missed_threshold_minutes = EXCLUDED.missed_threshold_minutes,
  is_compulsory = EXCLUDED.is_compulsory,
  bolus_rest_minutes = EXCLUDED.bolus_rest_minutes,
  bolus_rounds = EXCLUDED.bolus_rounds;

-- ----------------------------------------------------------------
-- Event log — past events for today so the timeline isn't empty.
-- Overdue status is computed client-side from schedule + current
-- time; these entries represent items that were explicitly logged.
-- ----------------------------------------------------------------

DELETE FROM public.event_log WHERE care_recipient_id = 'aaaaaaaa-0000-0000-0000-000000000001';

INSERT INTO public.event_log (
  care_recipient_id, event_type, scheduled_item_id, carer_id, occurred_at, status
) VALUES
  -- Morning Meds: explicitly missed
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'medication_scheduled',
    'bbbbbbbb-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    current_date + interval '8 hours 10 minutes',
    'missed'
  ),
  -- PEG Feed (08:00 slot): completed
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'nutrition',
    'bbbbbbbb-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    current_date + interval '8 hours 6 minutes',
    'completed'
  ),
  -- Stander Time: missed
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'activity',
    'bbbbbbbb-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    current_date + interval '10 hours 25 minutes',
    'missed'
  ),
  -- PEG Feed (12:00 slot): missed
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'nutrition',
    'bbbbbbbb-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    current_date + interval '12 hours 8 minutes',
    'missed'
  );
