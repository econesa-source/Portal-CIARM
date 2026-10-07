/**
 * Portal CIARM - Router SPA y Guardián de Autenticación
 * Versión: 18.1.0
 */

import { getAuthenticatedUser, logout } from './services/authService.js';
import { renderLoginWidget } from './components/loginWidget.js';

const APP_VERSION = '18.1.0';

const routes = {
  '#inicio': () => import(`./components/dashboardVoiceflow-v1782.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/misSolicitudesWidget.js?v=${APP_VERSION}`)
};

function isMobileViewport() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function setSidebarOpen(open) {
  const app = document.querySelector('.app-layout');
  const toggle = document.getElementById('btn-sidebar-toggle');
  if (!app) return;
  app.classList.toggle('sidebar-open', Boolean(open));
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeMobileSidebar() {
  if (isMobileViewport()) setSidebarOpen(false);
}

function setupSidebarControls() {
  const app = document.querySelector('.app-layout');
  const toggle = document.getElementById('btn-sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!app || !toggle || toggle.dataset.bound === 'true') return;

  toggle.dataset.bound = 'true';
  toggle.addEventListener('click', () => {
    if (isMobileViewport()) {
      setSidebarOpen(!app.classList.contains('sidebar-open'));
      return;
    }
    app.classList.toggle('sidebar-collapsed');
  });

  backdrop?.addEventListener('click', () => setSidebarOpen(false));

  window.addEventListener('resize', () => {
    if (!isMobileViewport()) setSidebarOpen(false);
  });
}

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || 'CI';
}

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
  const sidebarToggle = document.getElementById('btn-sidebar-toggle');
  setupSidebarControls();

  // GUARDIA DE SESIÓN REAL: la cookie HttpOnly del servidor es la fuente de verdad.
  const user = await getAuthenticatedUser();

  if (!user) {
    if (sidebar) sidebar.style.display = 'none';
    if (sidebarToggle) sidebarToggle.style.display = 'none';
    setSidebarOpen(false);
    if (userProfileHeader) {
      userProfileHeader.innerHTML = `<span class="login-header-tag">ACCESO INSTITUCIONAL</span>`;
    }

    mainContainer.innerHTML = '';
    renderLoginWidget(mainContainer, async () => {
      window.location.hash = '#inicio';
      await router();
    });
    return;
  }

  // SESIÓN ACTIVA: Mostrar Sidebar y Header
  if (sidebar) sidebar.style.display = 'block';
  if (sidebarToggle) sidebarToggle.style.display = 'inline-flex';
  if (userProfileHeader && user) {
    userProfileHeader.innerHTML = `
      <div class="header-user-wrap">
        <div class="user-copy">
          <span class="user-name">${user.nombre}</span>
          <span class="user-email">${user.correo}</span>
        </div>
        <div class="header-avatar-wrap" aria-hidden="true">
          <span class="header-avatar">${initials(user.nombre)}</span>
          <span class="header-missing-badge">5</span>
        </div>
        <button id="btn-logout-header" class="logout-btn">Cerrar sesión</button>
      </div>
    `;

    document.getElementById('btn-logout-header')?.addEventListener('click', logout);
  }

  const hash = window.location.hash || '#inicio';
  closeMobileSidebar();

  // Ajustar el layout al tipo de vista.
  mainContainer.classList.toggle('solicitud-screen', hash === '#solicitudes');

  // Actualizar clase active en el Sidebar
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

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
