-- Compatibility migration for older databases that do not yet include the
-- profile and schedule fields used by the current application UI.
-- The runner performs the required existence checks before executing these
-- ALTER TABLE statements so the migration is safe to re-run.
ALTER TABLE users
  ADD COLUMN photo_url VARCHAR(500) NULL;

ALTER TABLE schedules
  ADD COLUMN assigned_role VARCHAR(120) NULL;

ALTER TABLE schedules
  ADD COLUMN location VARCHAR(160) NULL;
