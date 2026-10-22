<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

try {
    $result = database_connection()->query('SELECT 1')->fetchColumn();
    if ((int) $result !== 1) {
        throw new RuntimeException('Unexpected database test result.');
    }
    fwrite(STDOUT, "Database connection successful.\n");
} catch (Throwable) {
    fwrite(STDERR, "Database connection failed. Check the development service and environment configuration.\n");
    exit(1);
}
