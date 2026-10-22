<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/http.php';
require_once __DIR__ . '/../../config/auth.php';

try {
    require_http_method('GET');
    start_application_session();

    $account = null;
    if (isset($_SESSION['user_id'])) {
        try {
            $pdo = database_connection();
            $account = require_authenticated_account($pdo);
        } catch (PDOException) {
            error_log('ShiftSync authentication: session database check failed.');
            send_json(503, ['success' => false, 'error' => 'service_unavailable']);
        }
    }

    send_json(200, [
        'success' => true,
        'data' => [
            'user' => $account === null ? null : public_account($account),
            'csrfToken' => $_SESSION['csrf_token'],
        ],
    ]);
} catch (Throwable) {
    error_log('ShiftSync authentication: session request failed.');
    send_json(503, ['success' => false, 'error' => 'service_unavailable']);
}
