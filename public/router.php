<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$routes = [
    '/api/login.php' => __DIR__ . '/api/login.php',
    '/api/session.php' => __DIR__ . '/api/session.php',
    '/api/logout.php' => __DIR__ . '/api/logout.php',
    '/health.php' => __DIR__ . '/health.php',
];

if (is_string($path) && isset($routes[$path])) {
    require $routes[$path];
    return true;
}

$assets = [
    '/' => [__DIR__ . '/../index.html', 'text/html; charset=utf-8'],
    '/index.html' => [__DIR__ . '/../index.html', 'text/html; charset=utf-8'],
    '/app.js' => [__DIR__ . '/../app.js', 'text/javascript; charset=utf-8'],
    '/data.js' => [__DIR__ . '/../data.js', 'text/javascript; charset=utf-8'],
    '/style.css' => [__DIR__ . '/../style.css', 'text/css; charset=utf-8'],
];

if (is_string($path) && isset($assets[$path])) {
    [$file, $contentType] = $assets[$path];
    if (!is_file($file)) {
        http_response_code(404);
        return true;
    }

    header('Content-Type: ' . $contentType);
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not found\n";
return true;
