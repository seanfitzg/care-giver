-- Full reset: deletes every care_recipient and every user account, taking
-- the database back to an empty, pre-onboarding state. IRREVERSIBLE.
--
-- Do not run this directly with `supabase db query` — use
-- `npm run supabase:reset-all -- --local` or `--linked`, which asks for
-- confirmation first (typing the project ref for --linked).
--
-- Ordering matters: care_recipients must be cleared before auth.users.
-- scheduled_items.created_by, nutrition_sessions.carer_id,
-- as_needed_medications.created_by, and event_log.carer_id reference
-- auth.users(id) with NO cascade, so deleting users first would violate
-- those foreign keys while rows still exist. Deleting care_recipients first
-- cascades away user_roles, scheduled_items, nutrition_sessions, event_log,
-- and as_needed_medications; deleting auth.users afterward cascades away
-- push_tokens (public) and identities/sessions/refresh_tokens (auth).

BEGIN;

DELETE FROM public.care_recipients;
DELETE FROM auth.users;

COMMIT;
