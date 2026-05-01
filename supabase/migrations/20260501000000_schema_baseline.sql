-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('admin', 'senior_carer', 'carer');

CREATE TYPE scheduled_item_type AS ENUM ('medication_scheduled', 'feeding', 'activity');

CREATE TYPE event_type AS ENUM (
  'medication_scheduled',
  'as_needed_medication',
  'feeding',
  'activity',
  'missed'
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

-- Role assignment per user per care_recipient.
CREATE TABLE user_roles (
  id                uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_recipient_id uuid      NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  role              user_role NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, care_recipient_id)
);

-- Carer check-in / check-out. An open session (no checked_out_at) means on-duty.
-- Admins are always considered on-duty without a duty session.
CREATE TABLE duty_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  carer_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_recipient_id uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  checked_in_at     timestamptz NOT NULL DEFAULT now(),
  checked_out_at    timestamptz
);

-- All recurring tasks: medications, feeding sessions, and activities.
-- time_of_day applies to medication_scheduled and activity.
-- interval_minutes applies to feeding.
-- bolus_rest_minutes applies to feeding (drives the countdown timer).
CREATE TABLE scheduled_items (
  id                       uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id        uuid                NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  type                     scheduled_item_type NOT NULL,
  name                     text                NOT NULL,
  time_of_day              time,
  interval_minutes         integer,
  overdue_window_minutes   integer             NOT NULL DEFAULT 15,
  missed_threshold_minutes integer             NOT NULL DEFAULT 60,
  is_compulsory            boolean             NOT NULL DEFAULT true,
  bolus_rest_minutes       integer,
  created_by               uuid                NOT NULL REFERENCES auth.users(id),
  created_at               timestamptz         NOT NULL DEFAULT now()
);

-- Guided feeding session records. Updated in-place as the session progresses,
-- then considered immutable once completed_at is set.
CREATE TABLE feeding_sessions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id      uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  scheduled_item_id      uuid        REFERENCES scheduled_items(id),
  carer_id               uuid        NOT NULL REFERENCES auth.users(id),
  started_at             timestamptz NOT NULL,
  completed_at           timestamptz,
  notes                  text,
  bolus_rounds_completed integer,
  bulk_confirmed         boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log. No UPDATE or DELETE policies are granted.
CREATE TABLE event_log (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id uuid         NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  event_type        event_type   NOT NULL,
  scheduled_item_id uuid         REFERENCES scheduled_items(id),
  carer_id          uuid         REFERENCES auth.users(id),
  occurred_at       timestamptz  NOT NULL,
  status            event_status NOT NULL,
  notes             text,
  bulk_confirmed    boolean      NOT NULL DEFAULT false,
  created_at        timestamptz  NOT NULL DEFAULT now()
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

CREATE INDEX duty_sessions_care_recipient_checked_out_idx
  ON duty_sessions (care_recipient_id, checked_out_at);

CREATE INDEX duty_sessions_carer_id_idx
  ON duty_sessions (carer_id);

CREATE INDEX scheduled_items_care_recipient_id_idx
  ON scheduled_items (care_recipient_id);

CREATE INDEX event_log_care_recipient_occurred_at_idx
  ON event_log (care_recipient_id, occurred_at);

CREATE INDEX event_log_scheduled_item_id_idx
  ON event_log (scheduled_item_id);

CREATE INDEX feeding_sessions_care_recipient_started_at_idx
  ON feeding_sessions (care_recipient_id, started_at);

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
-- ENABLE ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE care_recipients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeding_sessions      ENABLE ROW LEVEL SECURITY;
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
  USING (is_admin_for(care_recipient_id));

-- Admins cannot delete their own role (prevents lockout).
CREATE POLICY "user_roles_delete"
  ON user_roles FOR DELETE TO authenticated
  USING (is_admin_for(care_recipient_id) AND user_id != auth.uid());

-- duty_sessions
-- Carers manage their own sessions; admins manage any session for their care_recipient.
CREATE POLICY "duty_sessions_select"
  ON duty_sessions FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "duty_sessions_insert"
  ON duty_sessions FOR INSERT TO authenticated
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

CREATE POLICY "duty_sessions_update"
  ON duty_sessions FOR UPDATE TO authenticated
  USING (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

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
  USING (has_elevated_role(care_recipient_id));

CREATE POLICY "scheduled_items_delete"
  ON scheduled_items FOR DELETE TO authenticated
  USING (has_elevated_role(care_recipient_id));

-- feeding_sessions
-- Members read; carers create and update their own sessions; admins manage any.
CREATE POLICY "feeding_sessions_select"
  ON feeding_sessions FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "feeding_sessions_insert"
  ON feeding_sessions FOR INSERT TO authenticated
  WITH CHECK (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

CREATE POLICY "feeding_sessions_update"
  ON feeding_sessions FOR UPDATE TO authenticated
  USING (
    has_care_recipient_role(care_recipient_id)
    AND (carer_id = auth.uid() OR is_admin_for(care_recipient_id))
  );

-- event_log
-- Append-only: members read and insert; no UPDATE or DELETE policies granted.
CREATE POLICY "event_log_select"
  ON event_log FOR SELECT TO authenticated
  USING (has_care_recipient_role(care_recipient_id));

CREATE POLICY "event_log_insert"
  ON event_log FOR INSERT TO authenticated
  WITH CHECK (has_care_recipient_role(care_recipient_id));

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
