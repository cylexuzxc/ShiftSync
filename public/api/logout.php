<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/http.php';
require_once __DIR__ . '/../../config/session.php';

try {
    require_http_method('POST');
    start_application_session();
    require_csrf_token();
    invalidate_application_session();
    send_json(200, ['success' => true, 'data' => ['loggedOut' => true]]);
} catch (Throwable) {
    error_log('ShiftSync authentication: logout request failed.');
    send_json(503, ['success' => false, 'error' => 'service_unavailable']);
}
