/**
 * Portal CIARM - Módulo IB (Bachillerato Internacional)
 * Asistente Pedagógico IA + Catálogo de Documentación Curada (ES/EN)
 * Versión: 18.8.0
 */

const IB_SHARED_DRIVE_URL = "https://drive.google.com/drive/folders/0APjAPL7f_pxtUk9PVA?hl=es";

const CURATED_SAMPLE_CATALOG = [
  // CORE
  {
    id: "IB-CORE-001",
    titulo: "Guía de Teoría del Conocimiento (TOK)",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "ES",
    vigencia: "2020-2026",
    nivel: "Tronco Común",
    archivo: "Teoría del Conocimiento Guía - Spanish.pdf",
    tags: ["evaluacion", "ensayo", "exposicion", "areas de conocimiento", "marco de conocimiento"]
  },
  {
    id: "IB-CORE-002",
    titulo: "Theory of Knowledge Guide (TOK)",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "EN",
    vigencia: "2020-2026",
    nivel: "Core",
    archivo: "Theory of Knowledge Guide - English.pdf",
    tags: ["essay", "exhibition", "knowledge framework", "evaluation criteria"]
  },
  {
    id: "IB-CORE-003",
    titulo: "Guía de Creatividad, Actividad y Servicio (CAS)",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "ES",
    vigencia: "2017-Vigente",
    nivel: "Tronco Común",
    archivo: "Creativity, Activity and Service Guide - 2017 - Spanish.pdf",
    tags: ["etapas cas", "proyecto cas", "resultados de aprendizaje", "reflexion"]
  },
  {
    id: "IB-CORE-004",
    titulo: "Creativity, Activity and Service Guide (CAS)",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "EN",
    vigencia: "2017-Current",
    nivel: "Core",
    archivo: "Creativity, Activity and Service Guide - 2017 - English.pdf",
    tags: ["cas stages", "cas project", "learning outcomes", "portfolio"]
  },
  {
    id: "IB-CORE-005",
    titulo: "Guía de la Monografía (Extended Essay)",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "ES",
    vigencia: "2018-Vigente",
    nivel: "Tronco Común",
    archivo: "Extended Essay Guide - Spanish.pdf",
    tags: ["4000 palabras", "criterios de evaluacion", "investigacion", "supervision", "rppf"]
  },
  {
    id: "IB-CORE-006",
    titulo: "Extended Essay Guide",
    categoria: "Core",
    grupo: "Core: TOK, Monografía y CAS",
    idioma: "EN",
    vigencia: "2018-Current",
    nivel: "Core",
    archivo: "Extended Essay Guide - English.pdf",
    tags: ["4000 words", "assessment criteria", "reflection", "research", "rppf"]
  },

  // GRUPO 1: ESTUDIOS DE LENGUA Y LITERATURA
  {
    id: "IB-G1-001",
    titulo: "Guía de Lengua A: Literatura",
    categoria: "Guias",
    grupo: "Grupo 1: Lengua y Literatura",
    idioma: "ES",
    vigencia: "2021-Vigente",
    nivel: "NM / NS",
    archivo: "Language A Literature Guide 2021 - Spanish.pdf",
    tags: ["evaluacion oral individual", "eoi", "ensayo de ns", "criterios"]
  },
  {
    id: "IB-G1-002",
    titulo: "Language A: Literature Guide",
    categoria: "Guias",
    grupo: "Grupo 1: Lengua y Literatura",
    idioma: "EN",
    vigencia: "2021-Current",
    nivel: "SL / HL",
    archivo: "Language A Literature Guide 2021 - English.pdf",
    tags: ["individual oral", "hl essay", "paper 1", "paper 2"]
  },

  // GRUPO 2: ADQUISICIÓN DE LENGUAS
  {
    id: "IB-G2-001",
    titulo: "Guía de Lengua B (Adquisición de Lenguas)",
    categoria: "Guias",
    grupo: "Grupo 2: Adquisición de Lenguas",
    idioma: "ES",
    vigencia: "2020-Vigente",
    nivel: "NM / NS",
    archivo: "Language B Guide 2020 - Spanish.pdf",
    tags: ["temas prescritos", "interaccion oral", "comprension de textos", "expresion escrita"]
  },
  {
    id: "IB-G2-002",
    titulo: "Language B Guide",
    categoria: "Guias",
    grupo: "Grupo 2: Adquisición de Lenguas",
    idioma: "EN",
    vigencia: "2020-Current",
    nivel: "SL / HL",
    archivo: "Language B Guide 2020 - English.pdf",
    tags: ["themes", "listening", "reading", "individual oral", "writing"]
  },

  // GRUPO 3: INDIVIDUOS Y SOCIEDADES
  {
    id: "IB-G3-001",
    titulo: "Guía de Gestión Empresarial (Business Management)",
    categoria: "Guias",
    grupo: "Grupo 3: Individuos y Sociedades",
    idioma: "ES",
    vigencia: "2024-Vigente",
    nivel: "NM / NS",
    archivo: "Business Management Guide 2024 - Spanish.pdf",
    tags: ["evaluacion interna", "caso de estudio", "finanzas", "marketing", "estrategia"]
  },
  {
    id: "IB-G3-002",
    titulo: "Business Management Guide",
    categoria: "Guias",
    grupo: "Grupo 3: Individuos y Sociedades",
    idioma: "EN",
    vigencia: "2024-Current",
    nivel: "SL / HL",
    archivo: "Business Management Guide 2024 - English.pdf",
    tags: ["internal assessment", "case study", "finance", "operations", "cme"]
  },
  {
    id: "IB-G3-003",
    titulo: "Guía de Historia",
    categoria: "Guias",
    grupo: "Grupo 3: Individuos y Sociedades",
    idioma: "ES",
    vigencia: "2020-Vigente",
    nivel: "NM / NS",
    archivo: "History Guide 2020 - Spanish.pdf",
    tags: ["investigacion historica", "ensayo", "prueba 1", "prueba 2", "prueba 3"]
  },
  {
    id: "IB-G3-004",
    titulo: "History Guide",
    categoria: "Guias",
    grupo: "Grupo 3: Individuos y Sociedades",
    idioma: "EN",
    vigencia: "2020-Current",
    nivel: "SL / HL",
    archivo: "History Guide 2020 - English.pdf",
    tags: ["historical investigation", "paper 1", "paper 2", "paper 3", "sources"]
  },
  {
    id: "IB-G3-005",
    titulo: "Guía de Psicología",
    categoria: "Guias",
    grupo: "Grupo 3: Individuos y Sociedades",
    idioma: "ES",
    vigencia: "2019-Vigente",
    nivel: "NM / NS",
    archivo: "Psychology Guide 2019 - Spanish.pdf",
    tags: ["replicacion experimental", "enfoque biologico", "enfoque cognitivo", "sociocultural"]
  },

  // GRUPO 4: CIENCIAS
  {
    id: "IB-G4-001",
    titulo: "Guía de Biología (Primeros exámenes 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "ES",
    vigencia: "2025-Vigente",
    nivel: "NM / NS",
    archivo: "Biology Guide 2025 - Spanish.pdf",
    tags: ["nuevo curriculo", "investigacion cientifica", "criterios ia", "herramientas cientificas"]
  },
  {
    id: "IB-G4-002",
    titulo: "Biology Guide (First Assessment 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "EN",
    vigencia: "2025-Current",
    nivel: "SL / HL",
    archivo: "Biology Guide 2025 - English.pdf",
    tags: ["new syllabus", "scientific investigation", "internal assessment", "practical work"]
  },
  {
    id: "IB-G4-003",
    titulo: "Guía de Química (Primeros exámenes 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "ES",
    vigencia: "2025-Vigente",
    nivel: "NM / NS",
    archivo: "Chemistry Guide 2025 - Spanish.pdf",
    tags: ["estructura atomica", "reactividad", "investigacion cientifica", "laboratorio"]
  },
  {
    id: "IB-G4-004",
    titulo: "Chemistry Guide (First Assessment 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "EN",
    vigencia: "2025-Current",
    nivel: "SL / HL",
    archivo: "Chemistry Guide 2025 - English.pdf",
    tags: ["new syllabus", "structure and reactivity", "internal assessment"]
  },
  {
    id: "IB-G4-005",
    titulo: "Guía de Física (Primeros exámenes 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "ES",
    vigencia: "2025-Vigente",
    nivel: "NM / NS",
    archivo: "Physics Guide 2025 - Spanish.pdf",
    tags: ["mecanica", "campos", "energia", "investigacion individual"]
  },
  {
    id: "IB-G4-006",
    titulo: "Physics Guide (First Assessment 2025)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "EN",
    vigencia: "2025-Current",
    nivel: "SL / HL",
    archivo: "Physics Guide 2025 - English.pdf",
    tags: ["new syllabus", "mechanics", "waves", "fields", "experimental investigation"]
  },
  {
    id: "IB-G4-007",
    titulo: "Sistemas Ambientales y Sociedades (ESS - Exámenes 2026)",
    categoria: "Guias",
    grupo: "Grupo 4: Ciencias",
    idioma: "ES",
    vigencia: "2026-Vigente",
    nivel: "NM / NS",
    archivo: "Environmental Systems and Societies Guide 2026 - Spanish.pdf",
    tags: ["sistemas ambientales", "ecologia", "recursos", "primera version ns"]
  },

  // GRUPO 5: MATEMÁTICAS
  {
    id: "IB-G5-001",
    titulo: "Matemáticas: Análisis y Enfoques (AA)",
    categoria: "Guias",
    grupo: "Grupo 5: Matemáticas",
    idioma: "ES",
    vigencia: "2021-Vigente",
    nivel: "NM / NS",
    archivo: "Mathematics Analysis and Approaches Guide 2021 - Spanish.pdf",
    tags: ["analisis matematico", "calculo", "exploracion matematica", "criterios ia"]
  },
  {
    id: "IB-G5-002",
    titulo: "Mathematics: Analysis and Approaches Guide (AA)",
    categoria: "Guias",
    grupo: "Grupo 5: Matemáticas",
    idioma: "EN",
    vigencia: "2021-Current",
    nivel: "SL / HL",
    archivo: "Mathematics Analysis and Approaches Guide 2021 - English.pdf",
    tags: ["calculus", "algebra", "mathematical exploration", "paper 3 hl"]
  },
  {
    id: "IB-G5-003",
    titulo: "Matemáticas: Aplicaciones e Interpretación (AI)",
    categoria: "Guias",
    grupo: "Grupo 5: Matemáticas",
    idioma: "ES",
    vigencia: "2021-Vigente",
    nivel: "NM / NS",
    archivo: "Mathematics Applications and Interpretation Guide 2021 - Spanish.pdf",
    tags: ["estadistica", "modelizacion", "calculadora cgd", "exploracion"]
  },
  {
    id: "IB-G5-004",
    titulo: "Mathematics: Applications and Interpretation Guide (AI)",
    categoria: "Guias",
    grupo: "Grupo 5: Matemáticas",
    idioma: "EN",
    vigencia: "2021-Current",
    nivel: "SL / HL",
    archivo: "Mathematics Applications and Interpretation Guide 2021 - English.pdf",
    tags: ["statistics", "modelling", "technology", "mathematical exploration"]
  },

  // GRUPO 6: ARTES
  {
    id: "IB-G6-001",
    titulo: "Guía de Artes Visuales",
    categoria: "Guias",
    grupo: "Grupo 6: Artes",
    idioma: "ES",
    vigencia: "2017-Vigente",
    nivel: "NM / NS",
    archivo: "Visual Arts Guide - Spanish.pdf",
    tags: ["estudio comparativo", "carpeta de proceso", "exposicion artistica"]
  },
  {
    id: "IB-G6-002",
    titulo: "Visual Arts Guide",
    categoria: "Guias",
    grupo: "Grupo 6: Artes",
    idioma: "EN",
    vigencia: "2017-Current",
    nivel: "SL / HL",
    archivo: "Visual Arts Guide - English.pdf",
    tags: ["comparative study", "process portfolio", "exhibition"]
  },
  {
    id: "IB-G6-003",
    titulo: "Guía de Música",
    categoria: "Guias",
    grupo: "Grupo 6: Artes",
    idioma: "ES",
    vigencia: "2022-Vigente",
    nivel: "NM / NS",
    archivo: "Music Guide 2022 - Spanish.pdf",
    tags: ["exploracion musical", "experimentacion", "presentacion", "proyecto contemporaneo"]
  },
  {
    id: "IB-G6-004",
    titulo: "Music Guide",
    categoria: "Guias",
    grupo: "Grupo 6: Artes",
    idioma: "EN",
    vigencia: "2022-Current",
    nivel: "SL / HL",
    archivo: "Music Guide 2022 - English.pdf",
    tags: ["musical exploration", "experimenting with music", "presenting music"]
  },

  // NORMATIVA Y POLÍTICAS DEL IB
  {
    id: "IB-NORM-001",
    titulo: "Reglamento General del Programa del Diploma",
    categoria: "Normativa",
    grupo: "Normativa y Políticas Generales",
    idioma: "ES",
    vigencia: "Vigente",
    nivel: "Institucional",
    archivo: "Reglamento General del Programa del Diploma - Spanish.pdf",
    tags: ["requisitos diploma", "condiciones de aprobacion", "24 puntos", "faltas de conducta"]
  },
  {
    id: "IB-NORM-002",
    titulo: "General Regulations: Diploma Programme",
    categoria: "Normativa",
    grupo: "Normativa y Políticas Generales",
    idioma: "EN",
    vigencia: "Current",
    nivel: "Institutional",
    archivo: "General Regulations Diploma Programme - English.pdf",
    tags: ["diploma requirements", "24 points", "academic misconduct", "bilingual diploma"]
  },
  {
    id: "IB-NORM-003",
    titulo: "Integridad y Probidad Académica en el IB",
    categoria: "Normativa",
    grupo: "Normativa y Políticas Generales",
    idioma: "ES",
    vigencia: "Vigente",
    nivel: "Institucional",
    archivo: "Politica de Integridad Academica - Spanish.pdf",
    tags: ["plagio", "colusion", "uso de ia generativa", "citacion apa", "autenticidad"]
  },
  {
    id: "IB-NORM-004",
    titulo: "Academic Integrity Policy (IB)",
    categoria: "Normativa",
    grupo: "Normativa y Políticas Generales",
    idioma: "EN",
    vigencia: "Current",
    nivel: "Institutional",
    archivo: "Academic Integrity Policy - English.pdf",
    tags: ["plagiarism", "generative ai policy", "referencing", "intellectual property"]
  }
];

const QUICK_PROMPTS = [
  {
    titulo: "Evaluación Interna Ciencias 2025",
    prompt: "¿Cuáles son los criterios de evaluación y requisitos formales para la Evaluación Interna de Ciencias (Biología, Química y Física) para los exámenes vigentes?"
  },
  {
    titulo: "Criterios del Ensayo de TOK",
    prompt: "¿Cómo se evalúa el Ensayo de Teoría del Conocimiento (TOK) y qué aspectos determinan la banda de máxima calificación?"
  },
  {
    titulo: "Etapas y Requisitos de CAS",
    prompt: "¿Cuáles son las 5 etapas de CAS y cómo deben evidenciar los alumnos los 7 resultados de aprendizaje?"
  },
  {
    titulo: "Monografía: Matriz y RPPF",
    prompt: "¿Cuáles son los 5 criterios de evaluación de la Monografía y qué peso tienen las sesiones de reflexión (formulario RPPF)?"
  },
  {
    titulo: "Política de Inteligencia Artificial",
    prompt: "¿Cuál es la postura oficial del Bachillerato Internacional sobre el uso de herramientas de Inteligencia Artificial (IA) en trabajos evaluados?"
  },
  {
    titulo: "Diferencias Matemáticas AA vs AI",
    prompt: "¿Cuáles son las diferencias curriculares y de enfoque metodológico entre Matemáticas Análisis y Enfoques (AA) y Matemáticas Aplicaciones e Interpretación (AI)?"
  }
];

export async function render(container, userSession) {
  if (!container) return;

  const user = userSession || { nombre: "Docente CIARM", correo: "docente@ciarm.edu.mx" };

  container.innerHTML = `
    <div class="card-container-wide ib-module-wrap" style="animation: fadeIn 0.3s ease;">
      
      <!-- ENCABEZADO SUPERIOR -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:1px solid #E2E8F0; padding-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <a href="#inicio" style="color:var(--primary-color, #26487F); text-decoration:none; font-weight:700; font-size:0.88rem;">← Volver al Inicio</a>
            <span style="color:#CBD5E1;">|</span>
            <span style="background:var(--gold-color, #C1B27E); color:#FFF; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem; text-transform:uppercase;">Programa del Diploma</span>
          </div>
          <h2 style="margin:4px 0; color:var(--primary-color, #26487F); font-family:Kefa, Georgia, serif; font-size:1.6rem;">🎓 Módulo IB — Bachillerato Internacional</h2>
          <p style="margin:0; color:#64748B; font-size:0.88rem;">
            Asistente pedagógico, repositorio de guías oficiales y recursos curriculares para docentes del CIARM.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <a href="${IB_SHARED_DRIVE_URL}" target="_blank" rel="noopener noreferrer" 
             style="display:inline-flex; align-items:center; gap:8px; background:#0A192F; color:#FFF; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:700; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:all 0.2s ease;">
            <span>📂</span> Abrir Unidad Compartida en Drive
          </a>
        </div>
      </div>

      <!-- BADGES DE STATUS DEL REPOSITORIO -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:24px;">
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid var(--primary-color, #26487F); padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Colección Curada</span>
          <strong style="font-size:1.15rem; color:#0A192F;">18,892 Documentos</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">16.2 GB en Google Drive</small>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid var(--gold-color, #C1B27E); padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Idiomas Autorizados</span>
          <strong style="font-size:1.15rem; color:#0A192F;">Español & English</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">Filtrado oficial CIARM</small>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid #10B981; padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Vigencia Curricular</span>
          <strong style="font-size:1.15rem; color:#0A192F;">Guías 2025 / 2026</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">Ciencias, Matemáticas, Core</small>
        </div>
      </div>

      <!-- SECCIÓN 1: ASISTENTE PEDAGÓGICO IB (CHAT IA) -->
      <section style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:28px; box-shadow:0 2px 6px rgba(0,0,0,0.04); overflow:hidden;">
        <div style="background:#0A192F; color:#FFFFFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid var(--gold-color, #C1B27E);">
          <div>
            <h3 style="margin:0; font-size:1.1rem; font-family:Kefa, Georgia, serif; color:#FFFFFF; display:flex; align-items:center; gap:8px;">
              <span>🤖</span> Asistente Pedagógico IB
            </h3>
            <p style="margin:3px 0 0 0; font-size:0.78rem; color:#CBD5E1;">
              Consultas metodológicas, criterios de evaluación y planificación fundamentadas en las guías oficiales.
            </p>
          </div>
          <span style="background:rgba(193, 178, 126, 0.2); border:1px solid var(--gold-color, #C1B27E); color:#FFF; font-size:0.72rem; padding:4px 10px; border-radius:20px; font-weight:600;">
            ● Fundamentado en Guías Oficiales
          </span>
        </div>

        <div style="padding:16px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
          <span style="display:block; font-size:0.75rem; font-weight:700; color:#64748B; margin-bottom:8px; text-transform:uppercase;">
            💡 Consultas rápidas sugeridas:
          </span>
          <div style="display:flex; flex-wrap:wrap; gap:8px;" id="ib-quick-prompts">
            ${QUICK_PROMPTS.map((p, idx) => `
              <button class="ib-prompt-chip" data-idx="${idx}" style="background:#FFFFFF; border:1px solid #CBD5E1; color:#1E293B; font-size:0.78rem; font-weight:600; padding:6px 12px; border-radius:20px; cursor:pointer; transition:all 0.2s ease;">
                💬 ${p.titulo}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- ÁREA DE DIÁLOGO DEL CHAT -->
        <div id="ib-chat-box" style="padding:20px; max-height:360px; min-height:160px; overflow-y:auto; background:#FFFFFF; display:flex; flex-direction:column; gap:14px;">
          <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid var(--primary-color, #26487F); padding:14px; border-radius:6px; font-size:0.88rem; color:#1E3A8A; line-height:1.5;">
            👋 <strong>¡Hola, ${user.nombre || 'colega educador'}!</strong> Soy el Asistente Pedagógico del <strong>Módulo IB de CIARM</strong>.<br>
            Tengo indexadas las guías oficiales del Programa del Diploma, informes de examinador y reglamentos. 
            Puedes preguntarme sobre ponderaciones, criterios de corrección, formatos de evaluación interna, TOK o Monografía.
          </div>
        </div>

        <!-- FORMULARIO DE ENVÍO -->
        <form id="ib-chat-form" style="padding:16px 20px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; gap:10px;">
          <input type="text" id="ib-chat-input" placeholder="Pregunta sobre criterios, guías o normativas del IB..." 
                 style="flex:1; padding:12px 16px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.9rem; outline:none; background:#FFFFFF; box-sizing:border-box;" />
          <button type="submit" id="ib-chat-send-btn" 
                  style="background:#0A192F; color:#FFFFFF; border:none; padding:12px 24px; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.9rem; transition:background 0.2s ease;">
            Consultar
          </button>
        </form>
      </section>

      <!-- SECCIÓN 2: EXPLORADOR Y CATÁLOGO DE RECURSOS CURRICULARES -->
      <section style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:20px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0; font-size:1.2rem; color:#0A192F; font-family:Kefa, Georgia, serif;">
              📚 Catálogo de Guías y Recursos Curriculares
            </h3>
            <p style="margin:2px 0 0 0; font-size:0.8rem; color:#64748B;">
              Búsqueda indexada sobre el repositorio institucional de 18,892 documentos (Google Drive).
            </p>
          </div>
          <span id="ib-counter-tag" style="background:#F1F5F9; color:#475569; font-size:0.8rem; padding:6px 12px; border-radius:20px; font-weight:700;">
            Mostrando ${CURATED_SAMPLE_CATALOG.length} recursos destacados
          </span>
        </div>

        <!-- BARRA DE FILTROS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px; background:#F8FAFC; padding:14px; border-radius:6px; border:1px solid #E2E8F0;">
          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
              🔍 Buscar por título o tema
            </label>
            <input type="text" id="ib-search-input" placeholder="Ej. Biología, TOK, CAS, IA..." 
                   style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:4px; font-size:0.85rem; box-sizing:border-box; background:#FFF;" />
          </div>

          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
              📂 Grupo / Área Curricular
            </label>
            <select id="ib-filter-group" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:4px; font-size:0.85rem; box-sizing:border-box; background:#FFF;">
              <option value="ALL">-- Todas las Áreas y Grupos --</option>
              <option value="Core">Core: TOK, Monografía y CAS</option>
              <option value="Grupo 1">Grupo 1: Lengua y Literatura</option>
              <option value="Grupo 2">Grupo 2: Adquisición de Lenguas</option>
              <option value="Grupo 3">Grupo 3: Individuos y Sociedades</option>
              <option value="Grupo 4">Grupo 4: Ciencias (2025/2026)</option>
              <option value="Grupo 5">Grupo 5: Matemáticas (AA / AI)</option>
              <option value="Grupo 6">Grupo 6: Artes</option>
              <option value="Normativa">Normativa y Políticas Oficiales</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
              🌐 Idioma
            </label>
            <select id="ib-filter-lang" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:4px; font-size:0.85rem; box-sizing:border-box; background:#FFF;">
              <option value="ALL">Español & English (Ambos)</option>
              <option value="ES">🇪🇸 Solo Español</option>
              <option value="EN">🇬🇧 Solo Inglés</option>
            </select>
          </div>
        </div>

        <!-- GRID DE TARJETAS DE DOCUMENTOS -->
        <div id="ib-catalog-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px;">
          <!-- Se inyecta dinámicamente -->
        </div>

      </section>

    </div>
  `;

  // Renderizar catálogo inicial
  renderCatalog(CURATED_SAMPLE_CATALOG);

  // Vincular eventos de filtros
  const searchInput = document.getElementById("ib-search-input");
  const filterGroup = document.getElementById("ib-filter-group");
  const filterLang = document.getElementById("ib-filter-lang");

  function applyFilters() {
    const query = (searchInput?.value || "").toLowerCase().trim();
    const group = filterGroup?.value || "ALL";
    const lang = filterLang?.value || "ALL";

    const filtered = CURATED_SAMPLE_CATALOG.filter(item => {
      const matchQuery = !query || 
        item.titulo.toLowerCase().includes(query) || 
        item.grupo.toLowerCase().includes(query) ||
        item.tags.some(t => t.toLowerCase().includes(query));

      const matchGroup = group === "ALL" || item.grupo.includes(group) || item.categoria === group;
      const matchLang = lang === "ALL" || item.idioma === lang;

      return matchQuery && matchGroup && matchLang;
    });

    renderCatalog(filtered);
    const counter = document.getElementById("ib-counter-tag");
    if (counter) counter.textContent = `Mostrando ${filtered.length} de ${CURATED_SAMPLE_CATALOG.length} recursos`;
  }

  searchInput?.addEventListener("input", applyFilters);
  filterGroup?.addEventListener("change", applyFilters);
  filterLang?.addEventListener("change", applyFilters);

  // Chips de preguntas rápidas
  document.querySelectorAll(".ib-prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const idx = parseInt(chip.dataset.idx, 10);
      const promptObj = QUICK_PROMPTS[idx];
      if (promptObj) {
        const input = document.getElementById("ib-chat-input");
        if (input) {
          input.value = promptObj.prompt;
          input.focus();
        }
      }
    });
  });

  // Enviar mensaje al Asistente
  const chatForm = document.getElementById("ib-chat-form");
  const chatBox = document.getElementById("ib-chat-box");
  const chatInput = document.getElementById("ib-chat-input");
  const sendBtn = document.getElementById("ib-chat-send-btn");

  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = (chatInput?.value || "").trim();
    if (!message) return;

    // Agregar mensaje del usuario
    appendMessage(chatBox, "user", message, user.nombre);
    chatInput.value = "";
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.6";

    // Indicador de pensando
    const thinkingId = appendThinking(chatBox);

    try {
      // Intentar consultar proxy backend voiceflow.php
      const res = await fetch("/voiceflow.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[Módulo IB CIARM - Consulta Curricular]: ${message}`,
          conversationID: `ib-${(user.correo || 'anon').replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`
        })
      });

      removeThinking(thinkingId);

      if (res.ok) {
        const data = await res.json();
        const textResponse = extractVoiceflowText(data);
        if (textResponse) {
          appendMessage(chatBox, "assistant", textResponse, "Asistente IB CIARM");
        } else {
          appendLocalPedagogicalResponse(chatBox, message);
        }
      } else {
        appendLocalPedagogicalResponse(chatBox, message);
      }
    } catch (err) {
      removeThinking(thinkingId);
      appendLocalPedagogicalResponse(chatBox, message);
    } finally {
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  });
}

function renderCatalog(items) {
  const grid = document.getElementById("ib-catalog-grid");
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:30px; color:#64748B; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:6px;">
        🔍 No se encontraron documentos con los filtros seleccionados.<br>
        <small style="color:#94A3B8;">Prueba buscando otra palabra clave o cambiando el selector de idioma/área.</small>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const isEs = item.idioma === "ES";
    const langBadge = isEs ? "🇪🇸 Español" : "🇬🇧 English";
    const langColor = isEs ? "#D97706" : "#2563EB";
    const driveSearchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(item.archivo)}`;

    return `
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s, box-shadow 0.2s ease; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.7rem; font-weight:700; color:#64748B; text-transform:uppercase;">${item.grupo}</span>
            <span style="font-size:0.7rem; font-weight:700; color:${langColor}; background:${isEs ? '#FEF3C7' : '#EFF6FF'}; padding:2px 8px; border-radius:12px;">
              ${langBadge}
            </span>
          </div>
          <h4 style="margin:0 0 6px 0; color:#0A192F; font-size:0.95rem; font-weight:700; line-height:1.3;">
            ${item.titulo}
          </h4>
          <p style="margin:0 0 10px 0; font-size:0.78rem; color:#64748B;">
            Vigencia: <strong>${item.vigencia}</strong> • Nivel: <strong>${item.nivel}</strong>
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
            ${item.tags.slice(0, 3).map(tag => `
              <span style="font-size:0.68rem; background:#F1F5F9; color:#475569; padding:2px 6px; border-radius:4px;">#${tag}</span>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; gap:8px; border-top:1px solid #F1F5F9; padding-top:10px;">
          <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" 
             style="flex:1; text-align:center; background:#0A192F; color:#FFF; text-decoration:none; padding:8px 12px; border-radius:4px; font-size:0.78rem; font-weight:700; transition:background 0.2s ease;">
            📂 Ver en Drive
          </a>
          <button onclick="navigator.clipboard.writeText('${item.archivo}'); alert('Título copiado: ${item.archivo}');" 
                  title="Copiar nombre de archivo" 
                  style="background:#F8FAFC; border:1px solid #CBD5E1; color:#475569; padding:8px 10px; border-radius:4px; cursor:pointer; font-size:0.78rem;">
            📋
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function appendMessage(container, sender, text, author) {
  if (!container) return;
  const isUser = sender === "user";
  const msgEl = document.createElement("div");
  msgEl.style.display = "flex";
  msgEl.style.flexDirection = "column";
  msgEl.style.alignItems = isUser ? "flex-end" : "flex-start";

  msgEl.innerHTML = `
    <span style="font-size:0.72rem; color:#64748B; margin-bottom:3px; font-weight:600;">
      ${author || (isUser ? 'Tú' : 'Asistente IB')}
    </span>
    <div style="background:${isUser ? '#0A192F' : '#F1F5F9'}; color:${isUser ? '#FFF' : '#1E293B'}; border-radius:8px; padding:12px 16px; max-width:85%; font-size:0.88rem; line-height:1.5; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:${isUser ? 'none' : '1px solid #E2E8F0'}; white-space:pre-wrap;">
      ${escapeHtml(text)}
    </div>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function appendThinking(container) {
  const id = `thinking-${Date.now()}`;
  const el = document.createElement("div");
  el.id = id;
  el.style.fontSize = "0.8rem";
  el.style.color = "#64748B";
  el.style.fontStyle = "italic";
  el.style.padding = "6px 0";
  el.textContent = "🔍 Consultando acervo documental del IB...";
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeThinking(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendLocalPedagogicalResponse(chatBox, message) {
  const m = message.toLowerCase();
  let answer = "";

  if (m.includes("evaluacion interna") || m.includes("ciencias") || m.includes("biologia") || m.includes("quimica") || m.includes("fisica")) {
    answer = `📌 **Evaluación Interna de Ciencias (Syllabus 2025/2026):**
La investigación individual representa el 20% de la calificación final (ponderada sobre 24 puntos). 
Los criterios unificados para Biología, Química y Física son:
1. **Conclusión (Criterio 1):** Validez, interpretación científica y comparación con literatura establecida.
2. **Evaluación (Criterio 2):** Fortalezas, limitaciones metodológicas y mejoras realistas sugeridas.
3. **Comunicación:** Estructura clara y formato académico conciso (máximo 3,000 palabras o 12 páginas).
*(Consulta el documento completo en la carpeta: 'IB SUBJECT GUIDES/Group 4 - Sciences')*`;
  } else if (m.includes("tok") || m.includes("teoria del conocimiento") || m.includes("ensayo")) {
    answer = `📌 **Componente de Evaluación de TOK (Teoría del Conocimiento):**
El curso se evalúa mediante dos componentes:
• **Exposición de TOK (33%):** Evaluación interna moderada, enfocada en 3 objetos reales respondiendo a una pregunta prescrita.
• **Ensayo de TOK (67%):** Evaluación externa sobre uno de los 6 títulos prescritos (máximo 1,600 palabras).
Criterio central: Capacidad de conectar las Áreas de Conocimiento con el marco conceptual, utilizando argumentos y contraargumentos basados en ejemplos concretos.`;
  } else if (m.includes("cas") || m.includes("creatividad")) {
    answer = `📌 **Requisitos y Etapas de CAS:**
CAS no se califica con puntos pero es requisito obligatorio para la obtención del Diploma:
• **Las 5 etapas:** Investigación, Preparación, Acción, Reflexión y Demostración.
• **Los 7 resultados de aprendizaje:** Identificar fortalezas, afrontar desafíos, planificar experiencias, compromiso, trabajo colaborativo, compromiso global y ética.
• Es indispensable completar un **Proyecto CAS** de al menos un mes con trabajo en equipo.`;
  } else if (m.includes("monografia") || m.includes("extended essay")) {
    answer = `📌 **Estructura de la Monografía (Extended Essay):**
Investigación académica independiente de 4,000 palabras:
• Criterio A: Enfoque y método (6 pts)
• Criterio B: Conocimiento y comprensión (6 pts)
• Criterio C: Pensamiento crítico (12 pts)
• Criterio D: Presentación formal (4 pts)
• Criterio E: Compromiso / Reflexión en el formulario RPPF (6 pts).`;
  } else if (m.includes("inteligencia artificial") || m.includes("ia") || m.includes("artificial intelligence") || m.includes("chatgpt")) {
    answer = `📌 **Postura Oficial del IB sobre Inteligencia Artificial:**
El Bachillerato Internacional (IB) NO prohíbe el uso de IA generativa, pero establece directrices estrictas de probidad académica:
1. **Herramienta de apoyo, no autor:** El trabajo evaluado debe ser enteramente creación del alumno. La IA no puede figurar como autor ni sustituir el pensamiento crítico del estudiante.
2. **Declaración y Transparencia Obligatoria:** Todo uso de herramientas como ChatGPT debe ser transparentado explícitamente en el trabajo, indicando la herramienta, la fecha y el prompt utilizado en un apéndice o cita formal.
3. **Falta de Conducta:** Presentar texto o ideas generadas por IA sin atribuir como trabajo propio se clasifica directamente como plagio y falta de probidad académica sujeta a anulación de calificación.`;
  } else if (m.includes("matematicas") || m.includes("aa") || m.includes("ai") || m.includes("analisis") || m.includes("aplicaciones")) {
    answer = `📌 **Diferencias entre Matemáticas AA y Matemáticas AI:**
• **Análisis y Enfoques (AA):** Énfasis en rigor algebraico clásico, demostraciones formales, cálculo infinitesimal continuo y análisis teórico de funciones. Recomendado para ingenierías, física, matemáticas puras y ciencias exactas.
• **Aplicaciones e Interpretación (AI):** Énfasis en modelización matemática mediante tecnología y cálculo numérico, estadística avanzada descriptiva e inferencial y sistemas discretos. Recomendado para ciencias sociales, economía, negocios, diseño y medicina.
Ambas ramas se ofrecen en Nivel Medio (NM) y Nivel Superior (NS) y comparten el componente de Exploración Matemática (20% de evaluación interna).`;
  } else {
    answer = `📌 **Consulta Curricular Registrada:**
He recibido tu consulta sobre: "${message}".
Para profundizar en las normativas específicas y rúbricas completas de este tema, puedes consultar el **Catálogo de Guías** ubicado en la sección inferior de este módulo o abrir la carpeta en la **Unidad Compartida de Google Drive** con los 18,892 documentos indexados.`;
  }

  appendMessage(chatBox, "assistant", answer, "Asistente IB CIARM");
}

function extractVoiceflowText(data) {
  if (Array.isArray(data)) {
    const texts = data.filter(d => d.type === 'text' && d.payload?.message).map(d => d.payload.message);
    if (texts.length > 0) return texts.join("\n\n");
  }
  if (data?.text) return data.text;
  if (data?.message) return data.message;
  return null;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { render, renderIbWidget };
export default render;
