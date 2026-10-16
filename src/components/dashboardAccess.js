export const HT06_MVP_URL = 'https://docs.google.com/spreadsheets/d/1sw5ZK2-8DzrfdDJV_5VQcknzobYgXKaq89hMaJY0i_M/edit';
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
    if (!canSeeCard(permissions, card)) { element.remove(); return; }
    if (card === 'solicitudes') {
      if (!canSeeAction(permissions, card, 'crear')) {
        element.querySelector('a[href="#solicitudes"]')?.remove();
      }
      if (!canSeeAction(permissions, card, 'mis')) {
        element.querySelector('a[href="#mis-solicitudes"]')?.remove();
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
  // MVP: la tarjeta de Compras abre HT06 Sheets, sin hacer llamadas al proxy GAS del Portal.
  // Conservar la autorización visual DM05: tarjeta madre más una función permitida.
  if (allowedRoute('#compras', response) && !container.querySelector('[data-card="compras"]')) {
    const card = document.createElement('div');
    card.className = 'exact-card';
    card.dataset.module = 'compras';
    card.dataset.card = 'compras';
    card.innerHTML = '<span class="exact-card-category">SCGRC</span><h3 class="exact-card-title">Compras</h3><p class="exact-card-desc">Accedé a las solicitudes y autorizaciones desde HT06.</p>';
    const link = document.createElement('a');
    link.href = HT06_MVP_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'exact-btn gold';
    link.textContent = 'Abrir HT06';
    card.append(link);
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
  if (hash === '#mis-solicitudes') return canSeeAction(permissions, 'solicitudes', 'mis');
  if (hash === '#mis-tareas' || hash === '#historial-tareas') {
    return canSeeAction(permissions, 'tareas', 'gestionar') || canSeeAction(permissions, 'solicitudes', 'gestionar');
  }
  // Las pantallas administrativas solicitan GET tickets-api.php?action=context
  // y el servidor autoriza INT_GESTION desde DM05. No duplicar esta decisión.
  if (hash === '#admin-solicitudes' || hash === '#vision-gerencial') {
    return true;
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
