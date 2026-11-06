import { comprasUiEnabled } from '../services/comprasClient.js';
import { resolvePortalPermissions, canSeeCard, canSeeAction } from '../services/portalPermissions.js';

const PENDING_BUTTON = {
  biblioteca: 'acceder', normativa: 'consultar', comunicados: 'ver',
  administracion: 'acceder', ib: 'acceder'
};

/** Quita los elementos no autorizados ANTES de hacer visible el dashboard. */
export function applyDashboardAccess(container, response) {
  if (response?.enforced !== true) return; // transición sin cambios productivos
  const permissions = resolvePortalPermissions({ dm05: response });
  if (!permissions) throw new Error('Permisos del Portal no verificados.');

  const assistant = container.querySelector('.sicpe-search');
  if (!canSeeCard(permissions, 'asistente')) assistant?.remove();
  else if (!canSeeAction(permissions, 'asistente', 'consultar')) {
    assistant?.querySelector('#ciarm-assistant')?.remove();
  }

  const cards = [...container.querySelectorAll('.dashboard-grid-exact > .exact-card')];
  cards.forEach(element => {
    const card = element.dataset.card;
    if (card === 'tus-compras') {
      const tc = response?.tusCompras;
      const visible = tc?.visible === true || permissions.has('TUS_COMPRAS_TARJETA');
      if (!visible) { element.remove(); return; }
      if (tc && tc.canCreate === false) {
        element.querySelector('a[href="#tus-compras-nuevo"]')?.remove();
      }
      const isAdministracion = tc?.isAdministracion === true || (tc?.isDocenteDirector !== true && (tc?.canAdmin === true || tc?.canApprove === true));
      if (isAdministracion && !element.querySelector('a[href="#admin-tus-compras"]')) {
        const hdr = element.querySelector('.tus-compras-card-header');
        if (hdr) {
          const admLink = document.createElement('a');
          admLink.href = '#admin-tus-compras';
          admLink.className = 'exact-btn dark';
          admLink.textContent = 'Administrar';
          hdr.append(admLink);
        }
      }
      return;
    }
    if (!canSeeCard(permissions, card)) { element.remove(); return; }
    if (card === 'solicitudes') {
      if (!canSeeAction(permissions, card, 'crear')) {
        element.querySelector('a[href="#solicitudes"]')?.remove();
      }
      if (!canSeeAction(permissions, card, 'mis')) {
        element.querySelector('a[href="#mis-solicitudes"], a[href="#validar-solicitudes"]')?.remove();
      }
      // El acceso Administrar requiere además la validación del backend de tickets.
      if (!canSeeAction(permissions, card, 'gestionar')) {
        element.querySelector('a[href="#admin-solicitudes"]')?.remove();
      }
    } else if (card === 'tareas') {
      const canManage = canSeeAction(permissions, 'tareas', 'gestionar') || canSeeAction(permissions, 'solicitudes', 'gestionar');
      if (!canManage) {
        element.querySelector('a[href="#mis-tareas"]')?.remove();
        element.querySelector('a[href="#historial-tareas"]')?.remove();
      }
    } else if (card === 'ib') {
      if (!canSeeAction(permissions, 'ib', 'acceder')) {
        element.querySelector('a[href="#ib"]')?.remove();
        element.querySelector('.exact-btn-disabled')?.remove();
      }
    } else if (!canSeeAction(permissions, card, PENDING_BUTTON[card])) {
      element.querySelector('.exact-btn-disabled')?.remove();
    }
  });
  if (comprasUiEnabled() && allowedRoute('#compras', response)) {
    const card = document.createElement('div');
    card.className = 'exact-card';
    card.dataset.module = 'compras';
    card.dataset.card = 'compras';
    card.innerHTML = '<span class="exact-card-category">SCGRC</span><h3 class="exact-card-title">Compras</h3><p class="exact-card-desc">Solicita compras, elige cotizaciones y consulta sus avances.</p><a href="#compras" class="exact-btn gold">Gestionar compras</a>';
    container.querySelector('.dashboard-grid-exact')?.append(card);
  }
}

export function allowedRoute(hash, response) {
  if (hash === '#compras' && (response?.enforced !== true || response?.verified !== true)) return false;
  if (response?.enforced !== true) return true;
  const permissions = resolvePortalPermissions({ dm05: response });
  if (!permissions) return false;
  if (hash === '#compras') return canSeeCard(permissions, 'compras') && ['crear','mis','area','todos','cancelar','firmar','prorroga','excepcion','elegir','recibir'].some(action => canSeeAction(permissions,'compras',action));
  if (hash === '#solicitudes') return canSeeAction(permissions, 'solicitudes', 'crear');
  if (hash === '#mis-solicitudes' || hash === '#validar-solicitudes') return canSeeAction(permissions, 'solicitudes', 'mis');
  if (hash === '#mis-tareas' || hash === '#historial-tareas') {
    return canSeeAction(permissions, 'tareas', 'gestionar') || canSeeAction(permissions, 'solicitudes', 'gestionar');
  }
  // Las pantallas administrativas solicitan GET tickets-api.php?action=context
  // y el servidor autoriza INT_GESTION desde DM05. No duplicar esta decisión.
  if (hash === '#admin-solicitudes' || hash === '#vision-gerencial') {
    return true;
  }
  if (hash === '#tus-compras' || hash === '#tus-compras-nuevo' || hash === '#admin-tus-compras' || hash === '#vision-gerencial-compras') {
    const tc = response?.tusCompras;
    if (tc?.visible === true || permissions.has('TUS_COMPRAS_TARJETA')) {
      if (hash === '#tus-compras-nuevo') return tc ? tc.canCreate === true : true;
      if (hash === '#admin-tus-compras') return tc ? (tc.canAdmin === true || tc.canApprove === true) : true;
      if (hash === '#vision-gerencial-compras') return tc ? tc.canGerencial === true : true;
      return true;
    }
    return false;
  }
  if (hash === '#ib') {
    return canSeeAction(permissions, 'ib', 'acceder');
  }
  return true; // el resto de rutas conserva validaciones específicas del backend
}

export function syncIbNavigation(root, response) {
  const visible = Boolean(response) && allowedRoute('#ib', response);
  root.querySelectorAll('a[href="#ib"]').forEach(link => {
    link.hidden = !visible;
    link.style.display = visible ? '' : 'none';
  });
}
