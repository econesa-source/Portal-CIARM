/**
 * Portal CIARM - Router SPA y Carga Dinámica de Componentes
 * Versión: 11.0.0
 */

const APP_VERSION = '11.0.0';

const routes = {
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

async function router() {
  const hash = window.location.hash || '#inicio';
  const mainContainer = document.getElementById('main-content');
  
  if (routes[hash]) {
    try {
      const module = await routes[hash]();
      mainContainer.innerHTML = '';
      module.render(mainContainer);
    } catch (error) {
      console.error(`Error al cargar la ruta ${hash}:`, error);
      mainContainer.innerHTML = `<div class="error-box">Error al cargar la sección.</div>`;
    }
  } else {
    window.location.hash = '#inicio';
  }
}

window.addEventListener('DOMContentLoaded', router);
window.addEventListener('hashchange', router);
