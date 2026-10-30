/** Timing kept only within a signed request. Never stores ticket content or actor. */
function ticketPerfClock(){
 var started=Date.now(),previous=started,stages={};
 return {
  mark:function(name){var now=Date.now();stages[name]=now-previous;previous=now;},
  snapshot:function(){var result={};Object.keys(stages).forEach(function(k){result[k]=stages[k];});result.total=Date.now()-started;return result;}
 };
}
function ticketPerfReply(reply,request,clock){
 if(request&&request.perfProbe===true)reply._perf=clock.snapshot();
 return reply;
}
/** Administración de solicitudes internas. Requiere puente PHP firmado. */
var ADMIN_TICKET_HEADERS = ['ID TICKET','FECHA SOLICITUD','HORA SOLICITUD','ÁREA SOLICITANTE','SOLICITANTE','CORREO SOLICITANTE','TIPO DE SOLICITUD','DESCRIPCIÓN','PRIORIDAD','RESPONSABLE','FECHA ASIGNACIÓN','FECHA COMPROMISO','ESTADO','FECHA INICIO','FECHA TERMINACIÓN','TIEMPO EJECUCIÓN','TIEMPO TOTAL','SLA','PUNTOS','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN','PRIORIDAD SOLICITADA','PLAZO SOLICITADO','ARCHIVOS ADJUNTOS'];
var ADMIN_JOURNAL_HEADERS = ['OPERACION','ESTADO','ACTOR','PAYLOAD HASH','TICKET','ANTES','DESPUES','FECHA','PAYLOAD'];

function adminFail(code, detail) { var error = new Error(detail ? code + ': ' + detail : code); error.adminCode = code; error.adminDetail = detail || ''; throw error; }
function adminHex(bytes) { return bytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function adminHash(value) { return adminHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)); }
function adminEqual(a,b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var diff=0; for(var i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
function adminNormalizeHeader(h) {
 return String(h||'')
  .trim()
  .replace(/[\u200B-\u200D\uFEFF]/g,'')
  .replace(/\u221A\u00C5|\u00C3\u0081/g,'A')
  .replace(/\u221A\u00CC|\u00C3\u0093/g,'O')
  .replace(/\u221A\u00DA|\u00C3\u009A/g,'U')
  .replace(/\u221A\u00C9|\u00C3\u0089/g,'E')
  .replace(/\u221A\u00CD|\u00C3\u008D/g,'I')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toUpperCase();
}
function adminTable(book,name,required,valuesOnly) {
 var sheet=book.getSheetByName(name); if(!sheet) adminFail('SCHEMA', 'hoja ' + name + ' no existe');
 var range=sheet.getDataRange();var rows=range.getValues();var formulas=valuesOnly?null:range.getFormulas();
 var headers=rows[0].map(function(v){return String(v).trim().replace(/[\u200B-\u200D\uFEFF]/g,'');});
 var normHeaders=headers.map(adminNormalizeHeader);
 required.forEach(function(h){
  var normH=adminNormalizeHeader(h);
  var first=normHeaders.indexOf(normH);
  var last=normHeaders.lastIndexOf(normH);
  if(first<0) adminFail('SCHEMA', 'falta ' + h + ' en ' + name + '; headers=' + headers.join('|'));
  if(first!==last) adminFail('SCHEMA', 'duplicado ' + h + ' en ' + name);
  headers[first]=h;
 });
 return {sheet:sheet,headers:headers,rows:rows,formulas:formulas};
}
function adminPermission(actor) {
 if(['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx','r.valencia@ciarm.edu.mx'].indexOf(actor)<0) return false;
 var table;
 try {
  table=adminTable(SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID),'Permisos de usuario',['Correo Ciarm','Status','Sistema de tickets'],true);
 } catch(e){}
 if(!table){
  return ['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx','r.valencia@ciarm.edu.mx'].indexOf(actor)>=0;
 }
 var matches=table.rows.slice(1).filter(function(row){return String(row[table.headers.indexOf('Correo Ciarm')]||'').trim().toLowerCase()===actor;});
 return matches.length===1 && String(matches[0][table.headers.indexOf('Status')]||'').trim().toLowerCase()==='activo' && (String(matches[0][table.headers.indexOf('Sistema de tickets')]||'').trim()==='Administrador' || actor==='r.valencia@ciarm.edu.mx');
}
function handleAdminEnvelope(envelope,signature) {
 var lock=LockService.getScriptLock();var locked=false,request,clock=ticketPerfClock();
 try {
  var secret=PropertiesService.getScriptProperties().getProperty('TICKETS_ADMIN_SECRET')||PropertiesService.getScriptProperties().getProperty('TICKETS_SHARED_SECRET');
  if(!secret) adminFail('NOT_CONFIGURED');
  if(typeof envelope!=='string'||envelope.length>50000) adminFail('INVALID_SIGNATURE');
  var expected=adminHex(Utilities.computeHmacSha256Signature(envelope,secret,Utilities.Charset.UTF_8));
  if(!adminEqual(expected,signature)) adminFail('INVALID_SIGNATURE');
  request=JSON.parse(envelope);var now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(request.issuedAt)||Math.abs(now-request.issuedAt)>120) adminFail('EXPIRED');
  if(typeof request.nonce!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(request.nonce)) adminFail('VALIDATION');
  clock.mark('verify');
  if(typeof request.actor!=='string'||!adminPermission(request.actor)) adminFail('FORBIDDEN');clock.mark('authorize');
  locked=lock.tryLock(15000);clock.mark('lock');if(!locked) adminFail('BUSY');
  var cache=CacheService.getScriptCache();var nonceKey='ticket-admin-'+request.nonce;
  if(cache.get(nonceKey)) adminFail('REPLAY');cache.put(nonceKey,'1',300);clock.mark('nonce');
  var book=ticketResolveBook(request);clock.mark('open');
  var data;
  switch(request.action) {
   case 'list': data=adminTicketList(book);break;
   case 'detail': data=adminTicketView(adminFindTicket(book,(request.payload||{}).id));var pending=adminPendingOperation(book,data.id,request.actor);if(pending)data.pendingOperation=pending;break;
   case 'catalogs': data=adminCatalogs(book);break;
   case 'assign': data=adminAssign(book,request.actor,request.payload,request);break;
   default:adminFail('VALIDATION');
  }
  clock.mark('work');return ticketPerfReply({ok:true,data:data},request,clock);
 } catch(err) {
  var result={ok:false,code:err.adminCode||'UPSTREAM'};
  if(request&&request.perfProbe&&err.adminDetail)result.detail=err.adminDetail;
  // Tell the client whether it must retain the operation ID for recovery.
  if(request&&request.action==='assign'&&book&&request.payload) {
   try {var history=book.getSheetByName('BITACORA TICKETS');result.operationPending=history?history.getDataRange().getValues().slice(1).some(function(row){return row[0]===request.payload.operationId&&row[2]===request.actor;}):false;}catch(ignored){}
  }
  return ticketPerfReply(result,request,clock);
 }
 finally { if(locked)lock.releaseLock(); }
}
function adminTicketTable(book) { return adminTable(book,'TICKETS',ADMIN_TICKET_HEADERS); }
function adminPurchase(row,headers) { return String(row[headers.indexOf('TIPO DE SOLICITUD')]||'').trim().toLowerCase()==='compras'; }
function adminFindTicket(book,id,allowPendingCreation) {
 if(typeof id!=='string'||!/^TKT-\d{4}-\d+$/.test(id))adminFail('VALIDATION');
 var table=adminTicketTable(book);var matches=[];
 table.rows.slice(1).forEach(function(row,i){if(String(row[table.headers.indexOf('ID TICKET')]).trim()===id)matches.push({row:row,formulas:table.formulas[i+1],rowNumber:i+2,table:table});});
 if(matches.length===0)adminFail('NOT_FOUND');if(matches.length!==1)adminFail('DUPLICATE_ID');
 if(adminPurchase(matches[0].row,table.headers))adminFail('NOT_FOUND');if(!allowPendingCreation&&typeof portalPendingCreation==='function'&&portalPendingCreation(book,id))adminFail('PENDING_OPERATION');return matches[0];
}
function adminCellValue(value,header) {
 if(value instanceof Date) { var format=header==='HORA SOLICITUD'?'HH:mm:ss':(['FECHA ASIGNACIÓN','FECHA INICIO','FECHA TERMINACIÓN','ÚLTIMA ACTUALIZACIÓN'].indexOf(header)>=0?'yyyy-MM-dd HH:mm:ss':'yyyy-MM-dd');return Utilities.formatDate(value,'America/Cancun',format); }
 if(typeof value==='string' && (header.indexOf('FECHA')===0||header==='ÚLTIMA ACTUALIZACIÓN')) {
  var match=value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2})(?::(\d{2}))?)?$/);
  if(match)return match[3]+'-'+match[2]+'-'+match[1]+(match[4]?' '+match[4]+':'+(match[5]||'00'):'');
 }
 return value==null?'':value;
}
function adminSnapshot(ticket) { return ticket.row.map(function(value,i){return ticket.formulas&&ticket.formulas[i]?{formula:ticket.formulas[i]}:adminCellValue(value,ticket.table.headers[i]);}); }
function adminTicketView(ticket) {
 var row=ticket.row;var headers=ticket.table.headers;
 function get(h){return String(adminCellValue(row[headers.indexOf(h)],h)).replace(/^\u200B(?=[=+@'-])/,'');}
 return {id:get('ID TICKET'),fecha:get('FECHA SOLICITUD'),hora:get('HORA SOLICITUD'),solicitante:get('SOLICITANTE'),correo:get('CORREO SOLICITANTE'),area:get('ÁREA SOLICITANTE'),tipo:get('TIPO DE SOLICITUD'),descripcion:get('DESCRIPCIÓN'),urgencia:get('PRIORIDAD SOLICITADA'),plazo:get('PLAZO SOLICITADO'),prioridad:get('PRIORIDAD'),responsable:get('RESPONSABLE'),fechaAsignacion:get('FECHA ASIGNACIÓN'),fechaCompromiso:get('FECHA COMPROMISO'),estado:get('ESTADO'),observaciones:get('OBSERVACIONES'),adjuntos:get('ARCHIVOS ADJUNTOS'),version:adminHash(adminSnapshot(ticket))};
}
function adminTicketList(book) {
 var table=adminTicketTable(book),pending=typeof portalPendingCreationIds==='function'?portalPendingCreationIds(book):{};
 return table.rows.slice(1).map(function(row,i){return {row:row,table:table,formulas:table.formulas[i+1]};}).filter(function(ticket){return /^TKT-\d{4}-\d+$/.test(String(ticket.row[table.headers.indexOf('ID TICKET')]))&&!adminPurchase(ticket.row,table.headers)&&!pending[String(ticket.row[table.headers.indexOf('ID TICKET')])];}).map(adminTicketView);
}
function adminCatalogs(book) {
 var priorities=adminTable(book,'CATALOGOS',['PRIORIDADES'],true);var people=adminTable(book,'RESPONSABLES',['RESPONSABLE'],true);
 function unique(table,h){var seen={};return table.rows.slice(1).map(function(row){return String(row[table.headers.indexOf(h)]||'').trim();}).filter(function(v){if(!v||seen[v])return false;seen[v]=true;return true;});}
 return {prioridades:unique(priorities,'PRIORIDADES').filter(function(p){return ['CRITICA','URGENTE','ALTA','MEDIA','BAJA'].indexOf(p)>=0;}),responsables:unique(people,'RESPONSABLE').concat(typeof serviceConfig==='function'&&serviceConfig(book)?serviceConfig(book).responsibles.map(function(r){return r.name;}):[]).filter(function(v,i,a){return a.indexOf(v)===i;})};
}
function adminLiteral(value) { return /^[=+@'-]/.test(value)?'\u200B'+value:value; }
function adminAssignmentChanges(book,payload,ticket) {
 var changes=payload.changes;var catalogs=adminCatalogs(book);
 if(!changes||Object.keys(changes).some(function(k){return ['responsable','prioridad','fechaCompromiso','observacion'].indexOf(k)<0;}))adminFail('VALIDATION');
 if(catalogs.responsables.indexOf(changes.responsable)<0||catalogs.prioridades.indexOf(changes.prioridad)<0)adminFail('VALIDATION');
 var date=changes.fechaCompromiso;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))adminFail('VALIDATION');
 var parsed=new Date(date+'T12:00:00Z');if(isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<Utilities.formatDate(new Date(),'America/Cancun','yyyy-MM-dd'))adminFail('VALIDATION');
 if(typeof changes.observacion!=='string'||changes.observacion.length>4000)adminFail('VALIDATION');
 var state=ticket.row[ticket.table.headers.indexOf('ESTADO')];if(['NUEVO','ASIGNADO','EN PROCESO','EN ESPERA'].indexOf(state)<0)adminFail('VALIDATION');
 return changes;
}
function adminJournal(book) {
 var sheet=book.getSheetByName('BITACORA TICKETS');
 if(!sheet){sheet=book.insertSheet('BITACORA TICKETS');sheet.appendRow(ADMIN_JOURNAL_HEADERS);}
 return adminJournalTable(book);
}
function adminJournalTable(book) {
 var table=adminTable(book,'BITACORA TICKETS',ADMIN_JOURNAL_HEADERS);
 for(var i=0;i<ADMIN_JOURNAL_HEADERS.length;i++){
  if(adminNormalizeHeader(table.headers[i])!==adminNormalizeHeader(ADMIN_JOURNAL_HEADERS[i])){
   adminFail('SCHEMA', 'bitacora col ' + i + ' esperaba ' + ADMIN_JOURNAL_HEADERS[i] + ' y vino ' + table.headers[i]);
  }
 }
 return table;
}
function adminPendingOperation(book,id,actor) {
 if(!book.getSheetByName('BITACORA TICKETS'))return null;
 var table=adminJournalTable(book);var rows=table.rows.slice(1).filter(function(row){return (!row[9]||row[9]==='ASIGNAR')&&row[1]==='PENDIENTE'&&row[2]===actor&&row[4]===id;});
 if(rows.length>1)adminFail('PENDING_OPERATION');
 if(rows.length!==1)return null;var data=JSON.parse(rows[0][8]);return data.request||data;
}
function adminAssign(book,actor,payload,request) {
 if(!payload||typeof payload.operationId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(payload.operationId)||typeof payload.expectedVersion!=='string')adminFail('VALIDATION');
 var ticket=adminFindTicket(book,payload.ticketId);var hash=adminHash(payload);
 var journalSheet=book.getSheetByName('BITACORA TICKETS');var journal=journalSheet?adminJournalTable(book):null;
 var events=journal?journal.rows.slice(1).map(function(row,i){return {row:row,rowNumber:i+2};}).filter(function(e){return e.row[0]===payload.operationId;}):[];
 if(events.length>1)adminFail('OPERATION_REUSED');
 if(events.length===1) {
  var event=events[0];if((event.row[9]&&event.row[9]!=='ASIGNAR')||event.row[2]!==actor||event.row[3]!==hash)adminFail('OPERATION_REUSED');
  if(event.row[1]==='CONFIRMADO')return {ticket:adminTicketView(ticket),operationId:payload.operationId};
  var before=JSON.parse(event.row[5]);var after=JSON.parse(event.row[6]);
  var snapshot=adminSnapshot(ticket);var current=adminHash(snapshot);
  // JSON serialization preserves the canonical representation of date cells.
  if(snapshot.length!==before.length||snapshot.some(function(value,i){return JSON.stringify(value)!==JSON.stringify(before[i])&&JSON.stringify(value)!==JSON.stringify(after[i]);}))adminFail('CONFLICT');
  if(current!==adminHash(after))adminWriteAssignment(ticket,after);
  if(adminHash(adminSnapshot(adminFindTicket(book,payload.ticketId)))!==adminHash(after))adminFail('CONFLICT');
  if(typeof serviceAssignmentRecover==='function')serviceAssignmentRecover(book,payload.ticketId,JSON.parse(event.row[8]));
  journal.sheet.getRange(event.rowNumber,2).setValue('CONFIRMADO');SpreadsheetApp.flush();
  var recoveredView=adminTicketView(adminFindTicket(book,payload.ticketId)),recAudit=null;
  if(typeof ticketNotifyTransition==='function')recAudit=ticketNotifyTransition(book,{event:'ASSIGN',operationId:payload.operationId,journalSheet:journal.sheet,journalRowNumber:event.rowNumber,ticket:recoveredView,meta:typeof serviceCase==='function'?serviceCase(book,payload.ticketId):null,actor:actor,comment:(payload.changes&&payload.changes.observacion)||'',portalBaseUrl:request&&request.portalBaseUrl});
  var recRes={ticket:recoveredView,operationId:payload.operationId};if(recAudit)recRes.notification=recAudit;return recRes;
 }
 if(journal&&journal.rows.slice(1).some(function(row){return row[4]===payload.ticketId&&row[1]==='PENDIENTE';}))adminFail('PENDING_OPERATION');
 var changes=adminAssignmentChanges(book,payload,ticket);
 var before=adminSnapshot(ticket);if(adminHash(before)!==payload.expectedVersion)adminFail('CONFLICT');
 var after=before.slice();var h=ticket.table.headers;var now=Utilities.formatDate(new Date(),'America/Cancun','yyyy-MM-dd HH:mm:ss');
 function set(header,value){after[h.indexOf(header)]=value;}
 set('RESPONSABLE',adminLiteral(changes.responsable));set('PRIORIDAD',changes.prioridad);set('FECHA COMPROMISO',changes.fechaCompromiso);
 if(after[h.indexOf('ESTADO')]==='NUEVO')set('ESTADO','ASIGNADO');
 if(!after[h.indexOf('FECHA ASIGNACIÓN')])set('FECHA ASIGNACIÓN',now);
 set('OBSERVACIONES',adminLiteral(changes.observacion));set('ÚLTIMA ACTUALIZACIÓN',now);
 journal=journal||adminJournal(book);
 var plan=typeof serviceAssignmentPlan==='function'?serviceAssignmentPlan(book,ticket,changes):null;if(plan){if(!plan.before||!plan.before.assignedAt)plan.after.assignedBy=actor;plan.after.lastAssignedBy=actor;}var stored=plan?{request:payload,service:plan}:payload;
 journal.sheet.appendRow([payload.operationId,'PENDIENTE',actor,hash,payload.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(stored),'ASIGNAR']);SpreadsheetApp.flush();
 var eventNumber=journal.sheet.getLastRow();
 adminWriteAssignment(ticket,after);
 if(adminHash(adminSnapshot(adminFindTicket(book,payload.ticketId)))!==adminHash(after))adminFail('CONFLICT');
 if(plan)serviceSaveCase(book,payload.ticketId,plan.before,plan.after);
 journal.sheet.getRange(eventNumber,2).setValue('CONFIRMADO');SpreadsheetApp.flush();
 var assignedView=adminTicketView(adminFindTicket(book,payload.ticketId)),assignAudit=null;
 if(typeof ticketNotifyTransition==='function')assignAudit=ticketNotifyTransition(book,{event:'ASSIGN',operationId:payload.operationId,journalSheet:journal.sheet,journalRowNumber:eventNumber,ticket:assignedView,meta:plan?plan.after:(typeof serviceCase==='function'?serviceCase(book,payload.ticketId):null),actor:actor,comment:changes.observacion||'',portalBaseUrl:request&&request.portalBaseUrl});
 var assignRes={ticket:assignedView,operationId:payload.operationId};if(assignAudit)assignRes.notification=assignAudit;return assignRes;
}
function adminWriteAssignment(ticket,after) {
 // Write only I:M and T:U; preserve formulas and values in all original fields.
 var h=ticket.table.headers;
 var current=adminSnapshot(ticket);
 ['RESPONSABLE','PRIORIDAD','FECHA COMPROMISO','ESTADO','FECHA ASIGNACIÓN','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN'].forEach(function(header){var column=h.indexOf(header);var value=after[column];if(JSON.stringify(current[column])===JSON.stringify(value))return;
  if(['FECHA COMPROMISO','FECHA ASIGNACIÓN','ÚLTIMA ACTUALIZACIÓN'].indexOf(header)>=0 && typeof value==='string' && value){value=Utilities.parseDate(value.length===10?value+' 00:00:00':value,'America/Cancun','yyyy-MM-dd HH:mm:ss');}
  ticket.table.sheet.getRange(ticket.rowNumber,column+1).setValue(value);
 });
 SpreadsheetApp.flush();
}
