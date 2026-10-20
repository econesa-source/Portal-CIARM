var SERVICE_TABLE_CACHE=null;
function serviceCachedRows(book,name,headers){if(SERVICE_TABLE_CACHE&&SERVICE_TABLE_CACHE[name])return SERVICE_TABLE_CACHE[name];var rows=adminTable(book,name,headers,true).rows;if(SERVICE_TABLE_CACHE)SERVICE_TABLE_CACHE[name]=rows;return rows;}
function serviceInvalidate(name){if(SERVICE_TABLE_CACHE){delete SERVICE_TABLE_CACHE[name];if(name==='SEGUIMIENTO SERVICIO')delete SERVICE_TABLE_CACHE._serviceCaseIndex;}}
/** Service configuration and recoverable lifecycle. All callers hold the signed protocol lock. */
function serviceTable(book,name,headers){var sheet=book.getSheetByName(name);if(!sheet){sheet=book.insertSheet(name);sheet.appendRow(headers);}else if(sheet.getLastRow()===0)sheet.appendRow(headers);return adminTable(book,name,headers);}
function serviceConfig(book){var sheet=book.getSheetByName('CONFIG SERVICIO');if(!sheet||sheet.getLastRow()===0)return null;var rows=serviceCachedRows(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']).slice(1);if(!rows.length)return null;var value=JSON.parse(rows[rows.length-1][1]);return serviceValidatePolicy(value);}
function serviceSettings(book,actor){if(!adminPermission(actor))adminFail('FORBIDDEN');var p=serviceConfig(book)||serviceDefaultPolicy();if(!p.responsibles)p.responsibles=[{name:'Daniel Lara',email:'d.lara@ciarm.edu.mx'},{name:'PRUEBA — Rodrigo Valencia',email:'r.valencia@ciarm.edu.mx',test:true},{name:'PRUEBA — Ezequiel Conesa',email:'e.conesa@ciarm.edu.mx',test:true}];return {enabled:Boolean(serviceConfig(book)),policy:p};}
function servicePublish(book,actor,input){
 if(!adminPermission(actor))adminFail('FORBIDDEN');portalOperationId(input.operationId);var table=serviceTable(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']),hash=adminHash(input),old=table.rows.slice(1).filter(function(r){return r[4]===input.operationId;});
 if(old.length){if(old.length!==1||old[0][2]!==actor||old[0][5]!==hash)adminFail('OPERATION_REUSED');return serviceSettings(book,actor);}
 var current=serviceConfig(book),version=current?current.version:0;if(input.expectedVersion!==version)adminFail('CONFLICT');var p;try{p=serviceValidatePolicy(input.policy);}catch(error){adminFail('VALIDATION');}p.version=version+1;
 if(!Array.isArray(p.responsibles)||!p.responsibles.length||p.responsibles.length>100)adminFail('VALIDATION');var names={},emails={};
 p.responsibles.forEach(function(r){if(!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||names[r.name]||emails[r.email])adminFail('VALIDATION');portalCollaborator(r.email);names[r.name]=true;emails[r.email]=true;});
 var raw=JSON.stringify(p);if(Utilities.newBlob(raw).getBytes().length>20000)adminFail('PAYLOAD_SIZE');table.sheet.appendRow([p.version,raw,actor,serviceNow(),input.operationId,hash]);serviceInvalidate('CONFIG SERVICIO');SpreadsheetApp.flush();return serviceSettings(book,actor);
}
function serviceNow(){return Utilities.formatDate(new Date(),'America/Cancun','yyyy-MM-dd HH:mm:ss');}
function serviceDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))adminFail('VALIDATION');var date=new Date(value.replace(' ','T')+'-05:00');if(isNaN(date.getTime())||Utilities.formatDate(date,'America/Cancun','yyyy-MM-dd HH:mm:ss')!==value)adminFail('VALIDATION');return date;}
function serviceCase(book,id){
 // Construir un índice por ejecución en lugar de releer y filtrar la
 // misma tabla para cada solicitud. Conserva detección de duplicados.
 var index=SERVICE_TABLE_CACHE&&SERVICE_TABLE_CACHE._serviceCaseIndex;
 if(!index){
  index={};
  var sheet=book.getSheetByName('SEGUIMIENTO SERVICIO');
  if(sheet&&sheet.getLastRow()>0){
   serviceCachedRows(book,'SEGUIMIENTO SERVICIO',['FOLIO','SEGUIMIENTO'])
    .slice(1).forEach(function(r){
     var key=String(r[0]||'');
     if(!index[key])index[key]=[];
     index[key].push(r[1]);
    });
  }
  if(SERVICE_TABLE_CACHE)SERVICE_TABLE_CACHE._serviceCaseIndex=index;
 }
 var matches=index[id]||[];
 if(matches.length>1)adminFail('DUPLICATE_ID');
 return matches.length?JSON.parse(matches[0]):null;
}
function serviceSaveCase(book,id,before,after){var table=serviceTable(book,'SEGUIMIENTO SERVICIO',['FOLIO','SEGUIMIENTO']),matches=[];table.rows.slice(1).forEach(function(r,i){if(r[0]===id)matches.push(i+2);});if(matches.length>1)adminFail('DUPLICATE_ID');var current=serviceCase(book,id);if(adminHash(current)!==adminHash(before)&&adminHash(current)!==adminHash(after))adminFail('CONFLICT');var raw=JSON.stringify(after);if(Utilities.newBlob(raw).getBytes().length>45000)adminFail('PAYLOAD_SIZE');if(matches.length)table.sheet.getRange(matches[0],2).setValue(raw);else table.sheet.appendRow([id,raw]);serviceInvalidate('SEGUIMIENTO SERVICIO');}
function serviceAssignmentPlan(book,ticket,changes){var p=serviceConfig(book);if(!p)return null;var target=p.responsibles.filter(function(r){return r.name===changes.responsable;});if(!target.length){var cleanChange=changes.responsable.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase();target=p.responsibles.filter(function(r){return r.name.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase()===cleanChange;});}if(target.length!==1)adminFail('RESPONSIBLE_ACCOUNT');portalCollaborator(target[0].email);var before=serviceCase(book,adminTicketView(ticket).id);if(!before&&['EN PROCESO','EN ESPERA'].indexOf(adminTicketView(ticket).estado)>=0)adminFail('SERVICE_MIGRATION_REQUIRED');var after=before?JSON.parse(JSON.stringify(before)):{policy:p,createdAt:serviceNow(),historical:true,cycles:[],waits:[]};p=after.policy;var now=serviceNow();after.email=target[0].email;after.responsible=changes.responsable;
 if(!after.assignedAt){after.assignedAt=now;after.firstAssignedAt=now;if(after.assignmentDeadline){var limit=serviceDeadline(serviceDate(after.createdAt),p.levels[changes.prioridad].assign,p);if(limit.getTime()<serviceDate(after.assignmentDeadline).getTime())after.assignmentDeadline=Utilities.formatDate(limit,'America/Cancun','yyyy-MM-dd HH:mm:ss');}after.priority=changes.prioridad;after.assignedBy=null;after.deadlines={start:Utilities.formatDate(serviceDeadline(serviceDate(now),p.levels[changes.prioridad].start,p),'America/Cancun','yyyy-MM-dd HH:mm:ss')};var level=p.levels[changes.prioridad];if(level.resolve)after.deadlines.resolve=Utilities.formatDate(serviceDeadline(serviceDate(now),level.resolve,p),'America/Cancun','yyyy-MM-dd HH:mm:ss');if(level.contain){after.deadlines.resolve=Utilities.formatDate(new Date(serviceWindow(serviceDate(changes.fechaCompromiso+' 00:00:00'),p).end),'America/Cancun','yyyy-MM-dd HH:mm:ss');}if(level.contain)after.deadlines.contain=Utilities.formatDate(serviceDeadline(serviceDate(now),level.contain,p),'America/Cancun','yyyy-MM-dd HH:mm:ss');}
 after.stageOwners=after.stageOwners||{};if(!after.originalDeadlines){after.originalDeadlines=JSON.parse(JSON.stringify(after.deadlines));after.originalPriority=after.priority;}if(before&&before.assignedAt&&after.priority!==changes.prioridad){var previous=after.priority;after.priority=changes.prioridad;after.priorityChanges=after.priorityChanges||[];after.priorityChanges.push({from:previous,to:after.priority,date:now});var level=p.levels[after.priority];['start','contain','resolve'].forEach(function(k){if(k==='start'&&after.startedAt||k==='contain'&&after.containedAt||k==='resolve'&&after.resolvedAt)return;var candidate;if(k==='resolve'&&after.priority==='CRITICA')candidate=new Date(serviceWindow(serviceDate(changes.fechaCompromiso+' 00:00:00'),p).end);else if(level[k])candidate=serviceDeadline(serviceDate(now),level[k],p);if(candidate&&(!after.deadlines[k]||candidate.getTime()<serviceDate(after.deadlines[k]).getTime()))after.deadlines[k]=Utilities.formatDate(candidate,'America/Cancun','yyyy-MM-dd HH:mm:ss');});}
 return {before:before,after:after};}
function serviceAssignmentRecover(book,id,payload){if(payload.service)serviceSaveCase(book,id,payload.service.before,payload.service.after);}
function servicePending(book,id,operationId){var sheet=book.getSheetByName('BITACORA TICKETS');return sheet&&sheet.getDataRange().getValues().slice(1).some(function(r){return r[4]===id&&r[1]==='PENDIENTE'&&r[0]!==operationId;});}
function serviceIsExecutor(ticket,meta,actor,book){
 if(!actor||typeof actor!=='string')return false;
 actor=actor.trim().toLowerCase();
 if(meta&&meta.email&&String(meta.email).trim().toLowerCase()===actor)return true;
 var resp=ticket&&ticket.responsable?String(ticket.responsable).trim():'';
 if(!resp||resp==='SIN ASIGNAR'||resp==='Sin asignar')return false;
 var cleanResp=resp.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase();
 if(cleanResp==='rodrigo valencia'&&actor==='r.valencia@ciarm.edu.mx')return true;
 if(cleanResp==='daniel lara'&&actor==='d.lara@ciarm.edu.mx')return true;
 if(cleanResp==='ezequiel conesa'&&actor==='e.conesa@ciarm.edu.mx')return true;
 var policy=(meta&&meta.policy)||(book&&typeof serviceConfig==='function'?serviceConfig(book):null);
 if(policy&&Array.isArray(policy.responsibles)){
  for(var i=0;i<policy.responsibles.length;i++){
   var r=policy.responsibles[i];
   if(r&&r.email&&String(r.email).trim().toLowerCase()===actor){
    var rName=String(r.name||'').trim();
    var cleanRName=rName.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase();
    if(rName.toLowerCase()===resp.toLowerCase()||cleanRName===cleanResp||cleanRName===resp.toLowerCase())return true;
   }
  }
 }
 try{
  if(typeof portalCollaborator==='function'){
   var person=portalCollaborator(actor);
   if(person&&person.nombreCompleto){
    var personName=String(person.nombreCompleto).trim().toLowerCase();
    if(personName===resp.toLowerCase()||personName===cleanResp)return true;
   }
  }
 }catch(e){}
 return false;
}
function serviceAuthorize(ticket,meta,actor,event,book){var admin=adminPermission(actor),owner=ticket.correo.trim().toLowerCase()===actor,executor=serviceIsExecutor(ticket,meta,actor,book)||admin;var allowed=event==='ACCEPT'||event==='REJECT'?owner:event==='WAIT_APPROVE'||event==='EXCEPTION'||event==='TRIAGE'||event==='RESUME'?admin:executor;if(!allowed)adminFail('FORBIDDEN');}
function serviceDetail(book,actor,id){var raw=adminFindTicket(book,id),ticket=adminTicketView(raw),meta=serviceCase(book,id);if(!adminPermission(actor)&&ticket.correo!==actor&&!serviceIsExecutor(ticket,meta,actor,book))adminFail('FORBIDDEN');var events=book.getSheetByName('BITACORA TICKETS');var history=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[1]==='CONFIRMADO';}).map(function(r){var data;try{data=JSON.parse(r[8]);}catch(e){data={};}return {action:r[9]==='SERVICIO'&&data.request?data.request.event:r[9]||'ASIGNAR',actor:r[2],date:adminCellValue(r[7],'ÚLTIMA ACTUALIZACIÓN'),comment:data.request?data.request.comment||(data.request.changes||{}).observacion||(data.request.priority?'Prioridad: '+data.request.priority:''):data.comment||'',evidence:data.request?data.request.evidence||[]:[]};}):[];
 var pending=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[9]==='SERVICIO'&&r[1]==='PENDIENTE'&&r[2]===actor;}):[];if(pending.length>1)adminFail('PENDING_OPERATION');var operation=pending.length?JSON.parse(pending[0][8]).request:null;
 return {ticket:ticket,pendingOperation:operation||undefined,service:meta?serviceView(meta,ticket):null,history:history,roles:{admin:adminPermission(actor),owner:ticket.correo.trim().toLowerCase()===actor,executor:serviceIsExecutor(ticket,meta,actor,book)}};}
function serviceView(meta,ticket){var value=JSON.parse(JSON.stringify(meta)),now=new Date();value.effectiveDeadlines={};Object.keys(value.deadlines||{}).forEach(function(k){var completed=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;var cutoff=completed?serviceDate(completed):now,pauseHours=0;if(k!=='start')value.waits.forEach(function(w){var from=serviceDate(w.from),to=w.to?serviceDate(w.to):now;if(to>cutoff)to=cutoff;if(to>from)pauseHours+=serviceElapsedHours(from,to,value.policy);});value.effectiveDeadlines[k]=Utilities.formatDate(serviceDeadline(serviceDate(value.deadlines[k]),pauseHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');});value.overdue=Object.keys(value.effectiveDeadlines).filter(function(k){var done=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;return serviceDate(done||serviceNow()).getTime()>serviceDate(value.effectiveDeadlines[k]).getTime();});if(value.resolvedAt){value.validationDeadline=Utilities.formatDate(serviceDeadline(serviceDate(value.resolvedAt),value.policy.validationHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');value.validationOverdue=serviceDate(value.closedAt||serviceNow()).getTime()>serviceDate(value.validationDeadline).getTime();}var wait=value.waits[value.waits.length-1];if(wait&&!wait.to){value.waitFollowAt=wait.request.followAt;value.waitFollowOverdue=now.getTime()>serviceDate(value.waitFollowAt).getTime();}value.assignmentOverdue=value.assignmentDeadline?serviceDate(value.firstAssignedAt||value.assignedAt||serviceNow()).getTime()>serviceDate(value.assignmentDeadline).getTime():null;value.totalHours=(now.getTime()-serviceDate(value.createdAt).getTime())/3600000;return value;}

function serviceTransition(book,actor,input){
 portalOperationId(input.operationId);if(typeof input.expectedVersion!=='string'||typeof input.ticketId!=='string'||typeof input.comment!=='string'||input.comment.length>4000)adminFail('VALIDATION');var valid=['TRIAGE','START','WAIT_REQUEST','WAIT_APPROVE','RESUME','CONTAIN','RESOLVE','ACCEPT','REJECT','EXCEPTION'];if(valid.indexOf(input.event)<0)adminFail('VALIDATION');var raw=adminFindTicket(book,input.ticketId),ticket=adminTicketView(raw),meta=serviceCase(book,input.ticketId);if(!meta)adminFail('SERVICE_NOT_ENABLED');serviceAuthorize(ticket,meta,actor,input.event,book);
 var journal=portalJournal(book),hash=adminHash(input),events=journal.rows.slice(1).map(function(r,i){return {row:r,index:i+2};}).filter(function(e){return e.row[0]===input.operationId;});if(events.length>1)adminFail('OPERATION_REUSED');var event;
 if(events.length){event=events[0];if(event.row[9]!=='SERVICIO'||event.row[2]!==actor||event.row[3]!==hash)adminFail('OPERATION_REUSED');if(event.row[1]==='CONFIRMADO')return serviceDetail(book,actor,input.ticketId);}
 else{
  if(servicePending(book,input.ticketId,input.operationId))adminFail('PENDING_OPERATION');if(ticket.version!==input.expectedVersion)adminFail('CONFLICT');var before=adminSnapshot(raw),after=before.slice(),next=JSON.parse(JSON.stringify(meta)),now=serviceNow(),state=ticket.estado;
  function set(header,value){var index=raw.table.headers.indexOf(header);if(raw.formulas[index])adminFail('SCHEMA');after[index]=value;}
  var comment=input.comment.trim();if(['WAIT_REQUEST','CONTAIN','RESOLVE','REJECT','EXCEPTION'].indexOf(input.event)>=0&&!comment)adminFail('VALIDATION');var evidence=input.evidence||[];if(!Array.isArray(evidence)||evidence.length>5||evidence.some(function(u){return typeof u!=='string'||!/^https:\/\/(drive|docs)\.google\.com\//.test(u)||u.length>500;}))adminFail('VALIDATION');
  switch(input.event){
   case 'TRIAGE':if(state!=='NUEVO'||!next.policy.levels[input.priority])adminFail('VALIDATION');next.triagePriority=input.priority;var limit=serviceDeadline(serviceDate(next.createdAt),next.policy.levels[input.priority].assign,next.policy);if(!next.assignmentDeadline||limit.getTime()<serviceDate(next.assignmentDeadline).getTime())next.assignmentDeadline=Utilities.formatDate(limit,'America/Cancun','yyyy-MM-dd HH:mm:ss');set('PRIORIDAD',input.priority);break;
   case 'START':if(state!=='ASIGNADO'||next.startedAt)adminFail('VALIDATION');next.startedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.start=actor;if(!next.email)next.email=actor;if(!next.responsible)next.responsible=ticket.responsable;set('ESTADO','EN PROCESO');set('FECHA INICIO',now);break;
   case 'WAIT_REQUEST':if(['EN PROCESO','ASIGNADO'].indexOf(state)<0||next.waitRequest)adminFail('VALIDATION');if(typeof input.dependency!=='string'||!input.dependency.trim()||input.dependency.length>300||serviceDate(input.followAt).getTime()<=new Date().getTime())adminFail('VALIDATION');next.waitRequest={comment:comment,dependency:input.dependency,followAt:input.followAt,requestedBy:actor,requestedAt:now,operationId:input.operationId};if(!next.email)next.email=actor;if(!next.responsible)next.responsible=ticket.responsable;break;
   case 'WAIT_APPROVE':if(['EN PROCESO','ASIGNADO'].indexOf(state)<0||!next.waitRequest)adminFail('VALIDATION');next.waits.push({from:now,to:null,approvedBy:actor,request:{dependency:next.waitRequest.dependency,followAt:next.waitRequest.followAt,requestedBy:next.waitRequest.requestedBy,requestedAt:next.waitRequest.requestedAt,operationId:next.waitRequest.operationId}});next.waitRequest=null;set('ESTADO','EN ESPERA');break;
   case 'RESUME':if(state!=='EN ESPERA'||!next.waits.length||next.waits[next.waits.length-1].to)adminFail('VALIDATION');next.waits[next.waits.length-1].to=now;set('ESTADO','EN PROCESO');break;
   case 'CONTAIN':if(['EN PROCESO','ASIGNADO'].indexOf(state)<0||next.priority!=='CRITICA'||next.containedAt)adminFail('VALIDATION');if(!next.startedAt){next.startedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.start=actor;set('FECHA INICIO',now);}next.containedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.contain=actor;next.containmentComment=comment;if(!next.email)next.email=actor;if(!next.responsible)next.responsible=ticket.responsable;break;
   case 'RESOLVE':if(['EN PROCESO','ASIGNADO'].indexOf(state)<0||next.priority==='CRITICA'&&!next.containedAt)adminFail('VALIDATION');next.stageOwners=next.stageOwners||{};if(!next.startedAt){next.startedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.start=actor;set('FECHA INICIO',now);}next.stageOwners.resolve=actor;next.resolvedAt=now;next.waitRequest=null;next.solution=comment;next.evidence=evidence;if(!next.email)next.email=actor;if(!next.responsible)next.responsible=ticket.responsable;set('ESTADO','RESUELTO');set('FECHA TERMINACIÓN',now);break;
   case 'ACCEPT':if(state!=='RESUELTO')adminFail('VALIDATION');next.closedAt=now;next.verdict={conforme:true,comment:comment,actor:actor,date:now};set('ESTADO','CERRADO');break;
   case 'REJECT':if(state!=='RESUELTO')adminFail('VALIDATION');next.cycles.push({assignedAt:next.assignedAt,startedAt:next.startedAt,resolvedAt:next.resolvedAt,containedAt:next.containedAt||null,deadlines:next.deadlines,outcomes:serviceView(meta,ticket).overdue,executor:next.stageOwners&&next.stageOwners.resolve||next.email,stageOwners:next.stageOwners||{},validationOwner:ticket.correo,validationLate:serviceView(meta,ticket).validationOverdue,verdict:{conforme:false,actor:actor,date:now,operationId:input.operationId}});next.assignedAt=now;next.stageOwners={};next.startedAt=null;next.resolvedAt=null;next.containedAt=null;next.waits=[];next.waitRequest=null;next.deadlines={};Object.keys(meta.deadlines).forEach(function(k){if(next.priority==='CRITICA'&&k==='resolve'){next.deadlines[k]=meta.deadlines[k];return;}next.deadlines[k]=Utilities.formatDate(serviceDeadline(serviceDate(now),next.policy.levels[next.priority][k]||0,next.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');});set('ESTADO','ASIGNADO');set('FECHA INICIO','');set('FECHA TERMINACIÓN','');break;
   case 'EXCEPTION':if(['RESUELTO','CERRADO','CANCELADO'].indexOf(state)>=0)adminFail('VALIDATION');next.exceptions=next.exceptions||[];next.exceptions.push({actor:actor,date:now,operationId:input.operationId,commitment:input.commitment});if(!/^\d{4}-\d{2}-\d{2}$/.test(input.commitment||''))adminFail('VALIDATION');serviceDate(input.commitment+' 00:00:00');set('FECHA COMPROMISO',input.commitment);break;
  }
  set('ÚLTIMA ACTUALIZACIÓN',now);var payload={request:input,service:{before:meta,after:next}};if(Utilities.newBlob(JSON.stringify(payload)).getBytes().length>45000)adminFail('PAYLOAD_SIZE');journal.sheet.appendRow([input.operationId,'PENDIENTE',actor,hash,input.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(payload),'SERVICIO']);event={row:[input.operationId,'PENDIENTE',actor,hash,input.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(payload),'SERVICIO'],index:journal.sheet.getLastRow()};SpreadsheetApp.flush();
 }
 var prior=JSON.parse(event.row[5]),target=JSON.parse(event.row[6]),data=JSON.parse(event.row[8]),current=adminSnapshot(raw);if(current.some(function(v,i){return JSON.stringify(v)!==JSON.stringify(prior[i])&&JSON.stringify(v)!==JSON.stringify(target[i]);}))adminFail('CONFLICT');target.forEach(function(v,i){if(JSON.stringify(v)===JSON.stringify(current[i]))return;if(v&&typeof v==='object'&&v.formula)adminFail('SCHEMA');if(['FECHA INICIO','FECHA TERMINACIÓN','FECHA COMPROMISO','ÚLTIMA ACTUALIZACIÓN'].indexOf(raw.table.headers[i])>=0&&v)v=serviceDate(v.length===10?v+' 00:00:00':v);raw.table.sheet.getRange(raw.rowNumber,i+1).setValue(v);});SpreadsheetApp.flush();serviceSaveCase(book,input.ticketId,data.service.before,data.service.after);if(adminHash(adminSnapshot(adminFindTicket(book,input.ticketId)))!==adminHash(target))adminFail('CONFLICT');journal.sheet.getRange(event.index,2).setValue('CONFIRMADO');SpreadsheetApp.flush();return serviceDetail(book,actor,input.ticketId);
}
function serviceList(book,actor,kind){
 var admin=adminPermission(actor);
 if(kind==='all'&&!admin)adminFail('FORBIDDEN');
 return adminTicketList(book).map(function(t){
  return {ticket:t,meta:serviceCase(book,t.id)};
 }).filter(function(item){
  return kind==='all'||kind==='mine'&&item.ticket.correo.trim().toLowerCase()===actor||kind==='assigned'&&serviceIsExecutor(item.ticket,item.meta,actor,book);
 }).map(function(item){
  return {ticket:item.ticket,service:item.meta?serviceView(item.meta,item.ticket):null};
 });
}

function serviceConfigVersion(book,version){var rows=serviceCachedRows(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']).slice(1).filter(function(r){return r[0]===version;});if(rows.length!==1)adminFail('SCHEMA');return serviceValidatePolicy(JSON.parse(rows[0][1]));}
function serviceCreationPlan(book,request){var policy=serviceConfig(book);return policy?{version:policy.version,receivedAt:serviceNow(),urgent:request.prioridadSolicitada==='🔴 Urgente'}:null;}
function serviceCreationRecover(book,id,creation){if(!creation)return;var policy=serviceConfigVersion(book,creation.version),deadline=serviceDeadline(serviceDate(creation.receivedAt),creation.urgent?policy.levels.URGENTE.assign:policy.assignmentHours,policy);var meta={policy:policy,createdAt:creation.receivedAt,historical:false,assignmentOwner:'d.lara@ciarm.edu.mx',assignmentDeadline:Utilities.formatDate(deadline,'America/Cancun','yyyy-MM-dd HH:mm:ss'),cycles:[],waits:[]};serviceSaveCase(book,id,null,meta);}
function serviceUploadEvidence(book,actor,input){
 if(!input||typeof input.base64!=='string'||!input.name||!input.mime)adminFail('VALIDATION');
 var bytes=Utilities.base64Decode(input.base64);
 if(bytes.length>10*1024*1024)adminFail('PAYLOAD_SIZE');
 var root=DriveApp.getFolderById(CONFIG.ATTACHMENTS_FOLDER_ID);
 var candidates=root.getFoldersByName('evidencias-servicio'),folder;
 if(candidates.hasNext())folder=candidates.next();
 else folder=root.createFolder('evidencias-servicio');
 var cleanName=String(input.name).replace(/[^\w.-]/g,'_');
 if(cleanName.length>100)cleanName=cleanName.substring(cleanName.length-100);
 var fileName='evidencia_'+Utilities.formatDate(new Date(),'America/Cancun','yyyyMMdd_HHmmss')+'_'+cleanName;
 var blob=Utilities.newBlob(bytes,input.mime,fileName);
 var file=folder.createFile(blob);
 file.setDescription('Evidencia subida por '+actor);
 file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
 return {url:file.getUrl(),id:file.getId(),name:fileName};
}
