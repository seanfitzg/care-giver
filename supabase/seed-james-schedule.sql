-- One-off script: populates James's recurring daily schedule based on the
-- family's real care instructions ("Oscar's Schedule.pdf" — despite the
-- filename, this care recipient is named James in the app).
--
-- Deliberately excludes:
--  - Hydration top-ups ("60ml water every 30 min from 14:30 onward") —
--    scheduled_items only supports one time_of_day per item, not an
--    intraday repeat interval, so this can't be represented as-is.
--  - Pure transfer/positioning steps (move to wheelchair, move to bed) that
--    have no medication/nutrition/activity content of their own.
--  - The overnight nurse handover checklist and "Extra message for ..."
--    notes (page 6 of the source) — those are one-off shift notes, not a
--    recurring daily schedule. Excluded per instruction; a per-patient
--    notes feature is planned separately for this kind of detail.
--
-- Judgment calls worth reviewing before/after running:
--  - Canonical daily times use the Sun/Mon/Tue/Wed pattern (most consistent
--    across the source's 5 days); Saturday's partial day was not used.
--  - is_compulsory: true for all medications and meals (clinically
--    significant if missed, per CONTEXT.md's definition), false for
--    activities (Morning Care, Stander, floor time, bedtime prep) — the
--    source doesn't label these explicitly, this is inferred.
--  - "Evening Meds" (19:00) and "Morning Meds & Movicol" (08:00) are each
--    kept as one combined item because the source only says "5 meds,
--    including 10.5ml Paracetamol" / "7am meds" without naming the rest —
--    not fabricating drug names that aren't in the source.
--  - overdue_window_minutes is left at the schema default (15) throughout.
--
-- Run via: npx supabase db query --linked --file supabase/seed-james-schedule.sql

DO $$
DECLARE
  v_cr_id    uuid;
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_cr_id FROM care_recipients WHERE name = 'James' LIMIT 1;
  IF v_cr_id IS NULL THEN
    RAISE EXCEPTION 'No care_recipient named ''James'' found';
  END IF;

  SELECT user_id INTO v_admin_id
  FROM user_roles WHERE care_recipient_id = v_cr_id AND role = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin found for James''s care_recipient';
  END IF;

  INSERT INTO scheduled_items (
    care_recipient_id, type, name, time_of_day, is_compulsory,
    bolus_rest_minutes, duration_minutes, nutrition_type, description, created_by
  ) VALUES
    (v_cr_id, 'medication_scheduled', 'Morning Meds & Movicol', '08:00', true,
     NULL, NULL, NULL,
     'Confirm 7am medications and Movicol have been given.', v_admin_id),

    (v_cr_id, 'nutrition', 'Breakfast', '08:00', true,
     20, NULL, 'bolus',
     '2 x 60ml boluses, 20 min apart.', v_admin_id),

    (v_cr_id, 'activity', 'Morning Care', '09:00', false,
     NULL, NULL, NULL,
     'At least 30 min after breakfast. Suction if needed, wash head-to-toe, brush teeth, dress.',
     v_admin_id),

    (v_cr_id, 'medication_scheduled', 'CBD (morning)', '09:00', true,
     NULL, NULL, NULL,
     'Given during morning care.', v_admin_id),

    (v_cr_id, 'activity', 'Stander Time', '09:30', false,
     NULL, 20, NULL,
     'Ensure hips are perfectly aligned first, or legs become very sore. 20 minutes is plenty.',
     v_admin_id),

    (v_cr_id, 'medication_scheduled', 'Famotidine', '12:00', true,
     NULL, NULL, NULL, NULL, v_admin_id),

    (v_cr_id, 'medication_scheduled', 'Paracetamol (midday)', '12:00', true,
     NULL, NULL, NULL, '10.5ml.', v_admin_id),

    (v_cr_id, 'medication_scheduled', 'Gaviscon (midday)', '12:00', true,
     NULL, NULL, NULL, '5ml, given with Famotidine.', v_admin_id),

    (v_cr_id, 'nutrition', 'Dinner', '12:30', true,
     20, NULL, 'bolus',
     '2 x 60ml boluses, 20 min apart, then 20ml H2O + 40ml food. Iron supplement after the 2nd bolus.',
     v_admin_id),

    (v_cr_id, 'activity', 'Afternoon Floor Time', '15:00', false,
     NULL, NULL, NULL,
     '30 min post-dinner. Lights & music through hearing aids.', v_admin_id),

    (v_cr_id, 'activity', 'Bedtime Routine', '17:00', false,
     NULL, NULL, NULL,
     'Change bottom, PJs on, move to couch on one side.', v_admin_id),

    (v_cr_id, 'nutrition', 'Supper', '17:30', true,
     20, NULL, 'bolus',
     '2 x 60ml boluses, 20 min apart, then 20ml H2O + 40ml food.', v_admin_id),

    (v_cr_id, 'medication_scheduled', 'Evening Meds', '19:00', true,
     NULL, NULL, NULL,
     '5 medications total, including 10.5ml Paracetamol. Remaining 4 not itemized in source notes.',
     v_admin_id),

    (v_cr_id, 'activity', 'Bedtime & Monitor Setup', '20:00', false,
     NULL, NULL, NULL,
     'Move to bed, on the side opposite the couch. Sats probe & monitor on.', v_admin_id),

    (v_cr_id, 'medication_scheduled', 'CBD & Omega (night)', '21:00', true,
     NULL, NULL, NULL, NULL, v_admin_id);
END;
$$;
