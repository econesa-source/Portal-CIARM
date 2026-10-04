import { renderDashboardWidget } from './components/dashboardWidget.js?v=12.0.0';
import { renderSolicitudesWidget } from './components/solicitudesWidget.js?v=12.0.0';
import { renderMisSolicitudesWidget } from './components/misSolicitudesWidget.js?v=12.0.0';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwFQW8HyJsjfWQnJLrE6XAxW0_UFFPYn59Xa90ZB38X1kmdCWlxZM4wkTunr9UN-GxUrA/exec';

const USER_SESSION = {
  nombre: 'Ezequiel Conesa',
  correo: 'econesa@ciarm.edu.mx',
  area: 'Coordinación Pedagógica',
  rol: 'PORTAL_USUARIO'
};

function router() {
  const container = document.getElementById('app');
  if (!container) return;

  try {
    const hash = window.location.hash || '#inicio';

    if (hash === '#solicitudes' || hash === '#nueva-solicitud') {
      container.innerHTML = `
        <div style="max-width:800px; margin: 0 auto; padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <a href="#inicio" style="color:#1B2B48; text-decoration:none; font-weight:bold;">← Volver al Inicio</a>
            <a href="#mis-solicitudes" style="background:#C5A059; color:white; padding:0.5rem 1rem; border-radius:6px; text-decoration:none; font-weight:bold; font-size:0.9rem;">📋 Ver Mis Solicitudes</a>
          </div>
          <div id="solicitud-content"></div>
        </div>
      `;
      renderSolicitudesWidget(document.getElementById('solicitud-content'), USER_SESSION, GAS_URL);

    } else if (hash === '#mis-solicitudes') {
      container.innerHTML = `
        <div style="max-width:800px; margin: 0 auto; padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <a href="#solicitudes" style="color:#1B2B48; text-decoration:none; font-weight:bold;">← Crear Nueva Solicitud</a>
            <a href="#inicio" style="color:#6B7280; text-decoration:none;">Ir al Inicio</a>
          </div>
          <div id="mis-solicitudes-content"></div>
        </div>
      `;
      renderMisSolicitudesWidget(document.getElementById('mis-solicitudes-content'), USER_SESSION.correo);

    } else {
      renderDashboardWidget(container, (modulo) => {
        if (modulo === 'solicitudes') {
          window.location.hash = '#solicitudes';
        }
      });
    }
  } catch (err) {
    console.error("[CIARM Router Error]:", err);
  }
}

window.addEventListener('hashchange', router);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}
