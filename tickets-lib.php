<?php
declare(strict_types=1);
require_once __DIR__ . '/auth-lib.php';
require_once __DIR__ . '/portal-permissions-lib.php';

const CIARM_TICKETS_WEBAPP = 'https://script.google.com/macros/s/AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA/exec';
const CIARM_TICKET_PERMISSIONS_RANGE = "'Permisos de usuario'!A1:M1010";

function ciarm_ticket_permission(array $rows, string $email): bool {
    $email = strtolower(trim($email));
    if (!in_array($email, ['d.lara@ciarm.edu.mx', 'e.conesa@ciarm.edu.mx'], true) || count($rows) < 2) return false;
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
    if (!in_array($email, ['d.lara@ciarm.edu.mx', 'e.conesa@ciarm.edu.mx'], true)) return false;
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
    return $host === 'portal2.ciarm.edu.mx' && $origin === 'https://portal2.ciarm.edu.mx';
}

function ciarm_ticket_envelope(array $sessionUser, string $action, array $payload, string $secret, ?int $issuedAt = null, ?string $nonce = null): array {
    $envelope = json_encode([
        'action' => $action,
        'actor' => strtolower(trim((string)($sessionUser['correo'] ?? ''))),
        'issuedAt' => $issuedAt ?? time(),
        'nonce' => $nonce ?? bin2hex(random_bytes(24)),
        'payload' => $payload,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    return ['envelope' => $envelope, 'signature' => hash_hmac('sha256', $envelope, $secret)];
}

function ciarm_ticket_bridge(array $sessionUser, string $action, array $payload): array {
    $secret = @file_get_contents(ciarm_private_path('tickets-admin.key'));
    if ($secret === false || strlen(trim($secret)) < 32) throw new RuntimeException('not_configured');
    $signed = ciarm_ticket_envelope($sessionUser, $action, $payload, trim($secret));
    $response = ciarm_http_json(CIARM_TICKETS_WEBAPP, [
        'post' => true,
        'headers' => ['Accept: application/json', 'Content-Type: application/json'],
        'body' => json_encode($signed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ]);
    if ($response['status'] !== 200 || !isset($response['body']['ok'])) throw new RuntimeException('upstream');
    return $response['body'];
}
