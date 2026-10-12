import {getAdminContext,listAdminTickets,getAdminCatalogs,getAdminTicket,assignAdminTicket,escapeText as esc,safeAttachmentUrl,filterTickets} from '../services/ticketsAdminService.js';

const pendingOperations=new Map();
const messages={FORBIDDEN:'No tienes permiso para administrar solicitudes internas.',CONFLICT:'Otro administrador modificó esta solicitud. Tu edición se conserva; carga la versión actual antes de guardar.',PENDING_OPERATION:'Hay una asignación pendiente de confirmar. Reintenta la operación original.',VALIDATION:'Revisa responsable, prioridad y fecha de compromiso.',NOT_FOUND:'La solicitud ya no está disponible.',DUPLICATE_ID:'El folio está duplicado en la fuente. Requiere revisión.',OPERATION_REUSED:'La operación ya está registrada con otros datos.',BUSY:'El sistema está ocupado. Reintenta en unos segundos.'};
function errorMessage(error){return messages[error.code]||'No se pudo confirmar la operación. Reintenta en unos segundos.';}

export async function render(container) {
 const controller=new AbortController();const {signal}=controller;
 window.addEventListener('hashchange',()=>controller.abort(),{once:true});
 const current=()=>!signal.aborted&&container.isConnected;
 async function handleSession(error){if(error.status===401){const {getAuthenticatedUser}=await import('../services/authService.js');await getAuthenticatedUser(true);window.location.hash='#inicio';return true;}return false;}
 container.innerHTML='<section class="ticket-admin"><h1>Administrar solicitudes internas</h1><p role="status">Consultando permisos…</p></section>';
 let context,tickets,catalogs;
 try{
  context=await getAdminContext(signal);if(!current())return;
  if(!context.canAdmin){container.innerHTML=`<section class="ticket-admin"><h1>Administrar solicitudes internas</h1><p role="alert">${messages.FORBIDDEN}</p></section>`;return;}
  [tickets,catalogs]=await Promise.all([listAdminTickets(signal),getAdminCatalogs(signal)]);if(!current())return;
 }catch(error){if(signal.aborted)return;if(await handleSession(error))return;container.innerHTML=`<section class="ticket-admin"><h1>Administrar solicitudes internas</h1><p role="alert">${esc(errorMessage(error))}</p><button type="button" id="tickets-retry">Reintentar</button></section>`;container.querySelector('#tickets-retry').onclick=()=>render(container);return;}
 const filters={};
 container.innerHTML=`<section class="ticket-admin"><h1>Administrar solicitudes internas</h1><p>Consulta y asigna responsable, prioridad y fecha de compromiso.</p><div class="ticket-filters"><label>Buscar<input id="ticket-query" type="search" placeholder="Folio, solicitante o descripción"></label>${['estado','prioridad','urgencia','responsable','tipo','area'].map(key=>`<label>${({estado:'Estado',prioridad:'Prioridad asignada',urgencia:'Urgencia solicitada',responsable:'Responsable',tipo:'Tipo',area:'Área'})[key]}<select data-filter="${key}"><option value="">Todos</option>${[...new Set(tickets.map(t=>t[key]).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('')}</div><p id="ticket-count" role="status"></p><div class="ticket-admin-layout"><div class="ticket-table-wrap"><table class="ticket-table"><caption>Solicitudes internas</caption><thead><tr><th scope="col">Solicitud</th><th scope="col">Fecha</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col">Urgencia solicitada</th><th scope="col">Prioridad asignada</th><th scope="col">Responsable</th><th scope="col">Compromiso</th></tr></thead><tbody></tbody></table></div><section id="ticket-detail" aria-label="Detalle de la solicitud"><p>Selecciona una solicitud para ver su detalle.</p></section></div></section>`;
 const body=container.querySelector('tbody');const detail=container.querySelector('#ticket-detail');let selection=0;
 function paint(){const found=filterTickets(tickets,filters);container.querySelector('#ticket-count').textContent=`${found.length} de ${tickets.length} solicitudes`;body.innerHTML=found.length?found.map(t=>`<tr><td><button type="button" class="ticket-open" data-id="${esc(t.id)}">${esc(t.id)}</button><span>${esc(t.tipo)}</span></td><td>${esc(t.fecha)}</td><td>${esc(t.solicitante)}<span>${esc(t.area)}</span></td><td>${esc(t.estado)}</td><td>${esc(t.urgencia)}</td><td>${esc(t.prioridad)}</td><td>${esc(t.responsable)}</td><td>${esc(t.fechaCompromiso||'Sin fecha')}</td></tr>`).join(''):'<tr><td colspan="8">No hay solicitudes que coincidan con los filtros.</td></tr>';}
 paint();container.querySelector('#ticket-query').addEventListener('input',e=>{filters.query=e.target.value;paint();});container.querySelectorAll('[data-filter]').forEach(select=>select.addEventListener('change',()=>{filters[select.dataset.filter]=select.value;paint();}));
 body.addEventListener('click',e=>{const button=e.target.closest('[data-id]');if(button)openTicket(button.dataset.id);});
 async function openTicket(id){
  const request=++selection;detail.innerHTML='<p role="status">Cargando detalle…</p>';
  try{const ticket=await getAdminTicket(id,signal);if(current()&&request===selection)paintDetail(ticket);}catch(error){if(signal.aborted)return;if(await handleSession(error))return;if(request===selection)detail.innerHTML=`<p role="alert">${esc(errorMessage(error))}</p>`;}
 }
 function paintDetail(ticket){
  const links=String(ticket.adjuntos||'').split(/\s+/).filter(Boolean).map(value=>{const safe=safeAttachmentUrl(value);return safe?`<li><a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">Abrir adjunto en Google Drive</a></li>`:`<li>${esc(value)}</li>`;}).join('');
  const terminal=['RESUELTO','CERRADO','CANCELADO'].includes(ticket.estado);
  if(ticket.pendingOperation)pendingOperations.set(ticket.id,ticket.pendingOperation);
  const previous=pendingOperations.get(ticket.id);const edits=previous?.changes||{responsable:ticket.responsable,prioridad:ticket.prioridad,fechaCompromiso:ticket.fechaCompromiso,observacion:ticket.observaciones};
  const date=/^\d{4}-\d{2}-\d{2}$/.test(edits.fechaCompromiso)?edits.fechaCompromiso:'';
  detail.innerHTML=`<h2>${esc(ticket.id)}</h2><dl><dt>Solicitante</dt><dd>${esc(ticket.solicitante)} · ${esc(ticket.correo)}</dd><dt>Área y tipo</dt><dd>${esc(ticket.area)} · ${esc(ticket.tipo)}</dd><dt>Fecha de solicitud</dt><dd>${esc(ticket.fecha)} ${esc(ticket.hora)}</dd><dt>Descripción original</dt><dd class="ticket-description">${esc(ticket.descripcion)}</dd><dt>Urgencia solicitada</dt><dd>${esc(ticket.urgencia||'Sin dato')}</dd><dt>Plazo solicitado</dt><dd>${esc(ticket.plazo||'Sin dato')}</dd><dt>Estado actual</dt><dd>${esc(ticket.estado)}</dd></dl>${links?`<h3>Adjuntos</h3><ul>${links}</ul>`:''}<form id="ticket-assignment"><fieldset ${terminal?'disabled':''}><legend>Asignación</legend><label>Responsable<select name="responsable" required><option value="">Selecciona responsable</option>${catalogs.responsables.map(v=>`<option value="${esc(v)}" ${v===edits.responsable?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>Prioridad asignada<select name="prioridad" required><option value="">Selecciona prioridad</option>${catalogs.prioridades.map(v=>`<option value="${esc(v)}" ${v===edits.prioridad?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>Fecha de compromiso<input name="fechaCompromiso" type="date" value="${esc(date)}" required></label><label>Observaciones<textarea name="observacion" maxlength="4000" rows="4">${esc(edits.observacion)}</textarea></label><button type="submit">Guardar asignación</button></fieldset></form><p id="ticket-feedback" role="status" aria-live="polite">${terminal?'Esta solicitud está terminada y no permite asignación.':''}</p><button type="button" id="ticket-refresh">Cargar versión actual y descartar edición</button>`;
  const form=detail.querySelector('form');const fieldset=form.querySelector('fieldset');const feedback=detail.querySelector('#ticket-feedback');const refresh=detail.querySelector('#ticket-refresh');let saving=false;
  if(previous){feedback.textContent='Hay un guardado sin confirmar. Reintenta con los mismos datos.';form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=true);refresh.disabled=true;}
  refresh.addEventListener('click',()=>{if(saving)return;pendingOperations.delete(ticket.id);openTicket(ticket.id);});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(saving||terminal)return;
   const values=Object.fromEntries(new FormData(form));
   const operation=pendingOperations.get(ticket.id)||{operationId:crypto.randomUUID(),ticketId:ticket.id,expectedVersion:ticket.version,changes:values};
   pendingOperations.set(ticket.id,operation);saving=true;fieldset.disabled=true;refresh.disabled=true;feedback.textContent='Guardando asignación…';
   try{
    const result=await assignAdminTicket(operation,context.csrfToken,signal);pendingOperations.delete(ticket.id);
    if(!current()||selection!==requestSelection)return;
    const index=tickets.findIndex(t=>t.id===ticket.id);if(index>=0)tickets[index]=result.ticket;paint();paintDetail(result.ticket);detail.querySelector('#ticket-feedback').textContent='Asignación guardada y registrada en la bitácora.';
   }catch(error){
    if(signal.aborted)return;if(await handleSession(error))return;
    if(selection!==requestSelection)return;
    const known=error.operationPending===false&&[403,404,409,422].includes(error.status);
    if(known){pendingOperations.delete(ticket.id);form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=false);refresh.disabled=false;}
    else{form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=true);feedback.textContent='No se pudo confirmar el guardado. Reintenta con los mismos datos.';}
    if(known)feedback.textContent=errorMessage(error);
   }finally{saving=false;if(current()&&selection===requestSelection)fieldset.disabled=terminal;}
  });
  const requestSelection=selection;
 }
}
