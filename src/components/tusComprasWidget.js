/**
 * Módulo "Tus compras" - Sistema simplificado de pedidos de compra (Opex / Capex)
 * Coordinado por Administración (Daniel Lara) con aprobación ejecutiva (Ezequiel Conesa)
 * para compras Capex o cuando el acumulado mensual Opex del área solicitante supera $10,000 MXN.
 */

import {
  TUS_COMPRAS_STATES,
  TUS_COMPRAS_OPEX_LIMIT,
  evaluateOrderApprovalRequirement,
  resolveEffectiveOrderState,
  normalizeOrdersStates,
  getTusComprasContext,
  listTusCompras,
  createTusCompra,
  transitionTusCompra,
  uploadTusCompraAttachment
} from '../services/tusComprasService.js?v=18.7.16-tc2';

const ACTION_META = Object.freeze({
  RECEIVE_OPEX: {
    label: 'Recibir y poner En Proceso (2a)',
    badgeClass: 'dark',
    confirmTitle: 'Pasar a 2a) Solicitud recibida / En proceso',
    description: 'Confirma que el pedido Opex ha sido recibido en Administración y pasa a proceso de compra.',
    requireComment: false
  },
  APPROVE_CAPEX: {
    label: 'Aprobar y pasar a 2a)',
    badgeClass: 'dark',
    confirmTitle: 'Aprobar pedido → 2a) Solicitud recibida / En proceso',
    description: 'Autoriza este pedido en aprobación para que pase al estado 2a) Solicitud recibida / En proceso.',
    requireComment: false
  },
  REJECT_CAPEX: {
    label: 'Rechazar Pedido (2d)',
    badgeClass: 'danger',
    confirmTitle: 'Rechazar pedido → 2d) Rechazada',
    description: 'Indica el motivo del rechazo (obligatorio). Se notificará al solicitante y a Daniel Lara.',
    requireComment: true
  },
  RECEIVE_ITEMS_ADM: {
    label: 'Artículos Recibidos en Adm. (3)',
    badgeClass: 'dark',
    confirmTitle: 'Pasar a 3) Artículos Recibidos en Adm.',
    description: 'Registra que los artículos solicitados ya llegaron físicamente a Administración.',
    requireComment: false
  },
  DELIVER_TO_REQUESTER: {
    label: 'Entregar Compra al Solicitante (4)',
    badgeClass: 'gold',
    confirmTitle: 'Pasar a 4) Compra Entregada al Solicitante',
    description: 'Registra la entrega al solicitante y habilita su cierre como Recepción Conforme o Recepción Disconforme.',
    requireComment: false
  },
  CONFIRM_CONFORME: {
    label: 'Recepción Conforme',
    badgeClass: 'conforme',
    confirmTitle: 'Cerrar ticket: 5) Recepción Conforme',
    description: 'Confirma que recibiste los artículos solicitados a entera satisfacción para cerrar el ticket.',
    requireComment: false
  },
  CONFIRM_DISCONFORME: {
    label: 'Recepción Disconforme',
    badgeClass: 'danger',
    confirmTitle: 'Cerrar ticket: 5) Recepción Disconforme',
    description: 'Describe el motivo de disconformidad (artículo incompleto, dañado o distinto) para cerrar el ticket y notificar a Administración.',
    requireComment: true
  }
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
}

function stateBadgeStyle(state) {
  if (state === TUS_COMPRAS_STATES.CONFORME) return 'background:#dcfce7;color:#166534;border:1px solid #86efac;';
  if (state === TUS_COMPRAS_STATES.RECHAZADA || state === TUS_COMPRAS_STATES.DISCONFORME) {
    return 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;';
  }
  if (state === TUS_COMPRAS_STATES.EN_APROBACION) return 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;';
  if (state === TUS_COMPRAS_STATES.ENTREGADA) return 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;';
  if (state === TUS_COMPRAS_STATES.APROBADA || state === TUS_COMPRAS_STATES.EN_PROCESO || state === TUS_COMPRAS_STATES.RECIBIDOS_ADM) {
    return 'background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;';
  }
  return 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
}

function renderStepProgress(state) {
  const s = String(state || '');
  const step1Done = true;
  const step2Done = s !== TUS_COMPRAS_STATES.ENVIADA;
  const step3Done = [
    TUS_COMPRAS_STATES.RECIBIDOS_ADM,
    TUS_COMPRAS_STATES.ENTREGADA,
    TUS_COMPRAS_STATES.CONFORME,
    TUS_COMPRAS_STATES.DISCONFORME
  ].includes(s);
  const step4Done = [
    TUS_COMPRAS_STATES.ENTREGADA,
    TUS_COMPRAS_STATES.CONFORME,
    TUS_COMPRAS_STATES.DISCONFORME
  ].includes(s);
  const step5Done = [TUS_COMPRAS_STATES.CONFORME, TUS_COMPRAS_STATES.DISCONFORME].includes(s);

  let step2Label = '2) En proceso / Aprobación';
  if (s === TUS_COMPRAS_STATES.EN_PROCESO) step2Label = '2a) Recibida / En proceso';
  else if (s === TUS_COMPRAS_STATES.EN_APROBACION) step2Label = '2b) En aprobación';
  else if (s === TUS_COMPRAS_STATES.APROBADA) step2Label = '2c) Aprobada / En curso';
  else if (s === TUS_COMPRAS_STATES.RECHAZADA) step2Label = '2d) Rechazada';

  const steps = [
    { label: '1) Solicitud enviada', active: step1Done },
    { label: step2Label, active: step2Done, rejected: s === TUS_COMPRAS_STATES.RECHAZADA },
    { label: '3) Recibidos en Adm.', active: step3Done },
    { label: '4) Entregada al Solicitante', active: step4Done },
    {
      label: s === TUS_COMPRAS_STATES.DISCONFORME ? '5) Disconforme' : '5) Recepción Conforme',
      active: step5Done,
      rejected: s === TUS_COMPRAS_STATES.DISCONFORME
    }
  ];

  return `
    <div class="tus-compras-stepper" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;">
      ${steps
        .map(st => {
          const bg = st.rejected ? '#fee2e2' : st.active ? '#1e3a8a' : '#f1f5f9';
          const color = st.rejected ? '#991b1b' : st.active ? '#ffffff' : '#64748b';
          return `<span style="padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${bg};color:${color};">${escapeHtml(st.label)}</span>`;
        })
        .join('')}
    </div>
  `;
}

export async function render(container, userSession) {
  if (!container) return;
  const controller = new AbortController();
  const signal = controller.signal;
  window.addEventListener('hashchange', () => controller.abort(), { once: true });
  const active = () => !signal.aborted && container.isConnected;

  const route = window.location.hash || '#tus-compras';
  container.innerHTML = '<section class="ticket-admin"><p role="status">Cargando Tus compras…</p></section>';

  let ctx;
  try {
    ctx = await getTusComprasContext(signal);
  } catch (err) {
    if (!active()) return;
    container.innerHTML = `
      <div class="card-container-wide">
        <div class="solicitud-topbar">
          <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        </div>
        <p role="alert" style="color:#991b1b;font-weight:600;">No tienes acceso habilitado para Tus compras o no se pudo verificar tu perfil en DM03.</p>
      </div>
    `;
    return;
  }
  if (!active()) return;

  const access = ctx.access || {};
  const canCreate = Boolean(access.canCreate);
  const isAdministracion = Boolean(access.isAdministracion || (access.isDocenteDirector !== true && (access.canAdmin || access.canApprove)));

  if (route === '#tus-compras-nuevo') {
    if (!canCreate && !isAdministracion) {
      container.innerHTML = '<p role="alert">Tu perfil no tiene habilitado el registro de pedidos de compra.</p>';
      return;
    }
    renderCreateView(container, ctx, controller);
    return;
  }

  const isAdminView = route === '#admin-tus-compras' && isAdministracion;
  await renderListView(container, ctx, isAdminView ? 'all' : 'mine', controller);
}

function renderTopNavigation(activeRoute, access) {
  const canCreate = Boolean(access?.canCreate);
  // El menú de Gestión y Aprobaciones solo corresponde a usuarios con perfil "administración" en área (AG) y nivel (AJ)
  const showAdminMenu = Boolean(access?.isAdministracion === true);
  return `
    <div class="solicitud-topbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${canCreate ? `<a href="#tus-compras-nuevo" class="solicitud-secondary-link" style="${activeRoute === '#tus-compras-nuevo' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">+ Crear Pedido</a>` : ''}
        <a href="#tus-compras" class="solicitud-secondary-link" style="${activeRoute === '#tus-compras' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">Mis Compras</a>
        ${showAdminMenu ? `<a href="#admin-tus-compras" class="solicitud-secondary-link" style="${activeRoute === '#admin-tus-compras' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">Gestión y Aprobaciones</a>` : ''}
      </div>
    </div>
  `;
}

function renderCreateView(container, ctx, controller) {
  const access = ctx.access || {};
  const currentOpex = Number(ctx.areaMonthlyOpex || 0);
  const opexLimit = Number(ctx.opexLimit || TUS_COMPRAS_OPEX_LIMIT);
  const remainingOpex = Math.max(0, opexLimit - currentOpex);

  container.innerHTML = `
    <div class="card-container-wide solicitud-card">
      ${renderTopNavigation('#tus-compras-nuevo', access)}

      <div class="solicitud-heading">
        <h2>Nuevo Pedido de Compra · Tus compras</h2>
        <p>Registra tu solicitud de compra para Administración (Daniel Lara). Pedidos Opex hasta $10,000.00 MXN acumulados al mes por área se procesan directamente; pedidos Capex o que superen $10,000.00 MXN mensuales requieren aprobación de Ezequiel Conesa.</p>
      </div>

      <div id="tus-compras-budget-banner" style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #26487F;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:14px;">
        <div><strong>Área solicitante (DM03):</strong> ${escapeHtml(access.area || 'Docente')} · <strong>Acumulado Opex del mes (${escapeHtml(ctx.yearMonth || '')}):</strong> ${formatCurrency(currentOpex)} / ${formatCurrency(opexLimit)}</div>
        <div style="margin-top:4px;color:#334155;">Disponible Opex directo en el mes para tu área: <strong>${formatCurrency(remainingOpex)}</strong></div>
      </div>

      <form id="form-tus-compras" class="solicitud-form">
        <div class="solicitud-identity">
          <div class="solicitud-field">
            <label>SOLICITANTE INSTITUCIONAL</label>
            <input type="text" value="${escapeHtml(access.nombre || '')}" readonly />
          </div>
          <div class="solicitud-field">
            <label>CORREO Y ÁREA SOLICITANTE</label>
            <input type="text" value="${escapeHtml((access.correo || '') + ' · ' + (access.area || ''))}" readonly />
          </div>
        </div>

        <div class="solicitud-identity">
          <div class="solicitud-field">
            <label for="tc-tipo">TIPO DE COMPRA *</label>
            <select id="tc-tipo" name="tipo" required>
              <option value="OPEX" selected>1) OPEX — Gasto operativo mensual (tope $10,000 MXN/mes por área)</option>
              <option value="CAPEX">2) CAPEX — Inversión / Activo fijo (requiere aprobación de Ezequiel Conesa)</option>
            </select>
          </div>
          <div class="solicitud-field">
            <label for="tc-monto">MONTO TOTAL ESTIMADO (MXN) *</label>
            <input type="number" id="tc-monto" name="monto" min="1" max="10000000" step="0.01" required placeholder="Ej. 3500.00" />
          </div>
        </div>

        <div id="tc-route-preview" role="status" style="padding:10px 14px;border-radius:6px;background:#e0f2fe;color:#075985;font-size:13.5px;font-weight:600;margin-bottom:12px;">
          Ingresa el monto estimado para verificar si se gestiona directamente por Daniel Lara (2a) o si requiere aprobación de Ezequiel Conesa (2b).
        </div>

        <div class="solicitud-field solicitud-description">
          <label for="tc-descripcion">ARTÍCULOS SOLICITADOS Y CANTIDADES *</label>
          <textarea id="tc-descripcion" name="descripcion" rows="3" required placeholder="Detalla los artículos, cantidades y especificaciones requeridas..."></textarea>
        </div>

        <div class="solicitud-field">
          <label for="tc-justificacion">JUSTIFICACIÓN / PROVEEDOR O ENLACE DE REFERENCIA</label>
          <input type="text" id="tc-justificacion" name="justificacion" placeholder="Motivo pedagógico/operativo, proveedor sugerido o link de referencia..." />
        </div>

        <div class="solicitud-field solicitud-files">
          <label for="tc-adjunto">COTIZACIÓN O ARCHIVO ADJUNTO (OPCIONAL · PDF O IMAGEN MÁX. 10 MB)</label>
          <input type="file" id="tc-adjunto" accept="image/*,.pdf" />
        </div>

        <div class="solicitud-submit-row">
          <button type="submit" id="btn-submit-tus-compras" class="solicitud-submit-btn">
            Enviar Pedido de Compra
          </button>
        </div>
      </form>

      <div id="tc-form-status" class="solicitud-status"></div>
    </div>
  `;

  const selectTipo = container.querySelector('#tc-tipo');
  const inputMonto = container.querySelector('#tc-monto');
  const preview = container.querySelector('#tc-route-preview');
  const form = container.querySelector('#form-tus-compras');
  const btnSubmit = container.querySelector('#btn-submit-tus-compras');
  const fileInput = container.querySelector('#tc-adjunto');
  const statusBox = container.querySelector('#tc-form-status');

  function updatePreview() {
    const montoVal = Number(inputMonto.value || 0);
    const evalRes = evaluateOrderApprovalRequirement(selectTipo.value, montoVal, currentOpex, opexLimit);
    if (montoVal <= 0) {
      preview.style.background = '#e0f2fe';
      preview.style.color = '#075985';
      preview.textContent = 'Ingresa el monto estimado para calcular la ruta de atención.';
      return;
    }
    if (evalRes.requiresApproval) {
      preview.style.background = '#fef3c7';
      preview.style.color = '#92400e';
      const reason = evalRes.tipo === 'CAPEX'
        ? 'por ser compra tipo CAPEX'
        : `porque el acumulado mensual Opex del área (${formatCurrency(evalRes.projectedAreaMonthlyOpex)}) supera el límite permitido de ${formatCurrency(opexLimit)}`;
      preview.textContent = `Ruta automática: Al enviar el ticket pasará automáticamente al estado «2b) En aprobación» (${reason}). Cuando el autorizador (Administración) apruebe el ticket, pasará al estado «2a) Solicitud recibida / En proceso».`;
    } else {
      preview.style.background = '#dcfce7';
      preview.style.color = '#166534';
      preview.textContent = `Ruta Opex dentro de presupuesto: Se registrará en «1) Solicitud enviada» para pasar a «2a) Solicitud recibida / En proceso» (Acumulado mensual proyectado del área: ${formatCurrency(evalRes.projectedAreaMonthlyOpex)} ≤ ${formatCurrency(opexLimit)}).`;
    }
  }

  selectTipo?.addEventListener('change', updatePreview);
  inputMonto?.addEventListener('input', updatePreview);

  let busy = false;
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    btnSubmit.disabled = true;
    statusBox.className = 'solicitud-status is-visible is-loading';
    statusBox.textContent = 'Registrando pedido de compra y enviando notificaciones por correo…';

    try {
      let adjuntoUrl = '';
      const file = fileInput?.files?.[0];
      if (file) {
        statusBox.textContent = 'Subiendo archivo adjunto…';
        const uploaded = await uploadTusCompraAttachment(file, ctx.csrfToken, controller.signal);
        adjuntoUrl = uploaded.url || '';
      }
      statusBox.textContent = 'Guardando pedido y notificando a Administración…';
      const result = await createTusCompra(
        {
          tipo: selectTipo.value,
          monto: Number(inputMonto.value),
          descripcion: container.querySelector('#tc-descripcion').value.trim(),
          justificacion: container.querySelector('#tc-justificacion').value.trim(),
          adjuntos: adjuntoUrl
        },
        ctx.csrfToken,
        controller.signal
      );
      if (controller.signal.aborted) return;
      statusBox.className = 'solicitud-status is-visible is-success';
      statusBox.textContent = `Pedido ${result.order.id} registrado en estado «${result.order.estado}». Redirigiendo a Mis Compras…`;
      setTimeout(() => {
        if (!controller.signal.aborted) window.location.hash = '#tus-compras';
      }, 1800);
    } catch (err) {
      if (controller.signal.aborted) return;
      statusBox.className = 'solicitud-status is-visible is-error';
      statusBox.textContent = err?.message || 'No se pudo registrar el pedido. Verifica los datos e intenta nuevamente.';
      busy = false;
      btnSubmit.disabled = false;
    }
  });
}

async function renderListView(container, ctx, kind, controller) {
  const signal = controller.signal;
  const active = () => !signal.aborted && container.isConnected;
  const access = ctx.access || {};
  const activeRoute = kind === 'all' ? '#admin-tus-compras' : '#tus-compras';

  let listData;
  try {
    listData = await listTusCompras(kind, signal);
  } catch (err) {
    if (!active()) return;
    container.innerHTML = `<section class="ticket-admin"><p role="alert">No se pudieron consultar los pedidos de compra.</p></section>`;
    return;
  }
  if (!active()) return;

  let items = normalizeOrdersStates(Array.isArray(listData.items) ? listData.items : []);
  let stateFilter = 'ALL';
  let searchQuery = '';

  const countsByState = {};
  Object.values(TUS_COMPRAS_STATES).forEach(st => {
    countsByState[st] = 0;
  });
  items.forEach(item => {
    const effState = resolveEffectiveOrderState(item);
    item.estado = effState;
    countsByState[effState] = (countsByState[effState] || 0) + 1;
  });

  container.innerHTML = `
    <section class="ticket-admin">
      ${renderTopNavigation(activeRoute, access)}

      <header class="ticket-admin-header" style="margin-bottom:14px;">
        <div>
          <h1>${kind === 'all' ? 'Gestión y Aprobaciones · Tus compras' : 'Mis Compras y Validación de Recepción'}</h1>
          <p>${
            kind === 'all'
              ? 'Administra el ciclo de pedidos Opex (≤ $10,000 MXN/mes por área) y Capex (> $10,000 MXN/mes). Al aprobar un ticket en 2b) En aprobación, pasa al estado 2a) Solicitud recibida / En proceso.'
              : 'Consulta el estado informativo de tus tickets de compra. Cuando tu compra sea entregada podrás cerrar el ticket clasificándolo como Recepción Conforme o Recepción Disconforme.'
          }</p>
        </div>
      </header>

      ${
        kind === 'all'
          ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;" id="tc-state-filters">
          <button type="button" class="ticket-action-pill" data-filter="ALL" style="font-weight:700;">Todos (${items.length})</button>
          ${Object.values(TUS_COMPRAS_STATES)
            .map(
              st => `
            <button type="button" class="ticket-action-pill" data-filter="${escapeHtml(st)}">
              ${escapeHtml(st)} (${countsByState[st] || 0})
            </button>
          `
            )
            .join('')}
        </div>

        <div style="margin-bottom:14px;">
          <input type="search" id="tc-search-input" placeholder="Buscar por folio CMP-2026-..., solicitante, área o artículo…" style="width:100%;max-width:480px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;" />
        </div>
      `
          : ''
      }

      <div id="tc-notice" role="status" style="margin-bottom:12px;font-weight:600;color:#166534;" hidden></div>
      <div id="tc-orders-list" style="display:flex;flex-direction:column;gap:14px;"></div>

      <dialog id="tc-modal" class="ticket-modal" style="max-width:680px;width:94%;border-radius:10px;border:1px solid #cbd5e1;padding:20px;"></dialog>
    </section>
  `;

  const listEl = container.querySelector('#tc-orders-list');
  const modalEl = container.querySelector('#tc-modal');
  const noticeEl = container.querySelector('#tc-notice');
  const searchEl = container.querySelector('#tc-search-input');

  function renderCards() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter(order => {
      if (kind === 'all' && stateFilter !== 'ALL' && order.estado !== stateFilter) return false;
      if (!q) return true;
      const haystack = `${order.id} ${order.solicitante} ${order.area} ${order.tipo} ${order.descripcion} ${order.estado}`.toLowerCase();
      return haystack.includes(q);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div style="padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;">No tienes pedidos de compra registrados.</div>`;
      return;
    }

    if (kind === 'mine') {
      // Vista del solicitante: solo listado informativo con botón azul "Ver detalle" y botones de cierre de recepción cuando esté en estado 4)
      listEl.innerHTML = `
        <div class="ticket-table-wrap">
          <table class="ticket-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Tipo / Monto</th>
                <th>Artículos Solicitados</th>
                <th>Estado Actual</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(order => {
                  const canCloseReception = order.estado === TUS_COMPRAS_STATES.ENTREGADA;
                  return `
                    <tr data-order-id="${escapeHtml(order.id)}">
                      <td><strong>${escapeHtml(order.id)}</strong></td>
                      <td>${escapeHtml(order.fecha || '—')}</td>
                      <td>
                        <span style="padding:2px 7px;border-radius:4px;font-size:11.5px;font-weight:700;${
                          order.tipo === 'CAPEX' ? 'background:#fae8ff;color:#86198f;' : 'background:#f1f5f9;color:#0f172a;'
                        }">${escapeHtml(order.tipo)}</span>
                        <div style="font-weight:700;margin-top:3px;">${formatCurrency(order.monto)}</div>
                      </td>
                      <td>${escapeHtml(order.descripcion)}</td>
                      <td>
                        <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;${stateBadgeStyle(order.estado)}">
                          ${escapeHtml(order.estado)}
                        </span>
                      </td>
                      <td>
                        <div class="ticket-action-buttons" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                          <button type="button" class="ticket-action-pill" data-detail="${escapeHtml(order.id)}" style="background:var(--primary-color, #26487F);border-color:var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer;">
                            Ver detalle
                          </button>
                          ${
                            canCloseReception
                              ? `
                            <button type="button" class="ticket-action-pill" data-order="${escapeHtml(order.id)}" data-event="CONFIRM_CONFORME" style="background:#059669;border-color:#059669;color:#ffffff;font-weight:600;padding:7px 12px;border-radius:6px;cursor:pointer;">
                              Recepción Conforme
                            </button>
                            <button type="button" class="ticket-action-pill" data-order="${escapeHtml(order.id)}" data-event="CONFIRM_DISCONFORME" style="background:#dc2626;border-color:#dc2626;color:#ffffff;font-weight:600;padding:7px 12px;border-radius:6px;cursor:pointer;">
                              Recepción Disconforme
                            </button>
                          `
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map(order => {
        const actions = Array.isArray(order.allowedActions) ? order.allowedActions : [];
        return `
          <article class="exact-card" data-order-id="${escapeHtml(order.id)}" style="padding:18px;border:1px solid #cbd5e1;border-radius:10px;background:#ffffff;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
              <div>
                <span style="font-weight:700;font-size:16px;color:#1e3a8a;">${escapeHtml(order.id)}</span>
                <span style="margin-left:8px;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:700;${
                  order.tipo === 'CAPEX'
                    ? 'background:#fae8ff;color:#86198f;'
                    : 'background:#f1f5f9;color:#0f172a;'
                }">${escapeHtml(order.tipo)}</span>
                <span style="margin-left:6px;font-weight:700;color:#0f172a;">${formatCurrency(order.monto)}</span>
                <span style="margin-left:6px;font-size:12px;color:#64748b;">(Acum. mes área ${escapeHtml(order.area)}: ${formatCurrency(order.acumuladoMesArea)})</span>
              </div>
              <span style="padding:4px 10px;border-radius:999px;font-size:12.5px;font-weight:700;${stateBadgeStyle(order.estado)}">
                ${escapeHtml(order.estado)}
              </span>
            </div>

            ${renderStepProgress(order.estado)}

            <div style="margin:8px 0;font-size:14px;color:#1e293b;">
              <strong>Artículos:</strong> ${escapeHtml(order.descripcion)}
            </div>
            <div style="font-size:12.5px;color:#475569;display:flex;flex-wrap:wrap;gap:14px;">
              <span><strong>Solicitante:</strong> ${escapeHtml(order.solicitante)} (${escapeHtml(order.area)})</span>
              <span><strong>Fecha:</strong> ${escapeHtml(order.fecha)} ${escapeHtml(order.hora || '')}</span>
              <span><strong>Adm.:</strong> ${escapeHtml(order.responsableAdm || 'Daniel Lara')}</span>
              ${order.aprobador ? `<span><strong>Aprobación:</strong> ${escapeHtml(order.aprobador)}</span>` : ''}
            </div>

            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px solid #f1f5f9;padding-top:10px;">
              <div class="ticket-action-buttons" style="display:flex;flex-wrap:wrap;gap:8px;">
                ${actions
                  .map(act => {
                    const meta = ACTION_META[act];
                    if (!meta) return '';
                    const btnStyle =
                      meta.badgeClass === 'danger'
                        ? 'background:#dc2626;color:#fff;border:none;'
                        : meta.badgeClass === 'conforme'
                        ? 'background:#059669;color:#fff;border:none;'
                        : meta.badgeClass === 'gold'
                        ? 'background:#C1B27E;color:#0f172a;border:none;font-weight:700;'
                        : 'background:#26487F;color:#fff;border:none;';
                    return `<button type="button" class="ticket-action-pill" data-order="${escapeHtml(order.id)}" data-event="${escapeHtml(act)}" style="padding:7px 13px;border-radius:6px;cursor:pointer;${btnStyle}">${escapeHtml(meta.label)}</button>`;
                  })
                  .join('')}
              </div>
              <button type="button" class="ticket-action-pill" data-detail="${escapeHtml(order.id)}" style="background:var(--primary-color, #26487F);border-color:var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer;">
                Ver detalle
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openTransitionModal(orderId, eventCode) {
    const order = items.find(x => x.id === orderId);
    const meta = ACTION_META[eventCode];
    if (!order || !meta) return;

    modalEl.innerHTML = `
      <form id="tc-transition-form">
        <h3 style="margin-top:0;color:#1e3a8a;">${escapeHtml(meta.confirmTitle)}</h3>
        <p style="color:#334155;font-size:14px;"><strong>Pedido:</strong> ${escapeHtml(order.id)} · ${escapeHtml(order.tipo)} · ${formatCurrency(order.monto)}</p>
        <p style="color:#475569;font-size:13.5px;">${escapeHtml(meta.description)}</p>

        <div style="margin:12px 0;">
          <label for="tc-modal-comment" style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">
            ${meta.requireComment ? 'MOTIVO / OBSERVACIONES (OBLIGATORIO) *' : 'COMENTARIO / NOTA DE SEGUIMIENTO (OPCIONAL)'}
          </label>
          <textarea id="tc-modal-comment" name="comment" rows="3" ${meta.requireComment ? 'required minlength="5"' : ''} style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" placeholder="${meta.requireComment ? 'Escribe el motivo detallado (mínimo 5 caracteres)…' : 'Observación opcional para la bitácora y notificación por correo…'}"></textarea>
        </div>

        <div id="tc-modal-error" role="alert" style="color:#991b1b;font-size:13px;margin-bottom:8px;" hidden></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
          <button type="button" id="tc-modal-cancel" style="padding:8px 14px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;">Cancelar</button>
          <button type="submit" id="tc-modal-submit" style="padding:8px 16px;border-radius:6px;border:none;background:#1e3a8a;color:#fff;font-weight:600;cursor:pointer;">Confirmar y Notificar</button>
        </div>
      </form>
    `;

    modalEl.querySelector('#tc-modal-cancel')?.addEventListener('click', () => modalEl.close());
    const form = modalEl.querySelector('#tc-transition-form');
    const submitBtn = modalEl.querySelector('#tc-modal-submit');
    const errEl = modalEl.querySelector('#tc-modal-error');

    form?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const commentVal = modalEl.querySelector('#tc-modal-comment').value.trim();
      if (meta.requireComment && commentVal.length < 5) {
        errEl.hidden = false;
        errEl.textContent = 'Debes ingresar un motivo de al menos 5 caracteres.';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando…';
      errEl.hidden = true;
      try {
        const res = await transitionTusCompra(
          { id: order.id, event: eventCode, comment: commentVal },
          listData.csrfToken || ctx.csrfToken,
          signal
        );
        const idx = items.findIndex(x => x.id === order.id);
        if (idx !== -1 && res?.order) {
          items[idx] = res.order;
        }
        modalEl.close();
        noticeEl.hidden = false;
        noticeEl.textContent = `Pedido ${order.id} actualizado a «${res.order.estado}» y notificaciones enviadas por correo.`;
        renderCards();
      } catch (err) {
        errEl.hidden = false;
        errEl.textContent = err?.message || 'No se pudo aplicar el cambio de estado.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar y Notificar';
      }
    });

    if (typeof modalEl.showModal === 'function') modalEl.showModal();
    else modalEl.setAttribute('open', 'open');
  }

  function openDetailModal(orderId) {
    const order = items.find(x => x.id === orderId);
    if (!order) return;
    const history = Array.isArray(order.history) ? order.history : [];

    modalEl.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;color:#1e3a8a;">Detalle y Trazabilidad · ${escapeHtml(order.id)}</h3>
          <button type="button" id="tc-detail-close" style="padding:4px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;">Cerrar</button>
        </div>
        ${renderStepProgress(order.estado)}
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:12px 0;">
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Estado Actual</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.estado)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Solicitante / Área</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.solicitante)} (${escapeHtml(order.correo)}) · ${escapeHtml(order.area)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Tipo y Monto</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.tipo)} · ${formatCurrency(order.monto)} (Acumulado área: ${formatCurrency(order.acumuladoMesArea)})</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Artículos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.descripcion)}</td></tr>
          ${order.justificacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Justificación</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.justificacion)}</td></tr>` : ''}
          ${order.aprobador ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Aprobador</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.aprobador)} ${order.fechaAprobacion ? `(${escapeHtml(order.fechaAprobacion)})` : ''}</td></tr>` : ''}
          ${order.comentarioAprobacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Nota Aprobación</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.comentarioAprobacion)}</td></tr>` : ''}
          ${order.evaluacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Evaluación Recepción</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.evaluacion)} ${order.comentarioRecepcion ? `— ${escapeHtml(order.comentarioRecepcion)}` : ''}</td></tr>` : ''}
          ${order.adjuntos ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Adjuntos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;"><a href="${escapeHtml(order.adjuntos)}" target="_blank" rel="noopener noreferrer">Ver archivo adjunto</a></td></tr>` : ''}
        </table>

        <h4 style="margin:14px 0 8px;color:#0f172a;">Bitácora de Trazabilidad</h4>
        ${
          history.length
            ? `<div style="max-height:220px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:8px;">
                ${history
                  .map(
                    h => `
                  <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;">
                    <div><strong>${escapeHtml(h.fechaHora)}</strong> · ${escapeHtml(h.actorNombre)} (${escapeHtml(h.rol)})</div>
                    <div>Cambio: <em>${escapeHtml(h.estadoAnterior)}</em> → <strong>${escapeHtml(h.estadoNuevo)}</strong> · Correo: ${escapeHtml(h.notificacion)}</div>
                    ${h.comentario ? `<div style="color:#475569;">Nota: ${escapeHtml(h.comentario)}</div>` : ''}
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : '<p style="font-size:13px;color:#64748b;">Sin eventos registrados en bitácora.</p>'
        }
      </div>
    `;

    modalEl.querySelector('#tc-detail-close')?.addEventListener('click', () => modalEl.close());
    if (typeof modalEl.showModal === 'function') modalEl.showModal();
    else modalEl.setAttribute('open', 'open');
  }

  container.querySelector('#tc-state-filters')?.addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-filter]');
    if (!btn) return;
    stateFilter = btn.dataset.filter;
    renderCards();
  });

  searchEl?.addEventListener('input', () => {
    searchQuery = searchEl.value || '';
    renderCards();
  });

  listEl?.addEventListener('click', ev => {
    const actBtn = ev.target.closest('button[data-event]');
    if (actBtn) {
      openTransitionModal(actBtn.dataset.order, actBtn.dataset.event);
      return;
    }
    const detailBtn = ev.target.closest('button[data-detail]');
    if (detailBtn) {
      openDetailModal(detailBtn.dataset.detail);
    }
  });

  renderCards();
}

export const renderTusComprasWidget = render;
