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
 const filters={};let grouping=null;
 const knownStates=['NUEVO','ASIGNADO','EN PROCESO','EN ESPERA','RESUELTO','CERRADO','CANCELADO'];
 const stateLabels={NUEVO:'Nuevas',ASIGNADO:'Asignadas','EN PROCESO':'En proceso','EN ESPERA':'En espera',RESUELTO:'Resueltas',CERRADO:'Cerradas',CANCELADO:'Canceladas'};
 const dimensionLabels={estado:'Estado',prioridad:'Prioridad asignada',urgencia:'Urgencia solicitada',responsable:'Responsable',tipo:'Tipo',area:'Área solicitante'};
 const stateOf=t=>String(t.estado||'').trim().toUpperCase()||'SIN ESTADO';
 const isPending=t=>stateOf(t)==='NUEVO'||(!['RESUELTO','CERRADO','CANCELADO'].includes(stateOf(t))&&['','SIN ASIGNAR'].includes(String(t.responsable||'').trim().toUpperCase()));
 const groupValue=(t,key)=>String(t[key]||'').trim()||({responsable:'Sin responsable',prioridad:'Sin prioridad',tipo:'Sin tipo',area:'Sin área'})[key];
 const columns='<tr><th scope="col">Solicitud</th><th scope="col">Fecha</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col">Urgencia solicitada</th><th scope="col">Prioridad asignada</th><th scope="col">Responsable</th><th scope="col">Compromiso</th></tr>';
 container.innerHTML=`<section class="ticket-admin">
  <header class="ticket-executive-heading"><div><h1>Administrar solicitudes internas</h1><p>Estado general y solicitudes que requieren atención.</p></div></header>
  <section id="ticket-dashboard" class="ticket-panel" aria-labelledby="ticket-dashboard-title">
   <div class="ticket-panel-heading"><h2 id="ticket-dashboard-title">Estado de las solicitudes</h2><span id="ticket-total" class="ticket-counter"></span></div>
   <div id="ticket-states" class="ticket-state-grid"></div>
   <div class="ticket-distribution"><label>Distribución<select id="ticket-group">${['responsable','prioridad','tipo','area'].map(key=>`<option value="${key}">Por ${dimensionLabels[key].toLocaleLowerCase('es')}</option>`).join('')}</select></label><div id="ticket-groups" class="ticket-group-grid"></div></div>
  </section>
  <section id="ticket-pending" class="ticket-panel ticket-pending" aria-labelledby="ticket-pending-title">
   <div class="ticket-panel-heading"><div><h2 id="ticket-pending-title">Nuevas solicitudes por asignar</h2><p>Siempre visibles, independientemente de la agrupación seleccionada.</p></div><span id="ticket-pending-count" class="ticket-counter" role="status"></span></div>
   <div class="ticket-table-wrap"><table class="ticket-table"><caption class="ticket-sr-only">Solicitudes pendientes de asignación</caption><thead><tr><th scope="col">Solicitud / fecha</th><th scope="col">Solicitante</th><th scope="col">Solicitud</th><th scope="col">Urgencia</th><th scope="col">Acción</th></tr></thead><tbody id="ticket-pending-body"></tbody></table></div>
   <section id="ticket-detail" class="ticket-detail-panel" aria-label="Detalle de la solicitud"><p>Selecciona una solicitud para ver su detalle y asignación.</p></section>
  </section>
  <section class="ticket-panel" aria-labelledby="ticket-subset-title">
   <div class="ticket-panel-heading"><div><h2 id="ticket-subset-title">Todas las solicitudes</h2><p id="ticket-count" role="status"></p></div><button type="button" id="ticket-show-all" class="ticket-secondary">Ver todas</button></div>
   <div class="ticket-filters"><label>Buscar<input id="ticket-query" type="search" placeholder="Folio, solicitante o descripción"></label>${['estado','prioridad','urgencia','responsable','tipo','area'].map(key=>`<label>${dimensionLabels[key]}<select data-filter="${key}"><option value="">Todos</option>${[...new Set(tickets.map(t=>t[key]).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('')}</div>
   <div class="ticket-table-wrap"><table class="ticket-table"><caption class="ticket-sr-only">Subconjunto de solicitudes internas</caption><thead>${columns}</thead><tbody id="ticket-subset-body"></tbody></table></div>
  </section>
 </section>`;
 const body=container.querySelector('#ticket-subset-body');const detail=container.querySelector('#ticket-detail');let selection=0;
 function ticketRows(found,pending=false){return found.map(t=>pending?
  `<tr><td>${esc(t.id)}<span>${esc(t.fecha)}</span></td><td>${esc(t.solicitante)}<span>${esc(t.area)}</span></td><td><div class="ticket-pending-description">${esc(t.descripcion)}</div><span>${esc(t.tipo)}</span></td><td>${esc(t.urgencia)}</td><td><button type="button" data-id="${esc(t.id)}" aria-label="Asignar solicitud ${esc(t.id)}">Asignar</button></td></tr>`:
  `<tr><td><button type="button" class="ticket-open" data-id="${esc(t.id)}">${esc(t.id)}</button><span>${esc(t.tipo)}</span></td><td>${esc(t.fecha)}</td><td>${esc(t.solicitante)}<span>${esc(t.area)}</span></td><td>${esc(t.estado)}</td><td>${esc(t.urgencia)}</td><td>${esc(t.prioridad)}</td><td>${esc(t.responsable||'Sin responsable')}</td><td>${esc(t.fechaCompromiso||'Sin fecha')}</td></tr>`).join('');}
 function paint(){
  container.querySelector('#ticket-total').textContent=`${tickets.length} solicitudes`;
  const states=[...new Set([...knownStates,...tickets.map(stateOf)])];
  container.querySelector('#ticket-states').innerHTML=states.map(state=>`<button type="button" class="ticket-state" data-state="${esc(state)}" aria-pressed="${grouping?.key==='estado'&&grouping.value===state}"><span>${esc(stateLabels[state]||state)}</span><strong data-count>${tickets.filter(t=>stateOf(t)===state).length}</strong></button>`).join('');
  const key=container.querySelector('#ticket-group').value;
  const groups=[...new Set(tickets.map(t=>groupValue(t,key)))].map(value=>({value,count:tickets.filter(t=>groupValue(t,key)===value).length})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,'es'));
  container.querySelector('#ticket-groups').innerHTML=groups.length?groups.map(g=>`<button type="button" class="ticket-group" data-group-value="${esc(g.value)}" aria-pressed="${grouping?.key===key&&grouping.value===g.value}"><span class="ticket-group-label"><span>${esc(g.value)}</span><span>${g.count} · ${Math.round(g.count/tickets.length*100)}%</span></span><span class="ticket-group-track"><span class="ticket-group-fill" style="width:${g.count/tickets.length*100}%"></span></span></button>`).join(''):'<p>No hay solicitudes para distribuir.</p>';
  const pending=tickets.filter(isPending);
  container.querySelector('#ticket-pending-count').textContent=`${pending.length} pendientes`;
  container.querySelector('#ticket-pending-body').innerHTML=pending.length?ticketRows(pending,true):'<tr><td colspan="5">No hay solicitudes pendientes de asignación.</td></tr>';
  const subset=grouping?tickets.filter(t=>(grouping.key==='estado'?stateOf(t):groupValue(t,grouping.key))===grouping.value):tickets;
  const found=filterTickets(subset,filters);
  container.querySelector('#ticket-subset-title').textContent=grouping?`${dimensionLabels[grouping.key]} · ${stateLabels[grouping.value]||grouping.value}`:'Todas las solicitudes';
  container.querySelector('#ticket-count').textContent=`${found.length} de ${tickets.length} solicitudes`;
  body.innerHTML=found.length?ticketRows(found):'<tr><td colspan="8">No hay solicitudes que coincidan con los filtros.</td></tr>';
 }
 function resetFilters(){Object.keys(filters).forEach(key=>delete filters[key]);container.querySelector('#ticket-query').value='';container.querySelectorAll('[data-filter]').forEach(select=>select.value='');}
 paint();
 container.querySelector('#ticket-group').addEventListener('change',paint);
 container.querySelector('#ticket-query').addEventListener('input',e=>{filters.query=e.target.value;paint();});
 container.querySelectorAll('[data-filter]').forEach(select=>select.addEventListener('change',()=>{filters[select.dataset.filter]=select.value;paint();}));
 container.querySelector('#ticket-show-all').addEventListener('click',()=>{grouping=null;resetFilters();paint();});
 container.querySelector('.ticket-admin').addEventListener('click',e=>{
  const button=e.target.closest('[data-id]');if(button){openTicket(button.dataset.id);return;}
  const state=e.target.closest('[data-state]');const group=e.target.closest('[data-group-value]');
  if(state||group){grouping=state?{key:'estado',value:state.dataset.state}:{key:container.querySelector('#ticket-group').value,value:group.dataset.groupValue};resetFilters();paint();}
 });
 async function openTicket(id){
  const request=++selection;detail.innerHTML='<p role="status">Cargando detalle…</p>';
  try{const ticket=await getAdminTicket(id,signal);if(current()&&request===selection){const index=tickets.findIndex(t=>t.id===id);if(index>=0)tickets[index]=ticket;paint();paintDetail(ticket);detail.scrollIntoView?.({block:'nearest',behavior:'smooth'});}}catch(error){if(signal.aborted)return;if(await handleSession(error))return;if(request===selection)detail.innerHTML=`<p role="alert">${esc(errorMessage(error))}</p>`;}
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
    if(!current())return;
    const index=tickets.findIndex(t=>t.id===ticket.id);if(index>=0)tickets[index]=result.ticket;paint();
    if(selection!==requestSelection)return;
    paintDetail(result.ticket);detail.querySelector('#ticket-feedback').textContent='Asignación guardada y registrada en la bitácora.';
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
