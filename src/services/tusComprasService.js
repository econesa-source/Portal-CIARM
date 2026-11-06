/**
 * Servicio Frontend para el Módulo "Tus compras" (Pedidos de compra Opex / Capex)
 * Tope mensual Opex por área solicitante: $10,000.00 MXN
 */

export const TUS_COMPRAS_OPEX_LIMIT = 10000;

export const TUS_COMPRAS_STATES = Object.freeze({
  ENVIADA: '1) Solicitud enviada',
  EN_PROCESO: '2a) Solicitud recibida / En proceso',
  EN_APROBACION: '2b) En aprobación',
  APROBADA: '2c) Aprobada / En curso',
  RECHAZADA: '2d) Rechazada',
  RECIBIDOS_ADM: '3) Artículos Recibidos en Adm.',
  ENTREGADA: '4) Compra Entregada al Solicitante',
  CONFORME: '5) Recepción Conforme',
  DISCONFORME: '5) Recepción Disconforme'
});

export function canSeeTusCompras(response) {
  if (!response) return false;
  if (response?.tusCompras?.visible === true) return true;
  if (Array.isArray(response?.codes) && response.codes.includes('TUS_COMPRAS_TARJETA')) return true;
  return false;
}

export function evaluateOrderApprovalRequirement(tipo, monto, currentAreaMonthlyOpex = 0, limit = TUS_COMPRAS_OPEX_LIMIT) {
  const cleanTipo = String(tipo || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX';
  const numMonto = Math.max(0, Number(monto) || 0);
  const currentOpex = Math.max(0, Number(currentAreaMonthlyOpex) || 0);
  const projectedAreaOpex = cleanTipo === 'OPEX'
    ? Math.round((currentOpex + numMonto) * 100) / 100
    : Math.round(currentOpex * 100) / 100;
  const exceedsOpexLimit = cleanTipo === 'OPEX' && projectedAreaOpex > limit;
  const requiresApproval = cleanTipo === 'CAPEX' || exceedsOpexLimit;
  return {
    tipo: cleanTipo,
    monto: numMonto,
    currentAreaMonthlyOpex: currentOpex,
    projectedAreaMonthlyOpex: projectedAreaOpex,
    opexLimit: limit,
    exceedsOpexLimit,
    requiresApproval,
    initialState: requiresApproval ? TUS_COMPRAS_STATES.EN_APROBACION : TUS_COMPRAS_STATES.ENVIADA
  };
}

export function resolveEffectiveOrderState(order, limit = TUS_COMPRAS_OPEX_LIMIT) {
  if (!order) return TUS_COMPRAS_STATES.ENVIADA;
  const rawState = String(order.estado || '').trim();
  const isCapex = String(order.tipo || '').trim().toUpperCase() === 'CAPEX';
  const monto = Number(order.monto) || 0;
  const acum = Number(order.acumuladoMesArea) || 0;
  const requiresApproval = Boolean(order.requiereAprobacion)
    || isCapex
    || (!isCapex && (monto > limit || acum > limit));

  if (requiresApproval && (rawState === '' || rawState === TUS_COMPRAS_STATES.ENVIADA)) {
    return TUS_COMPRAS_STATES.EN_APROBACION;
  }
  return rawState || TUS_COMPRAS_STATES.ENVIADA;
}

export function normalizeOrdersStates(orders, limit = TUS_COMPRAS_OPEX_LIMIT) {
  if (!Array.isArray(orders)) return [];
  const chronological = [...orders].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
  const runningByAreaMonth = new Map();

  for (const item of chronological) {
    if (!item || typeof item !== 'object') continue;
    const isCapex = String(item.tipo || '').trim().toUpperCase() === 'CAPEX';
    const monto = Number(item.monto) || 0;
    const rawState = String(item.estado || '').trim();
    const areaKey = String(item.area || 'docente').trim().toLowerCase();
    const ymKey = String(item.fecha || '').trim().slice(0, 7);
    const bucket = `${areaKey}|${ymKey}`;

    if (!isCapex && rawState !== TUS_COMPRAS_STATES.RECHAZADA) {
      const nextSum = Math.round(((runningByAreaMonth.get(bucket) || 0) + monto) * 100) / 100;
      runningByAreaMonth.set(bucket, nextSum);
    }
    const runningOpex = runningByAreaMonth.get(bucket) || 0;
    const acum = !isCapex
      ? Math.max(Number(item.acumuladoMesArea) || 0, runningOpex, monto)
      : Math.max(Number(item.acumuladoMesArea) || 0, runningOpex);

    item.acumuladoMesArea = acum;
    if (isCapex || (!isCapex && (monto > limit || acum > limit))) {
      item.requiereAprobacion = true;
    }
    item.estado = resolveEffectiveOrderState(item, limit);
  }
  return orders;
}

export function computeAllowedActions(order, access, viewKind = 'all') {
  if (!order || !access) return [];
  const state = resolveEffectiveOrderState(order);
  const actorEmail = String(access.correo || '').trim().toLowerCase();
  const isOwner = Boolean(actorEmail) && String(order.correo || '').trim().toLowerCase() === actorEmail;
  const canAdmin = Boolean(access.canAdmin);
  const canApprove = Boolean(access.canApprove);
  const requiresApproval = Boolean(order.requiereAprobacion)
    || String(order.tipo || '').toUpperCase() === 'CAPEX'
    || Number(order.acumuladoMesArea || 0) > TUS_COMPRAS_OPEX_LIMIT;

  // En vista del solicitante ("Mis Compras"), solo es informativo y únicamente habilita el cierre cuando está en estado 4)
  if (viewKind === 'mine') {
    if (state === TUS_COMPRAS_STATES.ENTREGADA && isOwner) {
      return ['CONFIRM_CONFORME', 'CONFIRM_DISCONFORME'];
    }
    return [];
  }

  const actions = [];
  if (state === TUS_COMPRAS_STATES.ENVIADA) {
    if (canAdmin && !requiresApproval) actions.push('RECEIVE_OPEX');
  } else if (state === TUS_COMPRAS_STATES.EN_PROCESO) {
    if (canAdmin) {
      actions.push('RECEIVE_ITEMS_ADM');
    }
  } else if (state === TUS_COMPRAS_STATES.EN_APROBACION) {
    if (canApprove || canAdmin) {
      actions.push('APPROVE_CAPEX');
      actions.push('REJECT_CAPEX');
    }
  } else if (state === TUS_COMPRAS_STATES.APROBADA) {
    if (canAdmin) actions.push('RECEIVE_ITEMS_ADM');
  } else if (state === TUS_COMPRAS_STATES.RECIBIDOS_ADM) {
    if (canAdmin) actions.push('DELIVER_TO_REQUESTER');
  } else if (state === TUS_COMPRAS_STATES.ENTREGADA) {
    if (isOwner) {
      actions.push('CONFIRM_CONFORME');
      actions.push('CONFIRM_DISCONFORME');
    }
  } else if (state === TUS_COMPRAS_STATES.DISCONFORME) {
    if (canAdmin) actions.push('DELIVER_TO_REQUESTER');
  }
  return actions;
}

async function apiRequest(action, params = {}, method = 'GET', token = null, signal = null) {
  const isPost = method === 'POST';
  const query = isPost ? '' : `?${new URLSearchParams({ action, ...params })}`;
  const response = await fetch(`/tus-compras-api.php${query}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(isPost
      ? {
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ action, ...params, csrfToken: token })
        }
      : { headers: { Accept: 'application/json' } })
  });

  let body;
  try {
    body = await response.json();
  } catch {
    throw Object.assign(new Error('Respuesta inválida del servidor.'), { code: 'UPSTREAM' });
  }
  if (!response.ok || body?.ok !== true || body?.data === undefined) {
    throw Object.assign(new Error(body?.message || 'No se pudo completar la operación en Tus compras.'), {
      code: body?.code || 'UPSTREAM',
      status: response.status
    });
  }
  return body.data;
}

export function getTusComprasContext(signal) {
  return apiRequest('context', {}, 'GET', null, signal);
}

export function listTusCompras(kind = 'mine', signal) {
  return apiRequest('list', { kind }, 'GET', null, signal);
}

export function getTusCompraDetail(id, signal) {
  return apiRequest('detail', { id }, 'GET', null, signal);
}

export function createTusCompra(payload, csrfToken, signal) {
  return apiRequest('create', payload, 'POST', csrfToken, signal);
}

export function transitionTusCompra(payload, csrfToken, signal) {
  return apiRequest('transition', payload, 'POST', csrfToken, signal);
}

export async function uploadTusCompraAttachment(file, csrfToken, signal) {
  const formData = new FormData();
  formData.append('action', 'uploadAttachment');
  formData.append('csrfToken', csrfToken);
  formData.append('file', file);
  const response = await fetch('/tus-compras-api.php', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
    signal
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw Object.assign(new Error('Respuesta inválida al subir adjunto.'), { code: 'UPSTREAM' });
  }
  if (!response.ok || body?.ok !== true || !body?.data?.url) {
    throw Object.assign(new Error('No se pudo subir el archivo adjunto.'), {
      code: body?.code || 'UPSTREAM'
    });
  }
  return body.data;
}
