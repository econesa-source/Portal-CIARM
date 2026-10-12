<?php
declare(strict_types=1);
require_once __DIR__ . '/tickets-lib.php';

$user = ciarm_session_user();
if ($user === null) ciarm_json_response(401, ['ok' => false, 'code' => 'UNAUTHENTICATED']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) ciarm_json_response(405, ['ok' => false, 'code' => 'METHOD']);

try {
    if ($method === 'GET' && ($_GET['action'] ?? '') === 'context') {
        ciarm_json_response(200, ['ok' => true, 'data' => ciarm_ticket_context($user)]);
    }
    if (!ciarm_ticket_current_permission($user)) ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
    if ($method === 'POST') {
        if (!ciarm_ticket_origin_valid($_SERVER['HTTP_ORIGIN'] ?? '', $_SERVER['HTTP_HOST'] ?? '')) ciarm_json_response(403, ['ok' => false, 'code' => 'ORIGIN']);
        if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') ciarm_json_response(415, ['ok' => false, 'code' => 'CONTENT_TYPE']);
        $raw = file_get_contents('php://input', false, null, 0, 50001);
        if ($raw === false || strlen($raw) > 50000) ciarm_json_response(413, ['ok' => false, 'code' => 'PAYLOAD_SIZE']);
        $input = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($input) || ($input['action'] ?? '') !== 'assign') ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        if (!ciarm_ticket_csrf_valid((string)($_SESSION['ciarm_ticket_csrf'] ?? ''), is_string($input['csrfToken'] ?? null) ? $input['csrfToken'] : '')) ciarm_json_response(403, ['ok' => false, 'code' => 'CSRF']);
        $action = 'assign';
        $payload = array_intersect_key($input, array_flip(['operationId', 'ticketId', 'expectedVersion', 'changes']));
    } else {
        $action = $_GET['action'] ?? '';
        if (!is_string($action) || !in_array($action, ['list', 'catalogs', 'detail'], true)) ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        if ($action === 'detail' && !is_string($_GET['id'] ?? null)) ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        $payload = $action === 'detail' ? ['id' => $_GET['id']] : [];
    }
    // Release PHP session lock during the upstream call. Permission was just revalidated.
    session_write_close();
    $result = ciarm_ticket_bridge($user, $action, $payload);
    $code = $result['code'] ?? '';
    $status = $result['ok'] === true ? 200 : match ($code) {
        'FORBIDDEN' => 403,
        'NOT_FOUND' => 404,
        'CONFLICT', 'OPERATION_REUSED', 'PENDING_OPERATION', 'DUPLICATE_ID' => 409,
        'VALIDATION' => 422,
        'BUSY' => 503,
        default => 502,
    };
    ciarm_json_response($status, $result);
} catch (JsonException $e) {
    ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
} catch (Throwable $e) {
    ciarm_json_response(502, ['ok' => false, 'code' => 'UPSTREAM']);
}
