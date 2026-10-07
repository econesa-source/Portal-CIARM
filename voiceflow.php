<?php
declare(strict_types=1);

/**
 * Portal CIARM — proxy server-side para Asistente CIARM / Voiceflow.
 * Mantiene el token fuera del navegador y reutiliza la sesión PHP real de Portal 2.
 */

require_once __DIR__ . '/auth-lib.php';

const CIARM_VOICEFLOW_BASE = 'https://realtime-api.voiceflow.com/v1/stable';
const CIARM_VOICEFLOW_PROJECT_ID = '6a81e72529695cfeb738ad6e';

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

function ciarm_voiceflow_interact(string $token, string $userID, array $action): array {
    $url = CIARM_VOICEFLOW_BASE
        . '/conversation/' . rawurlencode($userID)
        . '?projectID=' . rawurlencode(CIARM_VOICEFLOW_PROJECT_ID)
        . '&environmentAlias=main';

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('voiceflow_curl_init_failed');
    }

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'action' => $action,
            'version' => 'published',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false || $error !== '' || $status < 200 || $status >= 300) {
        throw new RuntimeException('voiceflow_upstream_failed');
    }

    $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)$body) ?? '';
    $decoded = json_decode($cleaned, true);

    if (!is_array($decoded)) {
        throw new RuntimeException('voiceflow_invalid_json');
    }

    $traces = $decoded['traces'] ?? [];
    return is_array($traces) ? $traces : [];
}

$userID = 'portal-' . $conversationID;

try {
    if ($launch) {
        ciarm_voiceflow_interact($token, $userID, ['type' => 'launch']);
    }

    $traces = ciarm_voiceflow_interact($token, $userID, [
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
