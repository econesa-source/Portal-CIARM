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

if ($method === 'GET' && ($_GET['action'] ?? '') === 'file') {
    $fileId = trim((string)($_GET['f'] ?? ''));
    $resolvedPath = ciarm_tus_compras_resolve_attachment_path($fileId);
    if ($resolvedPath === null) {
        ciarm_json_response(404, ['ok' => false, 'code' => 'NOT_FOUND', 'message' => 'Archivo adjunto no encontrado.']);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($resolvedPath) ?: 'application/octet-stream';
    if (!str_starts_with($mime, 'image/') && $mime !== 'application/pdf') {
        $mime = 'application/octet-stream';
    }
    $displayName = preg_replace('/^tc_\d{8}_\d{6}_[a-f0-9]{24}_/', '', basename($resolvedPath)) ?: basename($resolvedPath);
    $fileSize = (int)@filesize($resolvedPath);
    header('Content-Type: ' . $mime);
    if ($fileSize > 0) {
        header('Content-Length: ' . $fileSize);
    }
    header('Content-Disposition: inline; filename="' . addslashes($displayName) . '"');
    header('Cache-Control: public, max-age=86400');
    header('X-Content-Type-Options: nosniff');
    readfile($resolvedPath);
    exit;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'ping') {
    $t0 = microtime(true);
    $canRead = false;
    $err = null;
    $count = 0;
    $recent = [];
    try {
        $store = ciarm_tus_compras_fetch_all();
        $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
        $canRead = true;
        $count = count($pedidos);
        foreach (array_slice(array_reverse($pedidos), 0, 5) as $p) {
            $recent[] = [
                'id' => $p['id'] ?? '',
                'fecha' => ($p['fecha'] ?? '') . ' ' . ($p['hora'] ?? ''),
                'tipo' => $p['tipo'] ?? '',
                'monto' => $p['monto'] ?? 0,
                'estado' => $p['estado'] ?? '',
            ];
        }
    } catch (Throwable $e) {
        $err = $e->getMessage();
    }
    ciarm_json_response(200, [
        'ok' => $canRead,
        'is_production' => ciarm_tickets_is_production_host(),
        'active_sheet' => ciarm_tus_compras_active_sheet_id(),
        'can_read_sheets' => $canRead,
        'pedidos_count' => $count,
        'recent_orders' => $recent,
        'error' => $err,
        'elapsed_ms' => round((microtime(true) - $t0) * 1000, 1),
    ]);
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

            ciarm_json_response(200, [
                'ok' => true,
                'data' => [
                    'access' => $access,
                    'csrfToken' => $csrfToken,
                    'yearMonth' => $yearMonth,
                    'areaMonthlyOpex' => $areaOpex,
                    'areaMonthlyRemaining' => null,
                    'opexLimit' => CIARM_TUS_COMPRAS_OPEX_LIMIT,
                    'threeQuotesThreshold' => CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
                    'activeSheetId' => $store['sheetId'],
                ],
            ]);
        }

        if ($action === 'list') {
            $kind = (string)($_GET['kind'] ?? 'mine');
            if (!in_array($kind, ['mine', 'all'], true)) {
                ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
            }
            if ($kind === 'all' && empty($access['canAdmin']) && empty($access['canApprove']) && empty($access['canViewAll'])) {
                ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
            }

            $store = ciarm_tus_compras_fetch_all();
            $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);
            ciarm_tus_compras_sync_normalized_orders($pedidos, $store['sheetId'], $store['token']);
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
            ciarm_tus_compras_sync_normalized_orders($pedidos, $store['sheetId'], $store['token']);
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
            if (strtolower(trim((string)$found['correo'])) !== $actorEmail && empty($access['canAdmin']) && empty($access['canApprove']) && empty($access['canViewAll'])) {
                ciarm_json_response(403, ['ok' => false, 'code' => 'FORBIDDEN']);
            }
            $detailKind = (!empty($access['canAdmin']) || !empty($access['canApprove']) || !empty($access['canViewAll'])) ? 'all' : 'mine';
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
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION', 'message' => 'No se recibió ningún archivo adjunto válido.']);
        }
        $file = $_FILES['file'];
        $fileName = basename((string)($file['name'] ?? 'archivo'));
        $fileErr = (int)($file['error'] ?? -1);
        if (in_array($fileErr, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            ciarm_tus_compras_notify_upload_failure($access, $fileName, 'El archivo supera el tamaño máximo permitido de 10 MB.');
            ciarm_json_response(413, [
                'ok' => false,
                'code' => 'PAYLOAD_SIZE',
                'message' => "El archivo «{$fileName}» supera el límite máximo permitido de 10 MB por archivo.",
            ]);
        }
        if ($fileErr !== UPLOAD_ERR_OK) {
            ciarm_tus_compras_notify_upload_failure($access, $fileName, 'Error de transmisión al subir el archivo (código ' . $fileErr . ').');
            ciarm_json_response(422, [
                'ok' => false,
                'code' => 'VALIDATION',
                'message' => "No se pudo recibir correctamente el archivo «{$fileName}». Intenta seleccionarlo nuevamente.",
            ]);
        }
        $size = (int)($file['size'] ?? 0);
        if ($size < 1 || $size > CIARM_TUS_COMPRAS_MAX_ATTACHMENT_BYTES) {
            ciarm_tus_compras_notify_upload_failure($access, $fileName, 'Tamaño fuera del rango permitido (máximo 10 MB).');
            ciarm_json_response(413, [
                'ok' => false,
                'code' => 'PAYLOAD_SIZE',
                'message' => "El archivo «{$fileName}» supera el límite máximo permitido de 10 MB por archivo.",
            ]);
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);
        $allowed = is_string($mime) && (str_starts_with($mime, 'image/') || $mime === 'application/pdf');
        if (!$allowed) {
            ciarm_tus_compras_notify_upload_failure($access, $fileName, 'Formato de archivo no permitido (' . (string)$mime . ').');
            ciarm_json_response(415, [
                'ok' => false,
                'code' => 'CONTENT_TYPE',
                'message' => "El formato del archivo «{$fileName}» no está permitido. Solo se aceptan PDF o imágenes (máx. 10 MB).",
            ]);
        }
        try {
            $uploaded = ciarm_tus_compras_store_attachment($file, $user);
            $uploadedUrl = trim((string)($uploaded['url'] ?? ''));
            if ($uploadedUrl === '' || !str_starts_with($uploadedUrl, 'http')) {
                throw new RuntimeException('UPLOAD_EMPTY_URL');
            }
            ciarm_json_response(200, ['ok' => true, 'data' => $uploaded]);
        } catch (Throwable $upErr) {
            ciarm_tus_compras_notify_upload_failure($access, $fileName, 'No se logró almacenar el archivo adjunto (' . $upErr->getMessage() . ').');
            ciarm_json_response(502, [
                'ok' => false,
                'code' => 'UPLOAD_FAILED',
                'message' => "No se logró cargar el archivo «{$fileName}». Se ha informado del incidente; por favor intenta nuevamente.",
            ]);
        }
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
        $adjuntoDetalle = trim((string)($input['adjuntoDetalle'] ?? ''));
        $adjuntoCotPrelim = trim((string)($input['adjuntoCotizacionPreliminar'] ?? ''));

        $adjParts = [];
        if ($adjuntoDetalle !== '') {
            $adjParts[] = 'DETALLE: ' . $adjuntoDetalle;
        }
        if ($adjuntoCotPrelim !== '') {
            $adjParts[] = 'COTIZACION_PRELIMINAR: ' . $adjuntoCotPrelim;
        }
        if ($adjuntos === '' && count($adjParts) > 0) {
            $adjuntos = implode(' | ', $adjParts);
        }

        if ($monto <= 0 || $monto > 10000000 || strlen($descripcion) < 5 || strlen($descripcion) > 2000) {
            ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
        }

        $store = ciarm_tus_compras_fetch_all();
        $pedidos = ciarm_tus_compras_parse_pedidos($store['pedidosRows']);

        // Idempotencia: si el mismo usuario envió exactamente el mismo pedido en los últimos 120 segundos, devolver el existente
        $actorEmailNorm = strtolower(trim((string)$access['correo']));
        foreach (array_reverse($pedidos) as $existingOrder) {
            if (strtolower(trim((string)($existingOrder['correo'] ?? ''))) === $actorEmailNorm
                && strtoupper((string)($existingOrder['tipo'] ?? '')) === $tipo
                && abs((float)($existingOrder['montoEstimado'] ?? 0) - $monto) < 0.01
                && trim((string)($existingOrder['descripcion'] ?? '')) === $descripcion
                && ($existingOrder['fecha'] ?? '') === $nowDate) {
                $existingTs = strtotime(($existingOrder['fecha'] ?? '') . ' ' . ($existingOrder['hora'] ?? ''));
                $currentTs = strtotime($nowFull);
                if ($existingTs !== false && $currentTs !== false && abs($currentTs - $existingTs) <= 120) {
                    $existingOrder['allowedActions'] = ciarm_tus_compras_allowed_actions($existingOrder, $access, 'mine');
                    ciarm_json_response(200, ['ok' => true, 'data' => ['order' => $existingOrder, 'deduplicated' => true]]);
                }
            }
        }

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
            'montoEstimado' => $monto,
            'montoOrdenCompra' => 0.0,
            'requiereCotizacion' => $monto >= CIARM_TUS_COMPRAS_QUOTE_THRESHOLD,
            'requiereTresCotizaciones' => $monto >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
            'cotizacionesRequeridas' => $eval['requiredQuotesCount'] ?? ($monto >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD ? 3 : 0),
            'acumuladoMesArea' => $eval['projectedAreaMonthlyOpex'],
            'requiereAprobacion' => $eval['requiresApproval'],
            'descripcion' => $descripcion,
            'justificacion' => $justificacion,
            'estado' => $initialState,
            'responsableAdm' => 'Daniel Lara',
            'aprobador' => $eval['requiresApproval'] ? 'En aprobación (Administración)' : 'No requiere (Opex < $8,000)',
            'fechaAprobacion' => '',
            'comentarioAprobacion' => '',
            'fechaRecepcionAdm' => '',
            'fechaEntrega' => '',
            'evaluacion' => '',
            'comentarioRecepcion' => '',
            'adjuntos' => $adjuntos,
            'adjuntoDetalle' => $adjuntoDetalle,
            'adjuntoCotizacionPreliminar' => $adjuntoCotPrelim,
            'adjuntoCotizacionesAdm' => '',
            'fechaCierreCotizacion' => '',
            'fechaRecepcionCotizacion' => '',
            'fechaOrdenCompra' => '',
            'fechaEntregaEstimada' => '',
            'ultimaActualizacion' => $nowFull,
            'version' => 'v1',
        ];

        $rowValues = ciarm_tus_compras_order_to_row($newOrder);
        $appendPedidoUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($store['sheetId'])
            . '/values/' . rawurlencode("'PEDIDOS'!A:AF") . ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
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

        $canFinishEarly = function_exists('fastcgi_finish_request');
        $notif = $canFinishEarly
            ? ['event' => 'CREATE', 'status' => 'ENVIADO (ASYNC)', 'overallStatus' => 'ENVIADO', 'deliveries' => []]
            : ciarm_tus_compras_dispatch_notifications('CREATE', $newOrder, $justificacion, null, (array)($access['approverEmails'] ?? []));

        $logRow = [
            'EVT-' . bin2hex(random_bytes(6)),
            $folio,
            $nowFull,
            (string)$access['correo'],
            (string)$access['nombre'],
            !empty($access['isAdministracion']) ? 'Solicitante (Administración)' : 'Solicitante (Director Docente)',
            'CREATE',
            $eval['requiresApproval'] ? CIARM_TUS_COMPRAS_STATE_ENVIADA : '—',
            $initialState,
            number_format($monto, 2, '.', ''),
            number_format((float)$eval['projectedAreaMonthlyOpex'], 2, '.', ''),
            $eval['requiresApproval']
                ? ($tipo === 'CAPEX'
                    ? 'Pedido Capex enviado y pasado automáticamente a 2b) En aprobación.'
                    : 'Pedido Opex mayor o igual a $8,000 MXN; pasa automáticamente a 2b) En aprobación y requiere 3 cotizaciones.')
                : 'Pedido Opex registrado (< $8,000 MXN · OC directa sin cotización previa · Sin monto límite por área).',
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

        if ($canFinishEarly) {
            ignore_user_abort(true);
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
            echo json_encode(['ok' => true, 'data' => ['order' => $newOrder]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            fastcgi_finish_request();
            try {
                ciarm_tus_compras_dispatch_notifications('CREATE', $newOrder, $justificacion, null, (array)($access['approverEmails'] ?? []));
            } catch (Throwable $ignoredAsyncNotif) {
            }
            exit;
        }

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

        $transition = ciarm_tus_compras_validate_transition($target, $event, $access, $comment, $input);
        $prevState = (string)$target['estado'];
        $newState = (string)$transition['newState'];

        $target['estado'] = $newState;
        $target['ultimaActualizacion'] = $nowFull;
        $verNum = (int)preg_replace('/\D/', '', (string)($target['version'] ?? 'v1')) ?: 1;
        $target['version'] = 'v' . ($verNum + 1);

        if ($adjuntoExtra !== '' && $event !== 'RECEIVE_QUOTES') {
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
        } elseif ($event === 'START_QUOTING') {
            $target['fechaCierreCotizacion'] = trim((string)($input['fechaCierreCotizacion'] ?? ''));
            if ($comment === '') {
                $comment = 'En proceso de cotización · Fecha estimada de cierre: ' . $target['fechaCierreCotizacion'];
            }
        } elseif ($event === 'RECEIVE_QUOTES') {
            $target['fechaRecepcionCotizacion'] = $nowFull;
            $validatedQuotes = (array)($transition['quoteUrls'] ?? []);
            if (count($validatedQuotes) > 0) {
                $cotUrl = implode(' | ', $validatedQuotes);
            } else {
                $rawCot = $input['adjuntoCotizacionesAdm'] ?? $adjuntoExtra;
                $cotUrl = is_array($rawCot) ? implode(' | ', array_filter(array_map('trim', $rawCot))) : trim((string)$rawCot);
            }
            if ($cotUrl !== '') {
                $target['adjuntoCotizacionesAdm'] = !empty($target['adjuntoCotizacionesAdm'])
                    ? ($target['adjuntoCotizacionesAdm'] . ' | ' . $cotUrl)
                    : $cotUrl;
                $target['adjuntos'] = !empty($target['adjuntos'])
                    ? ($target['adjuntos'] . ' | COTIZACIONES_ADM: ' . $cotUrl)
                    : ('COTIZACIONES_ADM: ' . $cotUrl);
            }
            if ($comment === '') {
                $comment = count($validatedQuotes) >= 3
                    ? '3 cotizaciones oficiales recibidas y adjuntadas al expediente.'
                    : 'Cotizaciones recibidas y adjuntadas al expediente.';
            }
        } elseif ($event === 'ISSUE_PURCHASE_ORDER') {
            $target['fechaOrdenCompra'] = trim((string)($input['fechaOrdenCompra'] ?? ''));
            $target['fechaEntregaEstimada'] = trim((string)($input['fechaEntregaEstimada'] ?? ''));
            $montoOC = round((float)($input['montoOrdenCompra'] ?? 0), 2);
            $montoEstPrev = (float)($target['montoEstimado'] ?? ($target['monto'] ?? 0));
            $target['montoEstimado'] = $montoEstPrev;
            $target['montoOrdenCompra'] = $montoOC;
            $target['monto'] = $montoOC; // Único monto válido descontado del presupuesto mensual del área
            $orderYm = ciarm_tus_compras_extract_year_month((string)($target['fecha'] ?? ''));
            $otherAreaOpex = ciarm_tus_compras_area_monthly_opex($pedidos, (string)($target['area'] ?? ''), $orderYm, $id);
            $target['acumuladoMesArea'] = strtoupper((string)($target['tipo'] ?? 'OPEX')) === 'OPEX'
                ? round($otherAreaOpex + $montoOC, 2)
                : round($otherAreaOpex, 2);
            $autoNote = sprintf(
                'Orden de Compra generada (%s) · Entrega est.: %s · Monto OC válido: $%s MXN (Estimado inicial: $%s MXN)',
                $target['fechaOrdenCompra'],
                $target['fechaEntregaEstimada'],
                number_format($montoOC, 2, '.', ','),
                number_format($montoEstPrev, 2, '.', ',')
            );
            $comment = $comment !== '' ? ($comment . ' — ' . $autoNote) : $autoNote;
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
        $rowRange = "'PEDIDOS'!A{$rowNum}:AF{$rowNum}";
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

        $canFinishEarly = function_exists('fastcgi_finish_request');
        $notif = $canFinishEarly
            ? ['event' => $event, 'status' => 'ENVIADO (ASYNC)', 'overallStatus' => 'ENVIADO', 'deliveries' => []]
            : ciarm_tus_compras_dispatch_notifications($event, $target, $comment, null, (array)($access['approverEmails'] ?? []));

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

        $transitionViewKind = (!empty($access['canAdmin']) || !empty($access['canApprove']) || !empty($access['canViewAll'])) ? 'all' : 'mine';
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

        if ($canFinishEarly) {
            ignore_user_abort(true);
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
            echo json_encode(['ok' => true, 'data' => ['order' => $target]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            fastcgi_finish_request();
            try {
                ciarm_tus_compras_dispatch_notifications($event, $target, $comment, null, (array)($access['approverEmails'] ?? []));
            } catch (Throwable $ignoredAsyncNotif) {
            }
            exit;
        }

        ciarm_json_response(200, ['ok' => true, 'data' => ['order' => $target]]);
    }

    ciarm_json_response(422, ['ok' => false, 'code' => 'VALIDATION']);
} catch (Throwable $e) {
    $code = $e->getMessage();
    $statusMap = [
        'VALIDATION' => 422,
        'COMMENT_REQUIRED' => 422,
        'QUOTE_CLOSE_DATE_REQUIRED' => 422,
        'QUOTE_ATTACHMENT_REQUIRED' => 422,
        'THREE_QUOTES_REQUIRED' => 422,
        'PO_DATE_REQUIRED' => 422,
        'ESTIMATED_DELIVERY_DATE_REQUIRED' => 422,
        'PO_AMOUNT_REQUIRED' => 422,
        'QUOTATION_FLOW_REQUIRED' => 409,
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
