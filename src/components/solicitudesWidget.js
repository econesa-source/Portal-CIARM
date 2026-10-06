/**
 * Componente Nueva Solicitud - Portal CIARM
 * Versión: 17.10.4
 */

import { GAS_WEBAPP_URL } from '../services/apiClient.js';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function renderSolicitudesWidget(container, userSession) {
  if (!container) return;

  const user = userSession || { nombre: 'Ezequiel Conesa', correo: 'econesa@ciarm.edu.mx' };

  container.innerHTML = `
    <div class="card-container-wide solicitud-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#mis-solicitudes" class="solicitud-secondary-link">📋 Ver Mis Solicitudes</a>
      </div>

      <div class="solicitud-heading">
        <h2>➕ Nueva Solicitud de Pedido</h2>
        <p>Complete el formulario para registrar un requerimiento en BD - Sistema de Tickets.</p>
      </div>

      <form id="form-solicitud-ciarm" class="solicitud-form">
        <div class="solicitud-identity">
          <div class="solicitud-field">
            <label>SOLICITANTE INSTITUCIONAL</label>
            <input type="text" id="solicitanteNombre" value="${user.nombre}" readonly />
          </div>
          <div class="solicitud-field">
            <label>CORREO CORPORATIVO</label>
            <input type="email" id="correoSolicitante" value="${user.correo}" readonly />
          </div>
        </div>

        <div class="solicitud-field">
          <label for="tipoSolicitud">TIPO DE SERVICIO / ÁREA *</label>
          <select id="tipoSolicitud" name="tipoSolicitud" required>
            <option value="" disabled selected>-- Seleccione el área requerida --</option>
            <option value="Soporte Tecnológico / TI">Soporte Tecnológico / TI</option>
            <option value="Mantenimiento de Instalaciones">Mantenimiento de Instalaciones</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Intendencia">Intendencia</option>
            <option value="RRHH / Admin">RRHH / Admin</option>
          </select>
        </div>

        <div class="solicitud-field">
          <label for="prioridad">PRIORIDAD REQUERIDA *</label>
          <select id="prioridad" name="prioridad" required>
            <option value="🟢 Normal">🟢 Normal (Atención regular)</option>
            <option value="🔴 Urgente">🔴 Urgente (Afecta operación inmediata)</option>
          </select>
        </div>

        <div id="grupo-fecha-programada" class="solicitud-date-field">
          <label for="fechaProgramada">📅 FECHA PROGRAMADA DE ENTREGA / EVENTO *</label>
          <small>Requerido para Intendencia o logística de eventos.</small>
          <input type="date" id="fechaProgramada" name="fechaProgramada" />
        </div>

        <div class="solicitud-field solicitud-description">
          <label for="descripcion">DESCRIPCIÓN DETALLADA *</label>
          <textarea id="descripcion" name="descripcion" rows="3" required placeholder="Describa claramente el requerimiento o falla detectada..."></textarea>
        </div>

        <div class="solicitud-field solicitud-files">
          <label for="archivosAdjuntos">ARCHIVOS ADJUNTOS (MÁX. 5 · 10 MB C/U)</label>
          <input type="file" id="archivosAdjuntos" multiple accept="image/*,.pdf,.doc,.docx" />
          <div id="solicitud-file-list" class="solicitud-file-list" aria-live="polite"></div>
          <small id="file-error-msg" class="solicitud-file-error"></small>
        </div>

        <div class="solicitud-submit-row">
          <button type="submit" id="btn-submit-solicitud" class="solicitud-submit-btn">
            🚀 Registrar Solicitud
          </button>
        </div>
      </form>

      <div id="mensaje-estado-form" class="solicitud-status"></div>
    </div>
  `;

  const selectTipo = document.getElementById('tipoSolicitud');
  const grupoFecha = document.getElementById('grupo-fecha-programada');
  const inputFecha = document.getElementById('fechaProgramada');
  const fileInput = document.getElementById('archivosAdjuntos');
  const fileList = document.getElementById('solicitud-file-list');
  const fileError = document.getElementById('file-error-msg');

  selectTipo?.addEventListener('change', (e) => {
    if (e.target.value === 'Intendencia') {
      grupoFecha.classList.add('is-visible');
      inputFecha.setAttribute('required', 'required');
    } else {
      grupoFecha.classList.remove('is-visible');
      inputFecha.removeAttribute('required');
      inputFecha.value = '';
    }
  });

  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    renderSelectedFiles(files, fileList, fileError);

    const invalid = validateFiles(files);
    if (invalid) {
      fileError.textContent = invalid;
    }
  });

  const form = document.getElementById('form-solicitud-ciarm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectTipo.value) {
      alert('Por favor seleccione un Tipo de Servicio / Área válido.');
      return;
    }

    const files = Array.from(fileInput?.files || []);
    const fileValidationError = validateFiles(files);
    if (fileValidationError) {
      fileError.textContent = fileValidationError;
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-solicitud');
    const msgEstado = document.getElementById('mensaje-estado-form');

    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ Procesando y conectando con Google Workspace...';

    msgEstado.className = 'solicitud-status is-visible is-loading';
    msgEstado.innerHTML = '<strong>Transmitiendo datos a BD - Sistema de Tickets...</strong>';

    try {
      const attachments = await Promise.all(files.map(file => convertFileToBase64(file)));
      const descripcion = document.getElementById('descripcion').value.trim();

      // Mis Solicitudes ya usa esta misma WebApp. Primero tomamos una foto
      // de los tickets existentes para poder confirmar que el POST creó uno nuevo.
      const beforeTickets = await readTicketsForUser(user.correo);
      const beforeIds = new Set(beforeTickets.map(ticket => ticket.id).filter(Boolean));

      const ticketPayload = {
        solicitante: user.nombre,
        correo: user.correo,
        tipo: selectTipo.value,
        descripcion,
        prioridad: document.getElementById('prioridad').value,
        fechaProgramada: inputFecha.value || '',
        adjuntos: attachments
      };

      // Enviamos exactamente una vez. El formulario oculto evita problemas de CORS
      // de Apps Script; luego confirmamos por GET antes de mostrar éxito.
      submitTicketViaHiddenForm(ticketPayload);

      const confirmedTicket = await waitForTicketConfirmation({
        email: user.correo,
        beforeIds,
        tipo: ticketPayload.tipo,
        descripcion: ticketPayload.descripcion,
        requireAttachments: attachments.length > 0
      });

      if (!confirmedTicket) {
        throw new Error(
          attachments.length > 0
            ? 'La solicitud fue enviada, pero no se pudo confirmar todavía el registro completo y sus adjuntos. Revisá “Mis Solicitudes” antes de volver a enviarla para evitar duplicados.'
            : 'La solicitud fue enviada, pero no se pudo confirmar todavía su registro. Revisá “Mis Solicitudes” antes de volver a enviarla para evitar duplicados.'
        );
      }

      msgEstado.className = 'solicitud-status is-visible is-success';
      msgEstado.innerHTML = `<strong>✅ Solicitud ${escapeHtml(confirmedTicket.id)} registrada en BD - Sistema de Tickets.</strong>${attachments.length ? ' Adjuntos confirmados en Drive.' : ''} Redirigiendo a Mis Solicitudes...`;

      setTimeout(() => {
        window.location.hash = '#mis-solicitudes';
      }, 2500);

    } catch (err) {
      console.error('Error procesando solicitud:', err);
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🚀 Registrar Solicitud';

      msgEstado.className = 'solicitud-status is-visible is-error';
      msgEstado.innerHTML = `<strong>⚠️ No se pudo confirmar el registro:</strong> ${escapeHtml(err.message)}`;
    }
  });
}

function validateFiles(files) {
  if (files.length > MAX_FILES) {
    return `Podés adjuntar hasta ${MAX_FILES} archivos. Actualmente seleccionaste ${files.length}.`;
  }

  const oversized = files.find(file => file.size > MAX_FILE_SIZE);
  if (oversized) {
    return `“${oversized.name}” supera el máximo permitido de 10 MB.`;
  }

  return '';
}

function renderSelectedFiles(files, container, errorContainer) {
  if (!container) return;

  if (errorContainer) errorContainer.textContent = '';

  if (!files.length) {
    container.innerHTML = '<span class="solicitud-file-empty">No hay archivos seleccionados.</span>';
    return;
  }

  container.innerHTML = files.map(file => `
    <div class="solicitud-file-item" title="${escapeHtml(file.name)}">
      <span class="solicitud-file-name">📎 ${escapeHtml(file.name)}</span>
      <span class="solicitud-file-size">${formatFileSize(file.size)}</span>
    </div>
  `).join('');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        nombre: file.name,
        mimeType: file.type,
        base64: base64Data
      });
    };
    reader.onerror = error => reject(error);
  });
}

function submitTicketViaHiddenForm(ticketPayload) {
  const iframeName = `gas_ticket_target_${Date.now()}`;
  const iframe = document.createElement('iframe');
  iframe.name = iframeName;
  iframe.style.display = 'none';

  const form = document.createElement('form');
  form.action = GAS_WEBAPP_URL;
  form.method = 'POST';
  form.target = iframeName;
  form.style.display = 'none';

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = 'postData';
  hiddenInput.value = JSON.stringify(ticketPayload);

  form.appendChild(hiddenInput);
  document.body.appendChild(iframe);
  document.body.appendChild(form);
  form.submit();

  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 30000);
}

async function readTicketsForUser(email) {
  const requestUrl =
    `${GAS_WEBAPP_URL}?action=getTickets&email=${encodeURIComponent(email)}&_t=${Date.now()}`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar BD - Sistema de Tickets (HTTP ${response.status}).`);
  }

  const text = await response.text();
  const payload = parseTicketPayload(text);

  if (payload && payload.status === 'error') {
    throw new Error(payload.message || 'El backend de tickets devolvió un error.');
  }

  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (Array.isArray(payload?.data)) rows = payload.data;
  else if (Array.isArray(payload?.tickets)) rows = payload.tickets;

  return rows.map(normalizeTicketForConfirmation);
}

function parseTicketPayload(text) {
  const clean = String(text || '').trim();
  if (!clean) return [];

  try {
    return JSON.parse(clean);
  } catch (_) {
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

    throw new Error('La respuesta del backend de tickets no tiene un formato reconocido.');
  }
}

function normalizeTicketForConfirmation(raw) {
  const value = raw || {};
  const first = (keys) => {
    for (const key of keys) {
      const cell = value?.[key];
      if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
        return String(cell).trim();
      }
    }
    return '';
  };

  return {
    id: first(['id', 'id_ticket', 'idTicket', 'ID TICKET', 'folio']),
    tipo: first(['tipo', 'tipo_solicitud', 'tipoSolicitud', 'TIPO DE SOLICITUD']),
    descripcion: first(['desc', 'descripcion', 'DESCRIPCIÓN']),
    correo: first(['correo', 'email', 'correo_solicitante', 'correoSolicitante', 'CORREO SOLICITANTE']).toLowerCase(),
    adjuntos: first([
      'driveUrl',
      'drive_url',
      'adjuntos_urls',
      'adjuntosUrls',
      'archivos_adjuntos',
      'ARCHIVOS ADJUNTOS'
    ])
  };
}

async function waitForTicketConfirmation({ email, beforeIds, tipo, descripcion, requireAttachments }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await sleep(1200);

    const tickets = await readTicketsForUser(normalizedEmail);
    const match = tickets.find(ticket =>
      ticket.id &&
      !beforeIds.has(ticket.id) &&
      (!ticket.correo || ticket.correo === normalizedEmail) &&
      ticket.tipo === tipo &&
      ticket.descripcion === descripcion
    );

    if (match && (!requireAttachments || match.adjuntos)) {
      return match;
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const render = renderSolicitudesWidget;
