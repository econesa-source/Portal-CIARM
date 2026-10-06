/**
 * Componente Nueva Solicitud - Portal CIARM
 * Versión: 17.9.0
 */

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function renderSolicitudesWidget(container, userSession) {
  if (!container) return;

  const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwFQW8HyJsjfWQnJLrE6XAxW0_UFFPYn59Xa90ZB38X1kmdCWlxZM4wkTunr9UN-GxUrA/exec';
  const user = userSession || { nombre: 'Ezequiel Conesa', correo: 'econesa@ciarm.edu.mx' };

  container.innerHTML = `
    <div class="card-container-wide solicitud-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#mis-solicitudes" class="solicitud-secondary-link">📋 Ver Mis Solicitudes</a>
      </div>

      <div class="solicitud-heading">
        <h2>➕ Nueva Solicitud de Pedido</h2>
        <p>Complete el formulario para registrar un requerimiento en la Base de Datos Institucional (HT05).</p>
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
            🚀 Registrar Solicitud en HT05
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
    msgEstado.innerHTML = '<strong>Transmitiendo datos a BD - Sistema de Tickets (HT05)...</strong>';

    try {
      const attachments = await Promise.all(files.map(file => convertFileToBase64(file)));

      const payload = {
        solicitante: user.nombre,
        correo: user.correo,
        tipo: selectTipo.value,
        descripcion: document.getElementById('descripcion').value,
        prioridad: document.getElementById('prioridad').value,
        fechaProgramada: inputFecha.value || '',
        adjuntos: attachments
      };

      await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      msgEstado.className = 'solicitud-status is-visible is-success';
      msgEstado.innerHTML = '<strong>✅ Solicitud registrada con éxito en Google Workspace.</strong> Redirigiendo a Mis Solicitudes...';

      setTimeout(() => {
        window.location.hash = '#mis-solicitudes';
      }, 2500);

    } catch (err) {
      console.error('Error procesando solicitud:', err);
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🚀 Registrar Solicitud en HT05';

      msgEstado.className = 'solicitud-status is-visible is-error';
      msgEstado.innerHTML = `<strong>⚠️ Error al procesar solicitud:</strong> ${err.message}`;
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

export const render = renderSolicitudesWidget;
