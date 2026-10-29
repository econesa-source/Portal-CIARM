/**
 * Portal CIARM - Router SPA y Guardián de Autenticación
 * Versión: 18.7.16
 */

import { comprasUiEnabled, clearComprasClient } from './services/comprasClient.js';
import { getAuthenticatedUser, logout } from './services/authService.js';
import { renderLoginWidget } from './components/loginWidget.js';
import { getPortalPermissions, clearPortalPermissionsCache } from './services/portalPermissionsClient.js';
import { applyDashboardAccess, allowedRoute, syncIbNavigation } from './components/dashboardAccess.js';

const APP_VERSION = '18.7.16';

const routes = {
  '#compras': () => import(`./components/comprasWidget.js?v=${APP_VERSION}`),
  '#vision-gerencial': () => import(`./components/ticketsManagementWidget.js?v=${APP_VERSION}`),
  '#inicio': () => import(`./components/dashboardWidget.js?v=${APP_VERSION}`),
  '#solicitudes': () => import(`./components/solicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-solicitudes': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#mis-tareas': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#historial-tareas': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#validar-solicitudes': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#seguimiento-servicio': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#config-servicio': () => import(`./components/ticketsServiceWidget.js?v=${APP_VERSION}`),
  '#admin-solicitudes': () => import(`./components/adminSolicitudesWidget.js?v=${APP_VERSION}`),
  '#mis-obligaciones': () => import(`./components/misObligacionesWidget.js?v=${APP_VERSION}`),
  '#normativa': () => import(`./components/normativaWidget.js?v=${APP_VERSION}`),
  '#ib': () => import(`./components/ibWidget.js?v=${APP_VERSION}`)
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

function syncComprasNavigation(permissions){
  const nav=document.querySelector('#main-sidebar .sidebar-nav');
  if(!nav)return;
  let link=nav.querySelector('[href="#compras"]');
  const codes=permissions?.enforced===true&&permissions?.verified===true?permissions.codes||[]:[];
  const eligible=comprasUiEnabled()&&codes.includes('COMPRAS_TARJETA')&&
    ['COMPRAS_CREAR','COMPRAS_MIS','COMPRAS_AREA','COMPRAS_TODOS','COMPRAS_FIRMAR','COMPRAS_PRORROGA_FIRMAR','COMPRAS_EXCEPCION_COT','COMPRAS_ELEGIR','COMPRAS_RECIBIR_ASIGNADA'].some(c=>codes.includes(c));
  if(!eligible){link?.remove();return;}
  if(link)return;
  link=document.createElement('a');link.href='#compras';link.className='nav-link';
  const icon=document.createElement('span');icon.className='nav-icon';icon.textContent='▤';
  const label=document.createElement('span');label.className='nav-label';label.textContent='Compras';
  link.append(icon,label);nav.append(link);
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
  const navigationId = ++latestNavigation;
  const mainContainer = getTargetContainer();
  const sidebar = document.getElementById('main-sidebar');
  const userProfileHeader = document.getElementById('header-user-profile');
  const sidebarToggle = document.getElementById('btn-sidebar-toggle');
  setupSidebarControls();

  // GUARDIA DE SESIÓN REAL: la cookie HttpOnly del servidor es la fuente de verdad.
  const user = await getAuthenticatedUser(true);
  if (navigationId !== latestNavigation) return;

  if (!user) {
    clearPortalPermissionsCache();
    clearComprasClient();
    syncComprasNavigation(null);
    syncIbNavigation(document, null);
    if (sidebar) sidebar.style.display = 'none';
    if (sidebarToggle) sidebarToggle.style.display = 'none';
    setSidebarOpen(false);
    if (userProfileHeader) {
      userProfileHeader.innerHTML = `<span class="login-header-tag">ACCESO INSTITUCIONAL</span>`;
    }

    mainContainer.innerHTML = '';
    renderLoginWidget(mainContainer, async () => {
      clearPortalPermissionsCache();
      if (window.location.hash !== '#diagnostico-permisos') window.location.hash = '#inicio';
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

  if (hash === '#diagnostico-permisos') {
    try {
      const { render } = await import(`./components/portalDiagnosticsWidget.js?v=${APP_VERSION}`);
      if (navigationId !== latestNavigation) return;
      await render(mainContainer);
    } catch (error) {
      console.error('Diagnóstico de permisos:', error);
      mainContainer.textContent = 'No se pudo ejecutar la comprobación desde el Portal.';
    }
    return;
  }

  if (routes[hash]) {
    try {
      const permissions = await getPortalPermissions();
      if (navigationId !== latestNavigation) return;
      window.__CIARM_COMPRAS_UI_ENABLED__ = permissions?.comprasEnabled === true;
      window.__CIARM_COMPRAS_WRITES_ENABLED__ = permissions?.comprasWritesEnabled === true;
      syncComprasNavigation(permissions);
      syncIbNavigation(document, permissions);
      if ((hash === '#compras' && !comprasUiEnabled()) || !allowedRoute(hash, permissions)) {
        mainContainer.innerHTML = '<p role="alert">Esta función no está habilitada para tu perfil.</p>';
        return;
      }
      const module = await routes[hash]();
      if (navigationId !== latestNavigation) return;
      mainContainer.innerHTML = '';
      
      if (typeof module.renderMisSolicitudesWidget === 'function') {
        module.renderMisSolicitudesWidget(mainContainer, user);
      } else if (typeof module.render === 'function') {
        if (hash === '#inicio') mainContainer.style.visibility = 'hidden';
        try {
          await module.render(mainContainer, { ...user, dm05: permissions });
          if (navigationId !== latestNavigation) return;
          if (hash === '#inicio') applyDashboardAccess(mainContainer, permissions);
        } finally {
          mainContainer.style.visibility = '';
        }
      }
    } catch (error) {
      console.error(`Error al cargar ${hash}:`, error);
      mainContainer.innerHTML = `<div style="padding:20px; color:red;">Error al cargar el módulo.</div>`;
    }
  } else {
    window.location.hash = '#inicio';
  }
}

let latestNavigation = 0;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', router);
} else {
  router();
}

window.addEventListener('hashchange', router);
