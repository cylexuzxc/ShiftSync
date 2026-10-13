-- ShiftSync database schema (MySQL 8.0.16+ / MariaDB 10.2+)
-- Re-runnable: drops and recreates the tables. Do NOT run on a database holding real data.
CREATE DATABASE IF NOT EXISTS shiftsync
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE shiftsync;

DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS users;

-- 1. users: admins and employees (one table, separated by role)
CREATE TABLE users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_no   VARCHAR(30)  NOT NULL,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,           -- PHP password_hash() output, never plaintext
  role          ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  department    VARCHAR(100) NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_employee_no UNIQUE (employee_no),
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_role_status (role, status)     -- employee lists / counts
) ENGINE=InnoDB;

-- 2. shifts: reusable shift types (Morning, Mid, Evening ...)
CREATE TABLE shifts (
  shift_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_name VARCHAR(80) NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,                      -- end < start means an overnight shift
  color      CHAR(7) NOT NULL DEFAULT '#2563eb', -- #RRGGBB
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_shifts_name UNIQUE (shift_name),
  CONSTRAINT chk_shift_times CHECK (start_time <> end_time),
  CONSTRAINT chk_shift_color CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT fk_shifts_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. schedules: one employee works one shift on one date
CREATE TABLE schedules (
  schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL,
  shift_id    INT UNSIGNED NOT NULL,
  work_date   DATE NOT NULL,
  assigned_by INT UNSIGNED NULL,                 -- admin who made the assignment
  notes       VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_schedule_employee_date UNIQUE (employee_id, work_date),
  CONSTRAINT fk_schedules_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,        -- keep history: deactivate users instead of deleting
  CONSTRAINT fk_schedules_shift
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_schedules_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_schedules_work_date (work_date),           -- "today's shifts", weekly grid
  INDEX idx_schedules_shift_date (shift_id, work_date) -- also serves the shift_id foreign key
) ENGINE=InnoDB;

-- 4. leave_requests: employee requests, admin decisions
CREATE TABLE leave_requests (
  leave_request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT UNSIGNED NOT NULL,
  leave_type       ENUM('Vacation','Sick','Personal','Emergency') NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  reason           VARCHAR(500) NOT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by      INT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  admin_remarks    VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
  -- a decision always has a timestamp; a pending request never does
  CONSTRAINT chk_leave_review CHECK (
    (status = 'pending' AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_at IS NOT NULL)),
  CONSTRAINT fk_leave_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_leave_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_leave_employee_status (employee_id, status), -- "my requests"
  INDEX idx_leave_status_dates (status, start_date, end_date) -- pending queue, leave-vs-shift checks
) ENGINE=InnoDB;
