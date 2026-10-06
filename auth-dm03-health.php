<?php
declare(strict_types=1);

require_once __DIR__ . '/auth-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    ciarm_json_response(405, ['ok' => false]);
}

try {
    // Solo verifica que la cuenta de servicio pueda leer DM03 y que el esquema sea válido.
    // El correo deliberadamente no existe y no se devuelve ningún dato personal.
    ciarm_dm03_user('healthcheck-do-not-exist@ciarm.edu.mx');
    ciarm_json_response(200, ['ok' => true]);
} catch (Throwable $error) {
    error_log('Portal CIARM DM03 health: ' . $error->getMessage());
    ciarm_json_response(503, ['ok' => false, 'code' => 'dm03_unavailable']);
}
