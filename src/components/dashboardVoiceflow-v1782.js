/**
 * Módulo de Inicio - Dashboard Oficial CIARM
 * Versión: 18.0.3
 */

const VOICEFLOW_PROJECT_ID = '6a81e72529695cfeb738ad6e';
const VOICEFLOW_SCRIPT_ID = 'ciarm-voiceflow-widget-script';
const VOICEFLOW_SCRIPT_SRC = 'https://cdn.voiceflow.com/widget-next/bundle.mjs';

function loadVoiceflowScript() {
  if (window.voiceflow?.chat) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(VOICEFLOW_SCRIPT_ID);

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Voiceflow.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = VOICEFLOW_SCRIPT_ID;
    script.type = 'text/javascript';
    script.src = VOICEFLOW_SCRIPT_SRC;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Voiceflow.'));

    document.head.appendChild(script);
  });
}

async function mountVoiceflowAssistant() {
  const target = document.getElementById('voiceflow-chat');

  if (!target) return;

  const expandAssistant = () => {
    target.classList.add('is-expanded');
    target.closest('.assistant-hero-card')?.classList.add('is-expanded');
  };

  // Igual que Portal 1: compacto al entrar y con más espacio al usarlo.
  target.addEventListener('pointerenter', expandAssistant, { once: true });
  target.addEventListener('focusin', expandAssistant, { once: true });
  target.addEventListener('pointerdown', expandAssistant, { once: true });

  target.innerHTML = '<div class="voiceflow-loading">Cargando Asistente CIARM...</div>';

  try {
    await loadVoiceflowScript();

    if (!window.voiceflow?.chat?.load) {
      throw new Error('La API del widget de Voiceflow no está disponible.');
    }

    target.innerHTML = '';

    await window.voiceflow.chat.load({
      verify: { projectID: VOICEFLOW_PROJECT_ID },
      url: 'https://general-runtime.voiceflow.com',
      voice: {
        url: 'https://runtime-api.voiceflow.com'
      },
      render: {
        mode: 'embedded',
        target
      }
    });
  } catch (error) {
    console.error('Error al inicializar Asistente CIARM:', error);
    target.innerHTML = `
      <div class="voiceflow-error">
        No fue posible cargar el Asistente CIARM. Actualizá la página e intentá nuevamente.
      </div>
    `;
  }
}

export function render(container, userSession) {
  if (!container) return;

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box;">
      
      <!-- HERO CARD: Asistente CIARM -->
      <div class="assistant-hero-card">
        <div class="assistant-hero-header">
          <div>
            <h2 class="assistant-title">Asistente C<span class="assistant-ai">IA</span>RM</h2>
            <p class="assistant-subtitle">Consulta normativa, procesos y herramientas del colegio.</p>
          </div>
          <span class="assistant-tag">CONSULTA INSTITUCIONAL</span>
        </div>

        <div class="assistant-chat-box">
          <div id="voiceflow-chat" class="voiceflow-embed-target" aria-label="Asistente CIARM"></div>
        </div>
      </div>

      <!-- GRID DE 6 TARJETAS EXACTAS (2 FILAS X 3 COLUMNAS) -->
      <div class="dashboard-grid-exact">
        
        <!-- Tarjeta 1: Solicitudes internas -->
        <div class="exact-card">
          <span class="exact-card-category">SERVICIOS INTERNOS</span>
          <h3 class="exact-card-title">Solicitudes internas</h3>
          <p class="exact-card-desc">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
          <div class="exact-card-btn-group">
            <a href="#solicitudes" class="exact-btn dark">+ Crear Solicitud</a>
            <a href="#mis-solicitudes" class="exact-btn gold">📋 Mis Solicitudes</a>
          </div>
        </div>

        <!-- Tarjeta 2: Libros y Papers -->
        <div class="exact-card">
          <span class="exact-card-category">BIBLIOTECA CIARM</span>
          <h3 class="exact-card-title">Libros y Papers</h3>
          <p class="exact-card-desc">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Acceder a Biblioteca</span>
        </div>

        <!-- Tarjeta 3: Normas y herramientas -->
        <div class="exact-card">
          <span class="exact-card-category">FICHE - SISTEMA INTEGRAL DE CUMPLIMIENTO</span>
          <h3 class="exact-card-title">Normas y herramientas</h3>
          <p class="exact-card-desc">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Consultar Normativa</span>
        </div>

        <!-- Tarjeta 4: Comunicados -->
        <div class="exact-card">
          <span class="exact-card-category">COMUNICACIÓN INSTITUCIONAL</span>
          <h3 class="exact-card-title">Comunicados</h3>
          <p class="exact-card-desc">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Ver Comunicados</span>
        </div>

        <!-- Tarjeta 5: Administración -->
        <div class="exact-card">
          <span class="exact-card-category">SIGCOE - SISTEMA DE CONTROL DE GESTIÓN</span>
          <h3 class="exact-card-title">Administración</h3>
          <p class="exact-card-desc">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Gestión Administrativa</span>
        </div>

        <!-- Tarjeta 6: IB -->
        <div class="exact-card">
          <span class="exact-card-category">BACHILLERATO INTERNACIONAL</span>
          <h3 class="exact-card-title">IB</h3>
          <p class="exact-card-desc">Accede a documentación, programas, recursos y herramientas correspondientes a tu función.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Acceso Módulo IB</span>
        </div>

      </div>

    </div>
  `;

  mountVoiceflowAssistant();
}

export const renderDashboardWidget = render;
