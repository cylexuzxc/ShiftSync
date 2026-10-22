<?php
declare(strict_types=1);

const SHIFTSYNC_IDLE_TIMEOUT = 1800;

function start_application_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secureSetting = strtolower((string) getenv('SESSION_COOKIE_SECURE'));
    $secureCookie = match ($secureSetting) {
        'true', '1' => true,
        'false', '0' => false,
        default => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off',
    };

    session_name('SHIFTSYNCSESSID');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', (string) SHIFTSYNC_IDLE_TIMEOUT);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secureCookie,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    if (!session_start()) {
        throw new RuntimeException('Unable to start the application session.');
    }

    $lastActivity = $_SESSION['last_activity'] ?? null;
    if (
        isset($_SESSION['user_id']) &&
        (!is_int($lastActivity) || time() - $lastActivity > SHIFTSYNC_IDLE_TIMEOUT)
    ) {
        $_SESSION = [];
        if (!session_regenerate_id(true)) {
            throw new RuntimeException('Unable to renew the application session.');
        }
    }

    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

function require_csrf_token(): void
{
    $expected = $_SESSION['csrf_token'] ?? '';
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($expected) || !is_string($provided) || $expected === '' || !hash_equals($expected, $provided)) {
        send_json(403, ['success' => false, 'error' => 'csrf_validation_failed']);
    }
}

function invalidate_application_session(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();
}
