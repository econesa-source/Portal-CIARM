/**
 * Portal CIARM - Router SPA Síncrono a Prueba de Fallos
 * Versión: 11.0.4
 */

const APP_VERSION = '11.0.4';

const routes = {
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

// Función síncrona de obtención o creación inmediata de contenedor (Sin bucles)
function getTargetContainer() {
  let container = document.getElementById('main-content');
  if (!container) {
    container = document.createElement('main');
    container.id = 'main-content';
    container.className = 'main-body';
    
    const wrapper = document.querySelector('.content-wrapper') || document.body;
    wrapper.appendChild(container);
  }
  return container;
}

async function router() {
  const hash = window.location.hash || '#inicio';
  const mainContainer = getTargetContainer();

  if (routes[hash]) {
    try {
      const module = await routes[hash]();
      mainContainer.innerHTML = '';
      module.render(mainContainer);
    } catch (error) {
      console.error(`Error al cargar la ruta ${hash}:`, error);
      mainContainer.innerHTML = `<div class="error-box" style="padding:20px; color:red;">Error al cargar la sección seleccionada.</div>`;
    }
  } else {
    window.location.hash = '#inicio';
  }
}

// Inicialización limpia
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}

window.addEventListener('hashchange', router);
