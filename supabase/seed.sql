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
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Dev Person', '2020-06-15')
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
  is_compulsory, bolus_rest_minutes,
  created_by
) VALUES
  -- Morning medication (compulsory)
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'medication_scheduled', 'Morning Meds',
    '08:00', null, 15, 60, true, null,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Evening medication (supplement)
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'medication_scheduled', 'Evening Supplement',
    '20:00', null, 30, 90, false, null,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Feeding (every 4 hours, 20 min bolus rest)
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'feeding', 'PEG Feed',
    null, 240, 30, 120, true, 20,
    '00000000-0000-0000-0000-000000000001'
  ),
  -- Stander activity
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'activity', 'Stander Time',
    '10:00', null, 30, 120, true, null,
    '00000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;
