# Arquitectura Google Cloud AI — Módulo IB Portal CIARM

## 1. Visión General y Propósito

El Módulo IB (`#ib`) del Portal CIARM sustituye la integración de Voiceflow por una **arquitectura 100% nativa en el entorno de Google Cloud (Vertex AI & Gemini)**, fundamentada en el acervo de **16.21 GB de documentación oficial curada (18,892 archivos en Español e Inglés)** alojados en la Unidad Compartida de Google Drive (`0APjAPL7f_pxtUk9PVA`).

```
                              [Carpeta Compartida Google Drive]
                                 (16.21 GB / 18,892 archivos)
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
            [Vertex AI Search]                             [Gemini Auto-Classifier]
      Indexa y entiende el texto                      Lee y extrae metadatos
      para el Chat de preguntas                       (Materia, Año, Tipo, Tags)
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              ▼
                                 [Portal CIARM — Módulo IB]
                                 • Chat Asistente Inteligente
                                 • Filtros automáticos generados por IA
```

---

## 2. Componentes de la Solución

### A. Endpoint Backend de Chat Nativo (`ib-chat.php`)
* **Ubicación:** `ib-chat.php` en la raíz del Portal CIARM.
* **Seguridad y Control de Acceso (RBAC):**
  * Exige método `POST`.
  * Valida la sesión institucional activa vía `auth-session.php` (`ciarm_session_user()`).
  * En modo DM05 activo (`ciarm_rbac_enforced()`), exige que el perfil docente posea simultáneamente las capacidades `IB_TARJETA` e `IB_ACCEDER`.
* **Autenticación con Google Cloud:**
  * Emplea `ciarm_google_access_token($serviceAccount, 'https://www.googleapis.com/auth/cloud-platform')` con firma RS256 JWT sobre la cuenta de servicio institucional (`portal-ciarm-private/service-account.json`).
  * Admite opcionalmente clave de API directa en `portal-ciarm-private/gemini-api-key.txt` o variable `GEMINI_API_KEY`.
* **Despacho y Grounding:**
  1. Si está configurado el Datastore de **Vertex AI Search (Discovery Engine)**, consulta el índice documental del IB para extraer fragmentos relevantes y enlaces directos a Google Drive.
  2. Sintetiza la respuesta pedagógica utilizando **Google Gemini** con un System Instruction especializado en el Programa del Diploma (criterios A–E, evaluación interna unificada de Ciencias 2025/2026, TOK, CAS, Monografía, Probidad e IA).
  3. Si la conexión upstream con GCP está pendiente de aprovisionamiento o sin conectividad externa temporal, activa el **motor de conocimiento curricular de respaldo**, devolviendo respuestas precisas con citas documentales y enlaces de búsqueda directa en Google Drive.

### B. Gemini Auto-Classifier y Facetas Dinámicas (`scripts/gemini_auto_classifier.py` y `src/data/ibCatalog.js`)
* **Script Clasificador:** `scripts/gemini_auto_classifier.py` implementa el pipeline de clasificación taxonómica del IB.
* **Metadatos Extraídos:**
  * `materia`: Asignatura canónica (Biología, Química, Física, Matemáticas AA/AI, Historia, Gestión Empresarial, Lengua A, Lengua B, TOK, CAS, Monografía, Artes Visuales, Música, ESS, etc.).
  * `grupo`: Grupo curricular oficial (Core, Grupo 1 a 6, Normativa).
  * `tipo`: Categoría de recurso (Guía de Asignatura, TSM / Ayuda al Profesor, Evaluación Interna, Specimen Papers, Informes de Convocatoria, Normativa Oficial).
  * `vigencia`: Periodo curricular (2025-2026, 2024-Vigente, 2021-Vigente, etc.).
  * `nivel`: NM / SL, NS / HL, Tronco Común, Institucional.
  * `idioma`: ES (Español) o EN (English).
  * `tags`: Etiquetas temáticas automáticas (ej. `#criterios`, `#evaluacion-interna`, `#rubrica`, `#3000-palabras`).
  * `driveUrl`: Vínculo autenticado al archivo o búsqueda en la Unidad Compartida de Google Drive.
* **Módulo de Datos:** `src/data/ibCatalog.js` exporta el catálogo estructurado y las funciones de cómputo reactivo de facetas (`computeFacets`) y filtrado multifacético (`filterCatalog`).

### C. Frontend SPA — Módulo IB (`src/components/ibWidget.js`)
* **Chat Asistente Inteligente:**
  * Conexión directa a `/ib-chat.php`.
  * Formateo semántico de Markdown (encabezados, listas, texto resaltado).
  * Caja de citas oficiales interactivas con badges que abren la guía en Drive con un clic.
  * Memoria contextual para diálogos pedagógicos multi-turno.
  * Chips de consultas rápidas para los tópicos curriculares 2025/2026.
* **Explorador Curricular con Filtros IA:**
  * Selector por Chips de Grupos Curriculares generados dinámicamente.
  * Selector por Tipo de Documento (Guías, TSM, Evaluaciones, Specimen).
  * Conmutador rápido de idioma (Todos, Español, English).
  * Barra de etiquetas (`#tags`) populares extraídas por el clasificador.
  * Botón *"💬 Preguntar al Asistente sobre esta guía"* en cada tarjeta: pre-carga la consulta pedagógica en el chat y enfoca la ventana de conversación.

---

## 3. Pruebas y Validación Automatizada

* `tests/ib-chat.test.mjs`: Valida el backend `ib-chat.php` (POST, sesión, DM05, Vertex AI Search, Gemini y fallback).
* `tests/ib-catalog.test.mjs`: Valida el catálogo estructurado, extracción de facetas y filtrado dinámico.
* `tests/voiceflow-access.test.mjs`: Valida la coexistencia y preservación del contrato `module: 'ib'`.
* `.github/workflows/deploy-neubox.yml`: Valida en producción que `portal2.ciarm.edu.mx/ib-chat.php` responda con protección de sesión (HTTP 401 sin sesión) y que `ibWidget.js` consuma el motor nativo de Google.
