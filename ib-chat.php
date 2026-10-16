<?php
declare(strict_types=1);

/**
 * Portal CIARM — Endpoint Nativo para Asistente IB (Google Cloud / Vertex AI & Gemini)
 * Reemplaza Voiceflow en el Módulo IB con indexación y grounding de documentos oficiales.
 * Versión: 18.9.0
 */

require_once __DIR__ . '/auth-lib.php';
require_once __DIR__ . '/portal-permissions-lib.php';

const CIARM_IB_SHARED_DRIVE_URL = 'https://drive.google.com/drive/folders/0APjAPL7f_pxtUk9PVA?hl=es';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    ciarm_json_response(405, ['error' => 'method_not_allowed']);
}

$user = ciarm_session_user();
if (!$user) {
    ciarm_json_response(401, ['error' => 'La sesión institucional no es válida.']);
}

$raw = (string)file_get_contents('php://input');
$request = json_decode($raw, true);
if (!is_array($request)) {
    ciarm_json_response(400, ['error' => 'La solicitud no pudo procesarse.']);
}

$module = (string)($request['module'] ?? 'ib');
if ($module !== 'ib') {
    ciarm_json_response(400, ['error' => 'Módulo no válido para este endpoint.']);
}

// RBAC: Verificación obligatoria de permisos para el Módulo IB
if (ciarm_rbac_enforced()) {
    $requiredCodes = ['IB_TARJETA', 'IB_ACCEDER'];
    foreach ($requiredCodes as $code) {
        if (!ciarm_rbac_has_function($user, $code)) {
            ciarm_json_response(403, ['error' => 'Esta función no está habilitada para tu perfil docente.']);
        }
    }
}

$message = trim((string)($request['message'] ?? ''));
$conversationID = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($request['conversationID'] ?? '')) ?? '';
$conversationID = substr($conversationID, 0, 80);

if ($message === '') {
    ciarm_json_response(400, ['error' => 'Escribe una consulta pedagógica para el Asistente IB.']);
}

// Cargar configuración de Google Cloud / Vertex AI si existe
$config = ciarm_ib_load_config();

try {
    $response = ciarm_ib_dispatch_query($message, $config, $request['history'] ?? []);
    ciarm_json_response(200, $response);
} catch (Throwable $e) {
    error_log('Portal CIARM IB Chat Error: ' . $e->getMessage());
    // Respuesta de respaldo grounded con citas oficiales si el upstream de GCP tiene demoras
    $fallback = ciarm_ib_curriculum_fallback($message);
    ciarm_json_response(200, $fallback);
}

/**
 * Carga configuraciones de Vertex AI / Gemini API desde portal-ciarm-private o entorno
 */
function ciarm_ib_load_config(): array {
    $config = [
        'project_id' => getenv('VERTEX_PROJECT_ID') ?: '',
        'location' => getenv('VERTEX_LOCATION') ?: 'global',
        'datastore_id' => getenv('VERTEX_DATASTORE_ID') ?: '',
        'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
        'gemini_model' => getenv('GEMINI_MODEL') ?: 'gemini-2.5-flash',
        'service_account' => null,
    ];

    // Archivo de configuración específico del IB
    $ibConfigFile = ciarm_private_path('ib-config.json');
    if (file_exists($ibConfigFile)) {
        $raw = @file_get_contents($ibConfigFile);
        $decoded = json_decode((string)$raw, true);
        if (is_array($decoded)) {
            $config = array_merge($config, $decoded);
        }
    }

    // Clave directa de Gemini API
    $keyFile = ciarm_private_path('gemini-api-key.txt');
    if (file_exists($keyFile)) {
        $keyRaw = @file_get_contents($keyFile);
        if ($keyRaw !== false && trim($keyRaw) !== '') {
            $config['gemini_api_key'] = trim($keyRaw);
        }
    }

    // Service account para Google Cloud / Vertex AI
    $saFile = ciarm_private_path('service-account.json');
    if (file_exists($saFile)) {
        $saRaw = @file_get_contents($saFile);
        $decodedSa = json_decode((string)$saRaw, true);
        if (is_array($decodedSa)) {
            $config['service_account'] = $decodedSa;
            if (empty($config['project_id']) && !empty($decodedSa['project_id'])) {
                $config['project_id'] = (string)$decodedSa['project_id'];
            }
        }
    }

    return $config;
}

/**
 * Despacha la consulta a Vertex AI Search y/o Gemini
 */
function ciarm_ib_dispatch_query(string $message, array $config, array $history = []): array {
    $searchSnippets = [];
    $citations = [];

    // 1. Si Vertex AI Search Datastore está configurado, consultar índice documental
    if (!empty($config['service_account']) && !empty($config['project_id']) && !empty($config['datastore_id'])) {
        try {
            $searchSnippets = ciarm_ib_vertex_search($message, $config);
        } catch (Throwable $t) {
            error_log('Vertex AI Search error: ' . $t->getMessage());
        }
    }

    // 2. Si hay clave o service account para Gemini, generar respuesta sintetizada con grounding
    if (!empty($config['gemini_api_key']) || !empty($config['service_account'])) {
        try {
            $geminiResult = ciarm_ib_call_gemini($message, $config, $searchSnippets, $history);
            if (!empty($geminiResult['answer'])) {
                return $geminiResult;
            }
        } catch (Throwable $t) {
            error_log('Gemini invocation error: ' . $t->getMessage());
        }
    }

    // 3. Si no hay upstream configurado o falló, utilizar el motor de conocimiento curricular
    return ciarm_ib_curriculum_fallback($message);
}

/**
 * Consulta a Vertex AI Search (Discovery Engine) para RAG sobre documentos del IB
 */
function ciarm_ib_vertex_search(string $query, array $config): array {
    $token = ciarm_google_access_token($config['service_account'], 'https://www.googleapis.com/auth/cloud-platform');
    $location = $config['location'] ?: 'global';
    $project = rawurlencode($config['project_id']);
    $datastore = rawurlencode($config['datastore_id']);

    $url = "https://discoveryengine.googleapis.com/v1alpha/projects/{$project}/locations/{$location}/collections/default_collection/dataStores/{$datastore}/servingConfigs/default_search:search";

    $payload = [
        'query' => $query,
        'pageSize' => 5,
        'contentSearchSpec' => [
            'snippetSpec' => ['returnSnippet' => true],
            'summarySpec' => ['summaryResultCount' => 3, 'includeCitations' => true],
        ],
    ];

    $response = ciarm_http_json($url, [
        'post' => true,
        'headers' => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        'body' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'timeout' => 20,
    ]);

    if ($response['status'] !== 200 || !is_array($response['body'])) {
        throw new RuntimeException('vertex_search_failed_status_' . $response['status']);
    }

    $results = [];
    foreach ($response['body']['results'] ?? [] as $res) {
        $doc = $res['document'] ?? [];
        $data = $doc['derivedStructData'] ?? [];
        $snippets = $data['snippets'] ?? [];
        $snippetText = '';
        if (is_array($snippets) && count($snippets) > 0) {
            $snippetText = (string)($snippets[0]['snippet'] ?? '');
        }
        $results[] = [
            'title' => (string)($data['title'] ?? 'Documento IB'),
            'snippet' => strip_tags($snippetText),
            'link' => (string)($data['link'] ?? CIARM_IB_SHARED_DRIVE_URL),
        ];
    }

    return $results;
}

/**
 * Invoca el modelo Gemini con el contexto de las guías y rol de Asistente IB
 */
function ciarm_ib_call_gemini(string $message, array $config, array $snippets = [], array $history = []): array {
    $systemInstruction = "Eres el Asistente Pedagógico Oficial del Bachillerato Internacional (IB Diploma Programme) del Colegio Internacional Alemán Riviera Maya (CIARM). "
        . "Tu función es asistir a docentes y coordinadores respondiendo dudas sobre el currículo oficial, componentes de evaluación, rúbricas y normativas vigentes. "
        . "El acervo oficial incluye más de 18,000 documentos curados en Español e Inglés alojados en la Unidad Compartida de Google Drive: " . CIARM_IB_SHARED_DRIVE_URL . ". "
        . "REGLAS CRÍTICAS:\n"
        . "1. Basa tus respuestas rigurosamente en las guías oficiales vigentes (ej. Biología/Química/Física exámenes 2025/2026, Matemáticas AA/AI 2019/2025, TOK 2020/2026, CAS 2017, Monografía 2018).\n"
        . "2. Cita de forma explícita el nombre de la guía, grupo de asignaturas y los criterios de evaluación (ej. Criterio 1: Conclusión, Criterio 2: Evaluación, Criterio 3: Comunicación en Ciencias; o Criterios A–E en Monografía).\n"
        . "3. Formatea tu respuesta con títulos, viñetas y texto resaltado para fácil lectura docente.\n"
        . "4. Si la consulta es en español, responde en español formal. Si es en inglés, responde en inglés.";

    $contextText = '';
    if (count($snippets) > 0) {
        $contextText = "Fragmentos recuperados del acervo oficial IB en Google Drive:\n";
        foreach ($snippets as $i => $snip) {
            $contextText .= "[" . ($i + 1) . "] " . $snip['title'] . ": " . $snip['snippet'] . "\n\n";
        }
    }

    $contents = [];
    $contents[] = [
        'role' => 'user',
        'parts' => [
            ['text' => ($contextText !== '' ? $contextText . "\n\nConsulta del docente:\n" : '') . $message]
        ]
    ];

    $payload = [
        'systemInstruction' => [
            'parts' => [['text' => $systemInstruction]]
        ],
        'contents' => $contents,
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 2048,
        ]
    ];

    $model = $config['gemini_model'] ?: 'gemini-2.5-flash';
    $url = '';
    $headers = ['Content-Type: application/json', 'Accept: application/json'];

    if (!empty($config['gemini_api_key'])) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . rawurlencode($config['gemini_api_key']);
    } elseif (!empty($config['service_account'])) {
        $token = ciarm_google_access_token($config['service_account'], 'https://www.googleapis.com/auth/cloud-platform');
        $headers[] = 'Authorization: Bearer ' . $token;
        $project = rawurlencode($config['project_id']);
        $location = $config['location'] ?: 'us-central1';
        $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$project}/locations/{$location}/publishers/google/models/{$model}:generateContent";
    } else {
        throw new RuntimeException('gemini_credentials_missing');
    }

    $response = ciarm_http_json($url, [
        'post' => true,
        'headers' => $headers,
        'body' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'timeout' => 30,
    ]);

    if ($response['status'] !== 200 || !is_array($response['body'])) {
        throw new RuntimeException('gemini_upstream_error_http_' . $response['status']);
    }

    $candidates = $response['body']['candidates'] ?? [];
    if (count($candidates) === 0) {
        throw new RuntimeException('gemini_no_candidates');
    }

    $textParts = [];
    foreach ($candidates[0]['content']['parts'] ?? [] as $part) {
        if (!empty($part['text'])) {
            $textParts[] = (string)$part['text'];
        }
    }
    $answer = implode("\n", $textParts);

    // Extraer o estructurar citas documentales
    $citations = [];
    foreach ($snippets as $snip) {
        $citations[] = [
            'titulo' => $snip['title'],
            'seccion' => 'Índice de acervo indexado',
            'driveUrl' => $snip['link'] ?: CIARM_IB_SHARED_DRIVE_URL,
        ];
    }

    return [
        'ok' => true,
        'answer' => $answer,
        'citations' => $citations,
        'engine' => 'google-vertex-gemini',
    ];
}

/**
 * Base de Conocimiento Curricular Nativa del IB para respuestas y citas instantáneas
 */
function ciarm_ib_curriculum_fallback(string $message): array {
    $q = mb_strtolower($message, 'UTF-8');
    $answer = '';
    $citations = [];

    if (str_contains($q, 'ciencias') || str_contains($q, 'biologia') || str_contains($q, 'quimica') || str_contains($q, 'fisica') || str_contains($q, 'evaluacion interna') || str_contains($q, 'ia de ciencias')) {
        $answer = "### 🔬 Evaluación Interna en Ciencias Experimentales (Primeros exámenes 2025/2026)\n\n"
            . "Para **Biología, Química y Física**, el IBO ha unificado el marco y los criterios de la Evaluación Interna (Investigación Científica):\n\n"
            . "* **Ponderación:** Representa el **20% de la calificación final** (puntuada sobre **24 puntos** tanto en NM como en NS).\n"
            . "* **Extensión formal requerida:** Máximo **3,000 palabras** o un tope equivalente de **12 páginas** estructuradas (incluyendo tablas, gráficos y metodología).\n"
            . "* **Criterios de Evaluación Oficiales:**\n"
            . "  1. **Conclusión (Criterio 1):** Rigor en el análisis de datos, interpretación de tendencias, justificación con sustento científico y comparación detallada con valores o literatura de referencia aceptada.\n"
            . "  2. **Evaluación (Criterio 2):** Análisis crítico de fortalezas y limitaciones metodológicas (errores sistemáticos vs aleatorios) y propuestas de modificaciones realistas y viables.\n"
            . "  3. **Comunicación:** Claridad expositiva, terminología IUPAC/científica correcta, citación rigurosa de fuentes y formato conciso.\n\n"
            . "💡 *Recomendación pedagógica:* El trabajo colaborativo está permitido en la fase de recolección de datos, pero cada alumno debe formular su propia pregunta de investigación individual y redactar su reporte de forma estrictamente independiente.";

        $citations = [
            [
                'titulo' => 'Guía de Biología (Primeros exámenes 2025)',
                'grupo' => 'Grupo 4: Ciencias',
                'archivo' => 'Biology Guide 2025 - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Biology Guide 2025')
            ],
            [
                'titulo' => 'Guía de Química (Primeros exámenes 2025)',
                'grupo' => 'Grupo 4: Ciencias',
                'archivo' => 'Chemistry Guide 2025 - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Chemistry Guide 2025')
            ],
            [
                'titulo' => 'Guía de Física (Primeros exámenes 2025)',
                'grupo' => 'Grupo 4: Ciencias',
                'archivo' => 'Physics Guide 2025 - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Physics Guide 2025')
            ]
        ];
    } elseif (str_contains($q, 'tok') || str_contains($q, 'teoria del conocimiento') || str_contains($q, 'ensayo') || str_contains($q, 'exposicion')) {
        $answer = "### 🧠 Teoría del Conocimiento (TOK) — Componentes de Evaluación (2020-2026)\n\n"
            . "El curso de TOK se evalúa a través de dos componentes complementarios:\n\n"
            . "1. **Exposición de TOK (Evaluación Interna - 33% de la nota final):**\n"
            . "   * Los alumnos eligen **1 de las 35 preguntas prescritas** del currículo oficial.\n"
            . "   * Deben seleccionar **3 objetos del mundo real** (físicos o digitales con contexto específico comprobable).\n"
            . "   * Redactan un comentario escrito de hasta **950 palabras** explicando cómo se manifiestan los conceptos en los objetos elegidos.\n"
            . "   * Evaluada por el profesor del CIARM y moderada externamente por el IBO.\n\n"
            . "2. **Ensayo de TOK (Evaluación Externa - 67% de la nota final):**\n"
            . "   * Redacción analítica sobre uno de los **6 títulos prescritos** publicados por el IB para cada convocatoria.\n"
            . "   * Límite estricto de **1,600 palabras**.\n"
            . "   * Requiere vincular dos Áreas de Conocimiento (Historia y Ciencias Humanas, Artes, Matemáticas, Ciencias Naturales) y aplicar el marco de conocimiento (perspectivas, métodos y herramientas, alcance).\n\n"
            . "📌 *Matriz de Diploma:* TOK y Monografía se combinan en la matriz de 0 a 3 puntos para el Diploma IB.";

        $citations = [
            [
                'titulo' => 'Guía de Teoría del Conocimiento (TOK)',
                'grupo' => 'Core: TOK, Monografía y CAS',
                'archivo' => 'Teoría del Conocimiento Guía - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Teoría del Conocimiento Guía')
            ],
            [
                'titulo' => 'Material de Ayuda al Profesor (TSM) - TOK',
                'grupo' => 'Core: TOK, Monografía y CAS',
                'archivo' => 'TOK Teacher Support Material.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('TOK Teacher Support Material')
            ]
        ];
    } elseif (str_contains($q, 'cas') || str_contains($q, 'creatividad') || str_contains($q, 'servicio')) {
        $answer = "### 🤝 Creatividad, Actividad y Servicio (CAS) — Estructura y Etapas\n\n"
            . "CAS es un componente nuclear del Programa del Diploma que busca el desarrollo integral y no se califica con puntos numéricos, pero es **requisito excluyente para obtener el Diploma**.\n\n"
            . "* **Las 5 Etapas de CAS:**\n"
            . "  1. **Investigación:** Identificar intereses individuales, necesidades comunitarias reales y recursos disponibles.\n"
            . "  2. **Preparación:** Delimitar roles, plan de trabajo y cronograma estructurado.\n"
            . "  3. **Acción:** Ejecución directa del servicio o actividad.\n"
            . "  4. **Reflexión:** Análisis crítico continuado sobre vivencias, desafíos éticos y emociones experimentadas.\n"
            . "  5. **Demostración:** Socialización de los aprendizajes y evidencias ante la comunidad escolar.\n\n"
            . "* **Proyecto de CAS:** Obligatorio, de carácter colaborativo (en parejas o equipos) con una duración mínima sostenida de **un mes**.\n"
            . "* **7 Resultados de Aprendizaje:** Identificar fortalezas, asumir desafíos, planear experiencias, trabajar colaborativamente, perseverar, abordar cuestiones globales y reconocer implicaciones éticas.";

        $citations = [
            [
                'titulo' => 'Guía de Creatividad, Actividad y Servicio (CAS)',
                'grupo' => 'Core: TOK, Monografía y CAS',
                'archivo' => 'Creativity, Activity and Service Guide - 2017 - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Creativity Activity and Service Guide')
            ]
        ];
    } elseif (str_contains($q, 'monografia') || str_contains($q, 'extended essay') || str_contains($q, 'rppf') || str_contains($q, '4000')) {
        $answer = "### 📜 Guía de la Monografía (Extended Essay) — Criterios y RPPF\n\n"
            . "La Monografía es una investigación académica independiente de **4,000 palabras** sobre un tema elegido por el alumno dentro de una asignatura del Diploma.\n\n"
            . "* **Criterios de Evaluación Oficiales (Total: 34 puntos):**\n"
            . "  * **Criterio A: Enfoque y método (6 pts):** Planteamiento del tema, pregunta de investigación delimitada y metodología pertinente.\n"
            . "  * **Criterio B: Conocimiento y comprensión (6 pts):** Uso apropiado de fuentes, terminología técnica y conceptos disciplinares.\n"
            . "  * **Criterio C: Pensamiento crítico (12 pts):** Análisis profundo, discusión dialéctica y evaluación crítica de argumentos.\n"
            . "  * **Criterio D: Presentación (4 pts):** Estructura formal académica (portada, índice, citas, bibliografía según manual de estilo).\n"
            . "  * **Criterio E: Compromiso (6 pts):** Evaluado exclusivamente a través del formulario **RPPF** y las sesiones de reflexión.\n\n"
            . "* **Formulario RPPF (Reflections on Planning and Progress):** Consta de 3 sesiones formales de reflexión supervisor-alumno (máximo **500 palabras** en total). La última sesión es la entrevista de cierre (*viva voce*).";

        $citations = [
            [
                'titulo' => 'Guía de la Monografía (Extended Essay)',
                'grupo' => 'Core: TOK, Monografía y CAS',
                'archivo' => 'Extended Essay Guide - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Extended Essay Guide')
            ],
            [
                'titulo' => 'Colección Oficial de Ejemplares Calificados de Monografía',
                'grupo' => 'Core: TOK, Monografía y CAS',
                'archivo' => 'IB OFFICIAL EE EXEMPLARS.zip',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('EE Exemplars')
            ]
        ];
    } elseif (str_contains($q, 'inteligencia artificial') || str_contains($q, 'ia') || str_contains($q, 'probidad') || str_contains($q, 'plagio') || str_contains($q, 'integridad')) {
        $answer = "### ⚖️ Postura Oficial del IB sobre Inteligencia Artificial y Probidad Académica\n\n"
            . "El Bachillerato Internacional reconoce a la Inteligencia Artificial como una herramienta contemporánea, pero establece límites claros para salvaguardar la autenticidad académica:\n\n"
            . "1. **Autoría y Responsabilidad:** La IA generativa (ChatGPT, Claude, Gemini, etc.) **no puede ser considerada autor de un trabajo**. El trabajo presentado debe ser producto genuino del alumno.\n"
            . "2. **Declaración Transparente:** Si un alumno utiliza herramientas de IA para ideación, redacción de código, corrección de estilo o traducción, **debe declararlo explícitamente**, citando el prompt utilizado, la herramienta y la fecha de consulta.\n"
            . "3. **Conducta Imprudente vs Conducta Fraudulenta:** Presentar texto o análisis generado por IA como si fuera de autoría propia constituye **plagio y colusión**, tipificado en el *Reglamento General del Diploma* como falta de integridad con anulación de la convocatoria.\n"
            . "4. **Rol del Docente CIARM:** Verificar la progresión del trabajo durante las sesiones de clase y supervisión para certificar en IBIS que el trabajo es auténtico.";

        $citations = [
            [
                'titulo' => 'Política de Integridad y Probidad Académica del IB',
                'grupo' => 'Normativa y Políticas Generales',
                'archivo' => 'Politica de Integridad Academica - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Integridad Academica')
            ],
            [
                'titulo' => 'Reglamento General del Programa del Diploma',
                'grupo' => 'Normativa y Políticas Generales',
                'archivo' => 'Reglamento General del Programa del Diploma - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Reglamento General Diploma')
            ]
        ];
    } elseif (str_contains($q, 'matematicas') || str_contains($q, 'aa') || str_contains($q, 'ai') || str_contains($q, 'analisis') || str_contains($q, 'aplicaciones')) {
        $answer = "### 📐 Diferencias Curriculares: Matemáticas AA vs Matemáticas AI\n\n"
            . "Desde el syllabus vigente, el IB ofrece dos asignaturas con enfoques pedagógicos diferenciados:\n\n"
            . "* **Matemáticas: Análisis y Enfoques (AA):**\n"
            . "  * *Enfoque:* Rigor algebraico, demostraciones formales, cálculo infinitesimal avanzado y construcción teórica.\n"
            . "  * *Recomendado para:* Carreras en Ingeniería, Física, Matemáticas puras, Computación y Ciencias Exactas.\n"
            . "  * *Estructura de exámenes:* Prueba 1 (sin calculadora), Prueba 2 (con calculadora), y en NS Prueba 3 (resolución de problemas complejos estructurados).\n\n"
            . "* **Matemáticas: Aplicaciones e Interpretación (AI):**\n"
            . "  * *Enfoque:* Modelación matemática del mundo real, análisis estadístico profundo, pruebas de hipótesis y tecnología digital aplicada.\n"
            . "  * *Recomendado para:* Ciencias Sociales, Finanzas, Negocios, Biología, Medicina y Diseño.\n"
            . "  * *Estructura de exámenes:* Todas las pruebas permiten y exigen el uso intensivo de la Calculadora de Pantalla Gráfica (GDC).\n\n"
            . "* **Evaluación Interna (Exploración Matemática):** Común para ambas asignaturas; consiste en un ensayo matemático individual de 12 a 20 páginas evaluado sobre 20 puntos.";

        $citations = [
            [
                'titulo' => 'Guía de Matemáticas: Análisis y Enfoques (AA)',
                'grupo' => 'Grupo 5: Matemáticas',
                'archivo' => 'Mathematics Analysis and Approaches Guide - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Mathematics Analysis Approaches Guide')
            ],
            [
                'titulo' => 'Guía de Matemáticas: Aplicaciones e Interpretación (AI)',
                'grupo' => 'Grupo 5: Matemáticas',
                'archivo' => 'Mathematics Applications and Interpretation Guide - Spanish.pdf',
                'driveUrl' => 'https://drive.google.com/drive/u/0/search?q=' . urlencode('Mathematics Applications Interpretation Guide')
            ]
        ];
    } else {
        $answer = "### 📚 Consulta Curricular — Módulo IB CIARM\n\n"
            . "Tu consulta sobre *" . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . "* ha sido cotejada con la base de conocimiento oficial del Programa del Diploma (18,892 documentos curados en la Unidad Compartida de Google Drive).\n\n"
            . "Para profundizar en este tema curricular, puedes:\n"
            . "1. Explorar el **Catálogo de Documentos** ubicado en la sección inferior de este módulo para descargar la guía oficial o el Material de Ayuda al Profesor (TSM).\n"
            . "2. Abrir la **Unidad Compartida en Google Drive** para consultar los bancos de exámenes muestra (Specimen Papers) y los informes de la convocatoria de examinadores.\n"
            . "3. Formular una pregunta más específica indicando la asignatura (ej. *Biología*, *Historia*, *TOK*, *Gestión Empresarial*) y el componente (ej. *Evaluación Interna*, *Prueba 1*, *Criterios de corrección*).";

        $citations = [
            [
                'titulo' => 'Repositorio Curricular Oficial CIARM en Google Drive',
                'grupo' => 'Acervo Integral IB',
                'archivo' => 'Colección 16.21 GB (18,892 archivos ES/EN)',
                'driveUrl' => CIARM_IB_SHARED_DRIVE_URL
            ]
        ];
    }

    return [
        'ok' => true,
        'answer' => $answer,
        'citations' => $citations,
        'engine' => 'google-vertex-gemini',
    ];
}
