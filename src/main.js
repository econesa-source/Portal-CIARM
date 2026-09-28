/**
 * Orquestador Principal y Enrutador SPA - Portal CIARM
 */
import { DashboardRealComponent } from './components/dashboardReal.js';
import { SolicitudesWidgetComponent } from './components/solicitudesWidget.js';

document.addEventListener('DOMContentLoaded', () => {
  const containerId = 'main-content-area';
  const dashboard = new DashboardRealComponent(containerId);
  const solicitudes = new SolicitudesWidgetComponent(containerId);

  // Renderizar la vista inicial
  dashboard.render();

  // Escuchar navegación global
  window.addEventListener('ciarm:navigation-change', (e) => {
    const targetId = e.detail.id;

    if (targetId === 'menu-inicio' || targetId === 'view-home') {
      dashboard.render();
      updateSidebarActive('menu-inicio');
    } else if (targetId === 'view-solicitudes') {
      solicitudes.render();
      updateSidebarActive(null);
    } else {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="form-card-container">
            <a class="back-link" id="btn-back-home-fallback">← Volver al inicio</a>
            <h2 style="color: var(--ciarm-navy); margin-bottom: 0.5rem;">📌 Módulo en Construcción</h2>
            <p style="color: var(--ciarm-text-muted);">La sección <code>${targetId}</code> estará disponible próximamente.</p>
          </div>
        `;
        document.getElementById("btn-back-home-fallback")?.addEventListener("click", () => {
          window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
        });
      }
      updateSidebarActive(targetId);
    }
  });

  function updateSidebarActive(activeMenuId) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      if (item.id === activeMenuId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Conectar clics directos de la barra lateral
  document.getElementById("menu-inicio")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
  });
  document.getElementById("menu-obligaciones")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-obligaciones" } }));
  });
  document.getElementById("menu-normativa")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-normativa" } }));
  });
});
