import { DashboardRealComponent } from './components/dashboardReal.js';
import { SolicitudesWidgetComponent } from './components/solicitudesWidget.js';
import { MisSolicitudesWidgetComponent } from './components/misSolicitudesWidget.js';

document.addEventListener('DOMContentLoaded', () => {
  const containerId = 'main-content-area';
  const dashboard = new DashboardRealComponent(containerId);
  const solicitudes = new SolicitudesWidgetComponent(containerId);
  const misSolicitudes = new MisSolicitudesWidgetComponent(containerId);

  dashboard.render();

  window.addEventListener('ciarm:navigation-change', (e) => {
    const targetId = e.detail.id;

    if (targetId === 'menu-inicio' || targetId === 'view-home') {
      dashboard.render();
      updateSidebarActive('menu-inicio');
    } else if (targetId === 'view-solicitudes') {
      solicitudes.render();
      updateSidebarActive(null);
    } else if (targetId === 'view-mis-solicitudes') {
      misSolicitudes.render();
      updateSidebarActive(null);
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

  document.getElementById("menu-inicio")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
  });
});
