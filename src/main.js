/**
 * Portal CIARM - Router SPA y Guardián de Autenticación
 * Versión: 13.0.0
 */

import { isLoggedIn, getUserSession, logout } from './services/authService.js';
import { renderLoginWidget } from './components/loginWidget.js';

const APP_VERSION = '13.0.0';

const routes = {
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

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
  const mainContainer = getTargetContainer();
  const sidebar = document.getElementById('main-sidebar');
  const userProfileHeader = document.getElementById('header-user-profile');

  // SI NO HAY SESIÓN: Ocultar Sidebar y renderizar vista de Login
  if (!isLoggedIn()) {
    if (sidebar) sidebar.style.display = 'none';
    if (userProfileHeader) {
      userProfileHeader.innerHTML = `<span class="login-header-tag">ACCESO INSTITUCIONAL</span>`;
    }
    
    mainContainer.innerHTML = '';
    renderLoginWidget(mainContainer, () => {
      window.location.hash = '#inicio';
      router();
    });
    return;
  }

  // SI HAY SESIÓN ACTIVA: Renderizar Sidebar y Header de usuario
  const user = getUserSession();
  if (sidebar) sidebar.style.display = 'block';
  if (userProfileHeader && user) {
    userProfileHeader.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="text-align:right;">
          <span style="display:block; font-weight:600; font-size:0.85rem; color:#fff;">${user.nombre}</span>
          <span style="font-size:0.75rem; color:#CBD5E1;">${user.correo}</span>
        </div>
        <button id="btn-logout-header" style="background:#C5A059; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-weight:600; cursor:pointer; font-size:0.75rem;">Cerrar sesión</button>
      </div>
    `;

    document.getElementById('btn-logout-header')?.addEventListener('click', logout);
  }

  const hash = window.location.hash || '#inicio';

  if (routes[hash]) {
    try {
      const module = await routes[hash]();
      mainContainer.innerHTML = '';
      
      if (typeof module.renderMisSolicitudesWidget === 'function') {
        module.renderMisSolicitudesWidget(mainContainer, user);
      } else if (typeof module.render === 'function') {
        module.render(mainContainer, user);
      }
    } catch (error) {
      console.error(`Error al cargar ${hash}:`, error);
      mainContainer.innerHTML = `<div style="padding:20px; color:red;">Error al cargar el módulo.</div>`;
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
