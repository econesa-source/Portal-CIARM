<?php
declare(strict_types=1);

require_once __DIR__ . '/tus-compras-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'POST'], true)) {
    ciarm_json_response(405, ['ok' => false, 'code' => 'METHOD_NOT_ALLOWED']);
}

if ($method === 'POST') {
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (!ciarm_ticket_origin_valid($origin, $host)) {
        ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN_ORIGIN']);
    }
}

$user = ciarm_session_user();
if ($user === null) {
    ciarm_json_response(401, ['ok' => false, 'code' => 'UNAUTHENTICATED']);
}

try {
    $access = ciarm_tus_compras_access($user);
    if (empty($access['visible'])) {
        ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
    }

    if (empty($_SESSION['ciarm_tus_compras_csrf'])) {
        $_SESSION['ciarm_tus_compras_csrf'] = bin2hex(random_bytes(32));
    }
    $csrfToken = (string)$_SESSION['ciarm_tus_compras_csrf'];

    if ($method === 'GET') {
        $action = (string)($_GET['action'] ?? 'context');
        session_write_close();

        if ($action === 'context') {
            $store = ciarm_tus_compras_fetch_all();
            $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
            $yearMonth = gmdate('Y-m', time() - 5 * 3600);
            $areaOpex = ciarm_tus_compras_area_monthly_opex($pedidos, (string)$access['area'], $yearMonth);
            $remaining = max(0.0, round(CIARM_TUS_COMPRAS_OPEX_LIMIT - $areaOpex, 2));

            ciarm_json_response(200, [
                'ok' => true,
                'data' => [
                    'access' => $access,
                    'csrfToken' => $csrfToken,
                    'yearMonth' => $yearMonth,
                    'areaMonthlyOpex' => $areaOpex,
                    'areaMonthlyRemaining' => $remaining,
                    'opexLimit' => CIARM_TUS_COMPRAS_OPEX_LIMIT,
                    'activeSheetId' => $store['sheetId'],
                ],
            ]);
        }

        if ($action === 'list') {
            $kind = (string)($_GET['kind'] ?? 'mine');
            if (!in_array($kind, ['mine', 'all'], true)) {
                ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
            }
            if ($kind === 'all' && empty($access['canAdmin']) && empty($access['canApprove'])) {
                ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
            }

            $store = ciarm_tus_compras_fetch_all();
            $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
            $bitacora = ciarm_tus_compras_parse_bitacora($store['bitacoraRows']);
            $byPedido = [];
            foreach ($bitacora as $entry) {
                $byPedido[$entry['idPedido']][] = $entry;
            }

            $actorEmail = strtolower(trim((string)$access['correo']));
            $items = [];
            foreach ($pedidos as $p) {
                if ($kind === 'mine' && strtolower(trim((string)$p['correo'])) !== $actorEmail) {
                    continue;
                }
                $p['allowedActions'] = ciarm_tus_compras_allowed_actions($p, $access, $kind);
                $p['history'] = $byPedido[$p['id']] ?? [];
                $items[] = $p;
            }
            // Ordenar más recientes primero
            usort($items, static fn($a, $b) => strcmp((string)($b['id'] ?? ''), (string)($a['id'] ?? '')));

            $yearMonth = gmdate('Y-m', time() - 5 * 3600);
            $areaOpex = ciarm_tus_compras_area_monthly_opex($pedidos, (string)$access['area'], $yearMonth);

            ciarm_json_response(200, [
                'ok' => true,
                'data' => [
                    'items' => $items,
                    'areaMonthlyOpex' => $areaOpex,
                    'opexLimit' => CIARM_TUS_COMPRAS_OPEX_LIMIT,
                    'csrfToken' => $csrfToken,
                ],
            ]);
        }

        if ($action === 'detail') {
            $id = trim((string)($_GET['id'] ?? ''));
            if (!preg_match('/^CMP-\d{4}-\d+$/', $id)) {
                ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
            }
            $store = ciarm_tus_compras_fetch_all();
            $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
            $found = null;
            foreach ($pedidos as $p) {
                if ($p['id'] === $id) {
                    $found = $p;
                    break;
                }
            }
            if ($found === null) {
                ciarm_json_response(404, ['ok' => false, 'code' => 'NOT_FOUND']);
            }
            $actorEmail = strtolower(trim((string)$access['correo']));
            if (strtolower(trim((string)$found['correo'])) !== $actorEmail && empty($access['canAdmin']) && empty($access['canApprove'])) {
                ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
            }
            $detailKind = (!empty($access['canAdmin']) || !empty($access['canApprove'])) ? 'all' : 'mine';
            $found['allowedActions'] = ciarm_tus_compras_allowed_actions($found, $access, $detailKind);
            $found['history'] = ciarm_tus_compras_parse_bitacora($store['bitacoraRows'], $id);

            ciarm_json_response(200, ['ok' => true, 'data' => $found]);
        }

        ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
    }

    // POST actions
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_starts_with($contentType, 'multipart/form-data')) {
        $action = (string)($_POST['action'] ?? '');
        $receivedCsrf = (string)($_POST['csrfToken'] ?? '');
        if (!ciarm_ticket_csrf_valid($csrfToken, $receivedCsrf)) {
            ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN_CSRF']);
        }
        session_write_close();
        if ($action !== 'uploadAttachment' || !isset($_FILES['file']) || !is_array($_FILES['file'])) {
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        }
        $file = $_FILES['file'];
        if (($file['error'] ?? -1) !== UPLOAD_ERR_OK) {
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        }
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > 10 * 1024 * 1024) {
            ciarm_json_response(413, ['ok' => false, 'code' => 'PAYLOAD_SIZE']);
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);
        $allowed = is_string($mime) && (str_starts_with($mime, 'image/') || $mime === 'application/pdf');
        if (!$allowed) {
            ciarm_json_response(415, ['ok' => false, 'code' => 'CONTENT_TYPE']);
        }
        $uploaded = ciarm_upload_evidence_to_drive($file, $user);
        ciarm_json_response(200, ['ok' => true, 'data' => $uploaded]);
    }

    $rawBody = (string)file_get_contents('php://input');
    $input = json_decode($rawBody, true);
    if (!is_array($input)) {
        ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
    }
    $receivedCsrf = (string)($input['csrfToken'] ?? '');
    if (!ciarm_ticket_csrf_valid($csrfToken, $receivedCsrf)) {
        ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN_CSRF']);
    }
    session_write_close();

    $action = (string)($input['action'] ?? '');
    $nowTs = time() - 5 * 3600;
    $nowDate = gmdate('Y-m-d', $nowTs);
    $nowTime = gmdate('H:i:s', $nowTs);
    $nowFull = $nowDate . ' ' . $nowTime;
    $year = gmdate('Y', $nowTs);
    $yearMonth = substr($nowDate, 0, 7);

    if ($action === 'create') {
        if (empty($access['canCreate'])) {
            ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN_CREATE']);
        }
        $tipo = strtoupper(trim((string)($input['tipo'] ?? 'OPEX'))) === 'CAPEX' ? 'CAPEX' : 'OPEX';
        $monto = round((float)($input['monto'] ?? 0), 2);
        $descripcion = trim((string)($input['descripcion'] ?? ''));
        $justificacion = trim((string)($input['justificacion'] ?? ''));
        $adjuntos = trim((string)($input['adjuntos'] ?? ''));

        if ($monto <= 0 || $monto > 10000000 || strlen($descripcion) < 5 || strlen($descripcion) > 2000) {
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        }

        $store = ciarm_tus_compras_fetch_all();
        $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
        $folio = ciarm_tus_compras_next_folio($pedidos, $year);

        $area = (string)$access['area'];
        $currentAreaOpex = ciarm_tus_compras_area_monthly_opex($pedidos, $area, $yearMonth);
        $eval = ciarm_tus_compras_requires_approval($tipo, $monto, $currentAreaOpex);
        $initialState = (string)($eval['initialState'] ?? ($eval['requiresApproval'] ? CIARM_TUS_COMPRAS_STATE_EN_APROBACION : CIARM_TUS_COMPRAS_STATE_ENVIADA));

        $newOrder = [
            'id' => $folio,
            'fecha' => $nowDate,
            'hora' => $nowTime,
            'solicitante' => (string)$access['nombre'],
            'correo' => (string)$access['correo'],
            'area' => $area,
            'tipo' => $tipo,
            'monto' => $monto,
            'acumuladoMesArea' => $eval['projectedAreaMonthlyOpex'],
            'requiereAprobacion' => $eval['requiresApproval'],
            'descripcion' => $descripcion,
            'justificacion' => $justificacion,
            'estado' => $initialState,
            'responsableAdm' => 'Daniel Lara',
            'aprobador' => $eval['requiresApproval'] ? 'En aprobación (Administración)' : 'No requiere (Opex ≤ $10,000)',
            'fechaAprobacion' => '',
            'comentarioAprobacion' => '',
            'fechaRecepcionAdm' => '',
            'fechaEntrega' => '',
            'evaluacion' => '',
            'comentarioRecepcion' => '',
            'adjuntos' => $adjuntos,
            'ultimaActualizacion' => $nowFull,
            'version' => 'v1',
        ];

        $rowValues = ciarm_tus_compras_order_to_row($newOrder);
        $appendPedidoUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($store['sheetId'])
            . '/values/' . rawurlencode("'PEDIDOS'!A:X") . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
        $appendRes = ciarm_http_json($appendPedidoUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $store['token'],
            ],
            'body' => json_encode(['values' => [$rowValues]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        if ($appendRes['status'] < 200 || $appendRes['status'] >= 300) {
            throw new RuntimeException('UPSTREAM_WRITE_FAILED');
        }

        $notif = ciarm_tus_compras_dispatch_notifications('CREATE', $newOrder, $justificacion);

        $logRow = [
            'EVT-' . bin2hex(random_bytes(6)),
            $folio,
            $nowFull,
            (string)$access['correo'],
            (string)$access['nombre'],
            'Solicitante (Director Docente)',
            'CREATE',
            $eval['requiresApproval'] ? CIARM_TUS_COMPRAS_STATE_ENVIADA : '—',
            $initialState,
            number_format($monto, 2, '.', ''),
            number_format((float)$eval['projectedAreaMonthlyOpex'], 2, '.', ''),
            $eval['requiresApproval']
                ? ($tipo === 'CAPEX'
                    ? 'Pedido Capex enviado y pasado automáticamente a 2b) En aprobación.'
                    : 'Pedido Opex supera tope mensual permitido ($10,000 MXN del área); pasa automáticamente a 2b) En aprobación.')
                : 'Pedido Opex dentro de presupuesto mensual del área (≤ $10,000 MXN).',
            (string)($notif['status'] ?? 'ENVIADO'),
        ];

        $appendLogUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($store['sheetId'])
            . '/values/' . rawurlencode("'BITACORA PEDIDOS'!A:M") . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
        @ciarm_http_json($appendLogUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $store['token'],
            ],
            'body' => json_encode(['values' => [$logRow]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $newOrder['allowedActions'] = ciarm_tus_compras_allowed_actions($newOrder, $access, 'mine');
        $newOrder['notification'] = $notif;

        ciarm_json_response(200, ['ok' => true, 'data' => ['order' => $newOrder]]);
    }

    if ($action === 'transition') {
        $id = trim((string)($input['id'] ?? ''));
        $event = trim((string)($input['event'] ?? ''));
        $comment = trim((string)($input['comment'] ?? ''));
        $adjuntoExtra = trim((string)($input['adjuntos'] ?? ''));

        if (!preg_match('/^CMP-\d{4}-\d+$/', $id) || $event === '') {
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        }

        $store = ciarm_tus_compras_fetch_all();
        $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
        $target = null;
        foreach ($pedidos as $p) {
            if ($p['id'] === $id) {
                $target = $p;
                break;
            }
        }
        if ($target === null) {
            ciarm_json_response(404, ['ok' => false, 'code' => 'NOT_FOUND']);
        }

        $transition = ciarm_tus_compras_validate_transition($target, $event, $access, $comment);
        $prevState = (string)$target['estado'];
        $newState = (string)$transition['newState'];

        $target['estado'] = $newState;
        $target['ultimaActualizacion'] = $nowFull;
        $verNum = (int)preg_replace('/\D/', '', (string)($target['version'] ?? 'v1')) ?: 1;
        $target['version'] = 'v' . ($verNum + 1);

        if ($adjuntoExtra !== '') {
            $target['adjuntos'] = $target['adjuntos'] !== ''
                ? ($target['adjuntos'] . ' | ' . $adjuntoExtra)
                : $adjuntoExtra;
        }

        if ($event === 'SEND_APPROVAL') {
            $target['requiereAprobacion'] = true;
            if ($target['aprobador'] === '' || str_starts_with($target['aprobador'], 'No requiere')) {
                $target['aprobador'] = 'Ezequiel Conesa (Pendiente)';
            }
        } elseif ($event === 'APPROVE_CAPEX') {
            $target['aprobador'] = (string)$access['nombre'] . ' (' . $access['correo'] . ')';
            $target['fechaAprobacion'] = $nowFull;
            if ($comment !== '') {
                $target['comentarioAprobacion'] = $comment;
            }
        } elseif ($event === 'REJECT_CAPEX') {
            $target['aprobador'] = (string)$access['nombre'] . ' (' . $access['correo'] . ')';
            $target['fechaAprobacion'] = $nowFull;
            $target['comentarioAprobacion'] = $comment;
        } elseif ($event === 'RECEIVE_ITEMS_ADM') {
            $target['fechaRecepcionAdm'] = $nowFull;
        } elseif ($event === 'DELIVER_TO_REQUESTER') {
            $target['fechaEntrega'] = $nowFull;
        } elseif ($event === 'CONFIRM_CONFORME') {
            $target['evaluacion'] = 'CONFORME (' . $nowFull . ')';
            if ($comment !== '') {
                $target['comentarioRecepcion'] = $comment;
            }
        } elseif ($event === 'CONFIRM_DISCONFORME') {
            $target['evaluacion'] = 'DISCONFORME (' . $nowFull . ')';
            $target['comentarioRecepcion'] = $comment;
        }

        $rowNum = (int)$target['rowNumber'];
        $rowRange = "'PEDIDOS'!A{$rowNum}:X{$rowNum}";
        $rowValues = ciarm_tus_compras_order_to_row($target);

        // Usamos values:batchUpdate (POST) para no depender de PUT en curl
        $batchUpdateUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($store['sheetId']) . '/values:batchUpdate';
        $upRes = ciarm_http_json($batchUpdateUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $store['token'],
            ],
            'body' => json_encode([
                'valueInputOption' => 'RAW',
                'data' => [
                    [
                        'range' => $rowRange,
                        'values' => [$rowValues],
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        if ($upRes['status'] < 200 || $upRes['status'] >= 300) {
            throw new RuntimeException('UPSTREAM_UPDATE_FAILED');
        }

        $notif = ciarm_tus_compras_dispatch_notifications($event, $target, $comment);

        $logRow = [
            'EVT-' . bin2hex(random_bytes(6)),
            $id,
            $nowFull,
            (string)$access['correo'],
            (string)$access['nombre'],
            (string)$transition['roleLabel'],
            $event,
            $prevState,
            $newState,
            number_format((float)$target['monto'], 2, '.', ''),
            number_format((float)$target['acumuladoMesArea'], 2, '.', ''),
            $comment !== '' ? $comment : ('Cambio de estado a ' . $newState),
            (string)($notif['status'] ?? 'ENVIADO'),
        ];

        $appendLogUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($store['sheetId'])
            . '/values/' . rawurlencode("'BITACORA PEDIDOS'!A:M") . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
        @ciarm_http_json($appendLogUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $store['token'],
            ],
            'body' => json_encode(['values' => [$logRow]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $transitionViewKind = (!empty($access['canAdmin']) || !empty($access['canApprove'])) ? 'all' : 'mine';
        $target['allowedActions'] = ciarm_tus_compras_allowed_actions($target, $access, $transitionViewKind);
        $target['notification'] = $notif;
        $target['history'] = ciarm_tus_compras_parse_bitacora($store['bitacoraRows'], $id);
        $target['history'][] = [
            'idEvento' => $logRow[0],
            'idPedido' => $id,
            'fechaHora' => $nowFull,
            'actorCorreo' => (string)$access['correo'],
            'actorNombre' => (string)$access['nombre'],
            'rol' => (string)$transition['roleLabel'],
            'evento' => $event,
            'estadoAnterior' => $prevState,
            'estadoNuevo' => $newState,
            'monto' => (float)$target['monto'],
            'acumuladoArea' => (float)$target['acumuladoMesArea'],
            'comentario' => $logRow[11],
            'notificacion' => $logRow[12],
        ];

        ciarm_json_response(200, ['ok' => true, 'data' => ['order' => $target]]);
    }

    ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
} catch (Throwable $e) {
    $code = $e->getMessage();
    $statusMap = [
        'VALIDATION' => 422,
        'COMMENT_REQUIRED' => 422,
        'INVALID_TRANSITION' => 409,
        'INVALID_TRANSITION_STATE_3' => 409,
        'REQUIRES_CAPEX_APPROVAL' => 409,
        'FORBIDDEN' => 403,
        'FORBIDDEN_ROLE' => 403,
        'FORBIDDEN_OWNER' => 403,
        'FORBIDDEN_CREATE' => 403,
        'NOT_FOUND' => 404,
    ];
    $httpStatus = $statusMap[$code] ?? 503;
    error_log('Tus Compras API error: ' . $code . ' (' . $e->getFile() . ':' . $e->getLine() . ')');
    ciarm_json_response($httpStatus, ['ok' => false, 'code' => isset($statusMap[$code]) ? $code : 'SERVICE_UNAVAILABLE']);
}
