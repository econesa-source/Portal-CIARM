<?php
declare(strict_types=1);

/**
 * Portal CIARM — proxy server-side para Asistente CIARM / Voiceflow.
 * Voiceflow queda oculto detrás de la interfaz propia del Portal.
 * Conversaciones API v4: API key -> sessionKey -> interact.
 */

require_once __DIR__ . '/auth-lib.php';

const CIARM_VOICEFLOW_BASE = 'https://general-runtime.voiceflow.com';
const CIARM_VOICEFLOW_PROJECT_ID = '6a81e72529695cfeb738ad6e';
const CIARM_VOICEFLOW_ENVIRONMENT = 'main';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ciarm_json_response(405, ['error' => 'method_not_allowed']);
}

$user = ciarm_session_user();
if (!$user) {
    ciarm_json_response(401, ['error' => 'La sesión institucional no es válida.']);
}

$tokenRaw = @file_get_contents(ciarm_private_path('voiceflow-access-token.txt'));
$token = $tokenRaw === false ? '' : trim($tokenRaw);
if ($token === '') {
    ciarm_json_response(503, ['error' => 'El Asistente CIARM no está configurado.']);
}

$raw = (string)file_get_contents('php://input');
$request = json_decode($raw, true);
if (!is_array($request)) {
    ciarm_json_response(400, ['error' => 'La solicitud no pudo procesarse.']);
}

$message = trim((string)($request['message'] ?? ''));
$conversationID = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($request['conversationID'] ?? '')) ?? '';
$conversationID = substr($conversationID, 0, 80);
$launch = ($request['launch'] ?? false) === true;

if ($message === '' || $conversationID === '') {
    ciarm_json_response(400, ['error' => 'Escribí un mensaje para el Asistente CIARM.']);
}

function ciarm_voiceflow_post(string $url, string $authorization, array $payload): array {
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('voiceflow_curl_init_failed');
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
        CURLOPT_POSTFIELDS => json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        ),
    ]);

    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false || $error !== '') {
        throw new RuntimeException('voiceflow_upstream_unreachable');
    }

    $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$body) ?? '';
    $decoded = json_decode($cleaned, true);

    if ($status < 200 || $status >= 300) {
        error_log('Portal CIARM Voiceflow HTTP ' . $status . ': ' . substr($cleaned, 0, 500));
        throw new RuntimeException('voiceflow_http_' . $status);
    }

    if (!is_array($decoded)) {
        throw new RuntimeException('voiceflow_invalid_json');
    }

    return $decoded;
}

function ciarm_voiceflow_start_session(string $token, string $userID): string {
    $url = CIARM_VOICEFLOW_BASE
        . '/v4/project/' . rawurlencode(CIARM_VOICEFLOW_PROJECT_ID)
        . '/environment/' . rawurlencode(CIARM_VOICEFLOW_ENVIRONMENT)
        . '/session';

    $response = ciarm_voiceflow_post($url, $token, [
        'userID' => $userID,
    ]);

    $sessionKey = trim((string)($response['sessionKey'] ?? ''));
    if ($sessionKey === '') {
        throw new RuntimeException('voiceflow_missing_session_key');
    }

    return $sessionKey;
}

function ciarm_voiceflow_interact(string $sessionKey, array $action): array {
    $response = ciarm_voiceflow_post(
        CIARM_VOICEFLOW_BASE . '/v4/interact',
        $sessionKey,
        [
            'action' => $action,
            'config' => [
                'userTimezone' => 'America/Cancun',
            ],
        ]
    );

    $traces = $response['traces'] ?? [];
    return is_array($traces) ? $traces : [];
}

$userID = 'portal-' . $conversationID;

try {
    if (!isset($_SESSION['ciarm_voiceflow_sessions']) || !is_array($_SESSION['ciarm_voiceflow_sessions'])) {
        $_SESSION['ciarm_voiceflow_sessions'] = [];
    }

    $sessionKey = trim((string)($_SESSION['ciarm_voiceflow_sessions'][$conversationID] ?? ''));

    if ($launch || $sessionKey === '') {
        $sessionKey = ciarm_voiceflow_start_session($token, $userID);
        $_SESSION['ciarm_voiceflow_sessions'][$conversationID] = $sessionKey;

        if ($launch) {
            // Portal 1 inicia la conversación y descarta la respuesta de launch.
            ciarm_voiceflow_interact($sessionKey, ['type' => 'launch']);
        }
    }

    $traces = ciarm_voiceflow_interact($sessionKey, [
        'type' => 'text',
        'payload' => $message,
    ]);

    $messages = [];
    foreach ($traces as $trace) {
        if (!is_array($trace)) continue;

        $type = (string)($trace['type'] ?? '');
        if ($type !== 'text' && $type !== 'speak') continue;

        $payload = is_array($trace['payload'] ?? null) ? $trace['payload'] : [];
        $text = trim((string)($payload['message'] ?? $payload['text'] ?? ''));
        if ($text !== '') {
            $messages[] = $text;
        }
    }

    ciarm_json_response(200, ['messages' => $messages]);

} catch (Throwable $error) {
    error_log('Portal CIARM Voiceflow: ' . $error->getMessage());
    ciarm_json_response(502, ['error' => 'Voiceflow no pudo responder en este momento.']);
}
