CREATE DATABASE IF NOT EXISTS shiftsync
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE shiftsync;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_no VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  department VARCHAR(100) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE shifts (
  shift_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_name VARCHAR(80) NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#2563eb',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shifts_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE schedules (
  schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL,
  shift_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  assigned_by INT UNSIGNED NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_schedule_employee_date UNIQUE (employee_id, work_date),
  CONSTRAINT fk_schedules_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_schedules_shift
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_schedules_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_schedules_work_date (work_date),
  INDEX idx_schedules_shift_date (shift_id, work_date)
) ENGINE=InnoDB;

CREATE TABLE leave_requests (
  leave_request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL,
  leave_type ENUM('Vacation', 'Sick', 'Personal', 'Emergency') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  admin_remarks TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
  CONSTRAINT fk_leave_employee
    FOREIGN KEY (employee_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_leave_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_leave_employee_status (employee_id, status),
  INDEX idx_leave_status_dates (status, start_date, end_date)
) ENGINE=InnoDB;
