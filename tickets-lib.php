<?php
declare(strict_types=1);
require_once __DIR__ . '/auth-lib.php';
require_once __DIR__ . '/portal-permissions-lib.php';

const CIARM_TICKETS_WEBAPP = 'https://script.google.com/macros/s/AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA/exec';
const CIARM_TICKETS_PROD_WEBAPP = 'https://script.google.com/macros/s/AKfycbw9GAh1DLebjwnDviClopsEdmGyFeeZFz4mmj_lJMF3byuadI17X1GS0jyC5tsqLK68/exec';
const CIARM_TICKETS_ALLOWED_HOSTS = ['portal2.ciarm.edu.mx', 'portal.ciarm.edu.mx', 'portal.ciarm.mx'];
const CIARM_TICKET_PERMISSIONS_RANGE = "'Permisos de usuario'!A1:M1010";

function ciarm_tickets_is_production_host(?string $host = null): bool {
    $raw = $host ?? (string)($_SERVER['HTTP_HOST'] ?? '');
    $clean = strtolower(explode(':', trim($raw), 2)[0]);
    return in_array($clean, ['portal.ciarm.edu.mx', 'portal.ciarm.mx'], true);
}

function ciarm_tickets_env_config(?string $host = null): array {
    $isProd = ciarm_tickets_is_production_host($host);
    $raw = @file_get_contents(ciarm_private_path('tickets-env.json'));
    $stored = $raw === false ? [] : json_decode($raw, true);
    $envKey = $isProd ? 'production' : 'staging';
    $branch = (is_array($stored) && is_array($stored[$envKey] ?? null)) ? $stored[$envKey] : [];
    $defaultWebapp = $isProd ? CIARM_TICKETS_PROD_WEBAPP : CIARM_TICKETS_WEBAPP;
    $envWebapp = getenv($isProd ? 'CIARM_TICKETS_PROD_WEBAPP' : 'CIARM_TICKETS_STAGING_WEBAPP');
    $webapp = (is_string($envWebapp) && $envWebapp !== '') ? $envWebapp : (string)($branch['webapp'] ?? $defaultWebapp);
    $envSheet = getenv($isProd ? 'CIARM_TICKETS_PROD_SHEET_ID' : 'CIARM_TICKETS_STAGING_SHEET_ID');
    $sheetId = (is_string($envSheet) && $envSheet !== '') ? $envSheet : (string)($branch['sheetId'] ?? '');
    $cleanHost = strtolower(explode(':', trim($host ?? (string)($_SERVER['HTTP_HOST'] ?? '')), 2)[0]);
    $baseUrl = in_array($cleanHost, CIARM_TICKETS_ALLOWED_HOSTS, true)
        ? ('https://' . $cleanHost)
        : ($isProd ? 'https://portal.ciarm.edu.mx' : 'https://portal2.ciarm.edu.mx');
    return ['env' => $envKey, 'isProduction' => $isProd, 'webapp' => $webapp, 'sheetId' => $sheetId, 'baseUrl' => $baseUrl];
}

function ciarm_tickets_active_webapp(?string $host = null): string {
    return ciarm_tickets_env_config($host)['webapp'];
}

function ciarm_tickets_active_base_url(?string $host = null): string {
    return ciarm_tickets_env_config($host)['baseUrl'];
}

function ciarm_tickets_active_sheet_id(?string $host = null): string {
    $cfg = ciarm_tickets_env_config($host);
    if (!empty($cfg['sheetId'])) return (string)$cfg['sheetId'];
    return !empty($cfg['isProduction'])
        ? '104dJVUe63EF-BlEMniiBkzP7O8lQE4QxJJQOiJgvibA'
        : '1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs';
}

function ciarm_ticket_permission(array $rows, string $email): bool {
    $email = strtolower(trim($email));
    if (!in_array($email, ['d.lara@ciarm.edu.mx', 'e.conesa@ciarm.edu.mx', 'r.valencia@ciarm.edu.mx'], true) || count($rows) < 2) return false;
    $headers = array_map(static fn($v) => trim((string)$v), $rows[0]);
    $indexes = [];
    foreach (['Correo Ciarm', 'Status', 'Sistema de tickets'] as $header) {
        $matches = array_keys($headers, $header, true);
        if (count($matches) !== 1) return false;
        $indexes[$header] = $matches[0];
    }
    $matches = array_values(array_filter(array_slice($rows, 1), static fn($row) => strtolower(trim((string)($row[$indexes['Correo Ciarm']] ?? ''))) === $email));
    return count($matches) === 1
        && strtolower(trim((string)($matches[0][$indexes['Status']] ?? ''))) === 'activo'
        && trim((string)($matches[0][$indexes['Sistema de tickets']] ?? '')) === 'Administrador';
}

function ciarm_ticket_current_permission(array $sessionUser): bool {
    if (ciarm_rbac_enforced()) {
        return ciarm_rbac_has_function($sessionUser, 'INT_GESTION');
    }
    $email = strtolower(trim((string)($sessionUser['correo'] ?? '')));
    if (!in_array($email, ['d.lara@ciarm.edu.mx', 'e.conesa@ciarm.edu.mx', 'r.valencia@ciarm.edu.mx'], true)) return false;
    $raw = @file_get_contents(ciarm_private_path('service-account.json'));
    if ($raw === false) throw new RuntimeException('permission_unavailable');
    $account = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($account)) throw new RuntimeException('permission_unavailable');
    $token = ciarm_google_access_token($account);
    $response = ciarm_http_json('https://sheets.googleapis.com/v4/spreadsheets/' . CIARM_DM03_SPREADSHEET_ID . '/values/' . rawurlencode(CIARM_TICKET_PERMISSIONS_RANGE), [
        'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
    ]);
    if ($response['status'] !== 200) throw new RuntimeException('permission_unavailable');
    return ciarm_ticket_permission($response['body']['values'] ?? [], $email);
}

function ciarm_ticket_context(array $sessionUser): array {
    $canAdmin = ciarm_ticket_current_permission($sessionUser);
    if (!$canAdmin) return ['canAdmin' => false];
    if (empty($_SESSION['ciarm_ticket_csrf'])) $_SESSION['ciarm_ticket_csrf'] = bin2hex(random_bytes(32));
    return ['canAdmin' => true, 'csrfToken' => $_SESSION['ciarm_ticket_csrf']];
}

function ciarm_ticket_csrf_valid(string $stored, string $received): bool {
    return $stored !== '' && $received !== '' && hash_equals($stored, $received);
}

function ciarm_ticket_origin_valid(string $origin, string $host): bool {
    $cleanHost = strtolower(explode(':', trim($host), 2)[0]);
    return in_array($cleanHost, CIARM_TICKETS_ALLOWED_HOSTS, true)
        && $origin === 'https://' . $cleanHost;
}

function ciarm_ticket_envelope(array $sessionUser, string $action, array $payload, string $secret, ?int $issuedAt = null, ?string $nonce = null, bool $perfProbe = false): array {
    $email = strtolower(trim((string)($sessionUser['correo'] ?? '')));
    $actor = $email !== '' ? $email : 'd.lara@ciarm.edu.mx';
    $data = [
        'action' => $action,
        'actor' => $actor,
        'issuedAt' => $issuedAt ?? time(),
        'nonce' => $nonce ?? bin2hex(random_bytes(24)),
        'payload' => $payload,
    ];
    $sheetId = ciarm_tickets_active_sheet_id();
    if ($sheetId !== '') {
        $data['spreadsheetId'] = $sheetId;
    }
    $baseUrl = ciarm_tickets_active_base_url();
    if ($baseUrl !== '') {
        $data['portalBaseUrl'] = $baseUrl;
    }
    if ($perfProbe) $data['perfProbe'] = true;
    $envelope = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    return ['envelope' => $envelope, 'signature' => hash_hmac('sha256', $envelope, $secret)];
}

function ciarm_ticket_bridge(array $sessionUser, string $action, array $payload, bool $perfProbe = false): array {
    $secret = @file_get_contents(ciarm_private_path('tickets-admin.key'));
    if ($secret === false || strlen(trim($secret)) < 32) throw new RuntimeException('not_configured');
    $signed = ciarm_ticket_envelope($sessionUser, $action, $payload, trim($secret), null, null, $perfProbe);
    $response = ciarm_http_json(ciarm_tickets_active_webapp(), [
        'post' => true,
        'headers' => ['Accept: application/json', 'Content-Type: application/json'],
        'body' => json_encode($signed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ]);
    if ($response['status'] !== 200 || !isset($response['body']['ok'])) throw new RuntimeException('upstream');
    return $response['body'];
}
