/**
 * Servicio Frontend para el Módulo "Tus compras" (Pedidos de compra Opex / Capex)
 * Simplificado en 2 pasos (sin monto límite mensual por área solicitante):
 * - Compras < $8,000.00 MXN: pasan directo a generación de Orden de Compra (ISSUE_PURCHASE_ORDER), sin requerir cotización previa.
 * - Compras >= $8,000.00 MXN: pasan por aprobación (2b) En aprobación) y requieren 3 cotizaciones obligatorias de parte de Daniel Lara.
 */

export const TUS_COMPRAS_OPEX_LIMIT = 8000;
export const TUS_COMPRAS_THREE_QUOTES_THRESHOLD = 8000;
export const TUS_COMPRAS_QUOTE_THRESHOLD = 8000;
export const TUS_COMPRAS_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB por archivo

export const TUS_COMPRAS_STATES = Object.freeze({
  ENVIADA: '1) Solicitud enviada',
  EN_PROCESO: '2a) Solicitud recibida / En proceso',
  EN_COTIZACION: '2a-1) En cotización',
  COTIZACIONES_RECIBIDAS: '2a-2) Cotizaciones recibidas',
  EN_APROBACION: '2b) En aprobación',
  OC_GENERADA: '2c) Orden de Compra generada',
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

export function getEffectiveOrderAmount(order) {
  if (!order || typeof order !== 'object') return 0;
  const montoOC = Number(order.montoOrdenCompra) || 0;
  if (montoOC > 0) return Math.round(montoOC * 100) / 100;
  const montoEst = Number(order.montoEstimado ?? order.monto) || 0;
  return Math.round(montoEst * 100) / 100;
}

export function getBaseQuoteAmount(orderOrMonto) {
  if (typeof orderOrMonto === 'object' && orderOrMonto !== null) {
    return Math.max(0, Number(orderOrMonto.montoEstimado ?? orderOrMonto.monto) || 0);
  }
  return Math.max(0, Number(orderOrMonto) || 0);
}

export function getRequiredQuotesCount(orderOrMonto) {
  const monto = getBaseQuoteAmount(orderOrMonto);
  if (monto >= TUS_COMPRAS_THREE_QUOTES_THRESHOLD) return 3;
  return 0;
}

export function requiresQuotationProcess(orderOrMonto) {
  return getRequiredQuotesCount(orderOrMonto) > 0;
}

export function evaluateOrderApprovalRequirement(tipo, monto, currentAreaMonthlyOpex = 0, limit = TUS_COMPRAS_OPEX_LIMIT) {
  const cleanTipo = String(tipo || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX';
  const numMonto = Math.max(0, Number(monto) || 0);
  const currentOpex = Math.max(0, Number(currentAreaMonthlyOpex) || 0);
  const projectedAreaOpex = cleanTipo === 'OPEX'
    ? Math.round((currentOpex + numMonto) * 100) / 100
    : Math.round(currentOpex * 100) / 100;
  // Sin monto límite mensual por área: solo se evalúa el monto individual de la compra (>= $8,000 MXN) o si es CAPEX
  const exceedsOpexLimit = cleanTipo === 'OPEX' && numMonto >= limit;
  const requiresApproval = cleanTipo === 'CAPEX' || exceedsOpexLimit;
  const requiresQuotation = numMonto >= TUS_COMPRAS_QUOTE_THRESHOLD;
  const requiresThreeQuotes = numMonto >= TUS_COMPRAS_THREE_QUOTES_THRESHOLD;
  const requiredQuotesCount = requiresThreeQuotes ? 3 : 0;
  return {
    tipo: cleanTipo,
    monto: numMonto,
    currentAreaMonthlyOpex: currentOpex,
    projectedAreaMonthlyOpex: projectedAreaOpex,
    opexLimit: limit,
    quoteThreshold: TUS_COMPRAS_QUOTE_THRESHOLD,
    threeQuotesThreshold: TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
    requiresQuotation,
    requiresThreeQuotes,
    requiredQuotesCount,
    exceedsOpexLimit,
    requiresApproval,
    initialState: requiresApproval ? TUS_COMPRAS_STATES.EN_APROBACION : TUS_COMPRAS_STATES.ENVIADA
  };
}

export function resolveEffectiveOrderState(order, limit = TUS_COMPRAS_OPEX_LIMIT) {
  if (!order) return TUS_COMPRAS_STATES.ENVIADA;
  const rawState = String(order.estado || '').trim();
  const isCapex = String(order.tipo || '').trim().toUpperCase() === 'CAPEX';
  const monto = getEffectiveOrderAmount(order);
  const requiresApproval = Boolean(order.requiereAprobacion)
    || isCapex
    || (!isCapex && monto >= limit);

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
    const montoEst = Number(item.montoEstimado ?? item.monto) || 0;
    const montoOC = Number(item.montoOrdenCompra) || 0;
    const monto = montoOC > 0 ? montoOC : montoEst;
    item.montoEstimado = montoEst;
    item.montoOrdenCompra = montoOC;
    item.monto = monto;
    item.requiereCotizacion = montoEst >= TUS_COMPRAS_QUOTE_THRESHOLD;
    item.requiereTresCotizaciones = montoEst >= TUS_COMPRAS_THREE_QUOTES_THRESHOLD;
    item.cotizacionesRequeridas = getRequiredQuotesCount(montoEst);

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
      ? (montoOC > 0 ? Math.max(runningOpex, monto) : Math.max(Number(item.acumuladoMesArea) || 0, runningOpex, monto))
      : Math.max(Number(item.acumuladoMesArea) || 0, runningOpex);

    item.acumuladoMesArea = acum;
    if (isCapex || (!isCapex && monto >= limit)) {
      item.requiereAprobacion = true;
    } else {
      item.requiereAprobacion = Boolean(item.requiereAprobacion);
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
  const montoEfectivo = getEffectiveOrderAmount(order);
  const requiresApproval = Boolean(order.requiereAprobacion)
    || String(order.tipo || '').toUpperCase() === 'CAPEX'
    || montoEfectivo >= TUS_COMPRAS_OPEX_LIMIT;
  const montoBase = Number(order.montoEstimado ?? order.monto) || 0;
  const requiresQuotation = montoBase >= TUS_COMPRAS_QUOTE_THRESHOLD;

  // En vista del solicitante ("Mis Compras"), solo es informativo y únicamente habilita el cierre cuando está en estado 4)
  if (viewKind === 'mine') {
    if (state === TUS_COMPRAS_STATES.ENTREGADA && isOwner) {
      return ['CONFIRM_CONFORME', 'CONFIRM_DISCONFORME'];
    }
    return [];
  }

  const actions = [];
  if (state === TUS_COMPRAS_STATES.ENVIADA) {
    if (canAdmin && !requiresApproval) {
      actions.push(requiresQuotation ? 'START_QUOTING' : 'ISSUE_PURCHASE_ORDER');
    }
  } else if (state === TUS_COMPRAS_STATES.EN_PROCESO) {
    if (canAdmin) {
      actions.push(requiresQuotation ? 'START_QUOTING' : 'ISSUE_PURCHASE_ORDER');
    }
  } else if (state === TUS_COMPRAS_STATES.EN_COTIZACION) {
    if (canAdmin) actions.push('RECEIVE_QUOTES');
  } else if (state === TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS) {
    if (canAdmin) actions.push('ISSUE_PURCHASE_ORDER');
  } else if (state === TUS_COMPRAS_STATES.EN_APROBACION) {
    if (canApprove || canAdmin) {
      actions.push('APPROVE_CAPEX');
      actions.push('REJECT_CAPEX');
    }
  } else if (state === TUS_COMPRAS_STATES.OC_GENERADA || state === TUS_COMPRAS_STATES.APROBADA) {
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

export function parseTusComprasTimestamp(rawDateOrFull, rawTime = '') {
  const dStr = String(rawDateOrFull || '').trim();
  if (!dStr) return null;
  const parenMatch = dStr.match(/\((\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\)/);
  const cleanStr = parenMatch ? parenMatch[1] : (rawTime ? `${dStr} ${String(rawTime).trim()}` : dStr);
  const isoCandidate = cleanStr.includes('T')
    ? cleanStr
    : cleanStr.length === 10
    ? `${cleanStr}T00:00:00-05:00`
    : `${cleanStr.replace(' ', 'T')}-05:00`;
  const ms = Date.parse(isoCandidate);
  return Number.isFinite(ms) ? ms : null;
}

export function formatDurationHours(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return 'Sin casos';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} min`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} días (${Math.round(hours)} h)`;
}

export function computeTusComprasExecutiveMetrics(orders, filters = {}, nowMs = Date.now()) {
  const normalized = normalizeOrdersStates(Array.isArray(orders) ? [...orders] : []);
  const daysFilter = Number(filters.days) || 0;
  const tipoFilter = String(filters.tipo || '').toUpperCase();
  const areaFilter = String(filters.area || '').trim().toLowerCase();

  const cutoffMs = daysFilter > 0 ? nowMs - daysFilter * 86400000 : null;

  const filtered = normalized.filter(order => {
    if (tipoFilter && tipoFilter !== 'ALL' && String(order.tipo || '').toUpperCase() !== tipoFilter) return false;
    if (areaFilter && areaFilter !== 'all' && String(order.area || '').trim().toLowerCase() !== areaFilter) return false;
    if (cutoffMs !== null) {
      const createdMs = parseTusComprasTimestamp(order.fecha, order.hora || '00:00:00');
      if (createdMs !== null && createdMs < cutoffMs) return false;
    }
    return true;
  });

  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const buckets = {
    OPEX: {
      count: 0,
      montoTotal: 0,
      openCount: 0,
      inDanielCourtCount: 0,
      inApprovalCount: 0,
      deliveredCount: 0,
      closedCount: 0,
      conformeCount: 0,
      disconformeCount: 0,
      rejectedCount: 0,
      endToEndDeliveryHours: [],
      endToEndClosureHours: [],
      approvalHours: [],
      danielReceptionHours: [],
      danielProcurementHours: [],
      danielInternalDeliveryHours: [],
      danielTotalCompletedHours: [],
      danielActiveAgingHours: [],
      requesterValidationHours: []
    },
    CAPEX: {
      count: 0,
      montoTotal: 0,
      openCount: 0,
      inDanielCourtCount: 0,
      inApprovalCount: 0,
      deliveredCount: 0,
      closedCount: 0,
      conformeCount: 0,
      disconformeCount: 0,
      rejectedCount: 0,
      endToEndDeliveryHours: [],
      endToEndClosureHours: [],
      approvalHours: [],
      danielReceptionHours: [],
      danielProcurementHours: [],
      danielInternalDeliveryHours: [],
      danielTotalCompletedHours: [],
      danielActiveAgingHours: [],
      requesterValidationHours: []
    }
  };

  const stateCounts = {};
  Object.values(TUS_COMPRAS_STATES).forEach(st => {
    stateCounts[st] = { total: 0, OPEX: 0, CAPEX: 0, monto: 0 };
  });

  const areaOpexMap = new Map();
  const danielBacklog = [];
  const currentMonth = new Date(nowMs - 5 * 3600000).toISOString().slice(0, 7);

  for (const order of filtered) {
    const tipo = String(order.tipo || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX';
    const b = buckets[tipo];
    const state = resolveEffectiveOrderState(order);
    const monto = Number(order.monto) || 0;
    const history = Array.isArray(order.history) ? order.history : [];

    b.count += 1;
    b.montoTotal = Math.round((b.montoTotal + monto) * 100) / 100;

    if (!stateCounts[state]) {
      stateCounts[state] = { total: 0, OPEX: 0, CAPEX: 0, monto: 0 };
    }
    stateCounts[state].total += 1;
    stateCounts[state][tipo] += 1;
    stateCounts[state].monto = Math.round((stateCounts[state].monto + monto) * 100) / 100;

    if (tipo === 'OPEX' && state !== TUS_COMPRAS_STATES.RECHAZADA) {
      const areaName = String(order.area || 'Docente').trim() || 'Docente';
      const orderMonth = String(order.fecha || '').slice(0, 7);
      const prev = areaOpexMap.get(areaName) || { area: areaName, currentMonthMonto: 0, periodMonto: 0, count: 0 };
      prev.periodMonto = Math.round((prev.periodMonto + monto) * 100) / 100;
      if (!orderMonth || orderMonth === currentMonth) {
        prev.currentMonthMonto = Math.round((prev.currentMonthMonto + monto) * 100) / 100;
      }
      prev.count += 1;
      areaOpexMap.set(areaName, prev);
    }

    const findEventMs = evName => {
      const found = history.find(h => String(h.evento || '').toUpperCase() === evName);
      return found ? parseTusComprasTimestamp(found.fechaHora) : null;
    };

    const tCreated = parseTusComprasTimestamp(order.fecha, order.hora || '09:00:00') || findEventMs('CREATE');
    const tApproved = parseTusComprasTimestamp(order.fechaAprobacion) || findEventMs('APPROVE_CAPEX');
    const tRejected = findEventMs('REJECT_CAPEX') || (state === TUS_COMPRAS_STATES.RECHAZADA ? parseTusComprasTimestamp(order.fechaAprobacion || order.ultimaActualizacion) : null);
    const tInProcess2a = findEventMs('RECEIVE_OPEX') || tApproved;
    const tReceivedAdm3 = parseTusComprasTimestamp(order.fechaRecepcionAdm) || findEventMs('RECEIVE_ITEMS_ADM');
    const tDelivered4 = parseTusComprasTimestamp(order.fechaEntrega) || findEventMs('DELIVER_TO_REQUESTER');
    const tClosed5 =
      parseTusComprasTimestamp(order.evaluacion) ||
      findEventMs('CONFIRM_CONFORME') ||
      findEventMs('CONFIRM_DISCONFORME') ||
      ([TUS_COMPRAS_STATES.CONFORME, TUS_COMPRAS_STATES.DISCONFORME].includes(state)
        ? parseTusComprasTimestamp(order.ultimaActualizacion)
        : null);

    const requiresApproval = Boolean(order.requiereAprobacion) || tipo === 'CAPEX' || monto >= TUS_COMPRAS_OPEX_LIMIT;

    // Momento desde el cual el ticket está disponible en cancha de Daniel Lara para gestionar la compra:
    // - Si no requirió aprobación: desde tCreated (1 Solicitud enviada)
    // - Si requirió aprobación (2b): desde que fue aprobado (tApproved -> 2a)
    const tReadyForDaniel = requiresApproval ? tApproved : tCreated;

    if (tCreated !== null && (tApproved !== null || tRejected !== null)) {
      const endApp = tApproved ?? tRejected;
      if (endApp >= tCreated) {
        b.approvalHours.push((endApp - tCreated) / 3600000);
      }
    }

    if (!requiresApproval && tCreated !== null && tInProcess2a !== null && tInProcess2a >= tCreated) {
      b.danielReceptionHours.push((tInProcess2a - tCreated) / 3600000);
    }

    const startProc = tInProcess2a ?? tReadyForDaniel;
    if (startProc !== null && tReceivedAdm3 !== null && tReceivedAdm3 >= startProc) {
      b.danielProcurementHours.push((tReceivedAdm3 - startProc) / 3600000);
    }

    if (tReceivedAdm3 !== null && tDelivered4 !== null && tDelivered4 >= tReceivedAdm3) {
      b.danielInternalDeliveryHours.push((tDelivered4 - tReceivedAdm3) / 3600000);
    }

    if (tReadyForDaniel !== null && tDelivered4 !== null && tDelivered4 >= tReadyForDaniel) {
      b.danielTotalCompletedHours.push((tDelivered4 - tReadyForDaniel) / 3600000);
    }

    if (tCreated !== null && tDelivered4 !== null && tDelivered4 >= tCreated) {
      b.endToEndDeliveryHours.push((tDelivered4 - tCreated) / 3600000);
    }

    if (tCreated !== null && tClosed5 !== null && tClosed5 >= tCreated) {
      b.endToEndClosureHours.push((tClosed5 - tCreated) / 3600000);
    }

    if (tDelivered4 !== null && tClosed5 !== null && tClosed5 >= tDelivered4) {
      b.requesterValidationHours.push((tClosed5 - tDelivered4) / 3600000);
    }

    const isDanielStage = [
      TUS_COMPRAS_STATES.ENVIADA,
      TUS_COMPRAS_STATES.EN_PROCESO,
      TUS_COMPRAS_STATES.EN_COTIZACION,
      TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS,
      TUS_COMPRAS_STATES.OC_GENERADA,
      TUS_COMPRAS_STATES.APROBADA,
      TUS_COMPRAS_STATES.RECIBIDOS_ADM
    ].includes(state);

    if (state === TUS_COMPRAS_STATES.EN_APROBACION) {
      b.inApprovalCount += 1;
      b.openCount += 1;
    } else if (isDanielStage) {
      b.inDanielCourtCount += 1;
      b.openCount += 1;
      const refStart = tReadyForDaniel ?? tCreated;
      const elapsedHours = refStart !== null ? Math.max(0, (nowMs - refStart) / 3600000) : 0;
      b.danielActiveAgingHours.push(elapsedHours);
      danielBacklog.push({
        order,
        tipo,
        state,
        elapsedHours
      });
    } else if (state === TUS_COMPRAS_STATES.ENTREGADA) {
      b.deliveredCount += 1;
      b.openCount += 1;
    } else if (state === TUS_COMPRAS_STATES.CONFORME) {
      b.deliveredCount += 1;
      b.closedCount += 1;
      b.conformeCount += 1;
    } else if (state === TUS_COMPRAS_STATES.DISCONFORME) {
      b.deliveredCount += 1;
      b.closedCount += 1;
      b.disconformeCount += 1;
    } else if (state === TUS_COMPRAS_STATES.RECHAZADA) {
      b.rejectedCount += 1;
    }
  }

  danielBacklog.sort((a, b) => b.elapsedHours - a.elapsedHours);

  const summarizeBucket = b => ({
    ...b,
    avgEndToEndDeliveryHours: avg(b.endToEndDeliveryHours),
    avgEndToEndClosureHours: avg(b.endToEndClosureHours),
    avgApprovalHours: avg(b.approvalHours),
    avgDanielReceptionHours: avg(b.danielReceptionHours),
    avgDanielProcurementHours: avg(b.danielProcurementHours),
    avgDanielInternalDeliveryHours: avg(b.danielInternalDeliveryHours),
    avgDanielTotalCompletedHours: avg(b.danielTotalCompletedHours),
    avgDanielActiveAgingHours: avg(b.danielActiveAgingHours),
    avgRequesterValidationHours: avg(b.requesterValidationHours),
    conformeRatePct: b.closedCount > 0 ? Math.round((b.conformeCount / b.closedCount) * 100) : null
  });

  const opexSummary = summarizeBucket(buckets.OPEX);
  const capexSummary = summarizeBucket(buckets.CAPEX);

  const totalClosed = opexSummary.closedCount + capexSummary.closedCount;
  const totalConforme = opexSummary.conformeCount + capexSummary.conformeCount;
  const totalDisconforme = opexSummary.disconformeCount + capexSummary.disconformeCount;

  return {
    totalOrders: filtered.length,
    totalMonto: Math.round((opexSummary.montoTotal + capexSummary.montoTotal) * 100) / 100,
    opex: opexSummary,
    capex: capexSummary,
    stateCounts,
    areaBudgets: [...areaOpexMap.values()].sort((a, b) => b.currentMonthMonto - a.currentMonthMonto),
    danielBacklog,
    quality: {
      totalClosed,
      totalConforme,
      totalDisconforme,
      conformeRatePct: totalClosed > 0 ? Math.round((totalConforme / totalClosed) * 100) : null
    }
  };
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

export function validateTusCompraAttachmentFile(file, label = 'archivo adjunto') {
  if (!file || typeof file !== 'object') {
    throw Object.assign(new Error(`No se seleccionó ningún ${label} válido.`), { code: 'VALIDATION' });
  }
  const fileName = String(file.name || label).trim() || label;
  const size = Number(file.size) || 0;
  if (size < 1) {
    throw Object.assign(new Error(`El archivo «${fileName}» está vacío.`), { code: 'VALIDATION' });
  }
  if (size > TUS_COMPRAS_MAX_ATTACHMENT_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(2);
    throw Object.assign(
      new Error(
        `El archivo «${fileName}» (${sizeMb} MB) supera el límite máximo permitido de 10 MB por archivo. Por favor selecciona un archivo de hasta 10 MB.`
      ),
      { code: 'PAYLOAD_SIZE' }
    );
  }
  return true;
}

export async function uploadTusCompraAttachment(file, csrfToken, signal, label = 'archivo adjunto') {
  validateTusCompraAttachmentFile(file, label);
  const fileName = String(file?.name || label).trim() || label;
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
    throw Object.assign(
      new Error(
        `No se logró cargar el ${label} «${fileName}» en Google Drive (respuesta inválida del servidor). La operación se detuvo para evitar que el registro quede sin su archivo.`
      ),
      { code: 'UPLOAD_FAILED' }
    );
  }
  const uploadedUrl = typeof body?.data?.url === 'string' ? body.data.url.trim() : '';
  if (!response.ok || body?.ok !== true || !uploadedUrl || !uploadedUrl.startsWith('http')) {
    throw Object.assign(
      new Error(
        body?.message ||
          `No se logró cargar el ${label} «${fileName}» en Google Drive. La operación se detuvo y se notificó del incidente; por favor intenta nuevamente.`
      ),
      {
        code: body?.code || 'UPLOAD_FAILED'
      }
    );
  }
  return body.data;
}
