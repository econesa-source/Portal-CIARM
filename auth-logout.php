<?php
declare(strict_types=1);

require_once __DIR__ . '/auth-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ciarm_json_response(405, ['ok' => false, 'code' => 'method_not_allowed']);
}

ciarm_start_session();
$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'] ?: '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

session_destroy();

ciarm_json_response(200, ['ok' => true]);
