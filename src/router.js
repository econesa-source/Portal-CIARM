/**
 * Enrutador Principal SPA - Portal CIARM
 * Versión: 17.3.0 (Rompe-Caché Estricto v17.3.0 para cPanel)
 */

export async function handleRouting(userSession) {
  const contentDiv = document.getElementById('main-content') || document.getElementById('app');
  if (!contentDiv) return;

  const hash = window.location.hash || '#inicio';

  try {
    if (hash === '#solicitudes') {
      const module = await import(`./components/solicitudesWidget.js?v=17.3.0`);
      if (module && module.render) {
        module.render(contentDiv, userSession);
      } else if (module && module.renderSolicitudesWidget) {
        module.renderSolicitudesWidget(contentDiv, userSession);
      }
    } else if (hash === '#mis-solicitudes') {
      const module = await import(`./components/misSolicitudesWidget.js?v=17.3.0`);
      if (module && module.render) {
        module.render(contentDiv, userSession);
      } else if (module && module.renderMisSolicitudesWidget) {
        module.renderMisSolicitudesWidget(contentDiv, userSession);
      }
    } else {
      contentDiv.innerHTML = `<div style="padding:20px; font-weight:bold; color:#0A192F;">Bienvenido al Portal CIARM</div>`;
    }
  } catch (error) {
    console.error('Error cargando el módulo dinámico:', error);
    contentDiv.innerHTML = `
      <div style="padding: 30px; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; margin: 20px;">
        <h3 style="color: #991B1B; margin-top: 0;">⚠️ Error al cargar el módulo.</h3>
        <p style="color: #7F1D1D; font-size: 0.9rem;">Detalles: ${error.message}</p>
        <button onclick="window.location.reload()" style="background: #0A192F; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
          🔄 Reintentar Carga
        </button>
      </div>
    `;
  }
}

window.addEventListener('hashchange', () => {
  const mockUser = { nombre: 'Ezequiel Conesa', correo: 'econesa@ciarm.edu.mx' };
  handleRouting(mockUser);
});

window.addEventListener('DOMContentLoaded', () => {
  const mockUser = { nombre: 'Ezequiel Conesa', correo: 'econesa@ciarm.edu.mx' };
  handleRouting(mockUser);
});
