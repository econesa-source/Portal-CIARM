<?php
declare(strict_types=1);

require_once __DIR__ . '/auth-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ciarm_json_response(405, ['ok' => false, 'code' => 'method_not_allowed']);
}

$user = ciarm_session_user();

if (!$user) {
    ciarm_json_response(401, ['ok' => false, 'code' => 'not_authenticated']);
}

ciarm_json_response(200, ['ok' => true, 'user' => $user]);
