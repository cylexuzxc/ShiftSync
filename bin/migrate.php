<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/schema.php';

function migration_object_exists(PDO $pdo, string $tableName, string $objectName, string $objectType): bool
{
    switch ($objectType) {
        case 'column':
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :object_name LIMIT 1'
            );
            $stmt->execute(['table_name' => $tableName, 'object_name' => $objectName]);
            return (bool) $stmt->fetchColumn();

        case 'index':
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = :table_name AND index_name = :object_name LIMIT 1'
            );
            $stmt->execute(['table_name' => $tableName, 'object_name' => $objectName]);
            return (bool) $stmt->fetchColumn();

        case 'constraint':
            $stmt = $pdo->prepare(
                'SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_schema = DATABASE() AND table_name = :table_name AND constraint_name = :object_name LIMIT 1'
            );
            $stmt->execute(['table_name' => $tableName, 'object_name' => $objectName]);
            return (bool) $stmt->fetchColumn();

        default:
            throw new InvalidArgumentException('Unsupported migration object type: ' . $objectType);
    }
}

function apply_migration(PDO $pdo, string $version, string $path): bool
{
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException('Unable to read migration ' . $version . '.');
    }

    if ($version === '002_dashboard_profile_schedule_fields') {
        $operations = [
            ['table' => 'users', 'object' => 'photo_url', 'type' => 'column', 'statement' => 'ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) NULL'],
            ['table' => 'schedules', 'object' => 'assigned_role', 'type' => 'column', 'statement' => 'ALTER TABLE schedules ADD COLUMN assigned_role VARCHAR(120) NULL'],
            ['table' => 'schedules', 'object' => 'location', 'type' => 'column', 'statement' => 'ALTER TABLE schedules ADD COLUMN location VARCHAR(160) NULL'],
        ];

        foreach ($operations as $operation) {
            if (!migration_object_exists($pdo, $operation['table'], $operation['object'], $operation['type'])) {
                $pdo->exec($operation['statement']);
            }
        }

        return true;
    }

    $statements = preg_split('/;\s*(?:\r?\n|$)/', $sql);
    if ($statements === false) {
        throw new RuntimeException('Unable to parse migration ' . $version . '.');
    }

    foreach ($statements as $statement) {
        $statement = preg_replace('/^\s*--.*$/m', '', trim($statement));
        if ($statement === null || trim($statement) === '') {
            continue;
        }

        if (preg_match(
            '/^ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD COLUMN\s+`?([a-zA-Z0-9_]+)`?/i',
            $statement,
            $matches
        )) {
            if (migration_object_exists($pdo, $matches[1], $matches[2], 'column')) {
                continue;
            }
        }

        if (preg_match(
            '/^CREATE\s+(UNIQUE\s+)?INDEX\s+`?([a-zA-Z0-9_]+)`?\s+ON\s+`?([a-zA-Z0-9_]+)`?/i',
            $statement,
            $matches
        )) {
            if (migration_object_exists($pdo, $matches[3], $matches[2], 'index')) {
                continue;
            }
        }

        if (preg_match(
            '/^ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD\s+CONSTRAINT\s+`?([a-zA-Z0-9_]+)`?/i',
            $statement,
            $matches
        )) {
            if (migration_object_exists($pdo, $matches[1], $matches[2], 'constraint')) {
                continue;
            }
        }

        $pdo->exec($statement);
    }

    return true;
}

$migrations = [
    '001_initial_foundation' => __DIR__ . '/../schema.sql',
    '002_dashboard_profile_schedule_fields' => __DIR__ . '/../database/migrations/002_dashboard_profile_schedule_fields.sql',
];
$expectedTables = [
    'employee_pay_rates',
    'leave_requests',
    'notifications',
    'schedules',
    'shift_swap_requests',
    'shifts',
    'time_entries',
    'users',
];

try {
    $pdo = database_connection();
    $allTables = $pdo->query(
        "SELECT table_name FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
    )->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('schema_migrations', $allTables, true) && $allTables !== []) {
        throw new RuntimeException(
            'Refusing to initialize a database containing untracked tables. Use a fresh development database.'
        );
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(100) NOT NULL PRIMARY KEY,
            migration_status ENUM(\'applying\',\'applied\') NOT NULL DEFAULT \'applying\',
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB'
    );
    $metadataColumns = $pdo->query(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'"
    )->fetchAll(PDO::FETCH_COLUMN);
    foreach (['version', 'migration_status', 'applied_at'] as $requiredColumn) {
        if (!in_array($requiredColumn, $metadataColumns, true)) {
            throw new RuntimeException('Refusing to use unrecognized migration metadata in this database.');
        }
    }

    $tables = $pdo->query(
        "SELECT table_name FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'"
    )->fetchAll(PDO::FETCH_COLUMN);
    if (array_diff($tables, $expectedTables) !== []) {
        throw new RuntimeException(
            'Refusing to continue because the database contains tables outside this foundation.'
        );
    }

    $readStatus = $pdo->prepare(
        'SELECT migration_status FROM schema_migrations WHERE version = :version'
    );
    foreach ($migrations as $version => $path) {
        $readStatus->execute(['version' => $version]);
        $status = $readStatus->fetchColumn();
        if ($status === 'applied') {
            continue;
        }
        if ($version !== '001_initial_foundation') {
            $readStatus->execute(['version' => '001_initial_foundation']);
            if ($readStatus->fetchColumn() !== 'applied') {
                throw new RuntimeException('The initial foundation migration must be applied first.');
            }
        } elseif ($status === false && $tables !== []) {
            throw new RuntimeException(
                'Refusing to initialize a database containing untracked tables. Use a fresh development database.'
            );
        }

        if ($status === false) {
            $startMigration = $pdo->prepare(
                'INSERT INTO schema_migrations (version, migration_status) VALUES (:version, \'applying\')'
            );
            $startMigration->execute(['version' => $version]);
        } elseif ($status !== 'applying') {
            throw new RuntimeException('Unrecognized migration state; refusing to continue.');
        }

        $migrationSucceeded = false;
        try {
            $migrationSucceeded = apply_migration($pdo, $version, $path);
        } finally {
            if (!$migrationSucceeded) {
                $pdo->prepare(
                    'UPDATE schema_migrations SET migration_status = \'applying\' WHERE version = :version'
                )->execute(['version' => $version]);
            }
        }

        $finishMigration = $pdo->prepare(
            'UPDATE schema_migrations SET migration_status = \'applied\' WHERE version = :version'
        );
        $finishMigration->execute(['version' => $version]);
        fwrite(STDOUT, 'Applied migration ' . $version . ".\n");
    }

    $schemaIssues = foundation_schema_issues($pdo);
    if ($schemaIssues !== []) {
        throw new RuntimeException(
            'Foundation schema verification failed: ' . implode('; ', $schemaIssues)
        );
    }
    fwrite(STDOUT, "Foundation schema is current.\n");
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
