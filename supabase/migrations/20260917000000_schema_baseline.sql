-- Consolidated schema baseline. Supersedes the 20 incremental migrations
-- previously applied between 2026-05-01 and 2026-08-16 (schema_baseline
-- through get_carers_with_emails_last_sign_in) — squashed into one file
-- now that the schema has stabilized. This is the full current-state
-- schema, not a diff.

-- =============================================================
-- EXTENSIONS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('admin', 'senior_carer', 'carer');

CREATE TYPE scheduled_item_type AS ENUM ('medication_scheduled', 'nutrition', 'activity');

CREATE TYPE nutrition_type AS ENUM ('bolus', 'oral_self', 'oral_carer');

CREATE TYPE event_type AS ENUM (
  'medication_scheduled',
  'as_needed_medication',
  'nutrition',
  'activity'
);

CREATE TYPE event_status AS ENUM ('completed', 'missed', 'skipped');

-- =============================================================
-- TABLES
-- =============================================================

-- Root tenant. All other records are scoped to a care_recipient.
-- Insert via the create_care_recipient() RPC — not directly.
CREATE TABLE care_recipients (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text  NOT NULL,
  date_of_birth date  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Role assignment per user per care_recipient. A user can hold a role on
-- more than one care_recipient (multi-patient support).
CREATE TABLE user_roles (
  id                uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_recipient_id uuid      NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  role              user_role NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, care_recipient_id)
);

-- All recurring tasks: medications, nutrition sessions, and activities.
-- time_of_day applies to medication_scheduled and activity.
-- nutrition_type/bolus_rest_minutes apply to nutrition items.
-- days_of_week: NULL = every day; otherwise 0=Sun..6=Sat (matches JS Date.getDay()).
CREATE TABLE scheduled_items (
  id                       uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id        uuid                NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  type                     scheduled_item_type NOT NULL,
  name                     text                NOT NULL,
  time_of_day              time,
  overdue_window_minutes   integer             NOT NULL DEFAULT 15,
  is_compulsory            boolean             NOT NULL DEFAULT true,
  bolus_rest_minutes       integer,
  created_by               uuid                NOT NULL REFERENCES auth.users(id),
  created_at               timestamptz         NOT NULL DEFAULT now(),
  duration_minutes         integer,
  nutrition_type           nutrition_type,
  description              text,
  days_of_week             integer[]
);

-- Guided nutrition session records. Updated in-place as the session
-- progresses, then considered immutable once completed_at is set.
CREATE TABLE nutrition_sessions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id      uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  scheduled_item_id      uuid        REFERENCES scheduled_items(id) ON DELETE SET NULL,
  carer_id               uuid        NOT NULL REFERENCES auth.users(id),
  started_at             timestamptz NOT NULL,
  completed_at           timestamptz,
  notes                  text,
  bulk_confirmed         boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  all_consumed           boolean,
  bolus_rest_minutes     integer,
  bolus_rounds_completed integer,
  rest_started_at        timestamptz
);

-- PRN (as-needed) medication definitions. Carers log against these at any time.
CREATE TABLE as_needed_medications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  notes             text,
  created_by        uuid        NOT NULL REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log. No UPDATE or DELETE policies are granted.
CREATE TABLE event_log (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id uuid         NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  event_type        event_type   NOT NULL,
  scheduled_item_id uuid         REFERENCES scheduled_items(id) ON DELETE SET NULL,
  carer_id          uuid         REFERENCES auth.users(id),
  occurred_at       timestamptz  NOT NULL,
  status            event_status NOT NULL,
  notes             text,
  bulk_confirmed    boolean      NOT NULL DEFAULT false,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  prn_medication_id uuid         REFERENCES as_needed_medications(id)
);

-- Expo push tokens per user. Upserted on each app launch.
CREATE TABLE push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text        NOT NULL,
  platform   text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

-- =============================================================
-- INDEXES
-- =============================================================

CREATE INDEX user_roles_care_recipient_id_idx
  ON user_roles (care_recipient_id);

CREATE INDEX scheduled_items_care_recipient_id_idx
  ON scheduled_items (care_recipient_id);

CREATE INDEX event_log_care_recipient_occurred_at_idx
  ON event_log (care_recipient_id, occurred_at);

CREATE INDEX event_log_scheduled_item_id_idx
  ON event_log (scheduled_item_id);

CREATE INDEX nutrition_sessions_care_recipient_started_at_idx
  ON nutrition_sessions (care_recipient_id, started_at);

CREATE INDEX push_tokens_user_id_idx
  ON push_tokens (user_id);

-- =============================================================
-- RLS HELPER FUNCTIONS
-- =============================================================
-- SECURITY DEFINER so these can query user_roles without triggering
-- its own RLS policies (which would cause infinite recursion).

CREATE OR REPLACE FUNCTION public.has_care_recipient_role(p_care_recipient_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE care_recipient_id = p_care_recipient_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_elevated_role(p_care_recipient_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE care_recipient_id = p_care_recipient_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'senior_carer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_for(p_care_recipient_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE care_recipient_id = p_care_recipient_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- =============================================================
-- BOOTSTRAP RPC
-- =============================================================
-- Creates a care_recipient and assigns the caller as admin atomically.
-- Called during onboarding; not exposed via direct table INSERT.

CREATE OR REPLACE FUNCTION public.create_care_recipient(p_name text, p_date_of_birth date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.care_recipients (name, date_of_birth)
  VALUES (p_name, p_date_of_birth)
  RETURNING id INTO v_id;

  INSERT INTO public.user_roles (user_id, care_recipient_id, role)
  VALUES (auth.uid(), v_id, 'admin');

  RETURN v_id;
END;
$$;

-- =============================================================
-- ADMIN QUERY RPCs
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_carer_names(p_care_recipient_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_care_recipient_role(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT ur.user_id,
           COALESCE(u.raw_user_meta_data->>'name', u.email::text) AS display_name
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_carers_with_emails(p_care_recipient_id uuid)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  role              user_role,
  email             text,
  last_sign_in_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_for(p_care_recipient_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT ur.id, ur.user_id, ur.role, u.email::text, u.last_sign_in_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.care_recipient_id = p_care_recipient_id;
END;
$$;

-- =============================================================
-- SCHEDULED JOB: MARK MISSED EVENTS
-- =============================================================
-- Finds scheduled items past their overdue window with no terminal event
-- today, then atomically inserts missed entries for them.
-- SECURITY DEFINER so the cron job can bypass RLS.

CREATE OR REPLACE FUNCTION public.mark_missed_events()
RETURNS TABLE(
  inserted_id            uuid,
  item_id                uuid,
  item_care_recipient_id uuid,
  item_event_type        text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL timezone TO 'GMT';

  RETURN QUERY
  WITH overdue AS (
    SELECT
      si.id                                                                        AS scheduled_item_id,
      si.care_recipient_id,
      si.type::text                                                                AS event_type_text,
      (CURRENT_DATE + si.time_of_day + (si.overdue_window_minutes * interval '1 minute')) AS missed_at
    FROM scheduled_items si
    WHERE si.time_of_day IS NOT NULL
      -- Day-of-week guard: skip items not scheduled for today
      AND (si.days_of_week IS NULL OR EXTRACT(DOW FROM CURRENT_DATE)::int = ANY(si.days_of_week))
      -- Threshold has passed today
      AND (CURRENT_DATE + si.time_of_day + (si.overdue_window_minutes * interval '1 minute')) < now()
      -- No completed or skipped event exists for this item today
      AND NOT EXISTS (
        SELECT 1 FROM event_log el
        WHERE el.scheduled_item_id = si.id
          AND el.status IN ('completed', 'skipped')
          AND el.occurred_at >= CURRENT_DATE
          AND el.occurred_at < CURRENT_DATE + interval '1 day'
      )
      -- Idempotency: skip if a missed entry already exists today
      AND NOT EXISTS (
        SELECT 1 FROM event_log el
        WHERE el.scheduled_item_id = si.id
          AND el.status = 'missed'
          AND el.occurred_at >= CURRENT_DATE
          AND el.occurred_at < CURRENT_DATE + interval '1 day'
      )
  ),
  inserted AS (
    INSERT INTO event_log (care_recipient_id, event_type, scheduled_item_id, carer_id, occurred_at, status)
    SELECT
      o.care_recipient_id,
      o.event_type_text::event_type,
      o.scheduled_item_id,
      NULL::uuid,   -- automated entry; no carer
      o.missed_at,
      'missed'::event_status
    FROM overdue o
    RETURNING id, scheduled_item_id, care_recipient_id, event_type::text
  )
  SELECT i.id, i.scheduled_item_id, i.care_recipient_id, i.event_type
  FROM inserted i;
END;
$$;

SELECT cron.schedule(
  'mark-missed-events',
  '* * * * *',
  'SELECT public.mark_missed_events()'
);

-- =============================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE care_recipients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE as_needed_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens           ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- care_recipients
-- No direct INSERT: use create_care_recipient() RPC instead.
CREATE POLICY "care_recipients_select"
  ON care_recipients FOR SELECT TO authenticated
  USING (has_care_recipient_role(id));

-- user_roles
CREATE POLICY "user_roles_select"
  ON user_roles FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "user_roles_insert"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (is_admin_for(care_recipient_id));

CREATE POLICY "user_roles_update"
  ON user_roles FOR UPDATE TO authenticated
  USING (is_admin_for(care_recipient_id))
  WITH CHECK (is_admin_for(care_recipient_id));

-- Admins cannot delete their own role (prevents lockout).
CREATE POLICY "user_roles_delete"
  ON user_roles FOR DELETE TO authenticated
  USING (is_admin_for(care_recipient_id) AND user_id != auth.uid());

-- scheduled_items
-- All members read; admin and senior_carer manage.
CREATE POLICY "scheduled_items_select"
  ON scheduled_items FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "scheduled_items_insert"
  ON scheduled_items FOR INSERT TO authenticated
  WITH CHECK (has_elevated_role(care_recipient_id));

CREATE POLICY "scheduled_items_update"
  ON scheduled_items FOR UPDATE TO authenticated
  USING (has_elevated_role(care_recipient_id))
  WITH CHECK (has_elevated_role(care_recipient_id));

CREATE POLICY "scheduled_items_delete"
  ON scheduled_items FOR DELETE TO authenticated
  USING (has_elevated_role(care_recipient_id));

-- nutrition_sessions
-- Members read; carers create and update their own sessions; admins manage any.
CREATE POLICY "nutrition_sessions_select"
  ON nutrition_sessions FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "nutrition_sessions_insert"
  ON nutrition_sessions FOR INSERT TO authenticated
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

CREATE POLICY "nutrition_sessions_update"
  ON nutrition_sessions FOR UPDATE TO authenticated
  USING (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  )
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

-- event_log
-- Append-only: members read and insert; no UPDATE or DELETE policies granted.
-- carer_id may be NULL for automated entries (e.g. the mark_missed_events cron).
CREATE POLICY "event_log_select"
  ON event_log FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "event_log_insert"
  ON event_log FOR INSERT TO authenticated
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id IS NULL OR carer_id = auth.uid())
  );

-- as_needed_medications
-- All members read; admin and senior_carer manage.
CREATE POLICY "as_needed_medications_select"
  ON as_needed_medications FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "as_needed_medications_insert"
  ON as_needed_medications FOR INSERT TO authenticated
  WITH CHECK (has_elevated_role(care_recipient_id));

CREATE POLICY "as_needed_medications_update"
  ON as_needed_medications FOR UPDATE TO authenticated
  USING (has_elevated_role(care_recipient_id));

CREATE POLICY "as_needed_medications_delete"
  ON as_needed_medications FOR DELETE TO authenticated
  USING (has_elevated_role(care_recipient_id));

-- push_tokens
-- Users manage only their own tokens.
CREATE POLICY "push_tokens_select"
  ON push_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert"
  ON push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_update"
  ON push_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_delete"
  ON push_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- REALTIME
-- =============================================================
-- Without this, postgres_changes subscriptions on this table silently
-- receive nothing in production (local dev auto-includes all tables;
-- cloud requires explicit inclusion).

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_log;
