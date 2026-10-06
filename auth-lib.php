<?php
declare(strict_types=1);

const CIARM_GOOGLE_CLIENT_ID = '202621439702-edb2e8j6hfnsm72po5n22eh63q27ee0d.apps.googleusercontent.com';
const CIARM_ALLOWED_DOMAIN = 'ciarm.edu.mx';
const CIARM_DM03_SPREADSHEET_ID = '1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY';
const CIARM_DM03_RANGE = "'Catálogo de colaboradores'!A4:AZ1010";
const CIARM_SESSION_TTL = 28800;

function ciarm_json_response(int $status, array $body): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ciarm_private_path(string $filename): string {
    return dirname(__DIR__) . '/portal-ciarm-private/' . $filename;
}

function ciarm_base64url(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function ciarm_http_json(string $url, array $options = []): array {
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('curl_init_failed');
    }

    $headers = $options['headers'] ?? ['Accept: application/json'];
    $curlOptions = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
    ];

    if (($options['post'] ?? false) === true) {
        $curlOptions[CURLOPT_POST] = true;
        $curlOptions[CURLOPT_POSTFIELDS] = $options['body'] ?? '';
    }

    curl_setopt_array($ch, $curlOptions);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $error !== '') {
        throw new RuntimeException('upstream_unreachable');
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('upstream_invalid_json');
    }

    return ['status' => $status, 'body' => $decoded];
}

function ciarm_google_access_token(array $serviceAccount): string {
    $now = time();

    $header = ciarm_base64url((string)json_encode([
        'alg' => 'RS256',
        'typ' => 'JWT'
    ]));

    $claims = ciarm_base64url((string)json_encode([
        'iss' => $serviceAccount['client_email'] ?? '',
        'scope' => 'https://www.googleapis.com/auth/spreadsheets.readonly',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ]));

    $unsigned = $header . '.' . $claims;
    $signature = '';

    if (!openssl_sign(
        $unsigned,
        $signature,
        (string)($serviceAccount['private_key'] ?? ''),
        OPENSSL_ALGO_SHA256
    )) {
        throw new RuntimeException('service_account_sign_failed');
    }

    $assertion = $unsigned . '.' . ciarm_base64url($signature);

    $response = ciarm_http_json('https://oauth2.googleapis.com/token', [
        'post' => true,
        'headers' => ['Content-Type: application/x-www-form-urlencoded'],
        'body' => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion,
        ]),
    ]);

    if ($response['status'] < 200 || $response['status'] >= 300 || empty($response['body']['access_token'])) {
        throw new RuntimeException('service_account_token_failed');
    }

    return (string)$response['body']['access_token'];
}

function ciarm_verify_google_credential(string $credential): ?array {
    if ($credential === '') {
        return null;
    }

    $response = ciarm_http_json(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($credential),
        ['headers' => ['Accept: application/json']]
    );

    if ($response['status'] !== 200) {
        return null;
    }

    $profile = $response['body'];
    $email = strtolower(trim((string)($profile['email'] ?? '')));
    $audience = trim((string)($profile['aud'] ?? ''));
    $hostedDomain = strtolower(trim((string)($profile['hd'] ?? '')));
    $verified = ($profile['email_verified'] ?? false);
    $isVerified = $verified === true || strtolower((string)$verified) === 'true';
    $expiresAt = (int)($profile['exp'] ?? 0);

    $validDomain = $hostedDomain === CIARM_ALLOWED_DOMAIN
        && substr($email, -strlen('@' . CIARM_ALLOWED_DOMAIN)) === '@' . CIARM_ALLOWED_DOMAIN;

    if (
        $audience !== CIARM_GOOGLE_CLIENT_ID ||
        !$isVerified ||
        !$validDomain ||
        $expiresAt <= time()
    ) {
        return null;
    }

    return [
        'email' => $email,
        'name' => trim((string)($profile['name'] ?? '')),
        'picture' => trim((string)($profile['picture'] ?? '')),
        'sub' => trim((string)($profile['sub'] ?? '')),
    ];
}

function ciarm_dm03_user(string $email): ?array {
    $serviceAccountRaw = @file_get_contents(ciarm_private_path('service-account.json'));
    if ($serviceAccountRaw === false || trim($serviceAccountRaw) === '') {
        throw new RuntimeException('service_account_unreadable');
    }

    try {
        $serviceAccount = json_decode($serviceAccountRaw, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        throw new RuntimeException('service_account_invalid');
    }

    if (!is_array($serviceAccount)) {
        throw new RuntimeException('service_account_invalid');
    }

    $accessToken = ciarm_google_access_token($serviceAccount);
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . CIARM_DM03_SPREADSHEET_ID
        . '/values/' . rawurlencode(CIARM_DM03_RANGE)
        . '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE';

    $response = ciarm_http_json($url, [
        'headers' => [
            'Accept: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
    ]);

    if ($response['status'] < 200 || $response['status'] >= 300) {
        throw new RuntimeException('dm03_sheet_request_failed');
    }

    $values = $response['body']['values'] ?? [];
    if (!is_array($values) || count($values) < 2) {
        throw new RuntimeException('dm03_sheet_empty');
    }

    $headers = array_map(
        static fn($value) => trim((string)$value),
        $values[0]
    );

    $required = [
        'Nombre',
        'Apellido',
        'Correo Ciarm',
        'Área',
        'Puesto',
        'Sección / Departamento',
        'Status',
    ];

    $indexes = [];
    foreach ($required as $header) {
        $index = array_search($header, $headers, true);
        if ($index === false) {
            throw new RuntimeException('dm03_schema_mismatch');
        }
        $indexes[$header] = (int)$index;
    }

    $normalizedEmail = strtolower(trim($email));

    for ($i = 1; $i < count($values); $i++) {
        $row = $values[$i];
        $rowEmail = strtolower(trim((string)($row[$indexes['Correo Ciarm']] ?? '')));

        if ($rowEmail !== $normalizedEmail) {
            continue;
        }

        $status = trim((string)($row[$indexes['Status']] ?? ''));
        if (strtolower($status) !== 'activo') {
            return null;
        }

        $nombre = trim((string)($row[$indexes['Nombre']] ?? ''));
        $apellido = trim((string)($row[$indexes['Apellido']] ?? ''));

        return [
            'nombre' => trim($nombre . ' ' . $apellido),
            'correo' => $rowEmail,
            'area' => trim((string)($row[$indexes['Área']] ?? '')),
            'puesto' => trim((string)($row[$indexes['Puesto']] ?? '')),
            'seccion' => trim((string)($row[$indexes['Sección / Departamento']] ?? '')),
            'status' => $status,
        ];
    }

    return null;
}

function ciarm_start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('CIARM_PORTAL');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    session_start();
}

function ciarm_session_user(): ?array {
    ciarm_start_session();

    $user = $_SESSION['ciarm_user'] ?? null;
    $expiresAt = (int)($_SESSION['ciarm_expires_at'] ?? 0);

    if (!is_array($user) || $expiresAt <= time()) {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        return null;
    }

    return $user;
}
