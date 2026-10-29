/**
 * Componente Nueva Solicitud - Portal CIARM
 * Versión: 18.0.0
 */

import {getSelfContext,prepareCreationDraft,readCreationDraft,completeCreationDraft,discardCreationDraft,getCreationStatus} from '../services/ticketsPortalService.js';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function renderSolicitudesWidget(container, userSession) {
  if (!container) return;

  const user = userSession;

  if (!user?.correo) {
    container.innerHTML = '<div class="card-container-wide"><strong>Sesión institucional no disponible.</strong></div>';
    return;
  }

  container.innerHTML = `
    <div class="card-container-wide solicitud-card">
      <div class="solicitud-topbar">
        <a href="#inicio" class="card-top-nav-link">← Volver al Inicio</a>
        <a href="#validar-solicitudes" class="solicitud-secondary-link">📋 Ver Mis Solicitudes</a>
      </div>

      <div class="solicitud-heading">
        <h2>➕ Nueva solicitud interna</h2>
        <p>Complete el formulario para registrar un requerimiento en BD - Sistema de Tickets.</p>
      </div>

      <form id="form-solicitud-ciarm" class="solicitud-form">
        <div class="solicitud-identity">
          <div class="solicitud-field">
            <label>SOLICITANTE INSTITUCIONAL</label>
            <input type="text" id="solicitanteNombre" value="${escapeHtml(user.nombre || "")}" readonly />
          </div>
          <div class="solicitud-field">
            <label>CORREO CORPORATIVO</label>
            <input type="email" id="correoSolicitante" value="${escapeHtml(user.correo)}" readonly />
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

  const form = container.querySelector('#form-solicitud-ciarm');
  const button = container.querySelector('#btn-submit-solicitud');
  const message = container.querySelector('#mensaje-estado-form');
  const metadata = [selectTipo,inputFecha,container.querySelector('#prioridad'),container.querySelector('#descripcion')];
  const controller = new AbortController();
  let context, busy=false, done=false, timer;
  const leave=()=>{controller.abort();clearTimeout(timer);window.removeEventListener('hashchange',leave);};
  window.addEventListener('hashchange',leave,{once:true});
  function status(text,kind='loading'){if(controller.signal.aborted)return;message.className=`solicitud-status is-visible is-${kind}`;message.textContent=text;}
  function lock(){const draft=readCreationDraft(user.correo);metadata.forEach(field=>field.disabled=busy||done||Boolean(draft));fileInput.disabled=busy||done;button.disabled=busy||done||!context;button.textContent=draft?'Reintentar solicitud':'🚀 Registrar Solicitud';}
  function hydrate(){const draft=readCreationDraft(user.correo);if(!draft)return;const r=draft.request;selectTipo.value=r.tipo;inputFecha.value=r.fechaProgramada;metadata[2].value=r.prioridadSolicitada;metadata[3].value=r.descripcion;if(r.tipo==='Intendencia')grupoFecha.classList.add('is-visible');lock();}
  button.disabled=true;
  getSelfContext(controller.signal).then(async value=>{
    if(controller.signal.aborted)return;
    if(value?.canCreate!==true||!value.csrfToken)throw new Error('FORBIDDEN');context=value;hydrate();lock();
    const draft=readCreationDraft(user.correo);
    if(draft){const state=await getCreationStatus(draft.request.operationId,controller.signal).catch(error=>{if(error.code==='NOT_FOUND')return null;throw error;});
      const missing=draft.request.files.filter(f=>!state?.uploadedIndexes?.includes(f.index));
      status(state?.state==='CONFIRMADO'?'Tu solicitud está confirmada. Pulsa Reintentar para recuperar su folio.':`Solicitud pendiente. Reintenta con los archivos faltantes: ${missing.map(f=>f.name).join(', ')||'ninguno'}.`,'error');
      const reset=document.createElement('button');reset.type='button';reset.textContent='Comenzar otro borrador';reset.addEventListener('click',async()=>{if(busy||done)return;try{await discardCreationDraft(user.correo,controller.signal);reset.remove();form.reset();lock();status('Puedes completar una nueva solicitud.');}catch{status('Primero recupera la solicitud pendiente para evitar duplicados.','error');}});message.after(reset);
    }
  }).catch(()=>status('No se pudo verificar tu acceso. Recarga la página para reintentar.','error'));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||done||!context)return;
    if(!readCreationDraft(user.correo)&&!form.reportValidity())return;
    const files=Array.from(fileInput.files||[]),invalid=validateFiles(files);
    if(invalid){fileError.textContent=invalid;return;}
    if(files.length&&!context.canUpload){status('Los adjuntos no están disponibles. Conserva tus archivos y reintenta más tarde.','error');return;}
    busy=true;lock();status('Preparando tu solicitud…');
    try{
      await prepareCreationDraft(user.correo,{tipo:selectTipo.value,descripcion:metadata[3].value.trim(),prioridadSolicitada:metadata[2].value,fechaProgramada:inputFecha.value||''},files);
      lock();const result=await completeCreationDraft(user.correo,files,context.csrfToken,controller.signal,text=>status(text));
      if(controller.signal.aborted)return;
      done=true;status(`✅ Solicitud ${result.ticket.id} registrada. Redirigiendo a Mis Solicitudes…`,'success');
      timer=setTimeout(()=>{if(!controller.signal.aborted)window.location.hash='#validar-solicitudes';},2500);
    }catch(error){status(error.code==='FILE_REQUIRED'?'Selecciona los archivos originales faltantes y reintenta.':'No se pudo confirmar la solicitud. Tus datos se conservaron; reintenta para recuperar el mismo registro.','error');}
    finally{busy=false;if(!controller.signal.aborted)lock();}
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

export const render = renderSolicitudesWidget;
