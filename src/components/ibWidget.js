/**
 * Portal CIARM - Módulo IB (Bachillerato Internacional)
 * Asistente Pedagógico IA (Google Cloud Vertex AI & Gemini) + Catálogo Curricular Facetado por IA
 * Versión: 18.9.0
 */

import { IB_CLASSIFIED_CATALOG, computeFacets, filterCatalog, IB_SHARED_DRIVE_URL } from '../data/ibCatalog.js';

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
  },
  {
    titulo: "Nueva Guía ESS 2026",
    prompt: "¿Qué cambios curriculares introduce la nueva guía de Sistemas Ambientales y Sociedades (ESS) con primeros exámenes en 2026 y la incorporación del Nivel Superior (NS)?"
  }
];

let conversationHistory = [];

async function render(container, userSession) {
  if (!container) return;

  const user = userSession || { nombre: "Docente CIARM", correo: "docente@ciarm.edu.mx" };
  const facets = computeFacets(IB_CLASSIFIED_CATALOG);

  container.innerHTML = `
    <div class="card-container-wide ib-module-wrap" style="animation: fadeIn 0.3s ease;">
      
      <!-- ENCABEZADO SUPERIOR INSTITUCIONAL -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:1px solid #E2E8F0; padding-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <a href="#inicio" style="color:var(--primary-color, #26487F); text-decoration:none; font-weight:700; font-size:0.88rem;">← Volver al Inicio</a>
            <span style="color:#CBD5E1;">|</span>
            <span style="background:var(--gold-color, #C1B27E); color:#FFF; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem; text-transform:uppercase;">Programa del Diploma</span>
          </div>
          <h2 style="margin:4px 0; color:var(--primary-color, #26487F); font-family:Kefa, Georgia, serif; font-size:1.6rem;">Módulo IB — Bachillerato Internacional</h2>
          <p style="margin:0; color:#64748B; font-size:0.88rem;">
            Asistente pedagógico con IA de Google, repositorio de guías oficiales y recursos curriculares para docentes del CIARM.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <a href="${IB_SHARED_DRIVE_URL}" target="_blank" rel="noopener noreferrer" 
             style="display:inline-flex; align-items:center; gap:8px; background:#0A192F; color:#FFF; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:700; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:all 0.2s ease;">
            Abrir Unidad Compartida en Drive ↗
          </a>
        </div>
      </div>

      <!-- BADGES DE STATUS DEL REPOSITORIO Y ARQUITECTURA GOOGLE AI -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:24px;">
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid var(--primary-color, #26487F); padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Colección Curada</span>
          <strong style="font-size:1.15rem; color:#0A192F;">18,892 Documentos</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">16.21 GB en Google Drive</small>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid var(--gold-color, #C1B27E); padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Motor de Asistencia IA</span>
          <strong style="font-size:1.15rem; color:#0A192F;">Google Vertex & Gemini</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">Grounding en Documentos IB</small>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid #10B981; padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Clasificador y Facetas</span>
          <strong style="font-size:1.15rem; color:#0A192F;">Gemini Auto-Classifier</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">Metadatos y Filtros Dinámicos</small>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-left:4px solid #6366F1; padding:12px; border-radius:6px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase; display:block;">Idiomas Autorizados</span>
          <strong style="font-size:1.15rem; color:#0A192F;">Español & English</strong>
          <small style="display:block; color:#94A3B8; font-size:0.75rem;">Filtrado oficial del colegio</small>
        </div>
      </div>

      <!-- SECCIÓN 1: ASISTENTE PEDAGÓGICO IB (CHAT NATIVO GOOGLE CLOUD) -->
      <section style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:28px; box-shadow:0 2px 6px rgba(0,0,0,0.04); overflow:hidden;">
        <div style="background:#0A192F; color:#FFFFFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid var(--gold-color, #C1B27E); flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="margin:0; font-size:1.1rem; font-family:Kefa, Georgia, serif; color:#FFFFFF; display:flex; align-items:center; gap:8px;">
              Asistente Pedagógico IB (Google Cloud AI)
            </h3>
            <p style="margin:3px 0 0 0; font-size:0.78rem; color:#CBD5E1;">
              Consultas metodológicas, criterios de evaluación y planificación fundamentadas en el acervo de guías oficiales.
            </p>
          </div>
          <span style="background:rgba(193, 178, 126, 0.25); border:1px solid var(--gold-color, #C1B27E); color:#FFF; font-size:0.72rem; padding:4px 10px; border-radius:20px; font-weight:600;">
            ● RAG & Grounding Oficial Activo
          </span>
        </div>

        <!-- CHIPS DE CONSULTAS RÁPIDAS -->
        <div style="padding:14px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
          <span style="display:block; font-size:0.75rem; font-weight:700; color:#64748B; margin-bottom:8px; text-transform:uppercase;">
            Consultas sugeridas (Syllabus vigente):
          </span>
          <div style="display:flex; flex-wrap:wrap; gap:8px;" id="ib-quick-prompts">
            ${QUICK_PROMPTS.map((p, idx) => `
              <button class="ib-prompt-chip" data-idx="${idx}" style="background:#FFFFFF; border:1px solid #CBD5E1; color:#1E293B; font-size:0.78rem; font-weight:600; padding:6px 12px; border-radius:20px; cursor:pointer; transition:all 0.2s ease;">
                ${p.titulo}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- ÁREA DE CONVERSACIÓN -->
        <div id="ib-chat-box" style="padding:20px; max-height:420px; min-height:180px; overflow-y:auto; background:#FFFFFF; display:flex; flex-direction:column; gap:16px;">
          <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid var(--primary-color, #26487F); padding:14px; border-radius:6px; font-size:0.88rem; color:#1E3A8A; line-height:1.5;">
            <strong>Bienvenido(a), ${escapeHtml(user.nombre || 'colega educador')}.</strong> Soy el Asistente Pedagógico del <strong>Módulo IB del CIARM</strong>.<br>
            Tengo indexado el acervo curricular oficial del Bachillerato Internacional (ciencias 2025/2026, matemáticas, lengua, humanidades, artes y componentes del Core).<br>
            Puedes consultarme sobre ponderaciones, criterios de corrección, formatos de evaluación interna, TOK, CAS o Monografía.
          </div>
        </div>

        <!-- FORMULARIO DE ENVÍO -->
        <form id="ib-chat-form" style="padding:16px 20px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; gap:10px;">
          <input type="text" id="ib-chat-input" placeholder="Pregunta sobre criterios, guías, rúbricas o normativas del IB..." 
                 style="flex:1; padding:12px 16px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.9rem; outline:none; background:#FFFFFF; box-sizing:border-box;" />
          <button type="submit" id="ib-chat-send-btn" 
                  style="background:#0A192F; color:#FFFFFF; border:none; padding:12px 24px; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.9rem; transition:background 0.2s ease; display:flex; align-items:center; gap:6px;">
            <span>Consultar</span> <span>→</span>
          </button>
        </form>
      </section>

      <!-- SECCIÓN 2: EXPLORADOR CURRICULAR CON FILTROS AUTOMÁTICOS POR IA -->
      <section style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:20px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="margin:0; font-size:1.2rem; font-family:Kefa, Georgia, serif; color:var(--primary-color, #26487F);">
              Repositorio de Recursos y Guías Oficiales
            </h3>
            <p style="margin:2px 0 0 0; font-size:0.8rem; color:#64748B;">
              Clasificación y facetas automáticas generadas por IA. Consulta, descarga y previsualiza en Google Drive.
            </p>
          </div>
          <span id="ib-counter-tag" style="background:#F1F5F9; color:#475569; font-size:0.78rem; font-weight:700; padding:4px 12px; border-radius:12px;">
            Mostrando ${IB_CLASSIFIED_CATALOG.length} recursos indexados
          </span>
        </div>

        <!-- FILTROS FACETADOS POR IA -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:16px; margin-bottom:20px; display:flex; flex-direction:column; gap:14px;">
          
          <!-- FILA 1: BÚSQUEDA Y SELECTORES DE TIPO E IDIOMA -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
            <div>
              <label for="ib-search-input" style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
                Búsqueda en texto y etiquetas:
              </label>
              <input type="text" id="ib-search-input" placeholder="Ej. Biología 2025, TOK, Criterio A..." 
                     style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:4px; font-size:0.85rem; box-sizing:border-box; background:#FFF;" />
            </div>

            <div>
              <label for="ib-filter-tipo" style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
                Tipo de Documento:
              </label>
              <select id="ib-filter-tipo" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:4px; font-size:0.85rem; box-sizing:border-box; background:#FFF;">
                <option value="ALL">Todas las Categorías</option>
                ${facets.tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">
                Idioma Oficial:
              </label>
              <div style="display:flex; gap:6px;">
                <button class="ib-lang-btn active" data-lang="ALL" style="flex:1; padding:8px 6px; font-size:0.78rem; font-weight:700; border-radius:4px; border:1px solid #CBD5E1; cursor:pointer; background:#0A192F; color:#FFF;">
                  Todos
                </button>
                <button class="ib-lang-btn" data-lang="ES" style="flex:1; padding:8px 6px; font-size:0.78rem; font-weight:700; border-radius:4px; border:1px solid #CBD5E1; cursor:pointer; background:#FFF; color:#475569;">
                  Español
                </button>
                <button class="ib-lang-btn" data-lang="EN" style="flex:1; padding:8px 6px; font-size:0.78rem; font-weight:700; border-radius:4px; border:1px solid #CBD5E1; cursor:pointer; background:#FFF; color:#475569;">
                  English
                </button>
              </div>
            </div>
          </div>

          <!-- FILA 2: CHIPS DE GRUPOS / ASIGNATURAS -->
          <div>
            <span style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:6px; text-transform:uppercase;">
              Filtrar por Grupo Curricular:
            </span>
            <div style="display:flex; flex-wrap:wrap; gap:6px;" id="ib-group-chips">
              <button class="ib-group-chip active" data-group="ALL" style="background:#0A192F; color:#FFF; border:1px solid #0A192F; padding:4px 10px; border-radius:14px; font-size:0.75rem; font-weight:600; cursor:pointer;">
                Todos los Grupos
              </button>
              ${facets.grupos.map(g => `
                <button class="ib-group-chip" data-group="${escapeHtml(g)}" style="background:#FFFFFF; color:#475569; border:1px solid #CBD5E1; padding:4px 10px; border-radius:14px; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.15s ease;">
                  ${escapeHtml(g)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- FILA 3: TAGS POPULARES GENERADOS POR IA -->
          <div>
            <span style="display:block; font-size:0.7rem; font-weight:700; color:#64748B; margin-bottom:4px; text-transform:uppercase;">
              Etiquetas frecuentes:
            </span>
            <div style="display:flex; flex-wrap:wrap; gap:5px;" id="ib-tags-bar">
              ${facets.popularTags.map(tag => `
                <span class="ib-tag-badge" data-tag="${escapeHtml(tag)}" style="font-size:0.68rem; background:#E2E8F0; color:#334155; padding:2px 8px; border-radius:4px; cursor:pointer; transition:background 0.2s ease;">
                  #${escapeHtml(tag)}
                </span>
              `).join('')}
            </div>
          </div>

        </div>

        <!-- GRID DE TARJETAS DE RECURSOS -->
        <div id="ib-catalog-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
          <!-- Las tarjetas se inyectan dinámicamente -->
        </div>

      </section>

    </div>
  `;

  // Estado reactivo de filtros
  let currentFilters = {
    query: "",
    grupo: "ALL",
    tipo: "ALL",
    vigencia: "ALL",
    idioma: "ALL",
    tag: "ALL"
  };

  const searchInput = document.getElementById("ib-search-input");
  const filterTipo = document.getElementById("ib-filter-tipo");
  const counterTag = document.getElementById("ib-counter-tag");

  function refreshCatalog() {
    const filtered = filterCatalog(IB_CLASSIFIED_CATALOG, currentFilters);
    renderCatalog(filtered);
    if (counterTag) {
      counterTag.textContent = `Mostrando ${filtered.length} de ${IB_CLASSIFIED_CATALOG.length} recursos`;
    }
  }

  // Escuchadores de filtros
  searchInput?.addEventListener("input", (e) => {
    currentFilters.query = e.target.value;
    refreshCatalog();
  });

  filterTipo?.addEventListener("change", (e) => {
    currentFilters.tipo = e.target.value;
    refreshCatalog();
  });

  // Selector de idioma
  document.querySelectorAll(".ib-lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ib-lang-btn").forEach(b => {
        b.style.background = "#FFF";
        b.style.color = "#475569";
        b.classList.remove("active");
      });
      btn.style.background = "#0A192F";
      btn.style.color = "#FFF";
      btn.classList.add("active");
      currentFilters.idioma = btn.dataset.lang || "ALL";
      refreshCatalog();
    });
  });

  // Selector de grupo
  document.querySelectorAll(".ib-group-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".ib-group-chip").forEach(c => {
        c.style.background = "#FFF";
        c.style.color = "#475569";
        c.style.borderColor = "#CBD5E1";
        c.classList.remove("active");
      });
      chip.style.background = "#0A192F";
      chip.style.color = "#FFF";
      chip.style.borderColor = "#0A192F";
      chip.classList.add("active");
      currentFilters.grupo = chip.dataset.group || "ALL";
      refreshCatalog();
    });
  });

  // Selector de tags populares
  document.querySelectorAll(".ib-tag-badge").forEach(badge => {
    badge.addEventListener("click", () => {
      const tag = badge.dataset.tag;
      if (currentFilters.tag === tag) {
        currentFilters.tag = "ALL";
        badge.style.background = "#E2E8F0";
        badge.style.color = "#334155";
      } else {
        document.querySelectorAll(".ib-tag-badge").forEach(b => {
          b.style.background = "#E2E8F0";
          b.style.color = "#334155";
        });
        currentFilters.tag = tag;
        badge.style.background = "var(--primary-color, #26487F)";
        badge.style.color = "#FFFFFF";
      }
      refreshCatalog();
    });
  });

  // Chips de preguntas rápidas sugeridas
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

  // Enviar mensaje al Asistente Google Cloud AI (ib-chat.php)
  const chatForm = document.getElementById("ib-chat-form");
  const chatBox = document.getElementById("ib-chat-box");
  const chatInput = document.getElementById("ib-chat-input");
  const sendBtn = document.getElementById("ib-chat-send-btn");

  const conversationID = `ib-session-${crypto.randomUUID()}`;
  let launched = false;
  let busy = false;

  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = (chatInput?.value || "").trim();
    if (!message || busy) return;
    busy = true;

    // Agregar mensaje del usuario a la UI
    appendMessage(chatBox, "user", message, user.nombre);
    chatInput.value = "";
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.6";

    // Indicador de pensando
    const thinkingId = appendThinking(chatBox);

    try {
      // Consulta al proxy server-side nativo Google ib-chat.php
      const res = await fetch("/ib-chat.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          module: 'ib',
          conversationID,
          launch: !launched,
          history: conversationHistory.slice(-6)
        })
      });

      removeThinking(thinkingId);

      if (res.ok) {
        const data = await res.json();
        launched = true;
        const textResponse = data?.answer || (Array.isArray(data?.messages) ? data.messages.filter(t => typeof t === "string" && t.trim()).join("\n\n") : data?.message);
        if (textResponse) {
          appendMessage(chatBox, "assistant", textResponse, "Asistente IB CIARM", data.citations);
          // Registrar en memoria de conversación
          conversationHistory.push({ role: "user", text: message });
          conversationHistory.push({ role: "model", text: textResponse });
        } else {
          appendMessage(chatBox, "assistant", "El asistente no devolvió contenido para esta consulta. Intenta reformular tu pregunta.", "Asistente IB CIARM");
        }
      } else if (res.status === 401) {
        appendMessage(chatBox, "assistant", "Tu sesión institucional ha expirado. Por favor, recarga la página para volver a iniciar sesión con tu cuenta de Google.", "Seguridad CIARM");
      } else if (res.status === 403) {
        appendMessage(chatBox, "assistant", "No tienes asignado el permiso de consulta al Módulo IB en DM05. Contacta a la Dirección o Coordinación IB.", "Control de Acceso");
      } else {
        appendMessage(chatBox, "assistant", "No fue posible conectar con el Asistente en este momento. Intenta nuevamente en unos instantes.", "Asistente IB CIARM");
      }
    } catch (err) {
      removeThinking(thinkingId);
      appendMessage(chatBox, "assistant", "Ocurrió un error al procesar la solicitud con el servicio de IA de Google. Verifica tu conexión e intenta nuevamente.", "Asistente IB CIARM");
    } finally {
      busy = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  });

  // Render inicial del catálogo
  refreshCatalog();
}

function renderCatalog(items) {
  const grid = document.getElementById("ib-catalog-grid");
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:36px 20px; color:#64748B; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:8px;">
        <strong>No se encontraron documentos con los filtros seleccionados.</strong><br>
        <small style="color:#94A3B8;">Prueba buscando otra palabra clave o restableciendo el selector de grupo o idioma.</small>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const isEs = item.idioma === "ES";
    const langBadge = isEs ? "Español" : "English";
    const langColor = isEs ? "#D97706" : "#2563EB";
    const langBg = isEs ? "#FEF3C7" : "#EFF6FF";

    return `
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s, box-shadow 0.2s ease; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
            <span style="font-size:0.68rem; font-weight:700; color:#64748B; text-transform:uppercase;">
              ${escapeHtml(item.grupo)}
            </span>
            <span style="font-size:0.68rem; font-weight:700; color:${langColor}; background:${langBg}; padding:2px 8px; border-radius:12px; white-space:nowrap;">
              ${langBadge}
            </span>
          </div>

          <h4 style="margin:0 0 6px 0; color:#0A192F; font-size:0.95rem; font-weight:700; line-height:1.35;">
            ${escapeHtml(item.titulo)}
          </h4>

          <div style="margin:0 0 8px 0; font-size:0.78rem; color:#64748B;">
            <span style="display:inline-block; margin-right:8px;">Materia: <strong>${escapeHtml(item.materia)}</strong></span><br>
            <span>Vigencia: <strong>${escapeHtml(item.vigencia)}</strong> • Nivel: <strong>${escapeHtml(item.nivel)}</strong></span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
            <span style="font-size:0.65rem; background:#EDE9FE; color:#5B21B6; padding:2px 6px; border-radius:4px; font-weight:600;">
              ${escapeHtml(item.tipo)}
            </span>
            ${(item.tags || []).slice(0, 3).map(tag => `
              <span style="font-size:0.65rem; background:#F1F5F9; color:#475569; padding:2px 6px; border-radius:4px;">#${escapeHtml(tag)}</span>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:6px; border-top:1px solid #F1F5F9; padding-top:10px;">
          <div style="display:flex; gap:8px;">
            <a href="${item.driveUrl}" target="_blank" rel="noopener noreferrer" 
               style="flex:1; text-align:center; background:#0A192F; color:#FFF; text-decoration:none; padding:8px 12px; border-radius:4px; font-size:0.78rem; font-weight:700; transition:background 0.2s ease;">
              Ver en Drive ↗
            </a>
            <button onclick="navigator.clipboard.writeText('${item.archivo.replace(/'/g, "\\'")}'); alert('Nombre copiado: ${item.archivo.replace(/'/g, "\\'")}');" 
                    title="Copiar nombre de archivo" 
                    style="background:#F8FAFC; border:1px solid #CBD5E1; color:#475569; padding:8px 12px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600;">
              Copiar
            </button>
          </div>
          <button class="ib-ask-guide-btn" data-title="${escapeHtml(item.titulo)}" 
                  style="width:100%; background:#F1F5F9; border:1px solid #E2E8F0; color:var(--primary-color, #26487F); font-size:0.75rem; font-weight:700; padding:6px; border-radius:4px; cursor:pointer; transition:all 0.2s ease;">
            Consultar con el Asistente →
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Conectar botón de preguntar al asistente desde cada tarjeta
  grid.querySelectorAll(".ib-ask-guide-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const title = btn.dataset.title;
      const input = document.getElementById("ib-chat-input");
      if (input && title) {
        input.value = `¿Cuáles son los requisitos clave, criterios de evaluación y recomendaciones pedagógicas en: ${title}?`;
        input.focus();
        document.getElementById("ib-chat-box")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

function appendMessage(container, sender, text, author, citations = []) {
  if (!container) return;
  const isUser = sender === "user";
  const msgEl = document.createElement("div");
  msgEl.style.display = "flex";
  msgEl.style.flexDirection = "column";
  msgEl.style.alignItems = isUser ? "flex-end" : "flex-start";

  const formattedContent = isUser ? escapeHtml(text) : formatMarkdown(text);

  let citationsHtml = '';
  if (!isUser && Array.isArray(citations) && citations.length > 0) {
    citationsHtml = `
      <div style="margin-top:12px; padding-top:10px; border-top:1px solid #CBD5E1; font-size:0.78rem;">
        <span style="font-weight:700; color:#475569; display:block; margin-bottom:6px;">Fuentes oficiales del IB citadas:</span>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${citations.map(c => `
            <a href="${c.driveUrl || IB_SHARED_DRIVE_URL}" target="_blank" rel="noopener noreferrer" 
               style="color:var(--primary-color, #26487F); text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
              ${escapeHtml(c.titulo || 'Guía IB')} ${c.grupo ? `(${escapeHtml(c.grupo)})` : ''} <span>↗</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  msgEl.innerHTML = `
    <span style="font-size:0.72rem; color:#64748B; margin-bottom:3px; font-weight:600;">
      ${escapeHtml(author || (isUser ? 'Tú' : 'Asistente IB'))}
    </span>
    <div style="background:${isUser ? '#0A192F' : '#F1F5F9'}; color:${isUser ? '#FFF' : '#1E293B'}; border-radius:8px; padding:14px 18px; max-width:85%; font-size:0.88rem; line-height:1.55; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:${isUser ? 'none' : '1px solid #E2E8F0'};">
      ${formattedContent}
      ${citationsHtml}
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
  el.style.padding = "8px 0";
  el.innerHTML = `Consultando acervo oficial del IB con Vertex AI & Gemini...`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeThinking(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Renderizador ligero y seguro de Markdown para respuestas pedagógicas
 */
function formatMarkdown(str) {
  if (!str) return "";
  let out = escapeHtml(str);

  // Headers (### Título)
  out = out.replace(/^### (.*$)/gim, '<h4 style="margin:10px 0 4px 0; color:#0A192F; font-size:0.98rem; font-weight:700;">$1</h4>');
  out = out.replace(/^## (.*$)/gim, '<h3 style="margin:12px 0 6px 0; color:#0A192F; font-size:1.05rem; font-weight:700;">$1</h3>');

  // Bold (**texto**)
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic (*texto*)
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Viñetas (* item o - item)
  out = out.replace(/^\s*[\*\-]\s+(.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');

  // Saltos de línea dobles
  out = out.replace(/\n\n/g, '<br><br>');
  out = out.replace(/\n/g, '<br>');

  return out;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export { render, render as renderIbWidget };
export default render;
