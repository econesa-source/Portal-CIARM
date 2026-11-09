/**
 * Módulo "Tus compras" - Sistema simplificado de pedidos de compra (Opex / Capex)
 * Simplificado en 2 pasos (sin monto límite mensual por área):
 * - Compras < $8,000.00 MXN: pasan directo a generación de Orden de Compra (ISSUE_PURCHASE_ORDER), sin requerir cotización previa (informando fecha de OC, entrega estimada y monto válido).
 * - Compras >= $8,000.00 MXN: pasan por aprobación (2b) En aprobación) y, al registrar la recepción de cotizaciones (RECEIVE_QUOTES), exigen 3 cotizaciones obligatorias (Cotización #1, #2 y #3, <= 10 MB c/u).
 */

import {
  TUS_COMPRAS_STATES,
  TUS_COMPRAS_OPEX_LIMIT,
  TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
  TUS_COMPRAS_QUOTE_THRESHOLD,
  TUS_COMPRAS_MAX_ATTACHMENT_BYTES,
  getEffectiveOrderAmount,
  getRequiredQuotesCount,
  evaluateOrderApprovalRequirement,
  resolveEffectiveOrderState,
  normalizeOrdersStates,
  formatDurationHours,
  computeTusComprasExecutiveMetrics,
  getTusComprasContext,
  listTusCompras,
  createTusCompra,
  transitionTusCompra,
  validateTusCompraAttachmentFile,
  uploadTusCompraAttachment
} from '../services/tusComprasService.js?v=18.7.16-tc11';

const ACTION_META = Object.freeze({
  RECEIVE_OPEX: {
    label: 'Recibir y poner En Proceso (2a)',
    badgeClass: 'dark',
    confirmTitle: 'Pasar a 2a) Solicitud recibida / En proceso',
    description: 'Confirma que el pedido Opex ha sido recibido en Administración y pasa a proceso de compra.',
    requireComment: false
  },
  START_QUOTING: {
    label: '2a-1) Informar En Cotización (≥ $8,000)',
    badgeClass: 'dark',
    confirmTitle: '2a-1) Informar que está cotizando (≥ $8,000.00 MXN · 3 cotizaciones)',
    description: 'Para compras mayores o iguales a $8,000.00 MXN, informa al solicitante que iniciaste el proceso de cotización (3 cotizaciones obligatorias) y define la fecha estimada de cierre de cotizaciones.',
    requireComment: false,
    requireQuoteCloseDate: true
  },
  RECEIVE_QUOTES: {
    label: '2a-2) Informar Recepción de 3 Cotizaciones',
    badgeClass: 'dark',
    confirmTitle: '2a-2) Informar Recepción y Adjuntar 3 Cotizaciones',
    description: 'Informa la recepción de las 3 cotizaciones y adjunta los 3 archivos obligatorios (Cotización #1, Cotización #2 y Cotización #3, máx. 10 MB c/u) antes de gestionar la Orden de Compra.',
    requireComment: false,
    requireQuoteAttachment: true
  },
  ISSUE_PURCHASE_ORDER: {
    label: '2c) Generar Orden de Compra',
    badgeClass: 'dark',
    confirmTitle: '2c) Generar Orden de Compra y Ajustar Monto Válido',
    description: 'Informa la fecha en que generaste la Orden de Compra, define la fecha estimada de entrega y ajusta el monto estimado por el usuario (este será el monto único válido del pedido).',
    requireComment: false,
    requirePurchaseOrderFields: true
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
  if (
    state === TUS_COMPRAS_STATES.OC_GENERADA ||
    state === TUS_COMPRAS_STATES.APROBADA ||
    state === TUS_COMPRAS_STATES.EN_PROCESO ||
    state === TUS_COMPRAS_STATES.EN_COTIZACION ||
    state === TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS ||
    state === TUS_COMPRAS_STATES.RECIBIDOS_ADM
  ) {
    return 'background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;';
  }
  return 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
}

function renderAttachmentsLinks(order) {
  if (!order) return '';
  const links = [];
  if (order.adjuntoDetalle) {
    links.push(`<a href="${escapeHtml(order.adjuntoDetalle)}" target="_blank" rel="noopener noreferrer" style="color:#1e3a8a;font-weight:600;text-decoration:underline;">📄 Detalle del pedido (Solicitante)</a>`);
  }
  if (order.adjuntoCotizacionPreliminar) {
    links.push(`<a href="${escapeHtml(order.adjuntoCotizacionPreliminar)}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:600;text-decoration:underline;">💵 Cotización preliminar (Solicitante)</a>`);
  }
  if (order.adjuntoCotizacionesAdm) {
    String(order.adjuntoCotizacionesAdm)
      .split('|')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach((url, idx) => {
        links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#047857;font-weight:700;text-decoration:underline;">📑 Cotización oficial Adm.${idx > 0 ? ` #${idx + 1}` : ''} (Daniel Lara)</a>`);
      });
  }
  if (!links.length && order.adjuntos && /^https?:\/\//i.test(String(order.adjuntos).trim())) {
    links.push(`<a href="${escapeHtml(order.adjuntos)}" target="_blank" rel="noopener noreferrer" style="color:#1e3a8a;font-weight:600;text-decoration:underline;">📎 Ver archivo adjunto</a>`);
  }
  return links.join(' · ');
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

  let step2Label = '2) En proceso / Cotización / OC';
  if (s === TUS_COMPRAS_STATES.EN_PROCESO) step2Label = '2a) Recibida / En proceso';
  else if (s === TUS_COMPRAS_STATES.EN_COTIZACION) step2Label = '2a-1) En cotización';
  else if (s === TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS) step2Label = '2a-2) Cotizaciones recibidas';
  else if (s === TUS_COMPRAS_STATES.EN_APROBACION) step2Label = '2b) En aprobación';
  else if (s === TUS_COMPRAS_STATES.OC_GENERADA) step2Label = '2c) Orden de Compra generada';
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
  const canGerencial = Boolean(access.canGerencial);
  const isAdministracion = Boolean(access.isAdministracion || (access.isDocenteDirector !== true && (access.canAdmin || access.canApprove)));

  if (route === '#tus-compras-nuevo') {
    if (!canCreate) {
      container.innerHTML = '<p role="alert">Tu perfil no tiene habilitado el registro de pedidos de compra.</p>';
      return;
    }
    renderCreateView(container, ctx, controller);
    return;
  }

  if (route === '#vision-gerencial-compras') {
    if (!canGerencial) {
      container.innerHTML = `
        <div class="card-container-wide">
          <div class="solicitud-topbar">
            <a href="#admin-tus-compras" class="card-top-nav-link">← Volver a Gestión y Aprobaciones</a>
          </div>
          <p role="alert" style="color:#991b1b;font-weight:600;">La Vista Gerencial de Tus compras está reservada para perfiles de Administración con rol directivo/autorizador.</p>
        </div>
      `;
      return;
    }
    await renderExecutiveDashboardView(container, ctx, controller);
    return;
  }

  const isAdminView = route === '#admin-tus-compras' && isAdministracion;
  await renderListView(container, ctx, isAdminView ? 'all' : 'mine', controller);
}

function renderTopNavigation(activeRoute, access) {
  const canCreate = Boolean(access?.canCreate);
  // El menú de Gestión y Aprobaciones solo corresponde a usuarios con perfil "administración" en área (AG) y nivel (AJ)
  const showAdminMenu = Boolean(access?.isAdministracion === true);
  // Vista Gerencial: todos los usuarios con área y nivel "administración" (incluyendo a Daniel Lara)
  const showGerencialMenu = Boolean(access?.canGerencial === true);
  return `
    <div class="solicitud-topbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${canCreate ? `<a href="#tus-compras-nuevo" class="solicitud-secondary-link" style="${activeRoute === '#tus-compras-nuevo' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">+ Crear Pedido</a>` : ''}
        <a href="#tus-compras" class="solicitud-secondary-link" style="${activeRoute === '#tus-compras' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">Mis Compras</a>
        ${showAdminMenu ? `<a href="#admin-tus-compras" class="solicitud-secondary-link" style="${activeRoute === '#admin-tus-compras' ? 'background:#26487F;color:#fff;border-color:#26487F;' : ''}">Gestión y Aprobaciones</a>` : ''}
        ${showGerencialMenu ? `<a href="#vision-gerencial-compras" class="solicitud-secondary-link" style="${activeRoute === '#vision-gerencial-compras' ? 'background:#26487F;color:#fff;border-color:#26487F;font-weight:700;' : 'border-color:#26487F;color:#26487F;font-weight:700;'}">📊 Vista Gerencial</a>` : ''}
      </div>
    </div>
  `;
}

function renderCreateView(container, ctx, controller) {
  const access = ctx.access || {};
  const currentOpex = Number(ctx.areaMonthlyOpex || 0);
  const opexLimit = Number(ctx.opexLimit || TUS_COMPRAS_OPEX_LIMIT);

  container.innerHTML = `
    <div class="card-container-wide solicitud-card">
      ${renderTopNavigation('#tus-compras-nuevo', access)}

      <div class="solicitud-heading">
        <h2>Nuevo Pedido de Compra · Tus compras</h2>
        <p>Registra tu solicitud de compra para Administración (Daniel Lara). <strong>No hay monto límite mensual por área.</strong> Compras inferiores a $8,000.00 MXN pasan directo a generación de Orden de Compra sin cotización previa; y <strong>compras mayores o iguales a $8,000.00 MXN pasan por aprobación (2b) y requieren 3 cotizaciones obligatorias de parte de Daniel Lara</strong>.</p>
      </div>

      <div id="tus-compras-budget-banner" style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #26487F;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:14px;">
        <div><strong>Área solicitante (DM03):</strong> ${escapeHtml(access.area || 'Docente')} · <strong>Acumulado Opex del mes (${escapeHtml(ctx.yearMonth || '')}):</strong> ${formatCurrency(currentOpex)} <span style="color:#047857;font-weight:700;">(Sin monto límite mensual por área)</span></div>
        <div style="margin-top:4px;color:#334155;font-size:13px;">Reglas en 2 pasos: <strong>&lt; $8,000.00 MXN</strong> Pasa directo a generación de Orden de Compra (sin cotización previa) · <strong>≥ $8,000.00 MXN</strong> Pasa por aprobación (2b) y requiere <strong>3 cotizaciones obligatorias</strong> de parte de Daniel Lara antes de emitir la Orden de Compra.</div>
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
              <option value="OPEX" selected>1) OPEX — Gasto operativo (sin monto límite por área)</option>
              <option value="CAPEX">2) CAPEX — Inversión / Activo fijo (requiere aprobación ejecutiva)</option>
            </select>
          </div>
          <div class="solicitud-field">
            <label for="tc-monto">MONTO TOTAL ESTIMADO (MXN) *</label>
            <input type="number" id="tc-monto" name="monto" min="1" max="10000000" step="0.01" required placeholder="Ej. 2500.00" />
          </div>
        </div>

        <div id="tc-route-preview" role="status" style="padding:10px 14px;border-radius:6px;background:#e0f2fe;color:#075985;font-size:13.5px;font-weight:600;margin-bottom:12px;">
          Ingresa el monto estimado para verificar la ruta (&lt; $8,000.00 MXN pasa directo a Orden de Compra · ≥ $8,000.00 MXN pasa por aprobación 2b y exige 3 cotizaciones de Daniel Lara).
        </div>

        <div class="solicitud-field solicitud-description">
          <label for="tc-descripcion">ARTÍCULOS SOLICITADOS Y CANTIDADES *</label>
          <textarea id="tc-descripcion" name="descripcion" rows="3" required placeholder="Detalla los artículos, cantidades y especificaciones requeridas..."></textarea>
        </div>

        <div class="solicitud-field">
          <label for="tc-justificacion">JUSTIFICACIÓN / PROVEEDOR O ENLACE DE REFERENCIA</label>
          <input type="text" id="tc-justificacion" name="justificacion" placeholder="Motivo pedagógico/operativo, proveedor sugerido o link de referencia..." />
        </div>

        <div class="solicitud-identity">
          <div class="solicitud-field solicitud-files">
            <label for="tc-adjunto-detalle">1) ARCHIVO DE DETALLE DEL PEDIDO (OPCIONAL · MÁX. 10 MB)</label>
            <input type="file" id="tc-adjunto-detalle" accept="image/*,.pdf" />
            <small style="display:block;margin-top:4px;color:#64748b;font-size:12px;">Especificaciones, listado o imagen de referencia de los artículos (PDF o imagen · Tamaño máximo: 10 MB · No obligatorio).</small>
          </div>
          <div class="solicitud-field solicitud-files">
            <label for="tc-adjunto-cotizacion">2) COTIZACIÓN PRELIMINAR DE REFERENCIA (OPCIONAL · MÁX. 10 MB)</label>
            <input type="file" id="tc-adjunto-cotizacion" accept="image/*,.pdf" />
            <small style="display:block;margin-top:4px;color:#64748b;font-size:12px;">Si cuentas con una cotización preliminar de referencia puedes adjuntarla aquí (PDF o imagen · Tamaño máximo: 10 MB · No obligatorio).</small>
          </div>
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
  const fileDetalleInput = container.querySelector('#tc-adjunto-detalle');
  const fileCotPrelimInput = container.querySelector('#tc-adjunto-cotizacion');
  const statusBox = container.querySelector('#tc-form-status');

  const checkFileOnSelect = (inputEl, labelText) => {
    inputEl?.addEventListener('change', () => {
      const f = inputEl.files?.[0];
      if (!f) return;
      try {
        validateTusCompraAttachmentFile(f, labelText);
        if (statusBox.classList.contains('is-error')) {
          statusBox.className = 'solicitud-status';
          statusBox.textContent = '';
        }
      } catch (err) {
        inputEl.value = '';
        statusBox.className = 'solicitud-status is-visible is-error';
        statusBox.textContent = err.message;
      }
    });
  };
  checkFileOnSelect(fileDetalleInput, 'archivo de Detalle del pedido');
  checkFileOnSelect(fileCotPrelimInput, 'archivo de Cotización preliminar de referencia');

  function updatePreview() {
    const montoVal = Number(inputMonto.value || 0);
    const evalRes = evaluateOrderApprovalRequirement(selectTipo.value, montoVal, currentOpex, opexLimit);
    if (montoVal <= 0) {
      preview.style.background = '#e0f2fe';
      preview.style.color = '#075985';
      preview.textContent = 'Ingresa el monto estimado para calcular la ruta de atención.';
      return;
    }
    const quoteNotice = evalRes.requiresThreeQuotes
      ? `Por ser mayor o igual a ${formatCurrency(TUS_COMPRAS_THREE_QUOTES_THRESHOLD)}, Daniel Lara deberá cotizar, adjuntar obligatoriamente las 3 cotizaciones recibidas (Cotización #1, #2 y #3) y posteriormente emitir la Orden de Compra.`
      : `Por ser inferior a ${formatCurrency(TUS_COMPRAS_THREE_QUOTES_THRESHOLD)}, pasa directo a generación de Orden de Compra (sin requerir cotización previa), donde Daniel Lara informará la fecha de generación de la OC, fecha estimada de entrega y monto definitivo.`;

    if (evalRes.requiresApproval) {
      preview.style.background = '#fef3c7';
      preview.style.color = '#92400e';
      const reason = evalRes.tipo === 'CAPEX'
        ? 'por ser compra tipo CAPEX'
        : `por ser mayor o igual a ${formatCurrency(opexLimit)}`;
      preview.textContent = `Ruta automática: Al enviar el ticket pasará automáticamente al estado «2b) En aprobación» (${reason}). Una vez aprobado, pasará a gestión de Daniel Lara. ${quoteNotice}`;
    } else {
      preview.style.background = '#dcfce7';
      preview.style.color = '#166534';
      preview.textContent = `Ruta Opex directa (sin monto límite mensual por área): Se registrará en «1) Solicitud enviada». ${quoteNotice}`;
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
      let adjuntoDetalleUrl = '';
      let adjuntoCotPrelimUrl = '';
      const fileDetalle = fileDetalleInput?.files?.[0];
      const fileCotPrelim = fileCotPrelimInput?.files?.[0];
      if (fileDetalle) {
        validateTusCompraAttachmentFile(fileDetalle, 'archivo de Detalle del pedido');
      }
      if (fileCotPrelim) {
        validateTusCompraAttachmentFile(fileCotPrelim, 'archivo de Cotización preliminar de referencia');
      }
      if (fileDetalle) {
        statusBox.textContent = `Subiendo Detalle del pedido («${fileDetalle.name}») a Google Drive…`;
        const upDet = await uploadTusCompraAttachment(
          fileDetalle,
          ctx.csrfToken,
          controller.signal,
          'archivo de Detalle del pedido'
        );
        adjuntoDetalleUrl = upDet.url || '';
        if (!adjuntoDetalleUrl) {
          throw new Error(`No se logró verificar la carga del archivo «${fileDetalle.name}». Por favor intenta nuevamente.`);
        }
      }
      if (fileCotPrelim) {
        statusBox.textContent = `Subiendo Cotización preliminar de referencia («${fileCotPrelim.name}») a Google Drive…`;
        const upCot = await uploadTusCompraAttachment(
          fileCotPrelim,
          ctx.csrfToken,
          controller.signal,
          'archivo de Cotización preliminar de referencia'
        );
        adjuntoCotPrelimUrl = upCot.url || '';
        if (!adjuntoCotPrelimUrl) {
          throw new Error(`No se logró verificar la carga del archivo «${fileCotPrelim.name}». Por favor intenta nuevamente.`);
        }
      }
      statusBox.textContent = 'Guardando pedido y notificando a Administración…';
      const result = await createTusCompra(
        {
          tipo: selectTipo.value,
          monto: Number(inputMonto.value),
          descripcion: container.querySelector('#tc-descripcion').value.trim(),
          justificacion: container.querySelector('#tc-justificacion').value.trim(),
          adjuntoDetalle: adjuntoDetalleUrl,
          adjuntoCotizacionPreliminar: adjuntoCotPrelimUrl
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
        <h1>${kind === 'all' ? 'Gestión y Aprobaciones · Tus compras' : 'Mis Compras y Validación de Recepción'}</h1>
        <p>${
          kind === 'all'
            ? 'Administra el ciclo de pedidos Opex y Capex (sin monto límite mensual por área). Compras < $8,000 MXN pasan directo a generación de Orden de Compra sin cotización previa (informando siempre fecha de OC, entrega estimada y monto válido); compras ≥ $8,000 MXN pasan por aprobación (2b) y exigen 3 cotizaciones obligatorias de parte de Daniel Lara.'
            : 'Consulta el estado informativo de tus tickets de compra, fechas estimadas de cotización/entrega y Orden de Compra. Cuando tu compra sea entregada podrás cerrar el ticket clasificándolo como Recepción Conforme o Recepción Disconforme.'
        }</p>
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
                  const hasOC = Number(order.montoOrdenCompra) > 0;
                  const montoEst = Number(order.montoEstimado ?? order.monto) || 0;
                  const datesSummary = [
                    order.fechaCierreCotizacion ? `Cierre cotiz. est.: ${order.fechaCierreCotizacion}` : '',
                    order.fechaOrdenCompra ? `Fecha OC: ${order.fechaOrdenCompra}` : '',
                    order.fechaEntregaEstimada ? `Entrega est.: ${order.fechaEntregaEstimada}` : ''
                  ].filter(Boolean).join(' · ');
                  return `
                    <tr data-order-id="${escapeHtml(order.id)}">
                      <td><strong>${escapeHtml(order.id)}</strong></td>
                      <td>${escapeHtml(order.fecha || '—')}</td>
                      <td>
                        <span style="padding:2px 7px;border-radius:4px;font-size:11.5px;font-weight:700;${
                          order.tipo === 'CAPEX' ? 'background:#fae8ff;color:#86198f;' : 'background:#f1f5f9;color:#0f172a;'
                        }">${escapeHtml(order.tipo)}</span>
                        <div style="font-weight:700;margin-top:3px;">${formatCurrency(getEffectiveOrderAmount(order))}</div>
                        ${
                          hasOC
                            ? `<div style="font-size:11px;color:#047857;font-weight:600;">Monto OC válido (Est.: ${formatCurrency(montoEst)})</div>`
                            : `<div style="font-size:11px;color:#64748b;">Monto estimado inicial</div>`
                        }
                      </td>
                      <td>
                        <div>${escapeHtml(order.descripcion)}</div>
                        ${datesSummary ? `<div style="margin-top:4px;font-size:11.5px;color:#1e3a8a;font-weight:600;">📅 ${escapeHtml(datesSummary)}</div>` : ''}
                      </td>
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
        const montoEst = Number(order.montoEstimado ?? order.monto) || 0;
        const montoOC = Number(order.montoOrdenCompra) || 0;
        const reqQuotesCount = getRequiredQuotesCount(order);
        const attachHtml = renderAttachmentsLinks(order);
        const quoteBadgeLabel = reqQuotesCount === 3
          ? '≥ $8,000 · 3 Cotizaciones Obligatorias'
          : '< $8,000 · OC Directa';
        const quoteBadgeStyle = reqQuotesCount === 3
          ? 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'
          : 'background:#dcfce7;color:#166534;';
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
                <span style="margin-left:6px;padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;${quoteBadgeStyle}">${quoteBadgeLabel}</span>
                <span style="margin-left:6px;font-weight:700;color:#0f172a;">${formatCurrency(getEffectiveOrderAmount(order))}</span>
                ${
                  montoOC > 0
                    ? `<span style="margin-left:6px;font-size:12px;color:#047857;font-weight:700;">(Monto OC válido · Est. inicial: ${formatCurrency(montoEst)})</span>`
                    : `<span style="margin-left:6px;font-size:12px;color:#64748b;">(Monto estimado inicial)</span>`
                }
                <span style="margin-left:6px;font-size:12px;color:#64748b;">· Acum. mes área ${escapeHtml(order.area)}: ${formatCurrency(order.acumuladoMesArea)} (Sin límite por área)</span>
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
              ${order.fechaCierreCotizacion ? `<span><strong>Cierre Cotiz. Est.:</strong> ${escapeHtml(order.fechaCierreCotizacion)}</span>` : ''}
              ${order.fechaOrdenCompra ? `<span><strong>Fecha OC:</strong> ${escapeHtml(order.fechaOrdenCompra)}</span>` : ''}
              ${order.fechaEntregaEstimada ? `<span><strong>Entrega Est.:</strong> ${escapeHtml(order.fechaEntregaEstimada)}</span>` : ''}
            </div>
            ${attachHtml ? `<div style="margin-top:8px;font-size:12.5px;"><strong>Adjuntos:</strong> ${attachHtml}</div>` : ''}

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

    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultPoAmount = Number(order.montoOrdenCompra || order.montoEstimado || order.monto || 0).toFixed(2);
    const requiredQuotes = getRequiredQuotesCount(order);

    modalEl.innerHTML = `
      <form id="tc-transition-form">
        <h3 style="margin-top:0;color:#1e3a8a;">${escapeHtml(meta.confirmTitle)}</h3>
        <p style="color:#334155;font-size:14px;"><strong>Pedido:</strong> ${escapeHtml(order.id)} · ${escapeHtml(order.tipo)} · ${formatCurrency(order.monto)} ${order.montoEstimado ? `<span style="color:#64748b;font-size:12.5px;">(Estimado inicial: ${formatCurrency(order.montoEstimado)})</span>` : ''}</p>
        <p style="color:#475569;font-size:13.5px;">${escapeHtml(meta.description)}</p>

        ${
          meta.requireQuoteCloseDate
            ? `
          <div style="margin:12px 0;">
            <label for="tc-modal-quote-close-date" style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">
              FECHA ESTIMADA DE CIERRE DE COTIZACIONES (OBLIGATORIA) *
            </label>
            <input id="tc-modal-quote-close-date" name="fechaCierreCotizacion" type="date" required value="${escapeHtml(order.fechaCierreCotizacion || todayIso)}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" />
          </div>
        `
            : ''
        }

        ${
          meta.requireQuoteAttachment
            ? `
          <div style="margin:12px 0;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;">
            <div style="font-weight:700;font-size:13.5px;color:#991b1b;margin-bottom:6px;">
              📑 COMPRA MAYOR O IGUAL A $8,000.00 MXN: ES OBLIGATORIO ADJUNTAR 3 COTIZACIONES
            </div>
            <p style="margin:0 0 10px;font-size:12.5px;color:#7f1d1d;">
              Toda compra mayor o igual a $8,000.00 MXN debe contar con las 3 cotizaciones adjuntas por parte de Daniel Lara (PDF o imagen · máximo 10 MB por archivo) antes de avanzar a 2a-2) Cotizaciones recibidas.
            </p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div>
                <label for="tc-modal-quote-file-1" style="display:block;font-weight:700;font-size:12.5px;margin-bottom:3px;color:#0f172a;">
                  1) COTIZACIÓN #1 (OBLIGATORIA · PDF o Imagen · MÁX. 10 MB) *
                </label>
                <input id="tc-modal-quote-file-1" class="tc-modal-quote-file-input" data-quote-idx="1" name="quoteFile1" type="file" accept="image/*,.pdf" required style="width:100%;font-size:13px;" />
              </div>
              <div>
                <label for="tc-modal-quote-file-2" style="display:block;font-weight:700;font-size:12.5px;margin-bottom:3px;color:#0f172a;">
                  2) COTIZACIÓN #2 (OBLIGATORIA · PDF o Imagen · MÁX. 10 MB) *
                </label>
                <input id="tc-modal-quote-file-2" class="tc-modal-quote-file-input" data-quote-idx="2" name="quoteFile2" type="file" accept="image/*,.pdf" required style="width:100%;font-size:13px;" />
              </div>
              <div>
                <label for="tc-modal-quote-file-3" style="display:block;font-weight:700;font-size:12.5px;margin-bottom:3px;color:#0f172a;">
                  3) COTIZACIÓN #3 (OBLIGATORIA · PDF o Imagen · MÁX. 10 MB) *
                </label>
                <input id="tc-modal-quote-file-3" class="tc-modal-quote-file-input" data-quote-idx="3" name="quoteFile3" type="file" accept="image/*,.pdf" required style="width:100%;font-size:13px;" />
              </div>
            </div>
          </div>
              `
            : ''
        }

        ${
          meta.requirePurchaseOrderFields
            ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;">
            <div>
              <label for="tc-modal-po-date" style="display:block;font-weight:600;font-size:12.5px;margin-bottom:4px;">
                FECHA EN QUE GENERÓ LA ORDEN DE COMPRA *
              </label>
              <input id="tc-modal-po-date" name="fechaOrdenCompra" type="date" required value="${escapeHtml(order.fechaOrdenCompra || todayIso)}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" />
            </div>
            <div>
              <label for="tc-modal-delivery-date" style="display:block;font-weight:600;font-size:12.5px;margin-bottom:4px;">
                FECHA ESTIMADA DE ENTREGA *
              </label>
              <input id="tc-modal-delivery-date" name="fechaEntregaEstimada" type="date" required value="${escapeHtml(order.fechaEntregaEstimada || '')}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" />
            </div>
          </div>
          <div style="margin:12px 0;padding:10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;">
            <label for="tc-modal-po-amount" style="display:block;font-weight:700;font-size:13px;margin-bottom:4px;color:#0c4a6e;">
              MONTO REAL AJUSTADO DE LA ORDEN DE COMPRA (MXN) *
            </label>
            <input id="tc-modal-po-amount" name="montoOrdenCompra" type="number" min="1" max="10000000" step="0.01" required value="${escapeHtml(defaultPoAmount)}" style="width:100%;padding:8px;border:1px solid #7dd3fc;border-radius:6px;font-weight:700;" />
            <small style="color:#0369a1;display:block;margin-top:4px;">Monto estimado informado por el usuario: <strong>${formatCurrency(order.montoEstimado || order.monto)}</strong>. El monto ajustado aquí será el <strong>monto único válido</strong> del pedido (sin límite mensual por área).</small>
          </div>
        `
            : ''
        }

        <div style="margin:12px 0;">
          <label for="tc-modal-comment" style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">
            ${meta.requireComment ? 'MOTIVO / OBSERVACIONES (OBLIGATORIO) *' : 'COMENTARIO / NOTA DE SEGUIMIENTO (OPCIONAL)'}
          </label>
          <textarea id="tc-modal-comment" name="comment" rows="3" ${meta.requireComment ? 'required minlength="5"' : ''} style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" placeholder="${meta.requireComment ? 'Escribe el motivo detallado (mínimo 5 caracteres)…' : 'Observación opcional para la bitácora y notificación por correo…'}"></textarea>
        </div>

        <div id="tc-modal-error" role="alert" style="color:#991b1b;font-size:13px;margin-bottom:8px;" hidden></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
          <button type="button" id="tc-modal-cancel" class="ticket-action-pill" style="background:var(--primary-color, #26487F);border:1px solid var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;">Cerrar</button>
          <button type="submit" id="tc-modal-submit" class="ticket-action-pill" style="background:var(--primary-color, #26487F);border:1px solid var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:8px 16px;border-radius:6px;cursor:pointer;">Confirmar y Notificar</button>
        </div>
      </form>
    `;

    modalEl.querySelector('#tc-modal-cancel')?.addEventListener('click', () => modalEl.close());
    const form = modalEl.querySelector('#tc-transition-form');
    const submitBtn = modalEl.querySelector('#tc-modal-submit');
    const errEl = modalEl.querySelector('#tc-modal-error');
    const quoteFileInputs = [...modalEl.querySelectorAll('.tc-modal-quote-file-input')];

    quoteFileInputs.forEach(inputEl => {
      inputEl.addEventListener('change', () => {
        const f = inputEl.files?.[0];
        if (!f) return;
        const idxLabel = inputEl.dataset.quoteIdx ? `Cotización #${inputEl.dataset.quoteIdx}` : 'archivo de Cotizaciones recibidas';
        try {
          validateTusCompraAttachmentFile(f, idxLabel);
          errEl.hidden = true;
        } catch (err) {
          inputEl.value = '';
          errEl.hidden = false;
          errEl.textContent = err.message;
        }
      });
    });

    form?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const commentVal = modalEl.querySelector('#tc-modal-comment').value.trim();
      if (meta.requireComment && commentVal.length < 5) {
        errEl.hidden = false;
        errEl.textContent = 'Debes ingresar un motivo de al menos 5 caracteres.';
        return;
      }

      const payload = { id: order.id, event: eventCode, comment: commentVal };

      if (meta.requireQuoteCloseDate) {
        const quoteCloseDate = modalEl.querySelector('#tc-modal-quote-close-date')?.value?.trim() || '';
        if (!quoteCloseDate) {
          errEl.hidden = false;
          errEl.textContent = 'Debes definir la fecha estimada de cierre de cotizaciones.';
          return;
        }
        payload.fechaCierreCotizacion = quoteCloseDate;
      }

      if (meta.requirePurchaseOrderFields) {
        const poDate = modalEl.querySelector('#tc-modal-po-date')?.value?.trim() || '';
        const deliveryDate = modalEl.querySelector('#tc-modal-delivery-date')?.value?.trim() || '';
        const poAmountRaw = Number(modalEl.querySelector('#tc-modal-po-amount')?.value || 0);
        if (!poDate) {
          errEl.hidden = false;
          errEl.textContent = 'Debes informar la fecha en que generaste la Orden de Compra.';
          return;
        }
        if (!deliveryDate) {
          errEl.hidden = false;
          errEl.textContent = 'Debes definir la fecha estimada de entrega.';
          return;
        }
        if (!Number.isFinite(poAmountRaw) || poAmountRaw <= 0) {
          errEl.hidden = false;
          errEl.textContent = 'Debes ingresar un monto válido de Orden de Compra mayor a $0.00 MXN.';
          return;
        }
        payload.fechaOrdenCompra = poDate;
        payload.fechaEntregaEstimada = deliveryDate;
        payload.montoOrdenCompra = poAmountRaw;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando…';
      errEl.hidden = true;
      try {
        if (meta.requireQuoteAttachment) {
          const neededCount = 3;
          const filesToUpload = [];
          for (let i = 1; i <= neededCount; i++) {
            const fileEl = modalEl.querySelector(`#tc-modal-quote-file-${i}`);
            const f = fileEl?.files?.[0];
            if (!f) {
              throw new Error(
                `Falta adjuntar la Cotización #${i}. Toda compra mayor o igual a $8,000.00 MXN debe contar con las 3 cotizaciones adjuntas.`
              );
            }
            validateTusCompraAttachmentFile(f, `Cotización #${i}`);
            filesToUpload.push({ idx: i, file: f });
          }

          const uploadedUrls = [];
          for (const item of filesToUpload) {
            submitBtn.textContent = `Subiendo Cotización #${item.idx} de 3 a Google Drive…`;
            const up = await uploadTusCompraAttachment(
              item.file,
              listData.csrfToken || ctx.csrfToken,
              signal,
              `Cotización #${item.idx}`
            );
            const url = up?.url || '';
            if (!url) {
              throw new Error(`No se logró verificar la carga de la Cotización #${item.idx} («${item.file.name}») en Google Drive.`);
            }
            uploadedUrls.push(url);
          }
          payload.adjuntoCotizacionesAdm = uploadedUrls.join(' | ');
          submitBtn.textContent = 'Procesando…';
        }

        const res = await transitionTusCompra(
          payload,
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
    const attachmentsHtml = renderAttachmentsLinks(order);

    modalEl.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;color:#1e3a8a;">Detalle y Trazabilidad · ${escapeHtml(order.id)}</h3>
        </div>
        ${renderStepProgress(order.estado)}
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:12px 0;">
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Estado Actual</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.estado)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Solicitante / Área</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.solicitante)} (${escapeHtml(order.correo)}) · ${escapeHtml(order.area)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Tipo y Monto Válido</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.tipo)} · <strong>${formatCurrency(order.monto)}</strong> (Acumulado mes área: ${formatCurrency(order.acumuladoMesArea)} · Sin límite por área)</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Monto Estimado (Usuario)</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${formatCurrency(order.montoEstimado || order.monto)}</td></tr>
          ${Number(order.montoOrdenCompra || 0) > 0 ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f766e;">Monto Orden de Compra (Ajustado)</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f766e;">${formatCurrency(order.montoOrdenCompra)} (Monto único válido del pedido)</td></tr>` : ''}
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Artículos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.descripcion)}</td></tr>
          ${order.justificacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Justificación</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.justificacion)}</td></tr>` : ''}
          ${order.fechaCierreCotizacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha est. cierre cotizaciones</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaCierreCotizacion)}</td></tr>` : ''}
          ${order.fechaRecepcionCotizacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha recepción cotizaciones</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaRecepcionCotizacion)}</td></tr>` : ''}
          ${order.fechaOrdenCompra ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha generación Orden de Compra</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaOrdenCompra)}</td></tr>` : ''}
          ${order.fechaEntregaEstimada ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha estimada de entrega</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaEntregaEstimada)}</td></tr>` : ''}
          ${order.aprobador ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Aprobador</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.aprobador)} ${order.fechaAprobacion ? `(${escapeHtml(order.fechaAprobacion)})` : ''}</td></tr>` : ''}
          ${order.comentarioAprobacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Nota Aprobación</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.comentarioAprobacion)}</td></tr>` : ''}
          ${order.evaluacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Evaluación Recepción</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.evaluacion)} ${order.comentarioRecepcion ? `— ${escapeHtml(order.comentarioRecepcion)}` : ''}</td></tr>` : ''}
          ${attachmentsHtml ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Archivos Adjuntos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${attachmentsHtml}</td></tr>` : ''}
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
        <div style="display:flex;justify-content:flex-end;margin-top:14px;">
          <button type="button" id="tc-detail-close-bottom" class="ticket-action-pill" style="background:var(--primary-color, #26487F);border:1px solid var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:7px 16px;border-radius:6px;cursor:pointer;">Cerrar</button>
        </div>
      </div>
    `;

    modalEl.querySelector('#tc-detail-close-bottom')?.addEventListener('click', () => modalEl.close());
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

async function renderExecutiveDashboardView(container, ctx, controller) {
  const signal = controller.signal;
  const active = () => !signal.aborted && container.isConnected;
  const access = ctx.access || {};

  let listData;
  try {
    listData = await listTusCompras('all', signal);
  } catch (err) {
    if (!active()) return;
    container.innerHTML = `<section class="ticket-admin"><p role="alert">No se pudieron consultar los indicadores gerenciales de Tus compras.</p></section>`;
    return;
  }
  if (!active()) return;

  const allItems = normalizeOrdersStates(Array.isArray(listData.items) ? listData.items : []);
  const areas = [...new Set(allItems.map(x => String(x.area || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filters = { days: '30', tipo: '', area: '' };

  container.innerHTML = `
    <section class="ticket-admin ticket-management">
      ${renderTopNavigation('#vision-gerencial-compras', access)}

      <header class="ticket-executive-heading" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div>
          <h1 style="margin:0;color:#0f172a;">Vista Gerencial · Tus compras</h1>
          <p style="margin:4px 0 0;color:#475569;">Evolución gráfica de tickets de compra, tiempos de entrega y cierre (OPEX vs CAPEX) y desempeño operativo de gestión de compra (Daniel Lara).</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="tc-exec-refresh" style="background:var(--primary-color, #26487F);border:1px solid var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;">Actualizar indicadores</button>
        </div>
      </header>

      <form id="tc-exec-filters" class="ticket-filters" aria-label="Filtros gerenciales de compras" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;background:#ffffff;padding:14px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:18px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#334155;">
          Período de análisis
          <select name="days" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;">
            <option value="7">Últimos 7 días</option>
            <option value="30" selected>Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="0">Todo el historial</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#334155;">
          Tipo de compra
          <select name="tipo" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;">
            <option value="">Todos (OPEX + CAPEX)</option>
            <option value="OPEX">Solo OPEX (≤ $8,000 directo / exceso)</option>
            <option value="CAPEX">Solo CAPEX (Inversión)</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#334155;">
          Área solicitante
          <select name="area" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;">
            <option value="">Todas las áreas</option>
            ${areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
          </select>
        </label>
      </form>

      <div id="tc-exec-body" aria-live="polite"></div>
      <dialog id="tc-exec-modal" class="ticket-modal" style="max-width:680px;width:94%;border-radius:10px;border:1px solid #cbd5e1;padding:20px;"></dialog>
    </section>
  `;

  const bodyEl = container.querySelector('#tc-exec-body');
  const modalEl = container.querySelector('#tc-exec-modal');
  const formEl = container.querySelector('#tc-exec-filters');

  function openDetail(orderId) {
    const order = allItems.find(x => x.id === orderId);
    if (!order) return;
    const history = Array.isArray(order.history) ? order.history : [];
    const attachmentsHtml = renderAttachmentsLinks(order);
    modalEl.innerHTML = `
      <div>
        <div>
          <h3 style="margin:0;color:#1e3a8a;">Detalle y Trazabilidad · ${escapeHtml(order.id)}</h3>
        </div>
        ${renderStepProgress(order.estado)}
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:12px 0;">
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Estado Actual</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.estado)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Solicitante / Área</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.solicitante)} (${escapeHtml(order.correo)}) · ${escapeHtml(order.area)}</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Tipo y Monto Válido</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.tipo)} · <strong>${formatCurrency(order.monto)}</strong> (Acumulado mes área: ${formatCurrency(order.acumuladoMesArea)} · Sin límite por área)</td></tr>
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Monto Estimado (Usuario)</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${formatCurrency(order.montoEstimado || order.monto)}</td></tr>
          ${Number(order.montoOrdenCompra || 0) > 0 ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f766e;">Monto Orden de Compra (Ajustado)</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f766e;">${formatCurrency(order.montoOrdenCompra)} (Monto único válido del pedido)</td></tr>` : ''}
          <tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Artículos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.descripcion)}</td></tr>
          ${order.fechaCierreCotizacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha est. cierre cotizaciones</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaCierreCotizacion)}</td></tr>` : ''}
          ${order.fechaRecepcionCotizacion ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha recepción cotizaciones</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaRecepcionCotizacion)}</td></tr>` : ''}
          ${order.fechaOrdenCompra ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha generación Orden de Compra</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaOrdenCompra)}</td></tr>` : ''}
          ${order.fechaEntregaEstimada ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Fecha estimada de entrega</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.fechaEntregaEstimada)}</td></tr>` : ''}
          ${order.aprobador ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Aprobación</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${escapeHtml(order.aprobador)} ${order.fechaAprobacion ? `(${escapeHtml(order.fechaAprobacion)})` : ''}</td></tr>` : ''}
          ${attachmentsHtml ? `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0;font-weight:600;">Archivos Adjuntos</td><td style="padding:6px;border-bottom:1px solid #e2e8f0;">${attachmentsHtml}</td></tr>` : ''}
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
        <div style="display:flex;justify-content:flex-end;margin-top:14px;">
          <button type="button" id="tc-exec-detail-close" class="ticket-action-pill" style="background:var(--primary-color, #26487F);border:1px solid var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:7px 16px;border-radius:6px;cursor:pointer;">Cerrar</button>
        </div>
      </div>
    `;
    modalEl.querySelector('#tc-exec-detail-close')?.addEventListener('click', () => modalEl.close());
    if (typeof modalEl.showModal === 'function') modalEl.showModal();
    else modalEl.setAttribute('open', 'open');
  }

  function paintDashboard() {
    const m = computeTusComprasExecutiveMetrics(allItems, filters);
    const opex = m.opex;
    const capex = m.capex;

    const opexDanielHeadline =
      opex.avgDanielTotalCompletedHours !== null
        ? formatDurationHours(opex.avgDanielTotalCompletedHours)
        : opex.avgDanielActiveAgingHours !== null
        ? `${formatDurationHours(opex.avgDanielActiveAgingHours)} (en curso)`
        : 'Sin casos';

    const capexDanielHeadline =
      capex.avgDanielTotalCompletedHours !== null
        ? formatDurationHours(capex.avgDanielTotalCompletedHours)
        : capex.avgDanielActiveAgingHours !== null
        ? `${formatDurationHours(capex.avgDanielActiveAgingHours)} (en curso)`
        : 'Sin casos';

    const maxTimeRef = Math.max(
      1,
      opex.avgEndToEndDeliveryHours || 0,
      opex.avgEndToEndClosureHours || 0,
      opex.avgDanielTotalCompletedHours || 0,
      opex.avgDanielActiveAgingHours || 0,
      capex.avgEndToEndDeliveryHours || 0,
      capex.avgEndToEndClosureHours || 0,
      capex.avgDanielTotalCompletedHours || 0,
      capex.avgDanielActiveAgingHours || 0
    );

    const barWidth = val => (val !== null && Number.isFinite(val) ? Math.min(100, Math.max(6, Math.round((val / maxTimeRef) * 100))) : 0);

    const orderedStates = [
      TUS_COMPRAS_STATES.ENVIADA,
      TUS_COMPRAS_STATES.EN_APROBACION,
      TUS_COMPRAS_STATES.EN_PROCESO,
      TUS_COMPRAS_STATES.EN_COTIZACION,
      TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS,
      TUS_COMPRAS_STATES.OC_GENERADA,
      TUS_COMPRAS_STATES.RECIBIDOS_ADM,
      TUS_COMPRAS_STATES.ENTREGADA,
      TUS_COMPRAS_STATES.CONFORME,
      TUS_COMPRAS_STATES.DISCONFORME,
      TUS_COMPRAS_STATES.RECHAZADA
    ];
    const maxStateCount = Math.max(1, ...orderedStates.map(st => m.stateCounts[st]?.total || 0));

    bodyEl.innerHTML = `
      <!-- Tarjetas KPI Superiores -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px;">
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #26487F;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Volumen Total de Pedidos</div>
          <div style="font-size:24px;font-weight:800;color:#0f172a;margin:4px 0;">${m.totalOrders} pedidos</div>
          <div style="font-size:12.5px;color:#334155;">Monto: <strong>${formatCurrency(m.totalMonto)}</strong> (${opex.count} OPEX · ${capex.count} CAPEX)</div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #0284c7;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;">Entrega y Cierre · OPEX</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">Entrega: ${formatDurationHours(opex.avgEndToEndDeliveryHours)}</div>
          <div style="font-size:12.5px;color:#334155;">Cierre total (Estado 5): <strong>${formatDurationHours(opex.avgEndToEndClosureHours)}</strong></div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #7c3aed;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#6d28d9;text-transform:uppercase;">Entrega y Cierre · CAPEX</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">Entrega: ${formatDurationHours(capex.avgEndToEndDeliveryHours)}</div>
          <div style="font-size:12.5px;color:#334155;">Cierre total (Estado 5): <strong>${formatDurationHours(capex.avgEndToEndClosureHours)}</strong></div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #d97706;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;">Gestión Daniel Lara · OPEX</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">${opexDanielHeadline}</div>
          <div style="font-size:12.5px;color:#334155;">En cancha de Daniel hoy: <strong>${opex.inDanielCourtCount}</strong> · En aprob.: <strong>${opex.inApprovalCount}</strong></div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #9333ea;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#7e22ce;text-transform:uppercase;">Gestión Daniel Lara · CAPEX</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">${capexDanielHeadline}</div>
          <div style="font-size:12.5px;color:#334155;">En cancha de Daniel hoy: <strong>${capex.inDanielCourtCount}</strong> · En aprob.: <strong>${capex.inApprovalCount}</strong></div>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:4px solid #059669;border-radius:10px;padding:14px;">
          <div style="font-size:12px;font-weight:700;color:#047857;text-transform:uppercase;">Calidad de Recepción (Estado 5)</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin:4px 0;">${m.quality.conformeRatePct !== null ? `${m.quality.conformeRatePct}% Conforme` : 'Sin cierres'}</div>
          <div style="font-size:12.5px;color:#334155;">Conformes: <strong>${m.quality.totalConforme}</strong> · Disconformes: <strong style="color:#dc2626;">${m.quality.totalDisconforme}</strong></div>
        </div>
      </div>

      <!-- Fila Principal de Gráficos -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;margin-bottom:18px;">
        <!-- Panel 1: Tiempos de Gestión de Daniel Lara y Tiempos de Entrega/Cierre por Tipo (OPEX vs CAPEX) -->
        <section style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:18px;">
          <h2 style="margin:0 0 6px;font-size:16px;color:#1e3a8a;">⏱️ Tiempos de Gestión de Daniel Lara vs. Entrega y Cierre (OPEX vs CAPEX)</h2>
          <p style="margin:0 0 14px;font-size:12.5px;color:#475569;">Mide por separado cuánto demora Daniel Lara desde que el pedido está listo para compra (creado en 1 para OPEX directo, o aprobado en 2a para CAPEX/excesos) hasta su entrega en Estado 4, frente al tiempo total hasta el cierre.</p>

          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              {
                title: '1. Tiempo Neto de Gestión de Daniel Lara (Entregados: Disponible → 4 Entrega)',
                opexVal: opex.avgDanielTotalCompletedHours,
                capexVal: capex.avgDanielTotalCompletedHours
              },
              {
                title: '2. Antigüedad Promedio Actual en Cancha de Daniel (Abiertos en 1, 2a o 3)',
                opexVal: opex.avgDanielActiveAgingHours,
                capexVal: capex.avgDanielActiveAgingHours
              },
              {
                title: '3. Sub-etapa Daniel: Compra y Llegada a Adm. (2a En Proceso → 3 Recibidos Adm.)',
                opexVal: opex.avgDanielProcurementHours,
                capexVal: capex.avgDanielProcurementHours
              },
              {
                title: '4. Sub-etapa Daniel: Entrega física al Solicitante (3 Recibidos Adm. → 4 Entregada)',
                opexVal: opex.avgDanielInternalDeliveryHours,
                capexVal: capex.avgDanielInternalDeliveryHours
              },
              {
                title: '5. Tiempo de Autorización Ejecutiva (2b En aprobación → Aprobada 2a)',
                opexVal: opex.avgApprovalHours,
                capexVal: capex.avgApprovalHours
              },
              {
                title: '6. Tiempo Total hasta Entrega al Solicitante (Creación → 4 Compra Entregada)',
                opexVal: opex.avgEndToEndDeliveryHours,
                capexVal: capex.avgEndToEndDeliveryHours
              },
              {
                title: '7. Tiempo Total hasta Cierre del Ticket (Creación → 5 Conforme / Disconforme)',
                opexVal: opex.avgEndToEndClosureHours,
                capexVal: capex.avgEndToEndClosureHours
              }
            ]
              .map(
                row => `
              <div style="border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:6px;">${escapeHtml(row.title)}</div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="width:58px;font-size:11.5px;font-weight:700;color:#0369a1;">OPEX</span>
                  <div style="flex:1;background:#f1f5f9;height:10px;border-radius:999px;overflow:hidden;">
                    <div style="width:${barWidth(row.opexVal)}%;height:100%;background:#0284c7;border-radius:999px;"></div>
                  </div>
                  <span style="min-width:115px;text-align:right;font-size:12px;font-weight:600;color:#0f172a;">${formatDurationHours(row.opexVal)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:58px;font-size:11.5px;font-weight:700;color:#7e22ce;">CAPEX</span>
                  <div style="flex:1;background:#f1f5f9;height:10px;border-radius:999px;overflow:hidden;">
                    <div style="width:${barWidth(row.capexVal)}%;height:100%;background:#9333ea;border-radius:999px;"></div>
                  </div>
                  <span style="min-width:115px;text-align:right;font-size:12px;font-weight:600;color:#0f172a;">${formatDurationHours(row.capexVal)}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Panel 2: Evolución Gráfica de Estados del Pipeline (OPEX vs CAPEX) -->
        <section style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:18px;">
          <h2 style="margin:0 0 6px;font-size:16px;color:#1e3a8a;">📊 Evolución de la Gestión por Estado (Pipeline OPEX vs CAPEX)</h2>
          <p style="margin:0 0 14px;font-size:12.5px;color:#475569;">Distribución actual de los tickets a lo largo de las 5 etapas del flujo y monto acumulado por estado.</p>

          <div style="display:flex;flex-direction:column;gap:11px;">
            ${orderedStates
              .map(st => {
                const info = m.stateCounts[st] || { total: 0, OPEX: 0, CAPEX: 0, monto: 0 };
                const opexW = Math.round((info.OPEX / maxStateCount) * 100);
                const capexW = Math.round((info.CAPEX / maxStateCount) * 100);
                return `
                  <div style="border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;">
                      <span style="font-weight:700;color:#1e293b;">${escapeHtml(st)}</span>
                      <span style="font-size:12px;color:#334155;"><strong>${info.total}</strong> (${info.OPEX} OPEX · ${info.CAPEX} CAPEX) · ${formatCurrency(info.monto)}</span>
                    </div>
                    <div style="display:flex;height:12px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
                      <div style="width:${opexW}%;background:#0284c7;" title="OPEX: ${info.OPEX}"></div>
                      <div style="width:${capexW}%;background:#9333ea;" title="CAPEX: ${info.CAPEX}"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div style="margin-top:12px;display:flex;gap:16px;font-size:12px;color:#475569;">
            <span><strong style="color:#0284c7;">■</strong> OPEX</span>
            <span><strong style="color:#9333ea;">■</strong> CAPEX</span>
          </div>
        </section>
      </div>

        <!-- Segunda Fila: Ejecución Presupuestaria Mensual OPEX por Área + Backlog de Daniel Lara -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;margin-bottom:18px;">
        <section style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:18px;">
          <h2 style="margin:0 0 6px;font-size:16px;color:#1e3a8a;">💰 Consumo Mensual OPEX por Área Solicitante (Sin límite mensual por área)</h2>
          <p style="margin:0 0 14px;font-size:12.5px;color:#475569;">Distribución del gasto mensual OPEX por área solicitante considerando el monto único válido ajustado en la Orden de Compra.</p>
          ${
            m.areaBudgets.length
              ? (() => {
                  const maxAreaSpend = Math.max(1, ...m.areaBudgets.map(x => Number(x.currentMonthMonto) || 0));
                  return m.areaBudgets
                    .map(ab => {
                      const barPct = Math.min(100, Math.max(6, Math.round(((Number(ab.currentMonthMonto) || 0) / maxAreaSpend) * 100)));
                      return `
                        <div style="margin-bottom:12px;">
                          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                            <strong>${escapeHtml(ab.area)} (${ab.count} pedidos OPEX)</strong>
                            <span style="font-weight:700;color:#0369a1;">${formatCurrency(ab.currentMonthMonto)} (Sin límite por área)</span>
                          </div>
                          <div style="height:10px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
                            <div style="width:${barPct}%;height:100%;background:#0284c7;"></div>
                          </div>
                        </div>
                      `;
                    })
                    .join('');
                })()
              : '<p style="font-size:13px;color:#64748b;">No hay consumos OPEX registrados para este filtro.</p>'
          }
        </section>

        <section style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:18px;">
          <h2 style="margin:0 0 6px;font-size:16px;color:#1e3a8a;">📌 Pedidos Activos en Gestión de Daniel Lara (Por Antigüedad)</h2>
          <p style="margin:0 0 12px;font-size:12.5px;color:#475569;">Tickets que ya están listos para gestión operativa de Daniel Lara (estados 1, 2a o 3), ordenados por mayor tiempo de demora acumulada.</p>
          ${
            m.danielBacklog.length
              ? `
              <div class="ticket-table-wrap">
                <table class="ticket-table" style="font-size:13px;">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Tipo / Monto</th>
                      <th>Estado</th>
                      <th>Tiempo en gestión Daniel</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${m.danielBacklog
                      .map(
                        item => `
                      <tr>
                        <td><strong>${escapeHtml(item.order.id)}</strong><div style="font-size:11.5px;color:#64748b;">${escapeHtml(item.order.area)}</div></td>
                        <td><strong>${escapeHtml(item.tipo)}</strong><div>${formatCurrency(item.order.monto)}</div></td>
                        <td><span style="padding:3px 8px;border-radius:999px;font-size:11.5px;font-weight:700;${stateBadgeStyle(item.state)}">${escapeHtml(item.state)}</span></td>
                        <td style="font-weight:700;color:${item.elapsedHours > 72 ? '#dc2626' : item.elapsedHours > 24 ? '#b45309' : '#0f172a'};">${formatDurationHours(item.elapsedHours)}</td>
                        <td>
                          <button type="button" class="ticket-action-pill" data-exec-detail="${escapeHtml(item.order.id)}" style="background:var(--primary-color, #26487F);border-color:var(--primary-color, #26487F);color:#ffffff;font-weight:600;padding:6px 12px;border-radius:6px;cursor:pointer;">
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
              : '<p style="font-size:13px;color:#64748b;">Actualmente no hay pedidos detenidos en la bandeja operativa de Daniel Lara (todos los pedidos están en 2b En aprobación o ya fueron entregados).</p>'
          }
        </section>
      </div>
    `;
  }

  formEl?.addEventListener('change', ev => {
    const target = ev.target;
    if (target && target.name) {
      filters[target.name] = target.value;
      paintDashboard();
    }
  });

  container.querySelector('#tc-exec-refresh')?.addEventListener('click', () => {
    controller.abort();
    modalEl?.close?.();
    render(container);
  });

  bodyEl?.addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-exec-detail]');
    if (btn) {
      openDetail(btn.dataset.execDetail);
    }
  });

  paintDashboard();
}

export const renderTusComprasWidget = render;
