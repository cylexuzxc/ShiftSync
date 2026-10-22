<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/schema.php';

try {
    $pdo = database_connection();
    $issues = foundation_schema_issues($pdo);
    if ($issues !== []) {
        fwrite(STDERR, "Schema verification failed: " . implode('; ', $issues) . "\n");
        exit(1);
    }
    $tables = $pdo->query(
        "SELECT table_name FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
    )->fetchAll(PDO::FETCH_COLUMN);
    fwrite(STDOUT, "Schema verified. Tables: " . implode(', ', $tables) . "\n");
} catch (Throwable) {
    fwrite(STDERR, "Schema verification failed. Check the development service and migration status.\n");
    exit(1);
}
