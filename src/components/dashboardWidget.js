/**
 * Módulo de Inicio - Dashboard Oficial CIARM (Fiel a Réplica)
 * Versión: 13.3.0
 */

export function render(container, userSession) {
  if (!container) return;

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box;">
      
      <!-- HERO CARD: Asistente CIARM -->
      <div class="assistant-hero-card">
        <div class="assistant-hero-header">
          <div>
            <h2 class="assistant-title">Asistente CIARM</h2>
            <p class="assistant-subtitle">Consulta normativa, procesos y herramientas del colegio.</p>
          </div>
          <span class="assistant-tag">CONSULTA INSTITUCIONAL</span>
        </div>

        <div class="assistant-chat-box">
          <div class="assistant-chat-history">
            <div class="assistant-msg">
              ¡Hola! Soy el Asistente CIARM, tu asistente institucional del Colegio Internacional Alemán de la Riviera Maya. Estoy aquí para ayudarte a consultar información, reglas, procesos, políticas y herramientas institucionales del Colegio.
              <br><br><strong>¿En qué puedo ayudarte hoy?</strong>
            </div>
          </div>

          <div class="assistant-input-group">
            <input type="text" id="ai-chat-input" placeholder="¿Cómo puedo ayudarte?" class="assistant-input" />
            <button id="ai-chat-send-btn" class="assistant-send-btn">↑</button>
          </div>
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
          <a href="#inicio" class="exact-btn light">Acceder a Biblioteca</a>
        </div>

        <!-- Tarjeta 3: Normas y herramientas -->
        <div class="exact-card">
          <span class="exact-card-category">FICHE - SISTEMA INTEGRAL DE CUMPLIMIENTO</span>
          <h3 class="exact-card-title">Normas y herramientas</h3>
          <p class="exact-card-desc">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          <a href="#solicitudes" class="exact-btn light">Consultar Normativa</a>
        </div>

        <!-- Tarjeta 4: Comunicados -->
        <div class="exact-card">
          <span class="exact-card-category">COMUNICACIÓN INSTITUCIONAL</span>
          <h3 class="exact-card-title">Comunicados</h3>
          <p class="exact-card-desc">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          <a href="#inicio" class="exact-btn light">Ver Comunicados</a>
        </div>

        <!-- Tarjeta 5: Administración -->
        <div class="exact-card">
          <span class="exact-card-category">SIGCOE - SISTEMA DE CONTROL DE GESTIÓN</span>
          <h3 class="exact-card-title">Administración</h3>
          <p class="exact-card-desc">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          <a href="#inicio" class="exact-btn light">Gestión Administrativa</a>
        </div>

        <!-- Tarjeta 6: IB -->
        <div class="exact-card">
          <span class="exact-card-category">BACHILLERATO INTERNACIONAL</span>
          <h3 class="exact-card-title">IB</h3>
          <p class="exact-card-desc">Accede a documentación, programas, recursos y herramientas correspondientes a tu función.</p>
          <a href="#inicio" class="exact-btn light">Acceso Módulo IB</a>
        </div>

      </div>

    </div>
  `;

  // Evento interactivo para el input del Chat
  document.getElementById('ai-chat-send-btn')?.addEventListener('click', () => {
    const input = document.getElementById('ai-chat-input');
    if (input && input.value.trim()) {
      alert(`Asistente CIARM: Consultando sobre "${input.value}"...`);
      input.value = '';
    }
  });
}

export const renderDashboardWidget = render;
