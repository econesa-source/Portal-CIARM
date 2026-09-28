/**
 * Componente Panel de Gestión y Mis Solicitudes (REQ-F-LIST & REQ-F-EVAL) - Portal CIARM
 */

const MOCK_TICKETS = [
  {
    id_ticket: "TICK-2026-0012",
    fecha_creacion: "2026-09-27 10:30",
    tipo_solicitud: "Limpieza e Intendencia",
    descripcion: "Acondicionamiento y limpieza profunda de aula magna para evento pedagógico.",
    urgencia: "SI",
    estado_actual: "RESUELTO",
    correo_ejecutor: "intendencia@ciarm.edu.mx",
    fecha_programada: "2026-09-28"
  },
  {
    id_ticket: "TICK-2026-0008",
    fecha_creacion: "2026-09-25 14:15",
    tipo_solicitud: "Soporte Tecnológico / TI",
    descripcion: "Proyector interactivo no responde a señal HDMI en laboratorio 2.",
    urgencia: "NO",
    estado_actual: "EN_PROCESO",
    correo_ejecutor: "soporte.ti@ciarm.edu.mx",
    fecha_programada: "2026-09-29"
  }
];

export class MisSolicitudesWidgetComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tickets = MOCK_TICKETS;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <a class="back-link" id="btn-back-home-list" style="margin-bottom: 0;">← Volver al inicio</a>
        <button id="btn-nueva-solicitud" style="background: var(--ciarm-gold); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 0.85rem;">
          + Nueva Solicitud
        </button>
      </div>

      <div class="form-card-container">
        <h2 style="color: var(--ciarm-navy); font-family: Georgia, serif; margin-bottom: 1rem;">📋 Mis Solicitudes y Registro de Tickets</h2>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--ciarm-border); color: var(--ciarm-navy);">
              <th style="padding: 0.75rem;">Folio</th>
              <th style="padding: 0.75rem;">Fecha</th>
              <th style="padding: 0.75rem;">Tipo</th>
              <th style="padding: 0.75rem;">Descripción</th>
              <th style="padding: 0.75rem;">Estado</th>
              <th style="padding: 0.75rem; text-align: right;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${this.tickets.map(t => `
              <tr style="border-bottom: 1px solid var(--ciarm-border);">
                <td style="padding: 0.75rem; font-weight: bold; color: var(--ciarm-navy);">${t.id_ticket}</td>
                <td style="padding: 0.75rem; color: #64748B;">${t.fecha_creacion}</td>
                <td style="padding: 0.75rem;">${t.tipo_solicitud}</td>
                <td style="padding: 0.75rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.descripcion}</td>
                <td style="padding: 0.75rem;">${this.getBadgeHTML(t.estado_actual)}</td>
                <td style="padding: 0.75rem; text-align: right;">
                  <button class="btn-action-ticket" data-id="${t.id_ticket}" style="background: transparent; border: 1px solid var(--ciarm-navy); color: var(--ciarm-navy); padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                    Ver Detalle / Evaluar
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div id="eval-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; border-top: 4px solid var(--ciarm-gold);">
          <h3 style="color: var(--ciarm-navy); margin-bottom: 0.5rem;">⭐ Evaluación de Satisfacción</h3>
          <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 1rem;">Confirma la recepción conforme y califica la atención recibida.</p>
          
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem;">Calificación de Calidad (1 a 5 ⭐)</label>
            <select id="eval-calidad" class="form-control-select"><option value="5">⭐⭐⭐⭐⭐ (Excelente)</option><option value="4">⭐⭐⭐⭐ (Bueno)</option></select>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem;">Calificación de Tiempo (1 a 5 ⭐)</label>
            <select id="eval-tiempo" class="form-control-select"><option value="5">⭐⭐⭐⭐⭐ (A Tiempo)</option></select>
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem;">Calificación de Amabilidad (1 a 5 ⭐)</label>
            <select id="eval-amabilidad" class="form-control-select"><option value="5">⭐⭐⭐⭐⭐ (Excelente)</option></select>
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
            <button id="btn-close-eval" style="background: #94A3B8; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Cancelar</button>
            <button id="btn-submit-eval" style="background: var(--ciarm-navy); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;">Confirmar Recibí Conforme</button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  getBadgeHTML(estado) {
    const map = {
      NUEVO: { bg: "#DBEAFE", color: "#1E40AF" },
      EN_PROCESO: { bg: "#FEF3C7", color: "#92400E" },
      RESUELTO: { bg: "#D1FAE5", color: "#065F46" },
      RECIBI_CONFORME: { bg: "#065F46", color: "#FFFFFF" },
      CANCELADO: { bg: "#FEE2E2", color: "#991B1B" }
    };
    const style = map[estado] || { bg: "#E2E8F0", color: "#475569" };
    return `<span style="background: ${style.bg}; color: ${style.color}; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${estado}</span>`;
  }

  attachEvents() {
    document.getElementById("btn-nueva-solicitud")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "view-solicitudes" } }));
    });

    document.getElementById("btn-back-home-list")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
    });

    const modal = document.getElementById("eval-modal");
    document.querySelectorAll(".btn-action-ticket").forEach(btn => {
      btn.addEventListener("click", () => {
        if (modal) modal.style.display = "flex";
      });
    });

    document.getElementById("btn-close-eval")?.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });

    document.getElementById("btn-submit-eval")?.addEventListener("click", () => {
      alert("⭐ ¡Gracias por tu evaluación! Se ha registrado el ticket como RECIBÍ CONFORME.");
      if (modal) modal.style.display = "none";
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
    });
  }
}
