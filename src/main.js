/**
 * Portal CIARM - Router SPA y Carga Dinámica de Componentes
 * Versión: 11.0.2 (Fix: Límite de reintentos y auto-recuperación de DOM)
 */

const APP_VERSION = '11.0.2';

const routes = {
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

let retryCount = 0;
const MAX_RETRIES = 10;

async function router() {
  const hash = window.location.hash || '#inicio';
  let mainContainer = document.getElementById('main-content');
  
  // Guard de seguridad con límite de reintentos
  if (!mainContainer) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(router, 50);
      return;
    } else {
      // Auto-recuperación: Crear el contenedor dinámicamente si no existe
      console.warn('Creando contenedor #main-content dinámicamente.');
      mainContainer = document.createElement('main');
      mainContainer.id = 'main-content';
      document.body.appendChild(mainContainer);
    }
  }
  
  retryCount = 0; // Reiniciar contador tras obtener el contenedor

  if (routes[hash]) {
    try {
      const module = await routes[hash]();
      mainContainer.innerHTML = '';
      module.render(mainContainer);
    } catch (error) {
      console.error(`Error al cargar la ruta ${hash}:`, error);
      if (mainContainer) {
        mainContainer.innerHTML = `<div class="error-box" style="padding:20px; color:red;">Error al cargar la sección seleccionada.</div>`;
      }
    }
  } else {
    window.location.hash = '#inicio';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}

window.addEventListener('hashchange', router);
