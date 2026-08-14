-- The web nutrition session runner must reconstruct in-progress bolus/rest state
-- after a page refresh (native app state was purely client-side and never needed this).
ALTER TABLE nutrition_sessions
  ADD COLUMN bolus_rounds_completed integer,
  ADD COLUMN rest_started_at timestamptz;
