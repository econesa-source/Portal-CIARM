/**
 * Portal CIARM - Router SPA y Carga Dinámica de Componentes
 * Versión: 11.0.1 (Hotfix: DOM null safety guard)
 */

const APP_VERSION = '11.0.1';

const routes = {
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

async function router() {
  const hash = window.location.hash || '#inicio';
  let mainContainer = document.getElementById('main-content');
  
  // Guard de seguridad: Si el contenedor no existe en el DOM, reintentar al siguiente frame
  if (!mainContainer) {
    console.warn('Contenedor #main-content no encontrado en el DOM. Reintentando...');
    setTimeout(router, 50);
    return;
  }
  
  if (routes[hash]) {
    try {
      const module = await routes[hash]();
      mainContainer.innerHTML = '';
      module.render(mainContainer);
    } catch (error) {
      console.error(`Error al cargar la ruta ${hash}:`, error);
      if (mainContainer) {
        mainContainer.innerHTML = `<div class="error-box">Error al cargar la sección.</div>`;
      }
    }
  } else {
    window.location.hash = '#inicio';
  }
}

// Inicialización segura del enrutador
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}

window.addEventListener('hashchange', router);
