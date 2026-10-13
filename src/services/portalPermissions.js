/**
 * Contrato visual del Portal ↔ DM05.
 * Los títulos son de presentación; únicamente los códigos gobiernan visibilidad.
 * El menú lateral queda deliberadamente fuera del alcance.
 */
export const PORTAL_CARDS = Object.freeze({
  asistente: { code: 'ASISTENTE_TARJETA', actions: { consultar: 'ASISTENTE_CONSULTAR' } },
  solicitudes: { code: 'INT_TARJETA', actions: { crear: 'INT_CREAR', mis: 'INT_MIS', gestionar: 'INT_GESTION' } },
  compras: { code: 'COMPRAS_TARJETA', actions: { crear: 'COMPRAS_CREAR', mis: 'COMPRAS_MIS', area: 'COMPRAS_AREA', todos: 'COMPRAS_TODOS', cancelar: 'COMPRAS_CANCELAR', firmar: 'COMPRAS_FIRMAR', prorroga: 'COMPRAS_PRORROGA_FIRMAR', excepcion: 'COMPRAS_EXCEPCION_COT', elegir: 'COMPRAS_ELEGIR', recibir: 'COMPRAS_RECIBIR_ASIGNADA' } },
  biblioteca: { code: 'BIBLIOTECA_TARJETA', actions: { acceder: 'BIBLIOTECA_ACCEDER' } },
  normativa: { code: 'NORM_TARJETA', actions: { consultar: 'NORM_CONSULTAR' } },
  comunicados: { code: 'COMUNICADOS_TARJETA', actions: { ver: 'COMUNICADOS_VER' } },
  administracion: { code: 'SCGRC_TARJETA', actions: { acceder: 'SCGRC_ACCEDER' } },
  ib: { code: 'IB_TARJETA', actions: { acceder: 'IB_ACCEDER' } }
});

/**
 * Un conjunto autorizado SOLO es válido si el backend lo devuelve explícitamente
 * como resultado verificado de DM05. Nunca inferir roles desde área o puesto.
 */
export function resolvePortalPermissions(session) {
  const payload = session?.dm05;
  if (payload?.verified !== true || !Array.isArray(payload.codes)) return null;
  return new Set(payload.codes.filter(code => typeof code === 'string'));
}

export function canSeeCard(permissions, card) {
  return permissions instanceof Set && permissions.has(PORTAL_CARDS[card]?.code);
}

export function canSeeAction(permissions, card, action) {
  return canSeeCard(permissions, card)
    && permissions.has(PORTAL_CARDS[card]?.actions[action]);
}
