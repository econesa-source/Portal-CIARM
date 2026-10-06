/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 18.0.0
 *
 * Fuente: BD - Sistema de Tickets / hoja TICKETS.
 * El listado se solicita por el correo de la sesión institucional y,
 * cuando el backend devuelve el correo en cada registro, se vuelve a
 * filtrar del lado cliente como control adicional.
 */

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA/exec';

export async function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const userEmail = String(userSession?.correo || '').trim().toLowerCase();

  if (!userEmail) {
    renderError(container, 'No fue posible identificar el correo de la sesión institucional.');
    return;
  }

  container.innerHTML = `
    <div class="card-container-wide mis-solicitudes-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#solicitudes" class="solicitud-secondary-link">+ Crear Nueva Solicitud</a>
      </div>

      <div class="mis-solicitudes-header">
        <div>
          <h2>📋 Mis Solicitudes</h2>
          <p>Solicitudes registradas en BD - Sistema de Tickets para tu correo institucional.</p>
        </div>
        <span class="mis-solicitudes-user">👤 ${escapeHtml(userEmail)}</span>
      </div>

      <div class="mis-solicitudes-loading">⏳ Consultando tus solicitudes...</div>
    </div>
  `;

  try {
    const tickets = await fetchTicketsForUser(userEmail);
    renderTable(container, tickets, userEmail);
  } catch (error) {
    console.error('Error consultando Mis Solicitudes:', error);
    renderError(
      container,
      'No fue posible consultar BD - Sistema de Tickets en este momento.',
      userEmail
    );
  }
}

async function fetchTicketsForUser(userEmail) {
  const requestUrl =
    `${GAS_WEBAPP_URL}?action=getTickets&email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Respuesta HTTP ${response.status}`);
  }

  const text = await response.text();
  const payload = parsePayload(text);

  if (payload && payload.status === 'error') {
    throw new Error(payload.message || 'El backend devolvió un error.');
  }

  let rawTickets = [];

  if (Array.isArray(payload)) {
    rawTickets = payload;
  } else if (Array.isArray(payload?.data)) {
    rawTickets = payload.data;
  } else if (Array.isArray(payload?.tickets)) {
    rawTickets = payload.tickets;
  }

  return rawTickets
    .map(normalizeTicket)
    .filter(ticket => !ticket.correo || ticket.correo === userEmail)
    .sort(sortTicketsNewestFirst);
}

function parsePayload(text) {
  const clean = String(text || '').trim();

  if (!clean) return [];

  try {
    return JSON.parse(clean);
  } catch (_) {
    // Compatibilidad con respuestas históricas que envolvían el JSON
    // en una asignación JavaScript.
    const arrayStart = clean.indexOf('[');
    const arrayEnd = clean.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(clean.slice(arrayStart, arrayEnd + 1));
    }

    const objectStart = clean.indexOf('{');
    const objectEnd = clean.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(clean.slice(objectStart, objectEnd + 1));
    }

    throw new Error('Formato de respuesta no reconocido.');
  }
}

function normalizeTicket(raw) {
  const value = raw || {};

  return {
    id: firstValue(value, ['id', 'id_ticket', 'idTicket', 'ID TICKET', 'folio']),
    fecha: firstValue(value, ['fecha', 'fecha_solicitud', 'fechaSolicitud', 'FECHA SOLICITUD']),
    hora: firstValue(value, ['hora', 'hora_solicitud', 'horaSolicitud', 'HORA SOLICITUD']),
    tipo: firstValue(value, ['tipo', 'tipo_solicitud', 'tipoSolicitud', 'TIPO DE SOLICITUD']),
    descripcion: firstValue(value, ['desc', 'descripcion', 'DESCRIPCIÓN']),
    estado: firstValue(value, ['estado', 'ESTADO']) || 'NUEVO',
    prioridad: firstValue(value, ['prioridad_solicitada', 'prioridadSolicitada', 'PRIORIDAD SOLICITADA', 'prioridad']),
    correo: String(firstValue(value, [
      'correo',
      'email',
      'correo_solicitante',
      'correoSolicitante',
      'CORREO SOLICITANTE'
    ]) || '').trim().toLowerCase(),
    adjuntos: extractAttachmentLinks(value)
  };
}

function firstValue(obj, keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function extractAttachmentLinks(value) {
  const raw = firstValue(value, [
    'driveUrl',
    'drive_url',
    'adjuntos_urls',
    'adjuntosUrls',
    'archivos_adjuntos',
    'ARCHIVOS ADJUNTOS'
  ]);

  if (!raw) return [];

  const urls = raw.match(/https?:\/\/[^\s,]+/g) || [];
  return [...new Set(urls)];
}

function sortTicketsNewestFirst(a, b) {
  const numberFromId = (id) => {
    const match = String(id || '').match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  return numberFromId(b.id) - numberFromId(a.id);
}

function renderTable(container, tickets, userEmail) {
  const rows = tickets.length
    ? tickets.map(ticket => {
        const attachmentHtml = renderAttachments(ticket.adjuntos);

        return `
          <tr>
            <td class="col-id"><strong>${escapeHtml(ticket.id || '—')}</strong></td>
            <td class="col-fecha">
              ${escapeHtml(ticket.fecha || '—')}
              ${ticket.hora ? `<small class="ticket-time">${escapeHtml(ticket.hora)}</small>` : ''}
            </td>
            <td class="col-tipo">${escapeHtml(ticket.tipo || '—')}</td>
            <td class="col-desc">${escapeHtml(ticket.descripcion || '—')}</td>
            <td class="col-estado">
              <span class="ticket-status">${escapeHtml(ticket.estado || 'NUEVO')}</span>
              ${ticket.prioridad ? `<small class="ticket-priority">${escapeHtml(ticket.prioridad)}</small>` : ''}
            </td>
            <td class="col-accion">${attachmentHtml}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="6" class="tickets-empty">
          No hay solicitudes registradas para <strong>${escapeHtml(userEmail)}</strong>.
        </td>
      </tr>
    `;

  container.innerHTML = `
    <div class="card-container-wide mis-solicitudes-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#solicitudes" class="solicitud-secondary-link">+ Crear Nueva Solicitud</a>
      </div>

      <div class="mis-solicitudes-header">
        <div>
          <h2>📋 Mis Solicitudes</h2>
          <p>BD - Sistema de Tickets · ${tickets.length} solicitud${tickets.length === 1 ? '' : 'es'} asociada${tickets.length === 1 ? '' : 's'} a tu correo.</p>
        </div>
        <span class="mis-solicitudes-user">👤 ${escapeHtml(userEmail)}</span>
      </div>

      <div class="table-responsive-container">
        <table class="tickets-table">
          <thead>
            <tr>
              <th class="col-id">ID Ticket</th>
              <th class="col-fecha">Fecha</th>
              <th class="col-tipo">Tipo / Área</th>
              <th class="col-desc">Descripción</th>
              <th class="col-estado">Estado</th>
              <th class="col-accion">Adjuntos</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAttachments(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return '<span class="ticket-no-attachments">Sin adjuntos</span>';
  }

  return urls.map((url, index) => `
    <a
      href="${escapeAttribute(url)}"
      target="_blank"
      rel="noopener noreferrer"
      class="ticket-attachment-link"
    >📎 Archivo ${index + 1}</a>
  `).join('');
}

function renderError(container, message, userEmail = '') {
  container.innerHTML = `
    <div class="card-container-wide mis-solicitudes-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#solicitudes" class="solicitud-secondary-link">+ Crear Nueva Solicitud</a>
      </div>
      <div class="mis-solicitudes-error">
        <strong>⚠️ No pudimos cargar Mis Solicitudes.</strong>
        <span>${escapeHtml(message)}</span>
        ${userEmail ? `<small>Usuario: ${escapeHtml(userEmail)}</small>` : ''}
        <button type="button" onclick="window.location.reload()">Reintentar</button>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

export const render = renderMisSolicitudesWidget;
