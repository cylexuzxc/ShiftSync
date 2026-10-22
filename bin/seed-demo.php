<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script may only be run from the command line.\n");
    exit(1);
}

$demoMode = strtolower((string) getenv('DEMO_MODE'));
$environment = strtolower((string) getenv('APP_ENV'));
$databaseName = (string) getenv('DB_NAME');
if ($demoMode !== 'true' || $environment === 'production') {
    fwrite(STDERR, "Demo seeding requires DEMO_MODE=true and a non-production environment.\n");
    exit(1);
}
if (
    !(
        ($environment === 'development' && $databaseName === 'shiftsync_dev') ||
        ($environment === 'demo' && $databaseName === 'shiftsync_demo')
    )
) {
    fwrite(STDERR, "Demo seeding is restricted to the dedicated ShiftSync development or demonstration database.\n");
    exit(1);
}

$demoPassword = getenv('DEMO_PASSWORD');
if (!is_string($demoPassword) || $demoPassword === '' || strlen($demoPassword) > 1024) {
    fwrite(STDERR, "Set DEMO_PASSWORD in the command environment before seeding.\n");
    exit(1);
}

$accounts = [
    [
        'employee_no' => 'DEMO-ADMIN',
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'email' => 'admin@shiftsync.ph',
        'role' => 'admin',
        'department' => 'Management',
        'job_title' => 'HR & Operations Director',
        'photo_url' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    ],
    [
        'employee_no' => 'DEMO-EMPLOYEE',
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'email' => 'employee@shiftsync.ph',
        'role' => 'employee',
        'department' => 'Engineering',
        'job_title' => 'Senior Software Engineer',
        'photo_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    ],
];

try {
    $pdo = database_connection();
    $pdo->beginTransaction();
    $find = $pdo->prepare(
        'SELECT user_id, employee_no, first_name, last_name, role, status, password_hash
         FROM users
         WHERE email = :email OR employee_no = :employee_no
         FOR UPDATE'
    );
    $insert = $pdo->prepare(
        'INSERT INTO users
            (employee_no, first_name, last_name, email, password_hash, role, department, job_title, photo_url, status)
         VALUES
            (:employee_no, :first_name, :last_name, :email, :password_hash, :role, :department, :job_title, :photo_url, \'active\')'
    );
    $updatePassword = $pdo->prepare(
        'UPDATE users SET password_hash = :password_hash
         WHERE user_id = :user_id AND employee_no = :employee_no AND role = :role'
    );
    $passwordHash = password_hash($demoPassword, PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        throw new RuntimeException('Unable to hash the demonstration password.');
    }

    foreach ($accounts as $account) {
        $find->execute([
            'email' => $account['email'],
            'employee_no' => $account['employee_no'],
        ]);
        $matches = $find->fetchAll();
        if (count($matches) > 1) {
            throw new RuntimeException('Conflicting records exist for a designated demonstration account.');
        }

        if ($matches === []) {
            $insert->execute($account + ['password_hash' => $passwordHash]);
            continue;
        }

        $existing = $matches[0];
        if (
            $existing['employee_no'] !== $account['employee_no'] ||
            $existing['role'] !== $account['role'] ||
            $existing['first_name'] !== $account['first_name'] ||
            $existing['last_name'] !== $account['last_name']
        ) {
            throw new RuntimeException('A designated demonstration email or employee number belongs to a non-demo account.');
        }
        if ($existing['status'] !== 'active') {
            throw new RuntimeException('A designated demonstration account is inactive; refusing to reactivate it automatically.');
        }
        if (!password_verify($demoPassword, (string) $existing['password_hash'])) {
            $updatePassword->execute([
                'password_hash' => $passwordHash,
                'user_id' => (int) $existing['user_id'],
                'employee_no' => $account['employee_no'],
                'role' => $account['role'],
            ]);
        }
    }

    $pdo->commit();
    fwrite(STDOUT, "Designated demonstration accounts are ready.\n");
} catch (Throwable) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Demo account seeding failed. Check the dedicated development database and account configuration.\n");
    exit(1);
}
