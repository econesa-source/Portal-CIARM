import {requestCompras,comprasUiEnabled} from '../services/comprasClient.js';

const TABS=[
 {id:'crear',label:'Solicitar compra',query:'contextoSolicitud',permission:'COMPRAS_CREAR'},
 {id:'mis',label:'Mis pedidos',query:'misPedidos',permission:'COMPRAS_MIS'},
 {id:'elegir',label:'Elegir cotización',query:'alternativas',permission:'COMPRAS_ELEGIR'},
 {id:'aprobar',label:'Aprobar y firmar',query:'pendientesAprobacion',permission:'COMPRAS_FIRMAR'},
 {id:'recibir',label:'Declarar recepción',query:'recepcionesAsignadas',permission:'COMPRAS_RECIBIR_ASIGNADA'}
];
const value=x=>String(x??'');
const escapeHtml=x=>value(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errText=e=>({'SERVICE_UNAVAILABLE':'Compras aún no está habilitado en el Portal.','FORBIDDEN':'No tenés permiso para esta operación.','CSRF_NOT_READY':'Volvé a cargar esta sección antes de enviar.','REPLAY':'El servidor ya recibió esta petición. Consultá su estado antes de repetirla.'})[e?.code]||'No se pudo completar. Comprobá su estado antes de reintentar.';
const key=()=> 'PORTAL_'+crypto.randomUUID().replace(/-/g,'');
const selectOptions=(a,selected='')=>(Array.isArray(a)?a:[]).map(x=>{
 const code=typeof x==='string'?x:value(x.codigo||x.id||x.valor);
 const label=typeof x==='string'?x:value(x.etiqueta||x.nombre||code);
 return '<option value="'+escapeHtml(code)+'"'+(code===selected?' selected':'')+'>'+escapeHtml(label)+'</option>';
}).join('');
function note(el,message,error=false){
 let node=el.querySelector('.compras-alert');
 if(!node){node=document.createElement('p');node.className='compras-alert';node.setAttribute('role','status');el.prepend(node);}
 node.textContent=message;node.style.color=error?'#a32028':'#0b695c';
}
function line(units){
 return '<div class="compras-line"><label>Descripción / especificación<input name="descripcion" required maxlength="500"></label>'+
 '<div class="compras-grid"><label>Cantidad<input name="cantidad" type="number" min="0.001" step="any" value="1" required></label>'+
 '<label>Unidad<select name="unidad" required><option value="">Seleccionar</option>'+selectOptions(units)+'</select></label></div>'+ 
 '<label class="compras-importe" hidden>Importe efectivamente pagado (MXN)<input type="number" name="importeDeclarado" step="0.01" min="0.01"></label></div>';
}
function renderCrear(p,ctx){
 p.innerHTML='<h3>Solicitar compra</h3><p>Compras se encarga de cotizar y clasificar cada renglón. No necesitás conocer cuentas ni partidas.</p>'+
 '<form id="compras-crear"><div class="compras-grid"><label>Tipo de solicitud<select name="tipoSolicitud" required><option value="">Seleccionar tipo</option>'+selectOptions(ctx.tipos)+'</select></label>'+
 '<label>Centro de costos<select name="centroCostos" required><option value="">Seleccionar</option>'+selectOptions(ctx.areas,ctx.areaSugerida)+'</select></label>'+
 '<label>Fecha necesaria<input type="date" name="fechaGeneral" required></label>'+
 '<label>Responsable de recepción<input name="responsableRecepcion" type="email" value="'+escapeHtml(ctx.email)+'" required></label></div>'+
 '<label>Área o contexto de uso<textarea name="areaContexto" maxlength="200"></textarea></label><h4>Artículos</h4>'+
 '<div id="compras-lineas">'+line(ctx.unidades)+'</div><button class="btn-secondary" type="button" id="compras-add">+ Artículo</button>'+
 '<label>Vínculo HTTPS del comprobante o cotización (si corresponde)<input name="adjuntosVinculos" type="url" placeholder="https://"></label>'+
 '<button type="submit">Enviar solicitud</button></form>';
 const form=p.querySelector('form'),container=p.querySelector('#compras-lineas');let clave=key();
 const isReintegro=()=>form.elements.tipoSolicitud.value==='Reintegro de gasto';
 function syncAmounts(){[...container.querySelectorAll('.compras-importe')].forEach(label=>{label.hidden=!isReintegro();label.querySelector('input').required=isReintegro();});}
 form.elements.tipoSolicitud.addEventListener('change',syncAmounts);syncAmounts();
 p.querySelector('#compras-add').addEventListener('click',()=>{
  if(container.children.length>=20)return;
  container.insertAdjacentHTML('beforeend',line(ctx.unidades));syncAmounts();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const fields=Object.fromEntries(new FormData(form).entries());
  const renglones=[...container.children].map(node=>{
   const item={descripcion:node.querySelector('[name=descripcion]').value.trim(),
    cantidad:Number(node.querySelector('[name=cantidad]').value),unidad:node.querySelector('[name=unidad]').value};
   if(isReintegro())item.importeDeclarado=Number(node.querySelector('[name=importeDeclarado]').value);
   return item;
  });
  const payload={tipoSolicitud:fields.tipoSolicitud,centroCostos:fields.centroCostos,fechaGeneral:fields.fechaGeneral,
   responsableRecepcion:fields.responsableRecepcion,areaContexto:fields.areaContexto,renglones,claveEnvio:clave};
  if(fields.adjuntosVinculos)payload.adjuntosVinculos=fields.adjuntosVinculos;
  if((isReintegro()||fields.tipoSolicitud==='Compra - ya tengo cotización')&&
    !/^https:\/\//i.test(fields.adjuntosVinculos||'')){
   note(p,'Adjuntá un vínculo HTTPS del comprobante o cotización correspondiente.',true);return;
  }
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   const result=await requestCompras('crearSolicitud',payload);
   note(p,'Solicitud registrada'+(result?.idSolicitud?' · '+result.idSolicitud:''));clave=key();
   form.reset();container.innerHTML=line(ctx.unidades);syncAmounts();
  }catch(error){note(p,errText(error),true);}
  finally{button.disabled=false;}
 });
}
function renderMis(p,data,session,codes){
 const rows=Array.isArray(data)?data:[];
 const email=value(session?.correo).trim().toLowerCase();
 const permitted=codes.has('COMPRAS_CANCELAR');
 p.innerHTML='<h3>Mis pedidos</h3><p>Seguimiento de HT06, actualizado desde Compras. La cancelación afecta únicamente el remanente de una OC, no lo ya comprado o recibido.</p>'+
 '<label>Buscar por solicitud, OC, centro o estado<input type="search" id="compras-buscar"></label>'+
 '<div class="compras-scroll"><table><thead><tr><th>Solicitud</th><th>Centro</th><th>Estado</th><th>OC</th><th>Compra / recepción</th><th>Acción</th></tr></thead><tbody></tbody></table></div>';
 const body=p.querySelector('tbody'),find=p.querySelector('#compras-buscar');
 function isOwn(r){return value(r['Correo solicitante']).trim().toLowerCase()===email;}
 function cancelable(r){
  return permitted&&isOwn(r)&&/^OC-\d+$/.test(value(r['ID OC']))&&
    !/cancelaci[oó]n|cancelad/i.test(value(r['Estado compra visible']));
 }
 function paint(){
  const term=find.value.trim().toLowerCase();
  const filtered=rows.filter(r=>['ID Solicitud','ID OC','Centro de costos','Estado','Estado compra visible'].some(k=>value(r[k]).toLowerCase().includes(term)));
  body.innerHTML=filtered.map(r=>'<tr><td>'+escapeHtml(r['ID Solicitud'])+'</td><td>'+escapeHtml(r['Centro de costos'])+
   '</td><td>'+escapeHtml(r.Estado)+'</td><td>'+escapeHtml(r['ID OC'])+'</td><td>'+escapeHtml(r['Estado compra visible'])+
   '</td><td>'+(cancelable(r)?
    '<details><summary>Cancelar remanente</summary><form data-cancel="'+escapeHtml(r['ID Solicitud'])+'">'+
    '<label>Motivo<textarea name="motivo" minlength="8" required maxlength="800"></textarea></label>'+
    '<button type="submit">Solicitar cancelación</button></form></details>':'—')+'</td></tr>').join('')||
   '<tr><td colspan="6">No hay pedidos para mostrar.</td></tr>';
 }
 body.addEventListener('submit',async e=>{
  const form=e.target.closest('form[data-cancel]');
  if(!form)return;
  e.preventDefault();
  const id=form.dataset.cancel,motivo=form.elements.motivo.value.trim();
  if(motivo.length<8){note(p,'El motivo de cancelación debe tener al menos 8 caracteres.',true);return;}
  if(!window.confirm('¿Solicitar la cancelación del remanente pendiente de '+id+'? No anula entregas previas.'))return;
  const button=form.querySelector('button');button.disabled=true;
  try{
   await requestCompras('cancelarRemanente',{idSolicitud:id,motivo});
   const row=rows.find(r=>r['ID Solicitud']===id);
   if(row)row['Estado compra visible']='Cancelación de remanente solicitada';
   paint();note(p,'Cancelación solicitada; Compras deberá completar su registro.');
  }catch(error){note(p,errText(error),true);button.disabled=false;}
 });
 find.addEventListener('input',paint);paint();
}
function renderAlternativas(p,data){
 p.innerHTML='<h3>Elegir cotización</h3><p>Debés elegir explícitamente una alternativa completa y justificarla. La compra todavía requerirá aprobación.</p>';
 const list=Array.isArray(data)?data:[];
 if(!list.length){p.insertAdjacentHTML('beforeend','<p>No hay alternativas pendientes.</p>');return;}
 list.forEach(s=>{
  const card=document.createElement('div');card.className='compras-item';
  const alternatives=Array.isArray(s.alternativas)?s.alternativas:[];
  card.innerHTML='<b>'+escapeHtml(s.idSolicitud)+'</b> · '+escapeHtml(s.descripcion)+
   '<form><fieldset><legend>Alternativas completas</legend>'+
   alternatives.map(a=>'<label><input type="radio" name="alternativa" value="'+escapeHtml(a.idAlternativa)+'" required> '+escapeHtml(a.idAlternativa)+' · $'+escapeHtml(a.total)+' MXN</label>').join('')+
   '</fieldset><label>Justificación<textarea name="motivo" minlength="8" required></textarea></label>'+
   '<button type="submit">Confirmar elección</button></form>';
  p.append(card);
  const form=card.querySelector('form');
  form.addEventListener('submit',async e=>{
   e.preventDefault();const chosen=form.querySelector('[name=alternativa]:checked'),button=form.querySelector('button');
   if(!chosen){note(card,'Seleccioná una alternativa.',true);return;}
   button.disabled=true;
   try{
    await requestCompras('elegirAlternativa',{idSolicitud:s.idSolicitud,idAlternativa:chosen.value,motivo:form.elements.motivo.value});
    card.remove();note(p,'Alternativa elegida; pendiente de autorización.');
   }catch(error){note(card,errText(error),true);button.disabled=false;}
  });
 });
}
function renderAprobaciones(p,data,canSign,canReassign){
 p.innerHTML='<h3>Aprobar y firmar</h3><p>Cada decisión se revalida en HT06: firmante, centro, ruta, presupuesto y cotización elegida.</p>';
 const rows=Array.isArray(data)?data:[];
 if(!canSign)return;
 if(!rows.length){p.insertAdjacentHTML('beforeend','<p>No hay solicitudes de compra pendientes de tu firma.</p>');return;}
 rows.forEach(s=>{
  const card=document.createElement('div');card.className='compras-item';
  const renglones=Array.isArray(s._renglones)?s._renglones:[];
  const donantes=Array.isArray(s._donantes)?s._donantes:[];
  const puedeReasignar=canReassign&&s['Ruta aprobación']==='DIRECCION_ACADEMICA'&&s._esReintegro!==true&&
   donantes.length>0&&renglones.length>0;
  const keyReasignacion=key();
  card.innerHTML='<b>'+escapeHtml(s['ID Solicitud'])+'</b><p>Centro: '+escapeHtml(s['Centro de costos'])+
   ' · Ruta: '+escapeHtml(s['Ruta aprobación'])+'</p><p>Importe: '+escapeHtml(s['Monto cotizado total'])+' MXN</p>'+
   '<form><label>Decisión<select name="decision" required><option value="">Seleccionar explícitamente</option>'+
   '<option value="Aprobar">Aprobar</option><option value="Rechazar">Rechazar</option>'+
   (puedeReasignar?'<option value="Reasignar y aprobar">Reasignar y aprobar (Dirección Académica)</option>':'')+
   '</select></label><label>Motivo<textarea name="motivo"></textarea></label>'+
   (puedeReasignar?
    '<fieldset class="compras-rea" hidden><legend>Reasignación presupuestaria</legend>'+
    '<p>Seleccioná el artículo con insuficiencia, una partida donante y el importe. HT06 comprobará que pertenezcan al mismo agregado académico y que exista saldo disponible.</p>'+
    '<label>Artículo<select name="renglon" required>'+
    '<option value="">Elegir renglón</option>'+
    renglones.map(r=>'<option value="'+escapeHtml(r['ID Renglón'])+'">'+escapeHtml(r['ID Renglón'])+' — '+
      escapeHtml(r['Descripción / especificación'])+'</option>').join('')+
    '</select></label><label>Partida presupuestaria donante<select name="partidaOrigen" required>'+
    '<option value="">Seleccionar renglón primero</option></select></label>'+
    '<label>Importe a transferir (MXN)<input type="number" name="importe" step="0.01" min="0.01" required></label></fieldset>':'')+
   '<button type="submit">Confirmar decisión</button></form>';
  p.append(card);
  const form=card.querySelector('form');
  const extra=form.querySelector('.compras-rea');
  const motivoEl=form.elements.motivo;
  if(extra){
   const renglonSelect=form.elements.renglon,donanteSelect=form.elements.partidaOrigen;
   function updateDonantes(){
    const elegido=renglones.find(r=>r['ID Renglón']===renglonSelect.value);
    const candidatos=elegido?donantes.filter(d=>d.fuente===elegido['Fuente presupuestaria']&&
      d.partida!==elegido['Partida presupuestaria']):[];
    donanteSelect.innerHTML='<option value="">Seleccionar partida donante</option>'+
      candidatos.map(d=>'<option value="'+escapeHtml(d.partida)+'">'+escapeHtml(d.partida)+' · '+
      escapeHtml(d.fuente)+'</option>').join('');
   }
   renglonSelect.addEventListener('change',updateDonantes);
   form.elements.decision.addEventListener('change',()=>{
    const active=form.elements.decision.value==='Reasignar y aprobar';
    extra.hidden=!active;
    extra.querySelectorAll('input,select').forEach(ctrl=>{ctrl.required=active&&ctrl.name!=='idRenglon';});
    motivoEl.required=active||form.elements.decision.value==='Rechazar';
   });
   extra.querySelectorAll('input,select').forEach(ctrl=>{ctrl.required=false;});
  }else form.elements.decision.addEventListener('change',()=>{
   motivoEl.required=form.elements.decision.value==='Rechazar';
  });
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const decision=form.elements.decision.value,motivo=motivoEl.value.trim();
   if(!decision)return;
   if(decision!=='Aprobar'&&!motivo){note(card,'La decisión requiere un motivo.',true);return;}
   const payload={idSolicitud:s['ID Solicitud'],decision,motivo};
   if(decision==='Reasignar y aprobar'){
    const renglon=form.elements.renglon.value,partida=form.elements.partidaOrigen.value,
      importe=Number(form.elements.importe.value);
    if(!puedeReasignar||!renglon||!partida||!(importe>0)||!Number.isFinite(importe)){
     note(card,'Completá renglón, partida donante e importe positivo.',true);return;
    }
    payload.reasignacion={idRenglon:renglon,partidaOrigen:partida,importe,idempotencyKey:keyReasignacion};
   }
   if(!window.confirm('¿Confirmás '+decision+' para '+value(s['ID Solicitud'])+'?'))return;
   const button=form.querySelector('button[type=submit]');button.disabled=true;
   try{
    await requestCompras('decidirSolicitud',payload);
    card.remove();note(p,'Decisión registrada en HT06.');
   }catch(error){note(card,errText(error),true);button.disabled=false;}
  });
 });
}
function renderProrrogas(p,data){
 const rows=Array.isArray(data)?data:[];
 const section=document.createElement('section');section.className='compras-extras';
 section.innerHTML='<h3>Prórrogas de órdenes de compra</h3><p>Solamente pueden firmarlas los firmantes originales. Una firma no ejecuta una compra.</p>';
 if(!rows.length)section.insertAdjacentHTML('beforeend','<p>No hay prórrogas pendientes para tu firma.</p>');
 rows.forEach(r=>{
  const card=document.createElement('div');card.className='compras-item';
  card.innerHTML='<b>'+escapeHtml(r.idOC)+'</b> · '+escapeHtml(r.idSolicitud)+
   '<p>Nueva fecha: '+escapeHtml(r.nuevaFecha)+' · Motivo: '+escapeHtml(r.motivo)+'</p>'+
   '<button type="button">Firmar prórroga</button>';
  section.append(card);
  const button=card.querySelector('button');
  button.addEventListener('click',async()=>{
   if(!window.confirm('¿Confirmás tu firma de la prórroga para '+value(r.idOC)+'?'))return;
   button.disabled=true;
   try{
    await requestCompras('firmarProrroga',{idOC:r.idOC,clave:r.clave});
    card.remove();note(section,'Firma registrada; la aplicación corresponde a HT10.');
   }catch(error){note(card,errText(error),true);button.disabled=false;}
  });
 });
 p.append(section);
}
function renderExcepciones(p,data){
 const rows=Array.isArray(data)?data:[];
 const section=document.createElement('section');section.className='compras-extras';
 section.innerHTML='<h3>Excepciones de cotización (Dirección General)</h3><p>Autorización extraordinaria con fundamento obligatorio. No equivale a firmar una OC.</p>';
 if(!rows.length)section.insertAdjacentHTML('beforeend','<p>No hay excepciones pendientes de Dirección General.</p>');
 rows.forEach(r=>{
  const card=document.createElement('div');card.className='compras-item';
  card.innerHTML='<b>'+escapeHtml(r.idSolicitud)+'</b> · '+escapeHtml(r.centroCostos)+
   '<p>'+escapeHtml(r.descripcion)+'</p><p>Antecedente: '+escapeHtml(r.motivo)+'</p>'+
   '<form><label>Fundamento de autorización<textarea name="motivo" minlength="15" maxlength="1000" required></textarea></label>'+
   '<button type="submit">Autorizar excepción</button></form>';
  section.append(card);
  const form=card.querySelector('form');
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const motivo=form.elements.motivo.value.trim();
   if(motivo.length<15){note(card,'El fundamento debe tener al menos 15 caracteres.',true);return;}
   if(!window.confirm('¿Autorizás excepcionalmente esta cotización para '+value(r.idSolicitud)+'?'))return;
   const button=form.querySelector('button');button.disabled=true;
   try{
    await requestCompras('autorizarExcepcionCotizacion',{idSolicitud:r.idSolicitud,motivo});
    card.remove();note(section,'Excepción registrada; queda pendiente el circuito ordinario.');
   }catch(error){note(card,errText(error),true);button.disabled=false;}
  });
 });
 p.append(section);
}
function renderRecepciones(p,data){
 p.innerHTML='<h3>Declarar recepción</h3><p>Registrá las cantidades efectivamente recibidas y conformes; HT10 conciliará la recepción.</p>';
 const items=(Array.isArray(data)?data:[]).flatMap(s=>(Array.isArray(s.renglones)?s.renglones:[]).map(l=>({...l,idSolicitud:s.idSolicitud})));
 if(!items.length){p.insertAdjacentHTML('beforeend','<p>No tenés recepciones asignadas.</p>');return;}
 items.forEach(s=>{
  const card=document.createElement('div');card.className='compras-item';let clave=key();
  card.innerHTML='<b>'+escapeHtml(s.idSolicitud)+' / '+escapeHtml(s.idRenglon)+'</b><p>'+escapeHtml(s.descripcion)+
   '</p><form><div class="compras-grid"><label>Cantidad recibida<input name="cantidadRecibida" type="number" min="0.001" step="any" required></label>'+
   '<label>Cantidad conforme<input name="cantidadConforme" type="number" min="0" step="any" required></label>'+
   '<label>Fecha de recepción<input name="fechaRecepcion" type="date" required></label></div>'+
   '<label>Observación<textarea name="observacion"></textarea></label><button type="submit">Registrar declaración</button></form>';
  p.append(card);
  const form=card.querySelector('form');
  form.addEventListener('submit',async e=>{
   e.preventDefault();const fields=Object.fromEntries(new FormData(form).entries());
   const recibida=Number(fields.cantidadRecibida),conforme=Number(fields.cantidadConforme);
   if(!(recibida>0)||conforme<0||conforme>recibida){note(card,'La cantidad conforme no puede superar la recibida.',true);return;}
   const button=form.querySelector('button');button.disabled=true;
   try{
    await requestCompras('declararRecepcion',{idSolicitud:s.idSolicitud,idRenglon:s.idRenglon,
     cantidadRecibida:recibida,cantidadConforme:conforme,fechaRecepcion:fields.fechaRecepcion,
     observacion:fields.observacion,claveEnvio:clave});
    clave=key();card.remove();note(p,'Declaración recibida, pendiente de conciliación con HT10.');
   }catch(error){note(card,errText(error),true);button.disabled=false;}
  });
 });
}
const CSS='<style>.compras-shell{max-width:1050px;margin:0 auto;padding:18px;color:#262626}.compras-shell h2,.compras-shell h3{color:#26487f}' +
 '.compras-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.compras-tabs button{border:1px solid #26487f;background:white;color:#26487f;border-radius:7px;padding:10px;cursor:pointer}' +
 '.compras-tabs [aria-selected=true]{background:#26487f;color:white}.compras-body{padding:20px;border:1px solid #dce3eb;border-radius:9px;background:white}' +
 '.compras-body label{display:block;color:#26487f;font-weight:600;font-size:13px;margin:10px 0}.compras-body [hidden]{display:none!important}.compras-body input:not([type=radio]),.compras-body select,.compras-body textarea{display:block;box-sizing:border-box;width:100%;padding:9px;border:1px solid #c1cada;border-radius:6px}' +
 '.compras-body button{background:#26487f;color:white;padding:10px;border:0;border-radius:6px;cursor:pointer}.compras-body button:disabled{opacity:.45}' +
 '.compras-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.compras-item,.compras-line{border:1px solid #e0e7ef;border-radius:6px;margin:13px 0;padding:14px}' +
 '.compras-extras{border-top:1px solid #dce3eb;margin-top:26px;padding-top:16px}.compras-body details summary{color:#26487f;cursor:pointer;font-weight:600}.compras-body details textarea{min-width:180px}.compras-scroll{overflow:auto}.compras-body table{width:100%;border-collapse:collapse}.compras-body th,.compras-body td{text-align:left;padding:10px;border-bottom:1px solid #ddd}.compras-body th{background:#26487f;color:white}</style>';

export async function render(container,session){
 if(!container)return;
 const roles=session?.dm05?.enforced===true&&session.dm05.verified===true?new Set(session.dm05.codes||[]):new Set();
 if(!comprasUiEnabled()||!session?.correo||!roles.has('COMPRAS_TARJETA')){
  container.textContent='Compras todavía no está habilitado desde el Portal.';return;
 }
 const tabs=TABS.filter(t=>t.id==='mis'
  ?['COMPRAS_MIS','COMPRAS_AREA','COMPRAS_TODOS'].some(k=>roles.has(k))
  :t.id==='aprobar'?['COMPRAS_FIRMAR','COMPRAS_PRORROGA_FIRMAR','COMPRAS_EXCEPCION_COT'].some(k=>roles.has(k))
  :roles.has(t.permission));
 container.innerHTML=CSS+'<section class="compras-shell"><a href="#inicio">← Volver al inicio</a><h2>Compras</h2>'+
  '<p>Solicitud → Cotización → Elección → Aprobación → Compra → Recepción</p><nav class="compras-tabs" role="tablist"></nav><div class="compras-body" role="tabpanel"></div></section>';
 const nav=container.querySelector('.compras-tabs'),body=container.querySelector('.compras-body');
 let controller=null;
 async function choose(tab){
  controller?.abort();controller=new AbortController();
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab.id)));
  body.textContent='Consultando…';
  try{
   let data;
   let extras=[];
   if(tab.id==='aprobar'){
    const jobs=[];
    if(roles.has('COMPRAS_FIRMAR'))jobs.push(['ordinarias',requestCompras(tab.query,{},controller.signal)]);
    if(roles.has('COMPRAS_PRORROGA_FIRMAR'))jobs.push(['prorrogas',requestCompras('prorrogasPendientes',{},controller.signal)]);
    if(roles.has('COMPRAS_EXCEPCION_COT'))jobs.push(['excepciones',requestCompras('excepcionesPendientes',{},controller.signal)]);
    // Si falla una consulta autorizada, no mostrar una lista parcial como si fuera completa.
    extras=await Promise.all(jobs.map(async ([name,job])=>({name,data:await job})));
    data=extras.find(x=>x.name==='ordinarias')?.data||[];
   }else data=await requestCompras(tab.query,{},controller.signal);
   if(controller.signal.aborted)return;
   if(tab.id==='crear')renderCrear(body,data);
   if(tab.id==='mis')renderMis(body,data,session,roles);
   if(tab.id==='elegir')renderAlternativas(body,data);
   if(tab.id==='aprobar'){
    renderAprobaciones(body,data,roles.has('COMPRAS_FIRMAR'),roles.has('COMPRAS_REASIGNAR_ACAD'));
    const prorrogas=extras.find(x=>x.name==='prorrogas');
    const excepciones=extras.find(x=>x.name==='excepciones');
    if(prorrogas)renderProrrogas(body,prorrogas.data);
    if(excepciones)renderExcepciones(body,excepciones.data);
   }
   if(tab.id==='recibir')renderRecepciones(body,data);
  }catch(error){if(!controller.signal.aborted){body.textContent='';note(body,errText(error),true);}}
 }
 tabs.forEach(tab=>{
  const button=document.createElement('button');button.type='button';button.textContent=tab.label;
  button.dataset.tab=tab.id;button.setAttribute('role','tab');button.setAttribute('aria-selected','false');
  button.addEventListener('click',()=>choose(tab));nav.append(button);
 });
 window.addEventListener('hashchange',()=>controller?.abort(),{once:true});
 if(tabs.length)await choose(tabs[0]);else body.textContent='No hay acciones de Compras asignadas a tu perfil.';
}
