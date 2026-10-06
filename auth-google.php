<?php
declare(strict_types=1);

require_once __DIR__ . '/auth-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ciarm_json_response(405, ['ok' => false, 'code' => 'method_not_allowed']);
}

$raw = (string)file_get_contents('php://input');
$request = json_decode($raw, true);
$credential = is_array($request) ? trim((string)($request['credential'] ?? '')) : '';

if ($credential === '') {
    ciarm_json_response(400, ['ok' => false, 'code' => 'missing_credential']);
}

try {
    $google = ciarm_verify_google_credential($credential);

    if (!$google) {
        ciarm_json_response(401, ['ok' => false, 'code' => 'invalid_google_credential']);
    }

    $dm03 = ciarm_dm03_user($google['email']);

    if (!$dm03) {
        ciarm_json_response(403, ['ok' => false, 'code' => 'access_not_enabled']);
    }

    ciarm_start_session();
    session_regenerate_id(true);

    $user = [
        'nombre' => $dm03['nombre'] !== '' ? $dm03['nombre'] : ($google['name'] ?: 'Usuario CIARM'),
        'correo' => $dm03['correo'],
        'foto' => $google['picture'],
        'area' => $dm03['area'],
        'puesto' => $dm03['puesto'],
        'seccion' => $dm03['seccion'],
    ];

    $_SESSION['ciarm_user'] = $user;
    $_SESSION['ciarm_expires_at'] = time() + CIARM_SESSION_TTL;

    ciarm_json_response(200, ['ok' => true, 'user' => $user]);

} catch (Throwable $error) {
    error_log('Portal CIARM auth: ' . $error->getMessage());
    ciarm_json_response(503, ['ok' => false, 'code' => 'authentication_service_unavailable']);
}
