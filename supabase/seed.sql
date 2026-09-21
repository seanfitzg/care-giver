-- Seed data for local development.
-- Run via: npx supabase db reset
--
-- Test accounts (password: "password123" for all). No role or care_recipient
-- assignment on any of them — the app should be exercised starting from
-- zero patient assignments (picker/pending flow), not a pre-wired one. Tests
-- that need a role/care_recipient fixture create it inline in their own
-- transaction (see supabase/tests/*.sql).
--   user1@test.local — Olivia Bennett
--   user2@test.local — Marcus Chen
--   user3@test.local — Priya Sharma
--   user4@test.local — Liam Foster
--   user5@test.local — Ava Torres

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
    'user1@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Olivia Bennett"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'user2@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Marcus Chen"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'user3@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Priya Sharma"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'user4@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Liam Foster"}',
    false, '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'user5@test.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Ava Torres"}',
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
    'user1@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'user2@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'user3@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000003","email":"user3@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    'user4@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.local"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    'user5@test.local', 'email',
    '{"sub":"00000000-0000-0000-0000-000000000005","email":"user5@test.local"}',
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;
