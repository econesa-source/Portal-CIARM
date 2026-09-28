/**
 * Componente Vista Principal Real - Portal CIARM
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
          <span style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; opacity: 0.8;">CONSULTA INSTITUCIONAL</span>
        </div>
        <div class="chat-input-box">
          <input type="text" placeholder="Mensaje..." id="assistant-input">
          <button class="btn-send-chat" id="btn-send-assistant">↑</button>
        </div>
      </section>

      <!-- Grilla 2x2 de Módulos Reales -->
      <section class="modules-grid">
        <article class="module-card">
          <div>
            <div class="module-tag">SERVICIOS INTERNOS</div>
            <h3 class="module-title">Solicitudes internas</h3>
            <p class="module-desc">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
          </div>
          <div class="module-icon-box">📋</div>
        </article>

        <article class="module-card">
          <div>
            <div class="module-tag">BIBLIOTECA CIARM</div>
            <h3 class="module-title">Libros y Papers</h3>
            <p class="module-desc">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          </div>
          <div class="module-icon-box">📖</div>
        </article>

        <article class="module-card">
          <div>
            <div class="module-tag">SICPE - SISTEMA INTEGRAL DE CUMPLIMIENTO</div>
            <h3 class="module-title">Normas y herramientas</h3>
            <p class="module-desc">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          </div>
          <div class="module-icon-box">📑</div>
        </article>

        <article class="module-card">
          <div>
            <div class="module-tag">COMUNICACIÓN INSTITUCIONAL</div>
            <h3 class="module-title">Comunicados</h3>
            <p class="module-desc">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          </div>
          <div class="module-icon-box">📣</div>
        </article>
      </section>
    `;
  }
}
