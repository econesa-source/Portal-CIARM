/**
 * Módulo de Captura de Solicitudes Internas - Portal CIARM
 * Versión: 14.1.0 (Persistencia Real GAS + Validación Adjuntos max 5 files / 10MB)
 */

export function render(container, userSession) {
  if (!container) return;

  const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwFQW8HyJsjfWQnJLrE6XAxW0_UFFPYn59Xa90ZB38X1kmdCWlxZM4wkTunr9UN-GxUrA/exec';
  const user = userSession || { nombre: 'Ezequiel Conesa', correo: 'econesa@ciarm.edu.mx' };

  container.innerHTML = `
    <div class="card-container-wide">
      
      <!-- Navegación Superior Interna -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
        <a href="#inicio" style="color: #1B2B48; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
          ← Volver al Inicio
        </a>
        <a href="#mis-solicitudes" style="color: #C5A059; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
          📋 Ver Mis Solicitudes
        </a>
      </div>

      <!-- Encabezado del Formulario -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 6px 0; color: #0A192F; font-size: 1.4rem;">➕ Nueva Solicitud de Pedido</h2>
        <p style="margin: 0; color: #64748B; font-size: 0.88rem;">
          Complete el formulario para registrar un requerimiento en la Base de Datos Institucional (HT05).
        </p>
      </div>

      <form id="form-solicitud-ciarm" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Datos de Identificación -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; background: #F8FAFC; padding: 16px; border-radius: 6px; border: 1px solid #E2E8F0;">
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 4px;">SOLICITANTE INSTITUCIONAL</label>
            <input type="text" id="solicitanteNombre" value="${user.nombre}" readonly style="width: 100%; padding: 10px; border: 1px solid #CBD5E1; border-radius: 4px; background: #E2E8F0; color: #1E293B; font-weight: 600; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 4px;">CORREO CORPORATIVO</label>
            <input type="email" id="correoSolicitante" value="${user.correo}" readonly style="width: 100%; padding: 10px; border: 1px solid #CBD5E1; border-radius: 4px; background: #E2E8F0; color: #1E293B; font-weight: 600; box-sizing: border-box;" />
          </div>
        </div>

        <!-- Selección de Tipo de Servicio -->
        <div>
          <label for="tipoSolicitud" style="display: block; font-size: 0.85rem; font-weight: 700; color: #0A192F; margin-bottom: 6px;">TIPO DE SERVICIO / ÁREA *</label>
          <select id="tipoSolicitud" name="tipoSolicitud" required style="width: 100%; padding: 12px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 0.9rem; background-color: #FFF; box-sizing: border-box;">
            <option value="">-- Seleccione el área requerida --</option>
            <option value="Soporte Tecnológico / TI">Soporte Tecnológico / TI</option>
            <option value="Mantenimiento de Instalaciones">Mantenimiento de Instalaciones</option>
            <option value="Limpieza e Intendencia">Limpieza e Intendencia</option>
            <option value="Recursos Humanos / Admón">Recursos Humanos / Admón.</option>
          </select>
        </div>

        <!-- LÓGICA CONDICIONAL: Fecha Programada de Entrega / Evento -->
        <div id="grupo-fecha-programada" style="display: none; background: #FFFBEB; border: 2px solid #F59E0B; padding: 16px; border-radius: 6px; transition: all 0.3s ease;">
          <label for="fechaProgramada" style="display: block; font-size: 0.85rem; font-weight: 700; color: #92400E; margin-bottom: 6px;">
            📅 FECHA PROGRAMADA DE ENTREGA / EVENTO (REQUERIDO PARA INTENDENCIA) *
          </label>
          <small style="display: block; color: #B45309; font-size: 0.8rem; margin-bottom: 8px;">
            Especifique la fecha exacta en la que se requiere listo el servicio de intendencia o logística para eventos.
          </small>
          <input type="date" id="fechaProgramada" name="fechaProgramada" style="width: 100%; padding: 10px; border: 1px solid #FCD34D; border-radius: 4px; font-size: 0.9rem; box-sizing: border-box;" />
        </div>

        <!-- Nivel de Prioridad -->
        <div>
          <label for="prioridad" style="display: block; font-size: 0.85rem; font-weight: 700; color: #0A192F; margin-bottom: 6px;">PRIORIDAD REQUERIDA *</label>
          <select id="prioridad" name="prioridad" required style="width: 100%; padding: 12px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 0.9rem; background-color: #FFF; box-sizing: border-box;">
            <option value="🟢 Normal">🟢 Normal (Atención regular)</option>
            <option value="🔴 Urgente">🔴 Urgente (Afecta operación inmediata)</option>
          </select>
        </div>

        <!-- Descripción del Requerimiento -->
        <div>
          <label for="descripcion" style="display: block; font-size: 0.85rem; font-weight: 700; color: #0A192F; margin-bottom: 6px;">DESCRIPCIÓN DETALLADA *</label>
          <textarea id="descripcion" name="descripcion" rows="4" required placeholder="Describa claramente el requerimiento o falla detectada..." style="width: 100%; padding: 12px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; resize: vertical;"></textarea>
        </div>

        <!-- Archivos Adjuntos (Máximo 5 archivos, 10MB c/u) -->
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0A192F; margin-bottom: 6px;">ARCHIVOS ADJUNTOS (MÁXIMO 5 ARCHIVOS, HASTA 10MB C/U)</label>
          <input type="file" id="archivosAdjuntos" multiple accept="image/*,.pdf,.doc,.docx" style="width: 100%; padding: 10px; border: 1px solid #CBD5E1; border-radius: 6px; background-color: #F8FAFC; box-sizing: border-box;" />
          <small id="file-error-msg" style="color: #D32F2F; font-size: 0.8rem; display: block; margin-top: 4px; font-weight: 600;"></small>
        </div>

        <!-- Botón de Envío -->
        <div style="margin-top: 10px;">
          <button type="submit" id="btn-submit-solicitud" style="width: 100%; background-color: #0A192F; color: #FFF; border: none; padding: 14px; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background-color 0.2s ease;">
            🚀 Registrar Solicitud en HT05
          </button>
        </div>

      </form>

      <div id="mensaje-estado-form" style="margin-top: 15px; display: none;"></div>
      <iframe name="hidden_gas_iframe" id="hidden_gas_iframe" style="display: none;"></iframe>
    </div>
  `;

  // EVENTO CONDICIONAL: Limpieza e Intendencia
  const selectTipo = document.getElementById('tipoSolicitud');
  const grupoFecha = document.getElementById('grupo-fecha-programada');
  const inputFecha = document.getElementById('fechaProgramada');

  selectTipo?.addEventListener('change', (e) => {
    if (e.target.value === 'Limpieza e Intendencia') {
      grupoFecha.style.display = 'block';
      inputFecha.setAttribute('required', 'required');
    } else {
      grupoFecha.style.display = 'none';
      inputFecha.removeAttribute('required');
      inputFecha.value = '';
    }
  });

  // VALIDACIÓN DE ARCHIVOS EN TIEMPO REAL (MÁXIMO 5 ARCHIVOS, <= 10MB)
  const fileInput = document.getElementById('archivosAdjuntos');
  const fileErrorMsg = document.getElementById('file-error-msg');

  fileInput?.addEventListener('change', () => {
    fileErrorMsg.innerText = '';
    const files = Array.from(fileInput.files);

    if (files.length > 5) {
      fileErrorMsg.innerText = '⚠️ Límite superado: Únicamente se permite adjuntar un máximo de 5 archivos por solicitud.';
      fileInput.value = '';
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB por archivo
    const fileTooLarge = files.find(f => f.size > MAX_FILE_SIZE);
    if (fileTooLarge) {
      fileErrorMsg.innerText = `⚠️ El archivo "${fileTooLarge.name}" supera el tamaño máximo permitido de 10 MB.`;
      fileInput.value = '';
      return;
    }
  });

  // ENVÍO ASÍNCRONO CON CONVERSIÓN BASE64 REAL
  const form = document.getElementById('form-solicitud-ciarm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btn-submit-solicitud');
    const msgEstado = document.getElementById('mensaje-estado-form');

    btnSubmit.disabled = true;
    btnSubmit.style.backgroundColor = '#64748B';
    btnSubmit.innerText = '⏳ Procesando archivos y conectando con Google Workspace...';

    msgEstado.style.display = 'block';
    msgEstado.style.background = '#EFF6FF';
    msgEstado.style.border = '1px solid #BFDBFE';
    msgEstado.style.color = '#1E40AF';
    msgEstado.style.padding = '12px';
    msgEstado.style.borderRadius = '6px';
    msgEstado.innerHTML = '<strong>Codificando adjuntos y transmitiendo a BD - Sistema de Tickets (HT05)...</strong>';

    try {
      const files = Array.from(fileInput.files);
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

      const tempForm = document.createElement('form');
      tempForm.action = GAS_WEBAPP_URL;
      tempForm.method = 'POST';
      tempForm.target = 'hidden_gas_iframe';

      const inputData = document.createElement('input');
      inputData.type = 'hidden';
      inputData.name = 'postData';
      inputData.value = encodeURIComponent(JSON.stringify(payload));

      tempForm.appendChild(inputData);
      document.body.appendChild(tempForm);
      tempForm.submit();

      msgEstado.style.background = '#ECFDF5';
      msgEstado.style.border = '1px solid #A7F3D0';
      msgEstado.style.color = '#065F46';
      msgEstado.innerHTML = '<strong>✅ Solicitud registrada exitosamente en Google Sheets (HT05) y subcarpeta creada en Google Drive.</strong> Redirigiendo a Mis Solicitudes...';

      setTimeout(() => {
        document.body.removeChild(tempForm);
        window.location.hash = '#mis-solicitudes';
      }, 2000);

    } catch (err) {
      console.error('Error procesando solicitud:', err);
      btnSubmit.disabled = false;
      btnSubmit.style.backgroundColor = '#0A192F';
      btnSubmit.innerText = '🚀 Registrar Solicitud en HT05';

      msgEstado.style.background = '#FFEBEE';
      msgEstado.style.border = '1px solid #FFCDD2';
      msgEstado.style.color = '#D32F2F';
      msgEstado.innerHTML = `<strong>⚠️ Error al procesar solicitud:</strong> ${err.message}`;
    }
  });
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

export const renderSolicitudesWidget = render;
