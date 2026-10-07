<?php
declare(strict_types=1);

/**
 * Diagnóstico temporal de Voiceflow para Portal CIARM.
 * NO devuelve secretos. Se elimina después de validar.
 */

require_once __DIR__ . '/auth-lib.php';

const VF_BASE = 'https://general-runtime.voiceflow.com';
const VF_PROJECT = '6a81e72529695cfeb738ad6e';
const VF_ENV = 'main';

function vf_probe_post(string $url, string $authorization, array $payload): array {
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'status' => 0, 'body' => ['error' => 'curl_init_failed']];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'authorization: ' . $authorization,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $error !== '') {
        return ['ok' => false, 'status' => $status, 'body' => ['error' => 'upstream_unreachable']];
    }

    $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$raw) ?? '';
    $decoded = json_decode($cleaned, true);

    return [
        'ok' => $status >= 200 && $status < 300 && is_array($decoded),
        'status' => $status,
        'body' => is_array($decoded) ? $decoded : ['error' => 'invalid_json'],
    ];
}

$tokenRaw = @file_get_contents(ciarm_private_path('voiceflow-access-token.txt'));
$token = $tokenRaw === false ? '' : trim($tokenRaw);

if ($token === '') {
    ciarm_json_response(503, ['ok' => false, 'stage' => 'token', 'error' => 'missing']);
}

$userID = 'portal-health-' . bin2hex(random_bytes(6));

$start = vf_probe_post(
    VF_BASE . '/v4/project/' . rawurlencode(VF_PROJECT) . '/environment/' . rawurlencode(VF_ENV) . '/session',
    $token,
    ['userID' => $userID]
);

if (!$start['ok']) {
    ciarm_json_response(502, [
        'ok' => false,
        'stage' => 'start_session',
        'http' => $start['status'],
        'error' => (string)($start['body']['message'] ?? $start['body']['error'] ?? 'unknown'),
    ]);
}

$sessionKey = trim((string)($start['body']['sessionKey'] ?? ''));
if ($sessionKey === '') {
    ciarm_json_response(502, ['ok' => false, 'stage' => 'session_key', 'http' => $start['status']]);
}

$launch = vf_probe_post(
    VF_BASE . '/v4/interact',
    $sessionKey,
    ['action' => ['type' => 'launch'], 'config' => ['userTimezone' => 'America/Cancun']]
);

if (!$launch['ok']) {
    ciarm_json_response(502, [
        'ok' => false,
        'stage' => 'launch',
        'http' => $launch['status'],
        'error' => (string)($launch['body']['message'] ?? $launch['body']['error'] ?? 'unknown'),
    ]);
}

$text = vf_probe_post(
    VF_BASE . '/v4/interact',
    $sessionKey,
    ['action' => ['type' => 'text', 'payload' => 'Hola'], 'config' => ['userTimezone' => 'America/Cancun']]
);

if (!$text['ok']) {
    ciarm_json_response(502, [
        'ok' => false,
        'stage' => 'text',
        'http' => $text['status'],
        'error' => (string)($text['body']['message'] ?? $text['body']['error'] ?? 'unknown'),
    ]);
}

$traces = $text['body']['traces'] ?? [];
ciarm_json_response(200, [
    'ok' => true,
    'start_http' => $start['status'],
    'launch_http' => $launch['status'],
    'text_http' => $text['status'],
    'trace_count' => is_array($traces) ? count($traces) : 0,
]);
