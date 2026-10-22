-- Add fields used by the current employee profile and assigned-shift screens.
ALTER TABLE users
  ADD COLUMN photo_url VARCHAR(500) NULL;

ALTER TABLE schedules
  ADD COLUMN assigned_role VARCHAR(120) NULL;

ALTER TABLE schedules
  ADD COLUMN location VARCHAR(160) NULL;
