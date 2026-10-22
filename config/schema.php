<?php
declare(strict_types=1);

function foundation_schema_issues(PDO $pdo): array
{
    $requiredColumns = [
        'employee_pay_rates' => ['pay_rate_id', 'employee_id', 'hourly_rate', 'effective_from', 'effective_to', 'created_by'],
        'leave_requests' => ['leave_request_id', 'employee_id', 'leave_type', 'start_date', 'end_date', 'status', 'reviewed_by'],
        'notifications' => ['notification_id', 'user_id', 'title', 'message', 'read_at'],
        'schedules' => ['schedule_id', 'employee_id', 'shift_id', 'work_date', 'status', 'assigned_role', 'location', 'assigned_by'],
        'schema_migrations' => ['version', 'migration_status', 'applied_at'],
        'shift_swap_requests' => ['swap_request_id', 'schedule_id', 'requester_id', 'target_user_id', 'reason', 'status', 'reviewed_by'],
        'shifts' => ['shift_id', 'shift_name', 'start_time', 'end_time', 'color', 'created_by'],
        'time_entries' => ['time_entry_id', 'employee_id', 'schedule_id', 'clock_in_at', 'clock_out_at', 'active_employee_id'],
        'users' => ['user_id', 'employee_no', 'first_name', 'last_name', 'email', 'password_hash', 'role', 'department', 'job_title', 'phone', 'location', 'bio', 'photo_url', 'status'],
    ];
    $expectedTables = array_keys($requiredColumns);
    $actualTables = $pdo->query(
        "SELECT table_name FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    )->fetchAll(PDO::FETCH_COLUMN);
    sort($expectedTables);
    sort($actualTables);

    $issues = [];
    if ($actualTables !== $expectedTables) {
        $issues[] = 'database table set does not match the foundation';
    }

    $actualColumns = $pdo->query(
        "SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = DATABASE()"
    )->fetchAll(PDO::FETCH_GROUP | PDO::FETCH_COLUMN);
    foreach ($requiredColumns as $table => $columns) {
        $missing = array_diff($columns, $actualColumns[$table] ?? []);
        if ($missing !== []) {
            $issues[] = $table . ' is missing required columns: ' . implode(', ', $missing);
        }
    }

    $expectedForeignKeys = [
        'fk_shifts_created_by',
        'fk_schedules_employee',
        'fk_schedules_shift',
        'fk_schedules_assigned_by',
        'fk_leave_employee',
        'fk_leave_reviewer',
        'fk_swaps_schedule',
        'fk_swaps_requester',
        'fk_swaps_target',
        'fk_swaps_reviewer',
        'fk_time_entries_employee',
        'fk_time_entries_schedule',
        'fk_notifications_user',
        'fk_pay_rates_employee',
        'fk_pay_rates_creator',
    ];
    $actualForeignKeys = $pdo->query(
        "SELECT constraint_name FROM information_schema.table_constraints
         WHERE constraint_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'"
    )->fetchAll(PDO::FETCH_COLUMN);
    $missingForeignKeys = array_diff($expectedForeignKeys, $actualForeignKeys);
    if ($missingForeignKeys !== []) {
        $issues[] = 'missing foreign keys: ' . implode(', ', $missingForeignKeys);
    }

    $expectedUniqueIndexes = [
        'uq_users_employee_no',
        'uq_users_email',
        'uq_shifts_name',
        'uq_schedule_employee_date',
        'uq_time_entry_one_open_per_employee',
        'uq_pay_rate_employee_start',
    ];
    $actualUniqueIndexes = $pdo->query(
        "SELECT DISTINCT index_name FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND non_unique = 0"
    )->fetchAll(PDO::FETCH_COLUMN);
    $missingUniqueIndexes = array_diff($expectedUniqueIndexes, $actualUniqueIndexes);
    if ($missingUniqueIndexes !== []) {
        $issues[] = 'missing unique indexes: ' . implode(', ', $missingUniqueIndexes);
    }

    return $issues;
}
