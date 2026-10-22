-- ShiftSync development foundation schema.
-- Apply only with `docker compose exec app php bin/migrate.php`.
-- This file intentionally contains no DROP, TRUNCATE, or database-selection statements.
-- The initializer refuses to run when untracked application tables already exist.

CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_no   VARCHAR(30) NOT NULL,
  first_name    VARCHAR(80) NOT NULL,
  last_name     VARCHAR(80) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  department    VARCHAR(100) NULL,
  job_title     VARCHAR(120) NULL,
  phone         VARCHAR(40) NULL,
  location      VARCHAR(160) NULL,
  bio           VARCHAR(500) NULL,
  photo_url     VARCHAR(500) NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_employee_no UNIQUE (employee_no),
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reusable shift types; schedules assign an employee to a shift type on a date.
CREATE TABLE IF NOT EXISTS shifts (
  shift_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_name VARCHAR(80) NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  color      CHAR(7) NOT NULL DEFAULT '#16a34a',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_shifts_name UNIQUE (shift_name),
  CONSTRAINT chk_shift_times CHECK (start_time <> end_time),
  CONSTRAINT chk_shift_color CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT fk_shifts_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL,
  shift_id    INT UNSIGNED NOT NULL,
  work_date   DATE NOT NULL,
  status      ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  assigned_role VARCHAR(120) NULL,
  location    VARCHAR(160) NULL,
  assigned_by INT UNSIGNED NULL,
  notes       VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_schedule_employee_date UNIQUE (employee_id, work_date),
  CONSTRAINT fk_schedules_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_schedules_shift
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_schedules_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_schedules_work_date (work_date),
  INDEX idx_schedules_shift_date (shift_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  leave_request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id      INT UNSIGNED NOT NULL,
  leave_type       VARCHAR(50) NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  reason           VARCHAR(500) NOT NULL,
  status           ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by      INT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  admin_remarks    VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_leave_review CHECK (
    (status IN ('pending','cancelled') AND reviewed_at IS NULL) OR
    (status IN ('approved','rejected') AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT fk_leave_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_leave_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_leave_employee_status (employee_id, status),
  INDEX idx_leave_status_dates (status, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_swap_requests (
  swap_request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id     INT UNSIGNED NOT NULL,
  requester_id    INT UNSIGNED NOT NULL,
  target_user_id  INT UNSIGNED NOT NULL,
  reason          VARCHAR(500) NOT NULL,
  status          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by     INT UNSIGNED NULL,
  reviewed_at     DATETIME NULL,
  admin_remarks   VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_swap_review CHECK (
    (status IN ('pending','cancelled') AND reviewed_at IS NULL) OR
    (status IN ('approved','rejected') AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT fk_swaps_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_swaps_requester
    FOREIGN KEY (requester_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_swaps_target
    FOREIGN KEY (target_user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_swaps_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_swaps_status_created (status, created_at),
  INDEX idx_swaps_target_status (target_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Times are stored in UTC by the application; one open entry per employee is enforced.
CREATE TABLE IF NOT EXISTS time_entries (
  time_entry_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id         INT UNSIGNED NOT NULL,
  schedule_id         INT UNSIGNED NULL,
  clock_in_at         DATETIME NOT NULL,
  clock_out_at        DATETIME NULL,
  active_employee_id  INT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN clock_out_at IS NULL THEN employee_id ELSE NULL END) STORED,
  notes               VARCHAR(500) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_time_entry_one_open_per_employee UNIQUE (active_employee_id),
  CONSTRAINT chk_time_entry_range CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at),
  CONSTRAINT fk_time_entries_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_time_entries_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_time_entries_employee_clockin (employee_id, clock_in_at),
  INDEX idx_time_entries_clockin (clock_in_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  title           VARCHAR(160) NOT NULL,
  message         VARCHAR(500) NOT NULL,
  read_at         DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_notifications_user_read_created (user_id, read_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compensation is separated from general profiles and must be admin-authorized in the API.
CREATE TABLE IF NOT EXISTS employee_pay_rates (
  pay_rate_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id    INT UNSIGNED NOT NULL,
  hourly_rate    DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to   DATE NULL,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_rate_employee_start UNIQUE (employee_id, effective_from),
  CONSTRAINT chk_pay_rate_positive CHECK (hourly_rate > 0),
  CONSTRAINT chk_pay_rate_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT fk_pay_rates_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pay_rates_creator
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_pay_rates_employee_effective (employee_id, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
