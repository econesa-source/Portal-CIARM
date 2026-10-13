<?php
declare(strict_types=1);
require_once __DIR__ . '/portal-permissions-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ciarm_json_response(405, ['ok' => false, 'code' => 'METHOD']);
}
$user = ciarm_session_user();
if ($user === null) {
    ciarm_json_response(401, ['ok' => false, 'code' => 'UNAUTHENTICATED']);
}

try {
    // Modo diagnóstico autenticado: comprueba Sheets sin activar permisos nuevos.
    $preflight = ($_GET['preflight'] ?? '') === '1';
    $result = ciarm_rbac_effective($user, $preflight);
    ciarm_json_response(200, ['ok' => true, 'data' => $result]);
} catch (Throwable $error) {
    error_log('Portal DM05 permissions unavailable: ' . $error->getMessage());
    ciarm_json_response(503, ['ok' => false, 'code' => 'PERMISSIONS_UNAVAILABLE']);
}
