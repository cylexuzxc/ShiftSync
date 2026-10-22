<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    database_connection()->query('SELECT 1');
    echo json_encode(['status' => 'ok'], JSON_THROW_ON_ERROR);
} catch (Throwable) {
    error_log('ShiftSync health check: database unavailable.');
    http_response_code(503);
    echo json_encode(['status' => 'unavailable'], JSON_THROW_ON_ERROR);
}
