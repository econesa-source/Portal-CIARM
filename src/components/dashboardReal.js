/**
 * Componente Vista Principal Completa (6 Módulos) - Portal CIARM
 */

export class DashboardRealComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <!-- Hero Widget: Asistente CIARM -->
      <section class="hero-assistant-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 class="hero-title">Asistente CIARM</h2>
            <p class="hero-subtitle">Consulta normativa, procesos y herramientas del colegio.</p>
          </div>
          <span style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; color: var(--ciarm-gold-light);">CONSULTA INSTITUCIONAL</span>
        </div>
        <div class="chat-input-box">
          <input type="text" placeholder="Mensaje..." id="assistant-input">
          <button class="btn-send-chat" id="btn-send-assistant">↑</button>
        </div>
      </section>

      <!-- Grilla 3x2 (6 Módulos) con Click Listeners -->
      <section class="modules-grid">
        <!-- 1. Solicitudes internas -->
        <article class="module-card" id="card-solicitudes-internas" style="cursor: pointer;">
          <div>
            <div class="module-tag">SERVICIOS INTERNOS</div>
            <h3 class="module-title">Solicitudes internas</h3>
            <p class="module-desc">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
        </article>

        <!-- 2. Libros y Papers -->
        <article class="module-card">
          <div>
            <div class="module-tag">BIBLIOTECA CIARM</div>
            <h3 class="module-title">Libros y Papers</h3>
            <p class="module-desc">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </article>

        <!-- 3. Normas y herramientas -->
        <article class="module-card">
          <div>
            <div class="module-tag">SICPE - SISTEMA INTEGRAL DE CUMPLIMIENTO</div>
            <h3 class="module-title">Normas y herramientas</h3>
            <p class="module-desc">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </article>

        <!-- 4. Comunicados -->
        <article class="module-card">
          <div>
            <div class="module-tag">COMUNICACIÓN INSTITUCIONAL</div>
            <h3 class="module-title">Comunicados</h3>
            <p class="module-desc">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c.41 0 .789.25 0 .588l1.54 4.311a.75.75 0 01-.702 1.001H7a4.001 4.001 0 01-1.564-.317z"/>
          </svg>
        </article>

        <!-- 5. Administración -->
        <article class="module-card">
          <div>
            <div class="module-tag">SCGRC - SISTEMA DE CONTROL DE GESTIÓN</div>
            <h3 class="module-title">Administración</h3>
            <p class="module-desc">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </article>

        <!-- 6. IB -->
        <article class="module-card">
          <div>
            <div class="module-tag">BACHILLERATO INTERNACIONAL</div>
            <h3 class="module-title">IB</h3>
            <p class="module-desc">Accede a documentación, programas, recursos y herramientas correspondientes a tu función.</p>
          </div>
          <svg class="module-icon-svg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke-width="1.5"/>
            <text x="12" y="15.5" font-size="9" font-weight="bold" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">IB</text>
          </svg>
        </article>
      </section>
    `;

    this.attachEvents();
  }

  attachEvents() {
    document.getElementById("card-solicitudes-internas")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "view-solicitudes" } }));
    });
  }
}
