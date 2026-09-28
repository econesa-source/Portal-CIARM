/**
 * Componente Solicitudes Internas - Portal CIARM
 */

export class SolicitudesWidgetComponent {
  constructor(containerId, userData = {}) {
    this.container = document.getElementById(containerId);
    this.userData = {
      name: userData.name || "Ezequiel Conesa",
      email: userData.email || "e.conesa@ciarm.edu.mx",
      initials: userData.initials || "EC"
    };
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <!-- Enlace de Retorno -->
      <a class="back-link" id="btn-back-home">
        ← Volver al inicio
      </a>

      <!-- Header del Módulo -->
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--ciarm-gold); letter-spacing: 0.08em;">SERVICIOS INTERNOS</div>
        <h1 class="form-page-title">Solicitudes internas</h1>
        <p class="form-page-subtitle">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
      </div>

      <!-- Banner Orientación -->
      <div class="orientation-banner">
        <div>
          <div class="orientation-title">ORIENTACIÓN</div>
          <div class="orientation-main-text">¿Qué puedes solicitar?</div>
        </div>

        <div class="orientation-items-group">
          <div class="orientation-item">
            <svg class="orientation-icon" viewBox="0 0 24 24">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <div>
              <div class="orientation-item-title">Operaciones</div>
              <div class="orientation-item-desc">Apoyo logístico, espacios y servicios internos.</div>
            </div>
          </div>

          <div class="orientation-item">
            <svg class="orientation-icon" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <div>
              <div class="orientation-item-title">Mantenimiento</div>
              <div class="orientation-item-desc">Reparaciones, instalaciones y adecuaciones.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Auditoría Usuario -->
      <div class="user-audit-card">
        <div class="user-audit-avatar">${this.userData.initials}</div>
        <div class="user-audit-info">
          <div><strong>Solicitud realizada por:</strong> ${this.userData.name}</div>
          <div><strong>Correo institucional:</strong> ${this.userData.email}</div>
        </div>
      </div>

      <!-- Formulario de Registro -->
      <form class="form-card-container" id="solicitud-form">
        <div class="form-grid-2col">
          <div>
            <label class="form-label">Área</label>
            <span class="form-label-sub">Área a la que pertenece el solicitante.</span>
            <select class="form-control-select" id="field-area" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option value="Dirección">Dirección</option>
              <option value="Académica">Académica</option>
              <option value="Administración">Administración</option>
              <option value="Operaciones">Operaciones</option>
            </select>
          </div>

          <div>
            <label class="form-label">Tipo de solicitud</label>
            <span class="form-label-sub" style="visibility: hidden;">Placeholder</span>
            <select class="form-control-select" id="field-tipo" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option value="Mantenimiento">Mantenimiento y Reparaciones</option>
              <option value="Apoyo Logístico">Apoyo Logístico / Espacios</option>
              <option value="Insumos">Insumos o Materiales</option>
            </select>
          </div>
        </div>

        <div class="form-group-full">
          <label class="form-label">Describe tu solicitud</label>
          <textarea class="form-control-textarea" id="field-descripcion" placeholder="Describe tu solicitud" required></textarea>
        </div>

        <div class="form-grid-2col">
          <div>
            <label class="form-label">Urgencia</label>
            <select class="form-control-select" id="field-urgencia" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>

          <div>
            <label class="form-label">¿Cuándo necesitas que esté resuelto?</label>
            <select class="form-control-select" id="field-fecha" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option value="Hoy">Hoy mismo</option>
              <option value="En 24-48 horas">En 24 - 48 horas</option>
              <option value="Esta semana">Durante esta semana</option>
            </select>
          </div>
        </div>

        <div class="form-group-full">
          <label class="form-label">Adjuntar archivo</label>
          <span class="form-label-sub">Opcional</span>
          <div class="form-file-box">
            <input type="file" id="field-file" style="display: block; font-size: 0.85rem;">
          </div>
        </div>

        <div class="form-actions-bar">
          <button type="button" class="btn-submit-solicitud" id="btn-submit-solicitud">
            Enviar solicitud
          </button>
          <span class="form-disclaimer">El envío de solicitudes estará disponible próximamente.</span>
        </div>
      </form>
    `;

    this.attachEvents();
  }

  attachEvents() {
    // Evento para volver al Inicio
    document.getElementById("btn-back-home")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
    });
  }
}
