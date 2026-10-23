<?php
declare(strict_types=1);

function resolve_environment_file(): string
{
    foreach (['DB_ENV_FILE', 'SHIFTSYNC_ENV_FILE'] as $key) {
        $candidate = getenv($key);
        if (!is_string($candidate)) {
            continue;
        }

        $candidate = trim($candidate);
        if ($candidate === '') {
            continue;
        }

        if (str_starts_with($candidate, '/')) {
            return $candidate;
        }

        if (str_contains($candidate, ':\\') || str_contains($candidate, ':/')) {
            return $candidate;
        }

        if (str_starts_with($candidate, '.')) {
            return rtrim(dirname(__DIR__), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $candidate;
        }

        return rtrim(dirname(__DIR__), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $candidate;
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
}

function resolve_database_ssl_ca(): string
{
    $sslCa = getenv('DB_SSL_CA') ?: getenv('MYSQL_SSL_CA') ?: 'ca.pem';
    if ($sslCa === '') {
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'ca.pem';
    }

    if (str_starts_with($sslCa, '/')) {
        return $sslCa;
    }

    if (str_contains($sslCa, ':\\') || str_contains($sslCa, ':/')) {
        return $sslCa;
    }

    if (str_starts_with($sslCa, '.')) {
        return rtrim(dirname(__DIR__), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $sslCa;
    }

    return rtrim(dirname(__DIR__), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $sslCa;
}

function load_environment_file(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }

    $envFile = resolve_environment_file();
    $explicitFileSelected = false;
    foreach (['DB_ENV_FILE', 'SHIFTSYNC_ENV_FILE'] as $key) {
        $candidate = getenv($key);
        if (is_string($candidate) && trim($candidate) !== '') {
            $explicitFileSelected = true;
            break;
        }
    }

    if (!is_file($envFile)) {
        $loaded = true;
        return;
    }

    $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        $loaded = true;
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (!str_contains($trimmed, '=')) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $trimmed, 2));
        if ($key === '') {
            continue;
        }

        if (!$explicitFileSelected && getenv($key) !== false) {
            continue;
        }

        $normalized = $value;
        if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
            $normalized = substr($value, 1, -1);
        }

        putenv($key . '=' . $normalized);
        $_ENV[$key] = $normalized;
        $_SERVER[$key] = $normalized;
    }

    $loaded = true;
}

function database_config_summary(): array
{
    load_environment_file();

    return [
        'env_file' => resolve_environment_file(),
        'host' => getenv('DB_HOST') ?: 'unset',
        'port' => getenv('DB_PORT') ?: '3306',
        'database' => getenv('DB_NAME') ?: 'unset',
        'username' => getenv('DB_USER') ?: 'unset',
        'ssl_ca' => resolve_database_ssl_ca(),
        'ssl_verify' => strtolower((string) getenv('DB_SSL_VERIFY')) !== 'false' ? 'true' : 'false',
    ];
}

function database_connection(): PDO
{
    load_environment_file();

    if (!extension_loaded('pdo_mysql')) {
        throw new RuntimeException('PDO MySQL extension is not available. Install php-mysql or use the Compose app service.');
    }

    $host = getenv('DB_HOST');
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME');
    $user = getenv('DB_USER');
    $password = getenv('DB_PASSWORD');

    if ($host === false || $name === false || $user === false || $password === false) {
        throw new RuntimeException('Database environment is incomplete.');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $host,
        $port,
        $name
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $sslCa = resolve_database_ssl_ca();
    $sslVerify = strtolower((string) getenv('DB_SSL_VERIFY')) !== 'false';

    if (defined('PDO::MYSQL_ATTR_SSL_CA') && is_string($sslCa) && $sslCa !== '' && is_file($sslCa)) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCa;
        if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = $sslVerify;
        }
    }

    return new PDO($dsn, $user, $password, $options);
}
