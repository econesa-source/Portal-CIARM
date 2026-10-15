<?php
declare(strict_types=1);
require_once __DIR__ . '/portal-permissions-lib.php';
require_once __DIR__ . '/compras-lib.php';

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
    $comprasConfig = ciarm_compras_config();
    $result['comprasEnabled'] = ciarm_compras_config_valid($comprasConfig);
    $result['comprasWritesEnabled'] = ciarm_compras_writes_enabled($comprasConfig);
    ciarm_json_response(200, ['ok' => true, 'data' => $result]);
} catch (Throwable $error) {
    error_log('Portal DM05 permissions unavailable: ' . $error->getMessage());
    // Sólo en preflight autenticado exponemos el nombre de una etapa conocida.
    // Nunca enviamos el mensaje arbitrario de la excepción ni detalles del servidor.
    $safeStages = [
        'rbac_sheet_unavailable' => 'DM03_READ',
        'rbac_dm03_empty' => 'DM03_EMPTY',
        'rbac_dm03_schema' => 'DM03_SCHEMA',
        'rbac_identity_mismatch' => 'DM03_IDENTITY',
        'rbac_inactive' => 'DM03_INACTIVE',
        'rbac_catalog_unavailable' => 'DM05_READ',
        'rbac_catalog_invalid' => 'DM05_SCHEMA',
        'rbac_catalog_empty' => 'DM05_EMPTY',
        'rbac_matrix_schema' => 'DM05_MATRIX',
        'rbac_role_missing_from_matrix' => 'DM05_ROLE',
        'rbac_service_account_unavailable' => 'SERVICE_ACCOUNT',
        'rbac_service_account_invalid' => 'SERVICE_ACCOUNT',
        'service_account_token_failed' => 'SERVICE_ACCOUNT_TOKEN',
    ];
    $reply = ['ok' => false, 'code' => 'PERMISSIONS_UNAVAILABLE'];
    if (!empty($preflight)) {
        $reply['stage'] = $safeStages[$error->getMessage()] ?? 'UNKNOWN';
    }
    ciarm_json_response(503, $reply);
}
