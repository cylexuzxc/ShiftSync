<?php
declare(strict_types=1);

function send_json(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}

function require_http_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        send_json(405, ['success' => false, 'error' => 'method_not_allowed']);
    }
}

function request_json(): array
{
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') {
        send_json(415, ['success' => false, 'error' => 'unsupported_media_type']);
    }

    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || strlen($rawBody) > 8192) {
        send_json(400, ['success' => false, 'error' => 'invalid_request']);
    }

    try {
        $data = json_decode($rawBody, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        send_json(400, ['success' => false, 'error' => 'invalid_request']);
    }

    if (!is_array($data)) {
        send_json(400, ['success' => false, 'error' => 'invalid_request']);
    }

    return $data;
}
