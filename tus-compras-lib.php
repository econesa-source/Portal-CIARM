<?php
declare(strict_types=1);

require_once __DIR__ . '/tickets-portal-lib.php';

/**
 * Módulo "Tus compras" - Sistema simplificado de pedidos de compra (Opex / Capex)
 * - Preproducción (portal2.ciarm.edu.mx): 1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso
 * - Producción (portal.ciarm.edu.mx):     1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ
 * - Límite Opex mensual acumulado por área solicitante: $10,000.00 MXN
 * - Perfiles gobernados por DM03 ('Catálogo de colaboradores'!A4:AZ1010):
 *   * Solicitante: Columna AG (Área) = "docente" y Columna AJ (Nivel) = "director"
 *   * Administración / Autorizador: Columna AG (Área) = "administración" y Columna AJ (Nivel) = "administración"
 */

const CIARM_TUS_COMPRAS_STAGING_SHEET_ID = '1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso';
const CIARM_TUS_COMPRAS_PROD_SHEET_ID = '1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ';
const CIARM_TUS_COMPRAS_STAGING_WEBAPP = 'https://script.google.com/macros/s/AKfycbw01gXyUlNRqMBLGeMfkys8HNGJlnYnrMHGb76_LrnG1-atYM43vEOEQdmimPkUHyhb/exec';
const CIARM_TUS_COMPRAS_PROD_WEBAPP = 'https://script.google.com/macros/s/AKfycbw01gXyUlNRqMBLGeMfkys8HNGJlnYnrMHGb76_LrnG1-atYM43vEOEQdmimPkUHyhb/exec';
const CIARM_TUS_COMPRAS_OPEX_LIMIT = 8000.0;
const CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD = 8000.0;
const CIARM_TUS_COMPRAS_QUOTE_THRESHOLD = 8000.0;
const CIARM_TUS_COMPRAS_MAX_ATTACHMENT_BYTES = 10485760; // 10 MB por archivo
const CIARM_TUS_COMPRAS_ADMIN_EMAIL = 'd.lara@ciarm.edu.mx';
const CIARM_TUS_COMPRAS_APPROVER_EMAILS = ['e.conesa@ciarm.edu.mx'];

const CIARM_TUS_COMPRAS_STATE_ENVIADA = '1) Solicitud enviada';
const CIARM_TUS_COMPRAS_STATE_EN_PROCESO = '2a) Solicitud recibida / En proceso';
const CIARM_TUS_COMPRAS_STATE_EN_COTIZACION = '2a-1) En cotización';
const CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS = '2a-2) Cotizaciones recibidas';
const CIARM_TUS_COMPRAS_STATE_EN_APROBACION = '2b) En aprobación';
const CIARM_TUS_COMPRAS_STATE_OC_GENERADA = '2c) Orden de Compra generada';
const CIARM_TUS_COMPRAS_STATE_APROBADA = '2c) Aprobada / En curso';
const CIARM_TUS_COMPRAS_STATE_RECHAZADA = '2d) Rechazada';
const CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM = '3) Artículos Recibidos en Adm.';
const CIARM_TUS_COMPRAS_STATE_ENTREGADA = '4) Compra Entregada al Solicitante';
const CIARM_TUS_COMPRAS_STATE_CONFORME = '5) Recepción Conforme';
const CIARM_TUS_COMPRAS_STATE_DISCONFORME = '5) Recepción Disconforme';

const CIARM_TUS_COMPRAS_STATES = [
    CIARM_TUS_COMPRAS_STATE_ENVIADA,
    CIARM_TUS_COMPRAS_STATE_EN_PROCESO,
    CIARM_TUS_COMPRAS_STATE_EN_COTIZACION,
    CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS,
    CIARM_TUS_COMPRAS_STATE_EN_APROBACION,
    CIARM_TUS_COMPRAS_STATE_OC_GENERADA,
    CIARM_TUS_COMPRAS_STATE_APROBADA,
    CIARM_TUS_COMPRAS_STATE_RECHAZADA,
    CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM,
    CIARM_TUS_COMPRAS_STATE_ENTREGADA,
    CIARM_TUS_COMPRAS_STATE_CONFORME,
    CIARM_TUS_COMPRAS_STATE_DISCONFORME,
];

const CIARM_TUS_COMPRAS_PEDIDOS_HEADERS = [
    'ID PEDIDO',
    'FECHA SOLICITUD',
    'HORA SOLICITUD',
    'SOLICITANTE',
    'CORREO SOLICITANTE',
    'ÁREA SOLICITANTE',
    'TIPO COMPRA',
    'MONTO ESTIMADO',
    'ACUMULADO MES ÁREA',
    'REQUIERE APROBACIÓN',
    'ARTÍCULOS / DESCRIPCIÓN',
    'JUSTIFICACIÓN / PROVEEDOR',
    'ESTADO',
    'RESPONSABLE ADM',
    'APROBADOR',
    'FECHA APROBACIÓN',
    'COMENTARIO APROBACIÓN',
    'FECHA RECEPCIÓN ADM',
    'FECHA ENTREGA',
    'EVALUACIÓN SOLICITANTE',
    'COMENTARIO RECEPCIÓN',
    'ARCHIVOS ADJUNTOS',
    'ÚLTIMA ACTUALIZACIÓN',
    'VERSIÓN',
    'MONTO ORDEN COMPRA',
    'FECHA CIERRE COTIZACIÓN EST.',
    'FECHA RECEPCIÓN COTIZACIÓN',
    'FECHA ORDEN COMPRA',
    'FECHA ENTREGA ESTIMADA',
    'ADJUNTO DETALLE PEDIDO',
    'ADJUNTO COTIZACIÓN PRELIMINAR',
    'ADJUNTO COTIZACIONES ADM',
];

const CIARM_TUS_COMPRAS_BITACORA_HEADERS = [
    'ID EVENTO',
    'ID PEDIDO',
    'FECHA HORA',
    'ACTOR CORREO',
    'ACTOR NOMBRE',
    'ROL',
    'EVENTO',
    'ESTADO ANTERIOR',
    'ESTADO NUEVO',
    'MONTO',
    'ACUMULADO ÁREA',
    'COMENTARIO',
    'NOTIFICACIÓN',
];

const CIARM_TUS_COMPRAS_CONFIG_HEADERS = [
    'CLAVE',
    'VALOR',
    'DESCRIPCIÓN',
    'ACTUALIZADO POR',
    'FECHA ACTUALIZACIÓN',
];

function ciarm_tus_compras_active_sheet_id(?string $host = null): string {
    $isProd = ciarm_tickets_is_production_host($host);
    $envSheet = getenv($isProd ? 'CIARM_TUS_COMPRAS_PROD_SHEET_ID' : 'CIARM_TUS_COMPRAS_STAGING_SHEET_ID');
    if (is_string($envSheet) && trim($envSheet) !== '') {
        return trim($envSheet);
    }
    $raw = @file_get_contents(ciarm_private_path('tus-compras-env.json'));
    if ($raw !== false) {
        $stored = json_decode($raw, true);
        $envKey = $isProd ? 'production' : 'staging';
        if (is_array($stored) && !empty($stored[$envKey]['sheetId'])) {
            return trim((string)$stored[$envKey]['sheetId']);
        }
    }
    return $isProd ? CIARM_TUS_COMPRAS_PROD_SHEET_ID : CIARM_TUS_COMPRAS_STAGING_SHEET_ID;
}

function ciarm_tus_compras_normalize_token(string $value): string {
    $clean = trim($value);
    if ($clean === '') return '';
    $map = [
        'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ü' => 'u', 'Ñ' => 'n',
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ];
    $clean = strtr($clean, $map);
    $clean = strtolower($clean);
    return preg_replace('/\s+/', ' ', $clean) ?? $clean;
}

/**
 * Verifica el perfil de la fila en DM03 ('Catálogo de colaboradores'!A4:AZ1010)
 * leyendo la columna AG (índice 32: área) y la columna AJ (índice 35: nivel):
 * - Solicitante (isDocenteDirector): AG = "docente" y AJ = "director"
 * - Administración / Autorizador (isAdministracion): AG = "administración" y AJ = "administración"
 */
function ciarm_tus_compras_matches_dm03_profile(array $row): array {
    $rawAG = trim((string)($row[32] ?? ''));
    $rawAJ = trim((string)($row[35] ?? ''));
    $normAG = ciarm_tus_compras_normalize_token($rawAG);
    $normAJ = ciarm_tus_compras_normalize_token($rawAJ);

    $isDocente = $normAG === 'docente' || preg_match('/\bdocente(s)?\b/i', $normAG) === 1;
    $isDirector = $normAJ === 'director' || $normAJ === 'directora' || preg_match('/\bdirector(a|es)?\b/i', $normAJ) === 1;

    $isAreaAdm = $normAG === 'administracion' || preg_match('/\badministraci[oó]?n\b/i', $normAG) === 1;
    $isNivelAdm = $normAJ === 'administracion' || preg_match('/\badministraci[oó]?n\b/i', $normAJ) === 1;

    return [
        'colAG' => $rawAG,
        'colAJ' => $rawAJ,
        'isDocente' => $isDocente,
        'isDirector' => $isDirector,
        'isDocenteDirector' => ($isDocente && $isDirector),
        'isAdministracion' => ($isAreaAdm && $isNivelAdm),
    ];
}

/**
 * Evalúa el perfil del usuario en DM03 a partir de las filas de
 * 'Catálogo de colaboradores'!A4:AZ1010:
 * - Si cumple con área "docente" (AG) y nivel "director" (AJ):
 *   sólo ve los botones Crear Pedido y Mis Compras (canCreate = true, canAdmin = false, canApprove = false).
 * - Si cumple con área "administración" (AG) y nivel "administración" (AJ):
 *   tiene acceso a Gestión y Aprobaciones (canAdmin = true, canApprove = true).
 */
function ciarm_tus_compras_evaluate_access_rows(array $rows, string $email): array {
    $email = strtolower(trim($email));
    $default = [
        'visible' => false,
        'canCreate' => false,
        'canAdmin' => false,
        'canApprove' => false,
        'canGerencial' => false,
        'isDocenteDirector' => false,
        'isAdministracion' => false,
        'correo' => $email,
        'nombre' => '',
        'area' => '',
        'puesto' => '',
        'colAG' => '',
        'colAJ' => '',
        'opexLimit' => CIARM_TUS_COMPRAS_OPEX_LIMIT,
        'adminEmail' => CIARM_TUS_COMPRAS_ADMIN_EMAIL,
        'approverEmails' => CIARM_TUS_COMPRAS_APPROVER_EMAILS,
    ];
    if ($email === '' || count($rows) < 2) {
        return $default;
    }

    $headers = array_map(static fn($v) => trim((string)$v), $rows[0]);
    $idxCorreo = array_search('Correo Ciarm', $headers, true);
    $idxStatus = array_search('Status', $headers, true);
    $idxNombre = array_search('Nombre', $headers, true);
    $idxApellido = array_search('Apellido', $headers, true);
    $idxArea = array_search('Área', $headers, true);
    $idxSeccion = array_search('Sección / Departamento', $headers, true);
    $idxPuesto = array_search('Puesto', $headers, true);

    if ($idxCorreo === false || $idxStatus === false) {
        return $default;
    }

    $matchedRow = null;
    $dm03AdminEmails = [];
    foreach (array_slice($rows, 1) as $row) {
        $rowEmail = strtolower(trim((string)($row[$idxCorreo] ?? '')));
        $rowStatus = strtolower(trim((string)($row[$idxStatus] ?? '')));
        if ($rowStatus === 'activo' && $rowEmail !== '' && filter_var($rowEmail, FILTER_VALIDATE_EMAIL)) {
            $rowProf = ciarm_tus_compras_matches_dm03_profile($row);
            if ($rowProf['isAdministracion']) {
                $dm03AdminEmails[$rowEmail] = true;
            }
        }
        if ($matchedRow === null && $rowEmail === $email) {
            $matchedRow = $row;
        }
    }

    if (!is_array($matchedRow)) {
        return $default;
    }

    $status = strtolower(trim((string)($matchedRow[$idxStatus] ?? '')));
    if ($status !== 'activo') {
        return $default;
    }

    $nombre = trim(
        ($idxNombre !== false ? trim((string)($matchedRow[$idxNombre] ?? '')) : '') . ' ' .
        ($idxApellido !== false ? trim((string)($matchedRow[$idxApellido] ?? '')) : '')
    );
    $area = $idxArea !== false ? trim((string)($matchedRow[$idxArea] ?? '')) : '';
    if ($area === '' && $idxSeccion !== false) {
        $area = trim((string)($matchedRow[$idxSeccion] ?? ''));
    }
    $puesto = $idxPuesto !== false ? trim((string)($matchedRow[$idxPuesto] ?? '')) : '';

    $profile = ciarm_tus_compras_matches_dm03_profile($matchedRow);
    if ($area === '' && $profile['colAG'] !== '') {
        $area = $profile['colAG'];
    }
    if ($area === '') {
        $area = 'Docente';
    }

    $isDocenteDirector = $profile['isDocenteDirector'];
    $isAdministracion = $profile['isAdministracion'];
    $normNombre = ciarm_tus_compras_normalize_token($nombre);
    $isDanielLara = ($email === strtolower(CIARM_TUS_COMPRAS_ADMIN_EMAIL))
        || ($normNombre === 'daniel lara')
        || ($normNombre === 'daniel lira');

    // Pueden crear pedidos de compra:
    // 1) Usuarios con AG="docente" y AJ="director"
    // 2) Usuarios con AG="administración" y AJ="administración", salvo Daniel Lara.
    $canCreate = $isDocenteDirector || ($isAdministracion && !$isDanielLara);
    $canAdmin = $isAdministracion && !$isDocenteDirector;
    $canApprove = $isAdministracion && !$isDocenteDirector;
    // Vista Gerencial: disponible para todos los usuarios con AG="administración" y AJ="administración" (incluyendo a Daniel Lara)
    $canGerencial = $isAdministracion && !$isDocenteDirector;
    $visible = $isDocenteDirector || $isAdministracion;

    $approverList = array_values(array_unique(array_merge(
        CIARM_TUS_COMPRAS_APPROVER_EMAILS,
        array_keys($dm03AdminEmails)
    )));

    return [
        'visible' => $visible,
        'canCreate' => $canCreate,
        'canAdmin' => $canAdmin,
        'canApprove' => $canApprove,
        'canGerencial' => $canGerencial,
        'isDocenteDirector' => $isDocenteDirector,
        'isAdministracion' => $isAdministracion,
        'correo' => $email,
        'nombre' => $nombre !== '' ? $nombre : $email,
        'area' => $area,
        'puesto' => $puesto,
        'colAG' => $profile['colAG'],
        'colAJ' => $profile['colAJ'],
        'opexLimit' => CIARM_TUS_COMPRAS_OPEX_LIMIT,
        'adminEmail' => CIARM_TUS_COMPRAS_ADMIN_EMAIL,
        'approverEmails' => $approverList,
    ];
}

function ciarm_tus_compras_access(array $sessionUser, ?array $dm03RowsOverride = null): array {
    $email = strtolower(trim((string)($sessionUser['correo'] ?? ($sessionUser['email'] ?? ''))));
    if ($email === '') {
        return ciarm_tus_compras_evaluate_access_rows([], '');
    }
    if (is_array($dm03RowsOverride)) {
        return ciarm_tus_compras_evaluate_access_rows($dm03RowsOverride, $email);
    }

    $cached = $_SESSION['ciarm_tus_compras_access'] ?? null;
    if (session_status() === PHP_SESSION_ACTIVE && is_array($cached)
        && ($cached['email'] ?? '') === $email
        && (int)($cached['expires'] ?? 0) > time()
        && is_array($cached['access'] ?? null)) {
        return $cached['access'];
    }

    $raw = @file_get_contents(ciarm_private_path('service-account.json'));
    if ($raw === false) {
        throw new RuntimeException('service_account_unavailable');
    }
    $account = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($account)) {
        throw new RuntimeException('service_account_invalid');
    }
    $token = ciarm_google_access_token($account);
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode(CIARM_DM03_SPREADSHEET_ID)
        . '/values/' . rawurlencode(CIARM_DM03_RANGE)
        . '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE';
    $response = ciarm_http_json($url, [
        'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
    ]);
    if ($response['status'] !== 200 || !is_array($response['body']['values'] ?? null)) {
        throw new RuntimeException('dm03_read_failed');
    }
    $access = ciarm_tus_compras_evaluate_access_rows($response['body']['values'], $email);
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION['ciarm_tus_compras_access'] = [
            'email' => $email,
            'expires' => time() + 20,
            'access' => $access,
        ];
    }
    return $access;
}

function ciarm_tus_compras_sheets_token(): string {
    $raw = @file_get_contents(ciarm_private_path('service-account.json'));
    if ($raw === false) {
        throw new RuntimeException('CONFIGURATION');
    }
    $account = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($account)) {
        throw new RuntimeException('CONFIGURATION');
    }
    return ciarm_google_access_token($account, 'https://www.googleapis.com/auth/spreadsheets');
}

function ciarm_tus_compras_ensure_schema(?string $spreadsheetId = null, ?string $token = null): void {
    $sheetId = $spreadsheetId ?? ciarm_tus_compras_active_sheet_id();
    $accessToken = $token ?? ciarm_tus_compras_sheets_token();

    $metaUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId)
        . '?fields=sheets.properties.title';
    $metaRes = ciarm_http_json($metaUrl, [
        'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $accessToken],
    ]);
    if ($metaRes['status'] !== 200 || !is_array($metaRes['body']['sheets'] ?? null)) {
        throw new RuntimeException('UPSTREAM_SHEETS_ACCESS');
    }

    $existingTitles = [];
    foreach ($metaRes['body']['sheets'] as $s) {
        $title = (string)($s['properties']['title'] ?? '');
        if ($title !== '') {
            $existingTitles[$title] = true;
        }
    }

    $requiredSheets = [
        'PEDIDOS' => CIARM_TUS_COMPRAS_PEDIDOS_HEADERS,
        'BITACORA PEDIDOS' => CIARM_TUS_COMPRAS_BITACORA_HEADERS,
        'CONFIG COMPRAS' => CIARM_TUS_COMPRAS_CONFIG_HEADERS,
    ];

    $addRequests = [];
    foreach ($requiredSheets as $title => $_headers) {
        if (!isset($existingTitles[$title])) {
            $addRequests[] = ['addSheet' => ['properties' => ['title' => $title]]];
        }
    }

    if (count($addRequests) > 0) {
        $batchUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId) . ':batchUpdate';
        $batchRes = ciarm_http_json($batchUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
            ],
            'body' => json_encode(['requests' => $addRequests], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        if ($batchRes['status'] < 200 || $batchRes['status'] >= 300) {
            throw new RuntimeException('UPSTREAM_SHEETS_INIT');
        }
    }

    $ranges = ["'PEDIDOS'!A1:AF1", "'BITACORA PEDIDOS'!A1:M1", "'CONFIG COMPRAS'!A1:E5"];
    $query = implode('&', array_map(static fn($r) => 'ranges=' . rawurlencode($r), $ranges));
    $getRes = ciarm_http_json(
        'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId) . '/values:batchGet?' . $query,
        ['headers' => ['Accept: application/json', 'Authorization: Bearer ' . $accessToken]]
    );
    if ($getRes['status'] !== 200) {
        throw new RuntimeException('UPSTREAM_SHEETS_READ');
    }

    $valueRanges = $getRes['body']['valueRanges'] ?? [];
    $updates = [];

    $pedidosRow1 = $valueRanges[0]['values'][0] ?? [];
    if ($pedidosRow1 === [] || trim((string)($pedidosRow1[0] ?? '')) !== 'ID PEDIDO' || count($pedidosRow1) < count(CIARM_TUS_COMPRAS_PEDIDOS_HEADERS)) {
        $updates[] = [
            'range' => "'PEDIDOS'!A1:AF1",
            'values' => [CIARM_TUS_COMPRAS_PEDIDOS_HEADERS],
        ];
    }

    $bitacoraRow1 = $valueRanges[1]['values'][0] ?? [];
    if ($bitacoraRow1 === [] || trim((string)($bitacoraRow1[0] ?? '')) !== 'ID EVENTO') {
        $updates[] = [
            'range' => "'BITACORA PEDIDOS'!A1:M1",
            'values' => [CIARM_TUS_COMPRAS_BITACORA_HEADERS],
        ];
    }

    $configRows = $valueRanges[2]['values'] ?? [];
    if ($configRows === [] || trim((string)($configRows[0][0] ?? '')) !== 'CLAVE') {
        $now = gmdate('Y-m-d H:i:s', time() - 5 * 3600);
        $updates[] = [
            'range' => "'CONFIG COMPRAS'!A1:E5",
            'values' => [
                CIARM_TUS_COMPRAS_CONFIG_HEADERS,
                ['TOPE_OPEX_MENSUAL_AREA', '8000', 'Tope mensual acumulado Opex por área solicitante (MXN)', 'sistema', $now],
                ['UMBRAL_COTIZACION_OBLIGATORIA', '3000', 'Umbral (> $3,000 MXN) que exige proceso de cotización', 'sistema', $now],
                ['ADMIN_COMPRAS_EMAIL', CIARM_TUS_COMPRAS_ADMIN_EMAIL, 'Encargado de Administración (Compras)', 'sistema', $now],
                ['APROBADOR_CAPEX_EMAIL', implode(',', CIARM_TUS_COMPRAS_APPROVER_EMAILS), 'Aprobador de Capex y excesos > $8,000 MXN', 'sistema', $now],
            ],
        ];
    }

    if (count($updates) > 0) {
        $updateUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId) . '/values:batchUpdate';
        $upRes = ciarm_http_json($updateUrl, [
            'post' => true,
            'headers' => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
            ],
            'body' => json_encode([
                'valueInputOption' => 'RAW',
                'data' => $updates,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        if ($upRes['status'] < 200 || $upRes['status'] >= 300) {
            throw new RuntimeException('UPSTREAM_SHEETS_HEADERS');
        }
    }
}

function ciarm_tus_compras_fetch_all(?string $spreadsheetId = null): array {
    $sheetId = $spreadsheetId ?? ciarm_tus_compras_active_sheet_id();
    $token = ciarm_tus_compras_sheets_token();
    ciarm_tus_compras_ensure_schema($sheetId, $token);

    $ranges = ["'PEDIDOS'!A1:AF2000", "'BITACORA PEDIDOS'!A1:M5000", "'CONFIG COMPRAS'!A1:E20"];
    $query = implode('&', array_map(static fn($r) => 'ranges=' . rawurlencode($r), $ranges));
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId)
        . '/values:batchGet?' . $query . '&valueRenderOption=FORMATTED_VALUE';
    $res = ciarm_http_json($url, [
        'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
    ]);
    if ($res['status'] !== 200 || !is_array($res['body']['valueRanges'] ?? null)) {
        throw new RuntimeException('UPSTREAM_SHEETS_READ');
    }

    $pedidosValues = $res['body']['valueRanges'][0]['values'] ?? [];
    $bitacoraValues = $res['body']['valueRanges'][1]['values'] ?? [];
    $configValues = $res['body']['valueRanges'][2]['values'] ?? [];

    foreach (array_slice($configValues, 1) as $cfgRow) {
        $cfgKey = trim((string)($cfgRow[0] ?? ''));
        $cfgVal = trim((string)($cfgRow[1] ?? ''));
        if ($cfgKey === 'WEBAPP_URL_CORREOS' && str_starts_with($cfgVal, 'https://script.google.com/macros/s/')) {
            $GLOBALS['ciarm_tus_compras_detected_webapp'] = $cfgVal;
        }
    }

    return [
        'sheetId' => $sheetId,
        'token' => $token,
        'pedidosRows' => $pedidosValues,
        'bitacoraRows' => $bitacoraValues,
        'configRows' => $configValues,
    ];
}

function ciarm_tus_compras_extract_year_month(string $fecha): string {
    $clean = trim($fecha);
    if (preg_match('/^(\d{4})-(\d{2})/', $clean, $m)) {
        return $m[1] . '-' . $m[2];
    }
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/', $clean, $m)) {
        return $m[3] . '-' . str_pad($m[2], 2, '0', STR_PAD_LEFT);
    }
    return substr($clean, 0, 7);
}

function ciarm_tus_compras_parse_pedidos(array $rows): array {
    if (count($rows) < 2) return [];
    $headers = array_map(static fn($h) => trim((string)$h), $rows[0]);
    $col = array_flip($headers);
    $get = static function (array $row, string $name) use ($col): string {
        $idx = $col[$name] ?? null;
        if ($idx === null) return '';
        $val = trim((string)($row[$idx] ?? ''));
        return preg_replace('/^\x{200B}(?=[=+@\x27-])/u', '', $val) ?? $val;
    };

    $runningOpexByAreaMonth = [];
    $list = [];
    for ($i = 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $id = $get($row, 'ID PEDIDO');
        if ($id === '' || !preg_match('/^CMP-\d{4}-\d+$/', $id)) {
            continue;
        }
        $fecha = $get($row, 'FECHA SOLICITUD');
        $area = $get($row, 'ÁREA SOLICITANTE');
        $tipo = strtoupper($get($row, 'TIPO COMPRA')) === 'CAPEX' ? 'CAPEX' : 'OPEX';
        $montoEstRaw = str_replace([',', '$', ' '], '', $get($row, 'MONTO ESTIMADO'));
        $montoOCRaw = str_replace([',', '$', ' '], '', $get($row, 'MONTO ORDEN COMPRA'));
        $acumRaw = str_replace([',', '$', ' '], '', $get($row, 'ACUMULADO MES ÁREA'));
        $montoEstimado = round((float)$montoEstRaw, 2);
        $montoOrdenCompra = round((float)$montoOCRaw, 2);
        // Regla presupuestal: cuando Daniel genera la Orden de Compra y ajusta el monto,
        // dicho montoOrdenCompra es el único monto válido a descontar del presupuesto mensual del área.
        $montoEfectivo = $montoOrdenCompra > 0 ? $montoOrdenCompra : $montoEstimado;
        $storedAcum = round((float)$acumRaw, 2);
        $rawEstado = $get($row, 'ESTADO');

        $normArea = ciarm_tus_compras_normalize_token($area !== '' ? $area : 'docente');
        $ym = ciarm_tus_compras_extract_year_month($fecha);
        $bucketKey = $normArea . '|' . $ym;

        if ($tipo === 'OPEX' && $rawEstado !== CIARM_TUS_COMPRAS_STATE_RECHAZADA) {
            $runningOpexByAreaMonth[$bucketKey] = round(($runningOpexByAreaMonth[$bucketKey] ?? 0.0) + $montoEfectivo, 2);
        }
        $runningAreaOpex = $runningOpexByAreaMonth[$bucketKey] ?? 0.0;
        if ($tipo === 'OPEX') {
            $acumuladoMesArea = $montoOrdenCompra > 0
                ? max($runningAreaOpex, $montoEfectivo)
                : max($storedAcum, $runningAreaOpex, $montoEfectivo);
        } else {
            $acumuladoMesArea = max($storedAcum, $runningAreaOpex);
        }

        $reqNorm = ciarm_tus_compras_normalize_token($get($row, 'REQUIERE APROBACIÓN'));
        // No existe monto límite mensual por área: la aprobación aplica a CAPEX o cuando la compra es >= $8,000 MXN
        $requiresApproval = ($tipo === 'CAPEX')
            || ($tipo === 'OPEX' && $montoEfectivo >= CIARM_TUS_COMPRAS_OPEX_LIMIT)
            || ($reqNorm === 'si');

        // Regla estricta de asignación de estado:
        // Si es CAPEX o si la compra es >= $8,000 MXN,
        // NUNCA debe quedar en "1) Solicitud enviada", sino en "2b) En aprobación".
        $estado = $rawEstado !== '' ? $rawEstado : CIARM_TUS_COMPRAS_STATE_ENVIADA;
        $needsStateSync = false;
        if ($requiresApproval && ($estado === CIARM_TUS_COMPRAS_STATE_ENVIADA || $rawEstado === '')) {
            $estado = CIARM_TUS_COMPRAS_STATE_EN_APROBACION;
            $needsStateSync = true;
        }
        if ($montoOrdenCompra > 0 && abs($storedAcum - $acumuladoMesArea) > 0.009) {
            $needsStateSync = true;
        }

        $aprobador = $get($row, 'APROBADOR');
        if ($requiresApproval && ($aprobador === '' || str_starts_with($aprobador, 'No requiere'))) {
            $aprobador = 'En aprobación (Administración)';
        }

        $adjuntoDetalle = $get($row, 'ADJUNTO DETALLE PEDIDO');
        $adjuntoCotPrelim = $get($row, 'ADJUNTO COTIZACIÓN PRELIMINAR');
        $adjuntoCotAdm = $get($row, 'ADJUNTO COTIZACIONES ADM');
        $rawAdjuntos = $get($row, 'ARCHIVOS ADJUNTOS');

        $list[] = [
            'rowNumber' => $i + 1,
            'id' => $id,
            'fecha' => $fecha,
            'hora' => $get($row, 'HORA SOLICITUD'),
            'solicitante' => $get($row, 'SOLICITANTE'),
            'correo' => strtolower($get($row, 'CORREO SOLICITANTE')),
            'area' => $area,
            'tipo' => $tipo,
            'monto' => $montoEfectivo,
            'montoEstimado' => $montoEstimado,
            'montoOrdenCompra' => $montoOrdenCompra,
            'requiereCotizacion' => $montoEstimado >= CIARM_TUS_COMPRAS_QUOTE_THRESHOLD,
            'requiereTresCotizaciones' => $montoEstimado >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
            'cotizacionesRequeridas' => $montoEstimado >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD ? 3 : 0,
            'acumuladoMesArea' => $acumuladoMesArea,
            'requiereAprobacion' => $requiresApproval,
            'descripcion' => $get($row, 'ARTÍCULOS / DESCRIPCIÓN'),
            'justificacion' => $get($row, 'JUSTIFICACIÓN / PROVEEDOR'),
            'estado' => $estado,
            'responsableAdm' => $get($row, 'RESPONSABLE ADM') ?: 'Daniel Lara',
            'aprobador' => $aprobador,
            'fechaAprobacion' => $get($row, 'FECHA APROBACIÓN'),
            'comentarioAprobacion' => $get($row, 'COMENTARIO APROBACIÓN'),
            'fechaRecepcionAdm' => $get($row, 'FECHA RECEPCIÓN ADM'),
            'fechaEntrega' => $get($row, 'FECHA ENTREGA'),
            'evaluacion' => $get($row, 'EVALUACIÓN SOLICITANTE'),
            'comentarioRecepcion' => $get($row, 'COMENTARIO RECEPCIÓN'),
            'adjuntos' => $rawAdjuntos,
            'adjuntoDetalle' => $adjuntoDetalle,
            'adjuntoCotizacionPreliminar' => $adjuntoCotPrelim,
            'adjuntoCotizacionesAdm' => $adjuntoCotAdm,
            'fechaCierreCotizacion' => $get($row, 'FECHA CIERRE COTIZACIÓN EST.'),
            'fechaRecepcionCotizacion' => $get($row, 'FECHA RECEPCIÓN COTIZACIÓN'),
            'fechaOrdenCompra' => $get($row, 'FECHA ORDEN COMPRA'),
            'fechaEntregaEstimada' => $get($row, 'FECHA ENTREGA ESTIMADA'),
            'ultimaActualizacion' => $get($row, 'ÚLTIMA ACTUALIZACIÓN'),
            'version' => $get($row, 'VERSIÓN') ?: 'v1',
            '_needsStateSync' => $needsStateSync,
        ];
    }
    return $list;
}

function ciarm_tus_compras_sync_normalized_orders(array $pedidos, string $sheetId, string $token): void {
    $data = [];
    foreach ($pedidos as $p) {
        if (empty($p['_needsStateSync']) || empty($p['rowNumber'])) {
            continue;
        }
        $rowNum = (int)$p['rowNumber'];
        $data[] = [
            'range' => "'PEDIDOS'!A{$rowNum}:AF{$rowNum}",
            'values' => [ciarm_tus_compras_order_to_row($p)],
        ];
    }
    if ($data === []) {
        return;
    }
    $batchUpdateUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($sheetId) . '/values:batchUpdate';
    @ciarm_http_json($batchUpdateUrl, [
        'post' => true,
        'headers' => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
        ],
        'body' => json_encode([
            'valueInputOption' => 'RAW',
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function ciarm_tus_compras_parse_bitacora(array $rows, ?string $filterPedidoId = null): array {
    if (count($rows) < 2) return [];
    $headers = array_map(static fn($h) => trim((string)$h), $rows[0]);
    $col = array_flip($headers);
    $get = static function (array $row, string $name) use ($col): string {
        $idx = $col[$name] ?? null;
        if ($idx === null) return '';
        return trim((string)($row[$idx] ?? ''));
    };

    $items = [];
    for ($i = 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $pedidoId = $get($row, 'ID PEDIDO');
        if ($pedidoId === '') continue;
        if ($filterPedidoId !== null && $pedidoId !== $filterPedidoId) continue;
        $items[] = [
            'idEvento' => $get($row, 'ID EVENTO'),
            'idPedido' => $pedidoId,
            'fechaHora' => $get($row, 'FECHA HORA'),
            'actorCorreo' => $get($row, 'ACTOR CORREO'),
            'actorNombre' => $get($row, 'ACTOR NOMBRE'),
            'rol' => $get($row, 'ROL'),
            'evento' => $get($row, 'EVENTO'),
            'estadoAnterior' => $get($row, 'ESTADO ANTERIOR'),
            'estadoNuevo' => $get($row, 'ESTADO NUEVO'),
            'monto' => (float)str_replace([',', '$', ' '], '', $get($row, 'MONTO')),
            'acumuladoArea' => (float)str_replace([',', '$', ' '], '', $get($row, 'ACUMULADO ÁREA')),
            'comentario' => $get($row, 'COMENTARIO'),
            'notificacion' => $get($row, 'NOTIFICACIÓN'),
        ];
    }
    return $items;
}

function ciarm_tus_compras_area_monthly_opex(array $pedidos, string $area, string $yearMonth, ?string $excludeId = null): float {
    $normArea = ciarm_tus_compras_normalize_token($area !== '' ? $area : 'docente');
    if ($normArea === '') return 0.0;
    $sum = 0.0;
    foreach ($pedidos as $p) {
        if ($excludeId !== null && ($p['id'] ?? '') === $excludeId) continue;
        if (strtoupper((string)($p['tipo'] ?? '')) !== 'OPEX') continue;
        if (($p['estado'] ?? '') === CIARM_TUS_COMPRAS_STATE_RECHAZADA) continue;
        $rawPArea = (string)($p['area'] ?? '');
        $pArea = ciarm_tus_compras_normalize_token($rawPArea !== '' ? $rawPArea : 'docente');
        if ($pArea !== $normArea) continue;
        $pMonth = ciarm_tus_compras_extract_year_month((string)($p['fecha'] ?? ''));
        if ($pMonth !== $yearMonth) continue;
        $montoOC = (float)($p['montoOrdenCompra'] ?? 0);
        $montoEst = (float)($p['montoEstimado'] ?? ($p['monto'] ?? 0));
        $sum += ($montoOC > 0 ? $montoOC : $montoEst);
    }
    return round($sum, 2);
}

/**
 * Determina si un pedido requiere aprobación y cuántas cotizaciones requiere (2 pasos):
 * - No existe monto límite mensual por área.
 * - Compras < $8,000.00 MXN: pasan directo a generación de Orden de Compra (ISSUE_PURCHASE_ORDER), sin requerir cotización previa (0 cotizaciones).
 * - Compras >= $8,000.00 MXN: pasan por aprobación ('2b) En aprobación') y requieren 3 cotizaciones obligatorias de parte de Daniel Lara antes de generar la Orden de Compra.
 */
function ciarm_tus_compras_requires_approval(string $tipo, float $monto, float $currentAreaMonthlyOpex = 0.0, float $limit = CIARM_TUS_COMPRAS_OPEX_LIMIT): array {
    $tipoNorm = strtoupper(trim($tipo)) === 'CAPEX' ? 'CAPEX' : 'OPEX';
    $montoRounded = round($monto, 2);
    $projectedAreaTotal = $tipoNorm === 'OPEX'
        ? round($currentAreaMonthlyOpex + $montoRounded, 2)
        : round($currentAreaMonthlyOpex, 2);
    // Sin monto límite por área: evalúa el monto de la compra individual (>= $8,000 MXN) o si es CAPEX
    $exceedsOpexLimit = ($tipoNorm === 'OPEX' && $montoRounded >= $limit);
    $requires = ($tipoNorm === 'CAPEX') || $exceedsOpexLimit;
    $requiresQuotation = $montoRounded >= CIARM_TUS_COMPRAS_QUOTE_THRESHOLD;
    $requiresThreeQuotes = $montoRounded >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD;
    $requiredQuotesCount = $requiresThreeQuotes ? 3 : 0;
    return [
        'tipo' => $tipoNorm,
        'monto' => $montoRounded,
        'currentAreaMonthlyOpex' => round($currentAreaMonthlyOpex, 2),
        'projectedAreaMonthlyOpex' => $projectedAreaTotal,
        'opexLimit' => $limit,
        'quoteThreshold' => CIARM_TUS_COMPRAS_QUOTE_THRESHOLD,
        'threeQuotesThreshold' => CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
        'requiresQuotation' => $requiresQuotation,
        'requiresThreeQuotes' => $requiresThreeQuotes,
        'requiredQuotesCount' => $requiredQuotesCount,
        'exceedsOpexLimit' => $exceedsOpexLimit,
        'requiresApproval' => $requires,
        'initialState' => $requires ? CIARM_TUS_COMPRAS_STATE_EN_APROBACION : CIARM_TUS_COMPRAS_STATE_ENVIADA,
    ];
}

/**
 * Máquina de estados de "Tus compras" (simplificada en 2 pasos según umbral de $8,000.00 MXN):
 * - Sin monto límite mensual por área.
 * - Compras >= $8,000.00 MXN (o Capex) pasan automáticamente a '2b) En aprobación' al crearse.
 * - Cuando el autorizador aprueba un ticket en '2b) En aprobación', pasa a '2a) Solicitud recibida / En proceso'.
 * - Si el autorizador lo rechaza desde '2b) En aprobación', pasa a '2d) Rechazada'.
 * - Una vez listo para gestión de Daniel Lara (en '1) Solicitud enviada' si es OPEX < $8,000, o en '2a) Solicitud recibida / En proceso'):
 *   * Si la compra es < $8,000.00 MXN: pasa directo a generación de Orden de Compra ('ISSUE_PURCHASE_ORDER' -> '2c) Orden de Compra generada'),
 *     sin requerir cotización previa, informando siempre fecha de OC, fecha estimada de entrega y monto definitivo de la OC.
 *   * Si la compra es >= $8,000.00 MXN:
 *     1) Daniel informa que está cotizando y da fecha estimada de cierre de cotizaciones ('START_QUOTING' -> '2a-1) En cotización').
 *     2) Al registrar la recepción de cotizaciones ('RECEIVE_QUOTES' -> '2a-2) Cotizaciones recibidas'), debe adjuntar
 *        obligatoriamente las 3 cotizaciones (Cotización #1, Cotización #2 y Cotización #3, <= 10 MB cada una).
 *     3) Luego gestiona la Orden de Compra ('ISSUE_PURCHASE_ORDER' -> '2c) Orden de Compra generada'), informando fecha de OC,
 *        fecha estimada de entrega y ajustando el monto definitivo de la OC.
 * - De '2c) Orden de Compra generada' pasa a '3) Artículos Recibidos en Adm.'.
 * - De '3)' pasa a '4) Compra Entregada al Solicitante'.
 * - En '4)', únicamente el Solicitante cierra el ticket como '5) Recepción Conforme' o '5) Recepción Disconforme'.
 */
function ciarm_tus_compras_validate_transition(array $order, string $event, array $access, string $comment = '', array $payload = []): array {
    $currentState = (string)($order['estado'] ?? '');
    $actorEmail = strtolower(trim((string)($access['correo'] ?? '')));
    $isOwner = ($actorEmail !== '' && strtolower(trim((string)($order['correo'] ?? ''))) === $actorEmail);
    $canAdmin = !empty($access['canAdmin']);
    $canApprove = !empty($access['canApprove']);
    $montoBase = (float)($order['montoEstimado'] ?? ($order['monto'] ?? 0));
    $requiresApproval = !empty($order['requiereAprobacion'])
        || strtoupper((string)($order['tipo'] ?? '')) === 'CAPEX'
        || ($montoBase >= CIARM_TUS_COMPRAS_OPEX_LIMIT);
    $requiresQuotation = $montoBase >= CIARM_TUS_COMPRAS_QUOTE_THRESHOLD;
    $requiresThreeQuotes = $montoBase >= CIARM_TUS_COMPRAS_THREE_QUOTES_THRESHOLD;

    switch ($event) {
        case 'RECEIVE_OPEX':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_ENVIADA) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            if ($requiresApproval) {
                throw new RuntimeException('REQUIRES_CAPEX_APPROVAL');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_EN_PROCESO,
                'roleLabel' => 'Administración',
            ];

        case 'APPROVE_CAPEX':
            if (!$canApprove && !$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_EN_APROBACION) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_EN_PROCESO,
                'roleLabel' => 'Autorizador (Administración)',
            ];

        case 'REJECT_CAPEX':
            if (!$canApprove && !$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_EN_APROBACION) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            if (strlen(trim($comment)) < 5) {
                throw new RuntimeException('COMMENT_REQUIRED');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_RECHAZADA,
                'roleLabel' => 'Autorizador (Administración)',
            ];

        case 'START_QUOTING':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState === CIARM_TUS_COMPRAS_STATE_ENVIADA && $requiresApproval) {
                throw new RuntimeException('REQUIRES_CAPEX_APPROVAL');
            }
            if (!in_array($currentState, [CIARM_TUS_COMPRAS_STATE_ENVIADA, CIARM_TUS_COMPRAS_STATE_EN_PROCESO], true)) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            if (!$requiresQuotation) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            $fechaCierre = trim((string)($payload['fechaCierreCotizacion'] ?? ''));
            if ($fechaCierre === '') {
                throw new RuntimeException('QUOTE_CLOSE_DATE_REQUIRED');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_EN_COTIZACION,
                'roleLabel' => 'Administración (Daniel Lara)',
            ];

        case 'RECEIVE_QUOTES':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_EN_COTIZACION) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            $rawCot = $payload['adjuntoCotizacionesAdm'] ?? ($payload['adjuntos'] ?? '');
            $cotUrls = is_array($rawCot)
                ? array_values(array_filter(array_map(static fn($u) => trim((string)$u), $rawCot)))
                : array_values(array_filter(array_map('trim', explode('|', (string)$rawCot))));
            if ($cotUrls === []) {
                throw new RuntimeException('QUOTE_ATTACHMENT_REQUIRED');
            }
            if (count($cotUrls) < 3) {
                throw new RuntimeException('THREE_QUOTES_REQUIRED');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS,
                'roleLabel' => 'Administración (Daniel Lara)',
                'quoteUrls' => $cotUrls,
            ];

        case 'ISSUE_PURCHASE_ORDER':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if ($currentState === CIARM_TUS_COMPRAS_STATE_ENVIADA && $requiresApproval) {
                throw new RuntimeException('REQUIRES_CAPEX_APPROVAL');
            }
            if ($requiresQuotation) {
                if ($currentState !== CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS) {
                    throw new RuntimeException('QUOTATION_FLOW_REQUIRED');
                }
            } else {
                if (!in_array($currentState, [
                    CIARM_TUS_COMPRAS_STATE_ENVIADA,
                    CIARM_TUS_COMPRAS_STATE_EN_PROCESO,
                    CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS,
                ], true)) {
                    throw new RuntimeException('INVALID_TRANSITION');
                }
            }
            $fechaOC = trim((string)($payload['fechaOrdenCompra'] ?? ''));
            $fechaEntregaEst = trim((string)($payload['fechaEntregaEstimada'] ?? ''));
            $montoOC = round((float)($payload['montoOrdenCompra'] ?? 0), 2);
            if ($fechaOC === '') {
                throw new RuntimeException('PO_DATE_REQUIRED');
            }
            if ($fechaEntregaEst === '') {
                throw new RuntimeException('ESTIMATED_DELIVERY_DATE_REQUIRED');
            }
            if ($montoOC <= 0 || $montoOC > 10000000) {
                throw new RuntimeException('PO_AMOUNT_REQUIRED');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_OC_GENERADA,
                'roleLabel' => 'Administración (Daniel Lara)',
                'fechaOrdenCompra' => $fechaOC,
                'fechaEntregaEstimada' => $fechaEntregaEst,
                'montoOrdenCompra' => $montoOC,
            ];

        case 'RECEIVE_ITEMS_ADM':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if (!in_array($currentState, [
                CIARM_TUS_COMPRAS_STATE_OC_GENERADA,
                CIARM_TUS_COMPRAS_STATE_EN_PROCESO,
                CIARM_TUS_COMPRAS_STATE_APROBADA,
            ], true)) {
                throw new RuntimeException('INVALID_TRANSITION_STATE_3');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM,
                'roleLabel' => 'Administración',
            ];

        case 'DELIVER_TO_REQUESTER':
            if (!$canAdmin) {
                throw new RuntimeException('FORBIDDEN_ROLE');
            }
            if (!in_array($currentState, [CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM, CIARM_TUS_COMPRAS_STATE_DISCONFORME], true)) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_ENTREGADA,
                'roleLabel' => 'Administración',
            ];

        case 'CONFIRM_CONFORME':
            if (!$isOwner) {
                throw new RuntimeException('FORBIDDEN_OWNER');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_ENTREGADA) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_CONFORME,
                'roleLabel' => 'Solicitante',
            ];

        case 'CONFIRM_DISCONFORME':
            if (!$isOwner) {
                throw new RuntimeException('FORBIDDEN_OWNER');
            }
            if ($currentState !== CIARM_TUS_COMPRAS_STATE_ENTREGADA) {
                throw new RuntimeException('INVALID_TRANSITION');
            }
            if (strlen(trim($comment)) < 5) {
                throw new RuntimeException('COMMENT_REQUIRED');
            }
            return [
                'newState' => CIARM_TUS_COMPRAS_STATE_DISCONFORME,
                'roleLabel' => 'Solicitante',
            ];

        default:
            throw new RuntimeException('INVALID_EVENT');
    }
}

/**
 * Devuelve las acciones permitidas según la vista ('mine' para Solicitante, 'all' para Administración).
 * - En la vista 'mine' (Mis Compras): el solicitante NO ve ningún botón de acción salvo cuando
 *   el ticket está en '4) Compra Entregada al Solicitante', donde ve CONFIRM_CONFORME y CONFIRM_DISCONFORME.
 * - En la vista 'all' (Gestión y Aprobaciones): el usuario con perfil "administración" ve las acciones
 *   administrativas/autorizadoras correspondientes a cada etapa y umbral ($3,000 MXN).
 */
function ciarm_tus_compras_allowed_actions(array $order, array $access, string $viewKind = 'all'): array {
    $state = (string)($order['estado'] ?? '');
    $actorEmail = strtolower(trim((string)($access['correo'] ?? '')));
    $isOwner = ($actorEmail !== '' && strtolower(trim((string)($order['correo'] ?? ''))) === $actorEmail);
    $canAdmin = !empty($access['canAdmin']);
    $canApprove = !empty($access['canApprove']);

    if ($viewKind === 'mine') {
        if ($state === CIARM_TUS_COMPRAS_STATE_ENTREGADA && $isOwner) {
            return ['CONFIRM_CONFORME', 'CONFIRM_DISCONFORME'];
        }
        return [];
    }

    $montoBase = (float)($order['montoEstimado'] ?? ($order['monto'] ?? 0));
    $requiresApproval = !empty($order['requiereAprobacion'])
        || strtoupper((string)($order['tipo'] ?? '')) === 'CAPEX'
        || ($montoBase >= CIARM_TUS_COMPRAS_OPEX_LIMIT);
    $requiresQuotation = $montoBase >= CIARM_TUS_COMPRAS_QUOTE_THRESHOLD;

    $actions = [];
    if ($state === CIARM_TUS_COMPRAS_STATE_ENVIADA) {
        if ($canAdmin && !$requiresApproval) {
            $actions[] = $requiresQuotation ? 'START_QUOTING' : 'ISSUE_PURCHASE_ORDER';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_EN_APROBACION) {
        if ($canApprove || $canAdmin) {
            $actions[] = 'APPROVE_CAPEX';
            $actions[] = 'REJECT_CAPEX';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_EN_PROCESO) {
        if ($canAdmin) {
            $actions[] = $requiresQuotation ? 'START_QUOTING' : 'ISSUE_PURCHASE_ORDER';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_EN_COTIZACION) {
        if ($canAdmin) {
            $actions[] = 'RECEIVE_QUOTES';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS) {
        if ($canAdmin) {
            $actions[] = 'ISSUE_PURCHASE_ORDER';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_OC_GENERADA || $state === CIARM_TUS_COMPRAS_STATE_APROBADA) {
        if ($canAdmin) {
            $actions[] = 'RECEIVE_ITEMS_ADM';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM) {
        if ($canAdmin) {
            $actions[] = 'DELIVER_TO_REQUESTER';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_ENTREGADA) {
        if ($isOwner) {
            $actions[] = 'CONFIRM_CONFORME';
            $actions[] = 'CONFIRM_DISCONFORME';
        }
    } elseif ($state === CIARM_TUS_COMPRAS_STATE_DISCONFORME) {
        if ($canAdmin) {
            $actions[] = 'DELIVER_TO_REQUESTER';
        }
    }
    return $actions;
}

function ciarm_tus_compras_build_notification_plan(string $event, array $order, string $comment = '', array $extraAdminEmails = []): array {
    $id = (string)($order['id'] ?? '');
    $estado = (string)($order['estado'] ?? '');
    $tipo = (string)($order['tipo'] ?? 'OPEX');
    $solicitante = (string)($order['solicitante'] ?? '');
    $correoSolicitante = strtolower(trim((string)($order['correo'] ?? '')));
    $area = (string)($order['area'] ?? '');
    $montoFmt = '$' . number_format((float)($order['monto'] ?? 0), 2, '.', ',') . ' MXN';
    $acumFmt = '$' . number_format((float)($order['acumuladoMesArea'] ?? 0), 2, '.', ',') . ' MXN';
    $baseUrl = function_exists('ciarm_tickets_active_base_url')
        ? rtrim(ciarm_tickets_active_base_url(), '/')
        : 'https://portal.ciarm.edu.mx';

    $messages = [];
    $seen = [];
    $enqueue = static function (string $role, string $to, string $subject, string $heading, string $intro, string $ctaLabel, string $ctaHash) use (&$messages, &$seen, $baseUrl, $comment): void {
        $norm = strtolower(trim($to));
        if ($norm === '' || !filter_var($norm, FILTER_VALIDATE_EMAIL)) return;
        if (isset($seen[$norm])) return;
        $seen[$norm] = true;
        $messages[] = [
            'role' => $role,
            'to' => $norm,
            'subject' => $subject,
            'heading' => $heading,
            'intro' => $intro,
            'ctaLabel' => $ctaLabel,
            'ctaUrl' => $baseUrl . '/' . $ctaHash,
            'comment' => $comment,
        ];
    };

    $requiresApproval = !empty($order['requiereAprobacion']);
    $allApprovers = array_values(array_unique(array_merge(CIARM_TUS_COMPRAS_APPROVER_EMAILS, $extraAdminEmails)));

    switch ($event) {
        case 'CREATE':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Solicitud registrada {$id} ({$estado})",
                'Hemos registrado tu pedido de compra',
                $requiresApproval
                    ? "Tu pedido de compra {$id} ({$tipo}) por {$montoFmt} ha sido enviado y pasó automáticamente al estado «{$estado}» por superar el límite mensual permitido (o ser Capex)."
                    : "Tu pedido de compra {$id} ({$tipo}) por {$montoFmt} ha sido registrado en estado «{$estado}» y enviado a Administración (Daniel Lara).",
                'Ver mis compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Nuevo pedido {$id} — {$solicitante} ({$area})",
                'Nuevo pedido de compra registrado',
                "Se ha registrado el pedido {$id} ({$tipo}) de {$solicitante} ({$area}) por {$montoFmt} (Acumulado mensual del área: {$acumFmt}) en estado «{$estado}».",
                'Gestionar pedidos de compra',
                '#admin-tus-compras'
            );
            if ($requiresApproval) {
                foreach ($allApprovers as $approver) {
                    $enqueue(
                        'aprobador',
                        $approver,
                        "[Portal CIARM · Tus Compras] Pedido {$id} en aprobación ({$tipo} · {$montoFmt})",
                        'Nuevo pedido en estado 2b) En aprobación',
                        "El pedido {$id} de {$solicitante} ({$area}) por {$montoFmt} ({$tipo}, acumulado mensual del área: {$acumFmt}) pasó automáticamente a «{$estado}» y requiere aprobación.",
                        'Aprobar o rechazar en Tus Compras',
                        '#admin-tus-compras'
                    );
                }
            } else {
                foreach ($extraAdminEmails as $admExtra) {
                    $enqueue(
                        'admin',
                        $admExtra,
                        "[Portal CIARM · Tus Compras] Nuevo pedido {$id} — {$solicitante} ({$area})",
                        'Nuevo pedido de compra registrado',
                        "Se ha registrado el pedido {$id} ({$tipo}) de {$solicitante} ({$area}) por {$montoFmt} (Acumulado mensual del área: {$acumFmt}) en estado «{$estado}».",
                        'Gestionar pedidos de compra',
                        '#admin-tus-compras'
                    );
                }
            }
            break;

        case 'RECEIVE_OPEX':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Pedido en proceso {$id} (2a)",
                'Tu pedido de compra está en proceso',
                "Administración (Daniel Lara) recibió tu pedido Opex {$id} y cambió su estado a «{$estado}».",
                'Ver mis compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Confirmación: Pedido {$id} en proceso (2a)",
                'Pedido Opex puesto en proceso',
                "El pedido {$id} de {$solicitante} ({$area}) pasó al estado «{$estado}».",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            break;

        case 'APPROVE_CAPEX':
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Pedido APROBADO {$id} — Pasa a 2a) Solicitud recibida / En proceso",
                'Pedido aprobado y puesto en estado 2a)',
                "El pedido {$id} ({$tipo} por {$montoFmt}) de {$solicitante} ({$area}) fue aprobado y pasó al estado «{$estado}». Ya puedes continuar con la compra y avanzar a Estado 3 cuando lleguen los artículos.",
                'Continuar compra en panel',
                '#admin-tus-compras'
            );
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Pedido aprobado {$id} — En proceso (2a)",
                'Tu pedido de compra ha sido aprobado y está en proceso',
                "Tu pedido {$id} ({$tipo} por {$montoFmt}) fue aprobado y pasó al estado «{$estado}».",
                'Ver mis compras',
                '#tus-compras'
            );
            foreach ($allApprovers as $approver) {
                $enqueue(
                    'aprobador',
                    $approver,
                    "[Portal CIARM · Tus Compras] Confirmación de aprobación {$id}",
                    'Aprobación registrada correctamente',
                    "Se aprobó el pedido {$id} de {$solicitante} ({$area}), pasando a estado «{$estado}».",
                    'Ver panel de compras',
                    '#admin-tus-compras'
                );
            }
            break;

        case 'REJECT_CAPEX':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Pedido rechazado {$id} (2d)",
                'Tu pedido de compra no fue autorizado',
                "El pedido {$id} ({$tipo} por {$montoFmt}) cambió al estado «{$estado}».",
                'Ver detalle en el portal',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Pedido rechazado {$id} (2d)",
                'Pedido rechazado en etapa de aprobación',
                "El pedido {$id} de {$solicitante} ({$area}) fue marcado como «{$estado}».",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            break;

        case 'START_QUOTING':
            $fCierre = (string)($order['fechaCierreCotizacion'] ?? '');
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Pedido en proceso de cotización {$id} (2a-1)",
                'Tu pedido de compra está en proceso de cotización',
                "Administración (Daniel Lara) informó que tu pedido {$id} (mayor o igual a \$8,000.00 MXN) se encuentra en proceso de cotización («{$estado}» · requiere 3 cotizaciones). Fecha estimada de cierre de cotizaciones: {$fCierre}.",
                'Ver detalle en Mis Compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Inicio de cotización registrado {$id} (2a-1)",
                'Proceso de cotización iniciado',
                "Registraste que el pedido {$id} de {$solicitante} ({$area}) está en cotización con fecha estimada de cierre: {$fCierre}.",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            break;

        case 'RECEIVE_QUOTES':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Cotizaciones recibidas {$id} (2a-2)",
                'Se recibieron las cotizaciones de tu pedido',
                "Administración (Daniel Lara) informó la recepción de las cotizaciones para tu pedido {$id} («{$estado}») y las adjuntó al expediente. El siguiente paso será la generación de la Orden de Compra.",
                'Ver cotizaciones en Mis Compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Cotizaciones registradas {$id} (2a-2)",
                'Recepción de cotizaciones registrada',
                "Se adjuntaron las cotizaciones del pedido {$id} de {$solicitante} ({$area}). Ya puedes generar la Orden de Compra.",
                'Generar Orden de Compra',
                '#admin-tus-compras'
            );
            break;

        case 'ISSUE_PURCHASE_ORDER':
            $fOC = (string)($order['fechaOrdenCompra'] ?? '');
            $fEntEst = (string)($order['fechaEntregaEstimada'] ?? '');
            $mEstFmt = '$' . number_format((float)($order['montoEstimado'] ?? ($order['monto'] ?? 0)), 2, '.', ',') . ' MXN';
            $mOCFmt = '$' . number_format((float)($order['montoOrdenCompra'] ?? ($order['monto'] ?? 0)), 2, '.', ',') . ' MXN';
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Orden de Compra generada {$id} — Entrega est. {$fEntEst}",
                'Se ha generado la Orden de Compra de tu pedido',
                "Administración (Daniel Lara) generó la Orden de Compra de tu pedido {$id} («{$estado}») con fecha {$fOC} y fecha estimada de entrega {$fEntEst}. Monto definitivo de la Orden de Compra (único válido descontado del presupuesto mensual del área): {$mOCFmt} (Monto estimado inicial: {$mEstFmt}).",
                'Ver Orden de Compra en Mis Compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Orden de Compra registrada {$id} ({$mOCFmt})",
                'Orden de Compra generada y presupuesto actualizado',
                "Generaste la Orden de Compra del pedido {$id} de {$solicitante} ({$area}) con fecha {$fOC}, entrega estimada {$fEntEst} y monto definitivo {$mOCFmt}.",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            break;

        case 'RECEIVE_ITEMS_ADM':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Artículos recibidos en Administración {$id} (Estado 3)",
                'Tus artículos ya llegaron a Administración',
                "Administración registró que los artículos de tu pedido {$id} fueron recibidos («{$estado}») y están listos para su entrega.",
                'Ver mis compras',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Recepción en Adm. registrada {$id} (Estado 3)",
                'Artículos recibidos en Administración',
                "Se registró el ingreso en Administración del pedido {$id} de {$solicitante} ({$area}).",
                'Gestionar entrega',
                '#admin-tus-compras'
            );
            break;

        case 'DELIVER_TO_REQUESTER':
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Compra entregada {$id} — Evalúa tu recepción (Estado 4)",
                'Tu compra ha sido entregada — Pendiente de tu evaluación',
                "Administración registró la entrega de tu pedido {$id} («{$estado}»). Ingresa a «Tus compras» para cerrar el pedido como Recepción Conforme o Recepción Disconforme.",
                'Evaluar Recepción',
                '#tus-compras'
            );
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Entrega registrada {$id} (Estado 4)",
                'Compra entregada al solicitante',
                "Registraste la entrega del pedido {$id} a {$solicitante} ({$area}). Queda pendiente la evaluación del solicitante.",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            break;

        case 'CONFIRM_CONFORME':
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] Recepción CONFORME {$id} (Estado 5)",
                'El solicitante confirmó Recepción Conforme',
                "El solicitante {$solicitante} ({$area}) cerró el pedido {$id} como «{$estado}».",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Pedido cerrado con conformidad {$id} (Estado 5)",
                'Recepción Conforme registrada',
                "Se ha registrado tu cierre de «{$estado}» para el pedido {$id}.",
                'Ver mis compras',
                '#tus-compras'
            );
            break;

        case 'CONFIRM_DISCONFORME':
            $enqueue(
                'admin',
                CIARM_TUS_COMPRAS_ADMIN_EMAIL,
                "[Portal CIARM · Tus Compras] ALERTA: Recepción DISCONFORME en pedido {$id} (Estado 5)",
                'El solicitante reportó Recepción Disconforme',
                "El solicitante {$solicitante} ({$area}) cerró el pedido {$id} como «{$estado}». Revisa las observaciones registradas.",
                'Atender en panel de compras',
                '#admin-tus-compras'
            );
            $enqueue(
                'solicitante',
                $correoSolicitante,
                "[Portal CIARM · Tus Compras] Recepción Disconforme registrada {$id} (Estado 5)",
                'Se registró tu reporte de disconformidad',
                "Hemos registrado tu cierre como «{$estado}» en el pedido {$id} y notificado a Administración.",
                'Ver mis compras',
                '#tus-compras'
            );
            break;
    }

    if ($event !== 'CREATE' && $event !== 'APPROVE_CAPEX') {
        foreach ($extraAdminEmails as $admExtra) {
            $enqueue(
                'admin',
                $admExtra,
                "[Portal CIARM · Tus Compras] Cambio de estado en pedido {$id} ({$estado})",
                'Actualización de estado en pedido de compra',
                "El pedido {$id} de {$solicitante} ({$area}) por {$montoFmt} cambió al estado «{$estado}».",
                'Ver panel de compras',
                '#admin-tus-compras'
            );
        }
    }

    return $messages;
}

function ciarm_tus_compras_render_email(array $msg, array $order): string {
    $esc = static fn(mixed $s): string => htmlspecialchars((string)($s ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $montoEst = (float)($order['montoEstimado'] ?? ($order['monto'] ?? 0));
    $montoOC = (float)($order['montoOrdenCompra'] ?? 0);
    $montoEstFmt = '$' . number_format($montoEst, 2, '.', ',') . ' MXN';
    $montoOCFmt = $montoOC > 0 ? ('$' . number_format($montoOC, 2, '.', ',') . ' MXN (Válido para presupuesto)') : 'Pendiente de Orden de Compra';
    $acumFmt = '$' . number_format((float)($order['acumuladoMesArea'] ?? 0), 2, '.', ',') . ' MXN';
    $rows = [
        ['Folio del Pedido', $order['id'] ?? ''],
        ['Estado Actual', $order['estado'] ?? ''],
        ['Tipo de Compra', ($order['tipo'] ?? 'OPEX') . (!empty($order['requiereAprobacion']) ? ' (Sujeto a aprobación)' : ' (Gestión directa Opex)')],
        ['Monto Estimado (Solicitante)', $montoEstFmt],
        ['Monto Orden de Compra (Válido)', $montoOCFmt],
        ['Acumulado Mensual Área', $acumFmt . ' (Sin monto límite por área)'],
        ['Solicitante', ($order['solicitante'] ?? '') . (!empty($order['area']) ? ' (' . $order['area'] . ')' : '')],
        ['Encargado Administración', $order['responsableAdm'] ?? 'Daniel Lara'],
        ['Artículos / Descripción', $order['descripcion'] ?? ''],
    ];
    if (!empty($order['fechaCierreCotizacion'])) {
        $rows[] = ['Fecha Est. Cierre Cotizaciones', $order['fechaCierreCotizacion']];
    }
    if (!empty($order['fechaRecepcionCotizacion'])) {
        $rows[] = ['Fecha Recepción Cotizaciones', $order['fechaRecepcionCotizacion']];
    }
    if (!empty($order['fechaOrdenCompra'])) {
        $rows[] = ['Fecha Generación Orden de Compra', $order['fechaOrdenCompra']];
    }
    if (!empty($order['fechaEntregaEstimada'])) {
        $rows[] = ['Fecha Estimada de Entrega', $order['fechaEntregaEstimada']];
    }
    if (!empty($order['justificacion'])) {
        $rows[] = ['Justificación / Referencia', $order['justificacion']];
    }
    if (!empty($order['aprobador'])) {
        $rows[] = ['Aprobación', $order['aprobador']];
    }
    if (!empty($msg['comment'])) {
        $rows[] = ['Observaciones / Comentario', $msg['comment']];
    }
    $htmlRows = '';
    foreach ($rows as $r) {
        $htmlRows .= '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;width:38%;">'
            . $esc($r[0]) . '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">'
            . $esc($r[1]) . '</td></tr>';
    }

    $attachmentItems = [];
    if (!empty($order['adjuntoDetalle'])) {
        $attachmentItems[] = '<li style="margin-bottom:6px;"><a href="' . $esc($order['adjuntoDetalle']) . '" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:700;text-decoration:underline;">📎 Abrir Detalle del pedido (Solicitante)</a></li>';
    }
    if (!empty($order['adjuntoCotizacionPreliminar'])) {
        $attachmentItems[] = '<li style="margin-bottom:6px;"><a href="' . $esc($order['adjuntoCotizacionPreliminar']) . '" target="_blank" rel="noopener noreferrer" style="color:#b45309;font-weight:700;text-decoration:underline;">📄 Abrir Cotización preliminar de referencia (Solicitante)</a></li>';
    }
    if (!empty($order['adjuntoCotizacionesAdm'])) {
        $cotUrls = array_filter(array_map('trim', explode('|', (string)$order['adjuntoCotizacionesAdm'])));
        foreach ($cotUrls as $idx => $u) {
            $suffix = count($cotUrls) > 1 ? ' #' . ($idx + 1) : '';
            $attachmentItems[] = '<li style="margin-bottom:6px;"><a href="' . $esc($u) . '" target="_blank" rel="noopener noreferrer" style="color:#15803d;font-weight:700;text-decoration:underline;">📑 Abrir Cotizaciones Administración' . $esc($suffix) . '</a></li>';
        }
    }
    if ($attachmentItems === [] && !empty($order['adjuntos'])) {
        $rawAdj = trim((string)$order['adjuntos']);
        if (str_starts_with($rawAdj, 'http')) {
            $attachmentItems[] = '<li style="margin-bottom:6px;"><a href="' . $esc($rawAdj) . '" target="_blank" rel="noopener noreferrer" style="color:#1e3a8a;font-weight:700;text-decoration:underline;">📎 Abrir archivo adjunto</a></li>';
        }
    }
    $htmlAttachments = '';
    if ($attachmentItems !== []) {
        $htmlAttachments = '<div style="margin:14px 0 16px;padding:12px 14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">'
            . '<div style="font-weight:700;color:#1e293b;font-size:13.5px;margin-bottom:6px;">Archivos Adjuntos del Pedido:</div>'
            . '<ul style="margin:0;padding-left:18px;font-size:13.5px;">' . implode('', $attachmentItems) . '</ul>'
            . '</div>';
    }

    return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#ffffff;">'
        . '<div style="background:#1e3a8a;color:#ffffff;padding:16px 20px;"><span style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;">Portal CIARM · Tus Compras</span><h2 style="margin:6px 0 0;font-size:18px;">' . $esc($msg['heading']) . '</h2></div>'
        . '<div style="padding:20px;"><p style="margin:0 0 16px;color:#1e293b;line-height:1.5;">' . $esc($msg['intro']) . '</p>'
        . '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">' . $htmlRows . '</table>'
        . $htmlAttachments
        . '<div style="margin-top:20px;"><a href="' . $esc($msg['ctaUrl']) . '" style="display:inline-block;background:#26487F;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">' . $esc($msg['ctaLabel']) . '</a></div>'
        . '</div><div style="background:#f8fafc;padding:12px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">Notificación automática del Módulo Tus Compras CIARM (' . $esc($order['id'] ?? '') . ').</div></div>';
}

function ciarm_tus_compras_notify_upload_failure(array $access, string $fileName, string $reason): void {
    $webAppUrl = ciarm_tus_compras_active_webapp();
    if ($webAppUrl === '') {
        return;
    }
    $actorEmail = strtolower(trim((string)($access['correo'] ?? '')));
    $actorName = trim((string)($access['nombre'] ?? $actorEmail));
    $area = trim((string)($access['area'] ?? ''));
    $esc = static fn(mixed $s): string => htmlspecialchars((string)($s ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $subject = "[Portal CIARM · Tus Compras] Error al adjuntar archivo «{$fileName}»";
    $html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #fecaca;border-radius:10px;overflow:hidden;background:#ffffff;">'
        . '<div style="background:#991b1b;color:#ffffff;padding:14px 18px;"><h2 style="margin:0;font-size:17px;">No se pudo cargar el archivo adjunto en Tus Compras</h2></div>'
        . '<div style="padding:18px;color:#1e293b;font-size:14px;line-height:1.5;">'
        . '<p>El sistema detectó un fallo al intentar subir un archivo adjunto en el módulo <strong>Tus compras</strong>:</p>'
        . '<ul>'
        . '<li><strong>Usuario:</strong> ' . $esc($actorName) . ' (' . $esc($actorEmail) . ') — ' . $esc($area) . '</li>'
        . '<li><strong>Archivo:</strong> ' . $esc($fileName) . '</li>'
        . '<li><strong>Motivo:</strong> ' . $esc($reason) . '</li>'
        . '</ul>'
        . '<p>La operación fue detenida preventivamente para evitar que el pedido o cambio de estado quedara registrado sin su archivo de respaldo. Por favor verifica que el archivo sea PDF o imagen menor a 10 MB e intenta nuevamente.</p>'
        . '</div></div>';

    $messages = [];
    if ($actorEmail !== '' && filter_var($actorEmail, FILTER_VALIDATE_EMAIL)) {
        $messages[] = [
            'role' => 'usuario',
            'to' => $actorEmail,
            'subject' => $subject,
            'text' => "No se pudo cargar el archivo adjunto {$fileName} en Tus Compras ({$reason}).",
            'html' => $html,
        ];
    }
    if ($actorEmail !== CIARM_TUS_COMPRAS_ADMIN_EMAIL) {
        $messages[] = [
            'role' => 'admin',
            'to' => CIARM_TUS_COMPRAS_ADMIN_EMAIL,
            'subject' => $subject,
            'text' => "El usuario {$actorName} ({$actorEmail}) tuvo un error al subir {$fileName}: {$reason}.",
            'html' => $html,
        ];
    }
    if ($messages === []) {
        return;
    }
    try {
        @ciarm_http_json($webAppUrl, [
            'post' => true,
            'headers' => ['Accept: application/json', 'Content-Type: application/json'],
            'body' => json_encode([
                'action' => 'sendNotifications',
                'orderId' => 'UPLOAD-ERR',
                'event' => 'UPLOAD_FAILURE',
                'messages' => $messages,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'timeout' => 12,
        ]);
    } catch (Throwable $ignored) {
    }
}

function ciarm_tus_compras_active_webapp(?string $host = null): string {
    $isProd = ciarm_tickets_is_production_host($host);
    $envVar = getenv($isProd ? 'CIARM_TUS_COMPRAS_PROD_WEBAPP' : 'CIARM_TUS_COMPRAS_STAGING_WEBAPP');
    if (is_string($envVar) && str_starts_with(trim($envVar), 'https://script.google.com/macros/s/')) {
        return trim($envVar);
    }
    $constUrl = $isProd ? CIARM_TUS_COMPRAS_PROD_WEBAPP : CIARM_TUS_COMPRAS_STAGING_WEBAPP;
    if ($constUrl !== '' && str_starts_with($constUrl, 'https://script.google.com/macros/s/')) {
        return $constUrl;
    }
    $detected = (string)($GLOBALS['ciarm_tus_compras_detected_webapp'] ?? '');
    if ($detected !== '' && str_starts_with($detected, 'https://script.google.com/macros/s/')) {
        return $detected;
    }
    return '';
}

function ciarm_tus_compras_dispatch_notifications(string $event, array $order, string $comment = '', ?callable $mailer = null, array $extraAdminEmails = []): array {
    $messages = ciarm_tus_compras_build_notification_plan($event, $order, $comment, $extraAdminEmails);
    $deliveries = [];

    // 1. Intentar envío prioritario mediante Google Apps Script WebApp (MailApp.sendEmail en Google Workspace)
    $webAppUrl = $mailer === null ? ciarm_tus_compras_active_webapp() : '';
    if ($webAppUrl !== '' && count($messages) > 0) {
        $gasMessages = [];
        foreach ($messages as $msg) {
            $gasMessages[] = [
                'role' => $msg['role'],
                'to' => $msg['to'],
                'subject' => $msg['subject'],
                'text' => $msg['intro'],
                'html' => ciarm_tus_compras_render_email($msg, $order),
            ];
        }
        try {
            $gasRes = ciarm_http_json($webAppUrl, [
                'post' => true,
                'headers' => ['Accept: application/json', 'Content-Type: application/json'],
                'body' => json_encode([
                    'action' => 'sendNotifications',
                    'orderId' => $order['id'] ?? '',
                    'event' => $event,
                    'messages' => $gasMessages,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'timeout' => 20,
            ]);
            if ($gasRes['status'] === 200 && ($gasRes['body']['ok'] ?? false) === true && is_array($gasRes['body']['deliveries'] ?? null)) {
                $deliveries = $gasRes['body']['deliveries'];
                $sentCount = count(array_filter($deliveries, static fn($d) => ($d['status'] ?? '') === 'ENVIADO'));
                $errCount = count(array_filter($deliveries, static fn($d) => ($d['status'] ?? '') === 'ERROR'));
                $overall = count($deliveries) === 0 ? 'OMITIDO' : ($errCount === 0 ? 'ENVIADO' : ($sentCount > 0 ? 'PARCIAL' : 'ERROR'));
                $rcptSummary = implode(', ', array_map(static fn($d) => ($d['to'] ?? '') . ':' . ($d['status'] ?? '') . '[GAS]', $deliveries));
                return [
                    'event' => $event,
                    'status' => $rcptSummary !== '' ? ($overall . ' (' . $rcptSummary . ')') : $overall,
                    'overallStatus' => $overall,
                    'via' => 'gas-mailapp',
                    'deliveries' => $deliveries,
                ];
            }
        } catch (Throwable $gasErr) {
            error_log('Tus Compras GAS MailApp fallback: ' . $gasErr->getMessage());
        }
    }
    $sendFn = $mailer ?? static function (string $to, string $subject, string $html): array {
        $mx = ciarm_ticket_smtp_mx_send($to, $subject, $html, 'smtp.google.com', 25);
        if (($mx['ok'] ?? false) === true) {
            return ['ok' => true, 'via' => 'smtp-google-mx'];
        }
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $fromName = '=?UTF-8?B?' . base64_encode('Portal CIARM — Tus Compras') . '?=';
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            "From: {$fromName} <no-reply@ciarm.edu.mx>",
            'Reply-To: no-reply@ciarm.edu.mx',
            'X-Mailer: Portal-CIARM-TusCompras/1.0',
        ]);
        $mailOk = @mail($to, $encodedSubject, chunk_split(base64_encode($html)), $headers, '-fno-reply@ciarm.edu.mx');
        return ['ok' => $mailOk, 'via' => 'php-mail', 'mxError' => $mx['error'] ?? ''];
    };

    foreach ($messages as $msg) {
        $html = ciarm_tus_compras_render_email($msg, $order);
        try {
            $res = $sendFn($msg['to'], $msg['subject'], $html);
            $ok = is_array($res) ? (bool)($res['ok'] ?? false) : (bool)$res;
            $deliveries[] = [
                'role' => $msg['role'],
                'to' => $msg['to'],
                'subject' => $msg['subject'],
                'status' => $ok ? 'ENVIADO' : 'ERROR',
                'via' => is_array($res) ? ($res['via'] ?? 'php') : 'php',
            ];
        } catch (Throwable $e) {
            $deliveries[] = [
                'role' => $msg['role'],
                'to' => $msg['to'],
                'subject' => $msg['subject'],
                'status' => 'ERROR',
                'error' => $e->getMessage(),
            ];
        }
    }

    $sentCount = count(array_filter($deliveries, static fn($d) => ($d['status'] ?? '') === 'ENVIADO'));
    $errCount = count(array_filter($deliveries, static fn($d) => ($d['status'] ?? '') === 'ERROR'));
    $overall = count($deliveries) === 0 ? 'OMITIDO' : ($errCount === 0 ? 'ENVIADO' : ($sentCount > 0 ? 'PARCIAL' : 'ERROR'));
    $rcptSummary = implode(', ', array_map(static fn($d) => ($d['to'] ?? '') . ':' . ($d['status'] ?? ''), $deliveries));

    return [
        'event' => $event,
        'status' => $rcptSummary !== '' ? ($overall . ' (' . $rcptSummary . ')') : $overall,
        'overallStatus' => $overall,
        'deliveries' => $deliveries,
    ];
}

function ciarm_tus_compras_sanitize_cell(string $val): string {
    $trimmed = trim($val);
    if ($trimmed !== '' && preg_match('/^[=+@\x27-]/', $trimmed) === 1) {
        return "\u{200B}" . $trimmed;
    }
    return $trimmed;
}

function ciarm_tus_compras_order_to_row(array $order): array {
    $montoEst = (float)($order['montoEstimado'] ?? ($order['monto'] ?? 0));
    $montoOC = (float)($order['montoOrdenCompra'] ?? 0);
    return [
        (string)($order['id'] ?? ''),
        (string)($order['fecha'] ?? ''),
        (string)($order['hora'] ?? ''),
        ciarm_tus_compras_sanitize_cell((string)($order['solicitante'] ?? '')),
        strtolower(trim((string)($order['correo'] ?? ''))),
        ciarm_tus_compras_sanitize_cell((string)($order['area'] ?? '')),
        strtoupper((string)($order['tipo'] ?? 'OPEX')) === 'CAPEX' ? 'CAPEX' : 'OPEX',
        number_format($montoEst, 2, '.', ''),
        number_format((float)($order['acumuladoMesArea'] ?? 0), 2, '.', ''),
        !empty($order['requiereAprobacion']) ? 'SÍ' : 'NO',
        ciarm_tus_compras_sanitize_cell((string)($order['descripcion'] ?? '')),
        ciarm_tus_compras_sanitize_cell((string)($order['justificacion'] ?? '')),
        (string)($order['estado'] ?? CIARM_TUS_COMPRAS_STATE_ENVIADA),
        ciarm_tus_compras_sanitize_cell((string)($order['responsableAdm'] ?? 'Daniel Lara')),
        ciarm_tus_compras_sanitize_cell((string)($order['aprobador'] ?? '')),
        (string)($order['fechaAprobacion'] ?? ''),
        ciarm_tus_compras_sanitize_cell((string)($order['comentarioAprobacion'] ?? '')),
        (string)($order['fechaRecepcionAdm'] ?? ''),
        (string)($order['fechaEntrega'] ?? ''),
        (string)($order['evaluacion'] ?? ''),
        ciarm_tus_compras_sanitize_cell((string)($order['comentarioRecepcion'] ?? '')),
        ciarm_tus_compras_sanitize_cell((string)($order['adjuntos'] ?? '')),
        (string)($order['ultimaActualizacion'] ?? ''),
        (string)($order['version'] ?? 'v1'),
        $montoOC > 0 ? number_format($montoOC, 2, '.', '') : '',
        (string)($order['fechaCierreCotizacion'] ?? ''),
        (string)($order['fechaRecepcionCotizacion'] ?? ''),
        (string)($order['fechaOrdenCompra'] ?? ''),
        (string)($order['fechaEntregaEstimada'] ?? ''),
        ciarm_tus_compras_sanitize_cell((string)($order['adjuntoDetalle'] ?? '')),
        ciarm_tus_compras_sanitize_cell((string)($order['adjuntoCotizacionPreliminar'] ?? '')),
        ciarm_tus_compras_sanitize_cell((string)($order['adjuntoCotizacionesAdm'] ?? '')),
    ];
}

function ciarm_tus_compras_next_folio(array $pedidos, string $year): string {
    $max = 0;
    $prefix = 'CMP-' . $year . '-';
    foreach ($pedidos as $p) {
        $id = (string)($p['id'] ?? '');
        if (str_starts_with($id, $prefix)) {
            $num = (int)substr($id, strlen($prefix));
            if ($num > $max) $max = $num;
        }
    }
    return sprintf('CMP-%s-%05d', $year, $max + 1);
}
