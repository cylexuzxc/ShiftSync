<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/session.php';

function find_active_account(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare(
        'SELECT user_id, employee_no, first_name, last_name, email, role, department, job_title,
                phone, location, bio, photo_url
         FROM users
         WHERE user_id = :user_id AND status = \'active\'
         LIMIT 1'
    );
    $statement->execute(['user_id' => $userId]);
    $account = $statement->fetch();

    return is_array($account) ? $account : null;
}

function is_designated_demo_account(array $account): bool
{
    return (
        ($account['employee_no'] ?? null) === 'DEMO-ADMIN' &&
        ($account['email'] ?? null) === 'admin@shiftsync.ph'
    ) || (
        ($account['employee_no'] ?? null) === 'DEMO-EMPLOYEE' &&
        ($account['email'] ?? null) === 'employee@shiftsync.ph'
    );
}

function demo_access_enabled(): bool
{
    $environment = strtolower((string) getenv('APP_ENV'));
    $databaseName = (string) getenv('DB_NAME');

    return strtolower((string) getenv('DEMO_MODE')) === 'true' && (
        ($environment === 'development' && $databaseName === 'shiftsync_dev') ||
        ($environment === 'demo' && $databaseName === 'shiftsync_demo')
    );
}

function public_account(array $account): array
{
    $escape = static fn (?string $value): string => htmlspecialchars(
        $value ?? '',
        ENT_QUOTES | ENT_SUBSTITUTE,
        'UTF-8'
    );
    $photoUrl = trim((string) ($account['photo_url'] ?? ''));
    $photoScheme = strtolower((string) parse_url($photoUrl, PHP_URL_SCHEME));
    if (!in_array($photoScheme, ['http', 'https'], true)) {
        $photoUrl = '';
    }

    $firstName = (string) $account['first_name'];
    $lastName = (string) $account['last_name'];

    return [
        'id' => (int) $account['user_id'],
        'name' => $escape(trim($firstName . ' ' . $lastName)),
        'email' => $escape((string) $account['email']),
        'role' => (string) $account['role'],
        'title' => $escape(isset($account['job_title']) ? (string) $account['job_title'] : ''),
        'department' => $escape(isset($account['department']) ? (string) $account['department'] : ''),
        'phone' => $escape(isset($account['phone']) ? (string) $account['phone'] : ''),
        'location' => $escape(isset($account['location']) ? (string) $account['location'] : ''),
        'bio' => $escape(isset($account['bio']) ? (string) $account['bio'] : ''),
        'photo' => $escape($photoUrl),
    ];
}

function require_authenticated_account(PDO $pdo): array
{
    $userId = $_SESSION['user_id'] ?? null;
    if (!is_int($userId) || $userId < 1) {
        send_json(401, ['success' => false, 'error' => 'authentication_required']);
    }

    $account = find_active_account($pdo, $userId);
    if ($account === null || (is_designated_demo_account($account) && !demo_access_enabled())) {
        invalidate_application_session();
        send_json(401, ['success' => false, 'error' => 'authentication_required']);
    }

    $_SESSION['last_activity'] = time();
    return $account;
}

function require_account_role(array $account, string $requiredRole): void
{
    if (!in_array($requiredRole, ['admin', 'employee'], true) || $account['role'] !== $requiredRole) {
        send_json(403, ['success' => false, 'error' => 'forbidden']);
    }
}
