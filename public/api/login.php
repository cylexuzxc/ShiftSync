<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/http.php';
require_once __DIR__ . '/../../config/auth.php';

try {
    require_http_method('POST');
    start_application_session();
    require_csrf_token();
    $request = request_json();

    $emailValue = $request['email'] ?? null;
    $password = $request['password'] ?? null;
    if (
        !is_string($emailValue) ||
        !is_string($password) ||
        $password === '' ||
        strlen($password) > 1024
    ) {
        send_json(401, ['success' => false, 'error' => 'invalid_credentials']);
    }

    $email = strtolower(trim($emailValue));
    if (
        filter_var($email, FILTER_VALIDATE_EMAIL) === false ||
        strlen($email) > 190
    ) {
        send_json(401, ['success' => false, 'error' => 'invalid_credentials']);
    }

    $pdo = database_connection();
    $statement = $pdo->prepare(
        'SELECT user_id, employee_no, email, password_hash, status
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $statement->execute(['email' => $email]);
    $account = $statement->fetch();

    if (
        !is_array($account) ||
        $account['status'] !== 'active' ||
        (is_designated_demo_account($account) && !demo_access_enabled()) ||
        !password_verify($password, (string) $account['password_hash'])
    ) {
        send_json(401, ['success' => false, 'error' => 'invalid_credentials']);
    }

    if (!session_regenerate_id(true)) {
        throw new RuntimeException('Unable to renew the application session.');
    }
    $_SESSION = [
        'user_id' => (int) $account['user_id'],
        'last_activity' => time(),
        'csrf_token' => bin2hex(random_bytes(32)),
    ];

    $publicAccount = find_active_account($pdo, (int) $account['user_id']);
    if ($publicAccount === null) {
        invalidate_application_session();
        send_json(401, ['success' => false, 'error' => 'invalid_credentials']);
    }

    send_json(200, [
        'success' => true,
        'data' => [
            'user' => public_account($publicAccount),
            'csrfToken' => $_SESSION['csrf_token'],
        ],
    ]);
} catch (Throwable) {
    error_log('ShiftSync authentication: login request failed.');
    send_json(503, ['success' => false, 'error' => 'service_unavailable']);
}
