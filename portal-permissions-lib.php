<?php
declare(strict_types=1);

/**
 * DM03 asigna roles en 'Permisos de usuario'!D.
 * DM05 es la única fuente de permisos efectivos por rol.
 * La caché es temporal y nunca una fuente autoritativa.
 */
require_once __DIR__ . '/auth-lib.php';

const CIARM_DM05_ID = '1h7byucfAaHEcO1hvidLKJUYfWQiS-NKx9-jZ8Jwvk2g';
const CIARM_RBAC_TTL = 60;

function ciarm_rbac_enforced(): bool {
    return getenv('CIARM_DM05_ENFORCE') !== '0';
}

function ciarm_rbac_codes_from_cell(string $text): array {
    $roles = preg_split('/\s*[,;\n]+\s*/', trim($text)) ?: [];
    return array_values(array_unique(array_filter(array_map('trim', $roles))));
}

function ciarm_rbac_values(string $spreadsheetId, string $range, string $token): array {
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($spreadsheetId)
        . '/values/' . rawurlencode($range)
        . '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE';
    $res = ciarm_http_json($url, ['headers' => [
        'Accept: application/json', 'Authorization: Bearer ' . $token
    ]]);
    if ($res['status'] !== 200 || !is_array($res['body']['values'] ?? null)) {
        throw new RuntimeException('rbac_sheet_unavailable');
    }
    return $res['body']['values'];
}

/** Tres tablas de DM05 en una sola solicitud HTTP de Sheets. */
function ciarm_rbac_catalog(string $token): array {
    $ranges = ["'CAT_ROLES'!A4:H100", "'CAT_FUNCIONES'!A4:G250", "'MATRIZ_ACCESOS'!A5:O200"];
    $query = implode('&', array_map(static fn($range) => 'ranges=' . rawurlencode($range), $ranges));
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode(CIARM_DM05_ID)
        . '/values:batchGet?' . $query . '&valueRenderOption=FORMATTED_VALUE';
    $response = ciarm_http_json($url, ['headers' => [
        'Accept: application/json', 'Authorization: Bearer ' . $token
    ]]);
    if ($response['status'] !== 200 || count($response['body']['valueRanges'] ?? []) !== 3) {
        throw new RuntimeException('rbac_catalog_unavailable');
    }
    $catalog = [];
    foreach ($response['body']['valueRanges'] as $valueRange) {
        if (!is_array($valueRange['values'] ?? null)) {
            throw new RuntimeException('rbac_catalog_invalid');
        }
        $catalog[] = $valueRange['values'];
    }
    return $catalog;
}

function ciarm_rbac_service_account(): array {
    $raw = @file_get_contents(ciarm_private_path('service-account.json'));
    if ($raw === false) throw new RuntimeException('rbac_service_account_unavailable');
    $account = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($account)) throw new RuntimeException('rbac_service_account_invalid');
    return $account;
}

/** Contrato: correo único, activo y con códigos explícitos de DM05. */
function ciarm_rbac_user_roles(array $rows, string $email): array {
    if (count($rows) < 2) throw new RuntimeException('rbac_dm03_empty');
    $header = array_map('trim', $rows[0]);
    $cols = [];
    foreach (['Correo Ciarm', 'Status', 'Roles DM05'] as $h) {
        $matches = array_keys($header, $h, true);
        if (count($matches) !== 1) throw new RuntimeException('rbac_dm03_schema');
        $cols[$h] = $matches[0];
    }
    $matches = [];
    foreach (array_slice($rows, 1) as $row) {
        if (strtolower(trim((string)($row[$cols['Correo Ciarm']] ?? ''))) === strtolower(trim($email))) {
            $matches[] = $row;
        }
    }
    if (count($matches) !== 1) throw new RuntimeException('rbac_identity_mismatch');
    $row = $matches[0];
    if (strtolower(trim((string)($row[$cols['Status']] ?? ''))) !== 'activo') {
        throw new RuntimeException('rbac_inactive');
    }
    return ciarm_rbac_codes_from_cell((string)($row[$cols['Roles DM05']] ?? ''));
}

function ciarm_rbac_permissions(array $roles, array $roleRows, array $functionRows, array $matrixRows): array {
    if (count($roleRows) < 2 || count($functionRows) < 2 || count($matrixRows) < 2) {
        throw new RuntimeException('rbac_catalog_empty');
    }
    $activeRoles = [];
    foreach (array_slice($roleRows, 1) as $row) {
        if (trim((string)($row[3] ?? '')) === 'Sí') $activeRoles[(string)($row[0] ?? '')] = true;
    }
    $functions = [];
    foreach (array_slice($functionRows, 1) as $row) {
        $code = trim((string)($row[0] ?? ''));
        if ($code !== '') $functions[$code] = [
            'parent' => trim((string)($row[5] ?? '')),
            'type' => trim((string)($row[6] ?? ''))
        ];
    }
    $columns = array_map('trim', $matrixRows[0]);
    if (($columns[0] ?? '') !== 'Código función') throw new RuntimeException('rbac_matrix_schema');
    $rowsByCode = [];
    foreach (array_slice($matrixRows, 1) as $row) {
        $code = trim((string)($row[0] ?? ''));
        if ($code !== '' && isset($functions[$code])) $rowsByCode[$code] = $row;
    }

    $allowed = [];
    foreach (array_unique($roles) as $role) {
        if (!isset($activeRoles[$role])) continue;
        $column = array_search($role, $columns, true);
        if ($column === false) throw new RuntimeException('rbac_role_missing_from_matrix');
        foreach ($rowsByCode as $code => $row) {
            $meta = $functions[$code];
            if ($meta['type'] === 'INTERNA') continue;
            $yes = (($row[$column] ?? false) === true || strtoupper(trim((string)($row[$column] ?? ''))) === 'TRUE');
            if (!$yes) continue;
            if ($meta['type'] !== 'TARJETA') {
                $parent = $meta['parent'];
                if ($parent === '' || !isset($functions[$parent]) ||
                    (($rowsByCode[$parent][$column] ?? false) !== true && strtoupper(trim((string)($rowsByCode[$parent][$column] ?? ''))) !== 'TRUE')) continue;
            }
            $allowed[$code] = true;
        }
    }
    return array_keys($allowed);
}

/** Sesión + caché privada compartida: evita consultas por tarjeta o botón. */
function ciarm_rbac_effective(array $sessionUser, bool $preflight = false): array {
    if (!ciarm_rbac_enforced() && !$preflight) return ['verified' => false, 'enforced' => false, 'codes' => []];
    $email = strtolower(trim((string)($sessionUser['correo'] ?? '')));
    if ($email === '') throw new RuntimeException('rbac_no_identity');

    $sessionCache = $_SESSION['ciarm_rbac'] ?? null;
    if (is_array($sessionCache) &&
        ($sessionCache['email'] ?? null) === $email &&
        (int)($sessionCache['expiry'] ?? 0) > time() &&
        is_array($sessionCache['codes'] ?? null)) {
        return ['verified' => true, 'enforced' => ciarm_rbac_enforced(), 'codes' => $sessionCache['codes']];
    }

    $account = ciarm_rbac_service_account();
    $token = ciarm_google_access_token($account);
    $roleRows = ciarm_rbac_values(CIARM_DM03_SPREADSHEET_ID, "'Permisos de usuario'!B1:D1000", $token);
    $roles = ciarm_rbac_user_roles($roleRows, $email);

    $catalogPath = ciarm_private_path('dm05-catalog-cache.json');
    $catalog = null;
    if (is_file($catalogPath) && (time() - (int)filemtime($catalogPath)) < CIARM_RBAC_TTL) {
        $decoded = json_decode((string)@file_get_contents($catalogPath), true);
        if (is_array($decoded) && count($decoded) === 3) $catalog = $decoded;
    }
    if ($catalog === null) {
        $catalog = ciarm_rbac_catalog($token);
        $temporary = $catalogPath . '.' . bin2hex(random_bytes(6)) . '.tmp';
        if (@file_put_contents($temporary, json_encode($catalog, JSON_THROW_ON_ERROR), LOCK_EX) !== false) {
            @chmod($temporary, 0600);
            @rename($temporary, $catalogPath);
        }
    }
    $codes = ciarm_rbac_permissions($roles, $catalog[0], $catalog[1], $catalog[2]);
    $_SESSION['ciarm_rbac'] = ['email' => $email, 'expiry' => time() + CIARM_RBAC_TTL, 'codes' => $codes];
    return ['verified' => true, 'enforced' => ciarm_rbac_enforced(), 'codes' => $codes];
}

function ciarm_rbac_has_function(array $sessionUser, string $code): bool {
    return in_array($code, ciarm_rbac_effective($sessionUser)['codes'], true);
}
