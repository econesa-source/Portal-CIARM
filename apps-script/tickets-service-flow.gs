var SERVICE_TABLE_CACHE=null;
function serviceCachedRows(book,name,headers){if(SERVICE_TABLE_CACHE&&SERVICE_TABLE_CACHE[name])return SERVICE_TABLE_CACHE[name];var rows=adminTable(book,name,headers,true).rows;if(SERVICE_TABLE_CACHE)SERVICE_TABLE_CACHE[name]=rows;return rows;}
function serviceInvalidate(name){if(SERVICE_TABLE_CACHE){delete SERVICE_TABLE_CACHE[name];if(name==='SEGUIMIENTO SERVICIO')delete SERVICE_TABLE_CACHE._serviceCaseIndex;}}
/** Service configuration and recoverable lifecycle. All callers hold the signed protocol lock. */
function serviceTable(book,name,headers){var sheet=book.getSheetByName(name);if(!sheet){sheet=book.insertSheet(name);sheet.appendRow(headers);}else if(sheet.getLastRow()===0)sheet.appendRow(headers);return adminTable(book,name,headers);}
function serviceConfig(book){var sheet=book.getSheetByName('CONFIG SERVICIO');if(!sheet||sheet.getLastRow()===0)return null;var rows=serviceCachedRows(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']).slice(1);if(!rows.length)return null;var value=JSON.parse(rows[rows.length-1][1]);return serviceValidatePolicy(value);}
function ticketDefaultConfigAdmins(p){
 var list=[],seen={};
 if(p&&Array.isArray(p.responsibles)){
  p.responsibles.forEach(function(r){
   var email=r&&r.email?String(r.email).trim().toLowerCase():'';
   if(email&&!seen[email]&&adminPermission(email)){seen[email]=true;list.push({name:r.name,email:email,test:Boolean(r.test)});}
  });
 }
 if(!list.length){
  [{name:'Daniel Lara',email:'d.lara@ciarm.edu.mx'},{name:'Ezequiel Conesa',email:'e.conesa@ciarm.edu.mx'}].forEach(function(a){
   if(!seen[a.email]&&adminPermission(a.email)){seen[a.email]=true;list.push(a);}
  });
 }
 return list;
}
function serviceSettings(book,actor){if(!adminPermission(actor))adminFail('FORBIDDEN');var p=serviceConfig(book)||serviceDefaultPolicy();if(!p.responsibles)p.responsibles=[{name:'Daniel Lara',email:'d.lara@ciarm.edu.mx'},{name:'PRUEBA — Rodrigo Valencia',email:'r.valencia@ciarm.edu.mx',test:true},{name:'PRUEBA — Ezequiel Conesa',email:'e.conesa@ciarm.edu.mx',test:true}];if(!p.admins||!p.admins.length)p.admins=ticketDefaultConfigAdmins(p);return {enabled:Boolean(serviceConfig(book)),policy:p};}
function servicePublish(book,actor,input){
 if(!adminPermission(actor))adminFail('FORBIDDEN');portalOperationId(input.operationId);var table=serviceTable(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']),hash=adminHash(input),old=table.rows.slice(1).filter(function(r){return r[4]===input.operationId;});
 if(old.length){if(old.length!==1||old[0][2]!==actor||old[0][5]!==hash)adminFail('OPERATION_REUSED');return serviceSettings(book,actor);}
 var current=serviceConfig(book),version=current?current.version:0;if(input.expectedVersion!==version)adminFail('CONFLICT');var p;try{p=serviceValidatePolicy(input.policy);}catch(error){adminFail('VALIDATION');}p.version=version+1;
 if(!Array.isArray(p.responsibles)||!p.responsibles.length||p.responsibles.length>100)adminFail('VALIDATION');var names={},emails={};
 p.responsibles.forEach(function(r){if(!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||names[r.name]||emails[r.email])adminFail('VALIDATION');portalCollaborator(r.email);names[r.name]=true;emails[r.email]=true;});
 if(p.admins!==undefined){
  if(!Array.isArray(p.admins)||!p.admins.length||p.admins.length>50)adminFail('VALIDATION');
  var adminEmails={};
  p.admins=p.admins.map(function(a){
   var item=typeof a==='string'?{name:a.trim(),email:a.trim().toLowerCase()}:a;
   if(!item||typeof item.email!=='string'||!item.email.trim())adminFail('VALIDATION');
   var email=item.email.trim().toLowerCase();
   var name=(typeof item.name==='string'&&item.name.trim())?item.name.trim():email;
   if(name.length>100||adminEmails[email])adminFail('VALIDATION');
   var collab=portalCollaborator(email);
   adminEmails[email]=true;
   return {name:name===email&&collab&&collab.nombreCompleto?collab.nombreCompleto:name,email:email,test:Boolean(item.test)};
  });
 }else{
  p.admins=ticketDefaultConfigAdmins(p);
 }
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
function serviceDetail(book,actor,id){var raw=adminFindTicket(book,id),ticket=adminTicketView(raw),meta=serviceCase(book,id);if(!adminPermission(actor)&&ticket.correo!==actor&&!serviceIsExecutor(ticket,meta,actor,book))adminFail('FORBIDDEN');var events=book.getSheetByName('BITACORA TICKETS');var history=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[1]==='CONFIRMADO';}).map(function(r){var data;try{data=JSON.parse(r[8]);}catch(e){data={};}var item={action:r[9]==='SERVICIO'&&data.request?data.request.event:r[9]||'ASIGNAR',actor:r[2],date:adminCellValue(r[7],'ÚLTIMA ACTUALIZACIÓN'),comment:data.request?data.request.comment||(data.request.changes||{}).observacion||(data.request.priority?'Prioridad: '+data.request.priority:''):data.comment||'',evidence:data.request?data.request.evidence||[]:[]};if(data&&data.notification)item.notification=data.notification;return item;}):[];
 var pending=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[9]==='SERVICIO'&&r[1]==='PENDIENTE'&&r[2]===actor;}):[];if(pending.length>1)adminFail('PENDING_OPERATION');var operation=pending.length?JSON.parse(pending[0][8]).request:null;
 return {ticket:ticket,pendingOperation:operation||undefined,service:meta?serviceView(meta,ticket):null,history:history,roles:{admin:adminPermission(actor),owner:ticket.correo.trim().toLowerCase()===actor,executor:serviceIsExecutor(ticket,meta,actor,book)}};}
function serviceView(meta,ticket){var value=JSON.parse(JSON.stringify(meta)),now=new Date();value.effectiveDeadlines={};Object.keys(value.deadlines||{}).forEach(function(k){var completed=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;var cutoff=completed?serviceDate(completed):now,pauseHours=0;if(k!=='start')value.waits.forEach(function(w){var from=serviceDate(w.from),to=w.to?serviceDate(w.to):now;if(to>cutoff)to=cutoff;if(to>from)pauseHours+=serviceElapsedHours(from,to,value.policy);});value.effectiveDeadlines[k]=Utilities.formatDate(serviceDeadline(serviceDate(value.deadlines[k]),pauseHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');});value.overdue=Object.keys(value.effectiveDeadlines).filter(function(k){var done=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;return serviceDate(done||serviceNow()).getTime()>serviceDate(value.effectiveDeadlines[k]).getTime();});if(value.resolvedAt){value.validationDeadline=Utilities.formatDate(serviceDeadline(serviceDate(value.resolvedAt),value.policy.validationHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');value.validationOverdue=serviceDate(value.closedAt||serviceNow()).getTime()>serviceDate(value.validationDeadline).getTime();}var wait=value.waits[value.waits.length-1];if(wait&&!wait.to){value.waitFollowAt=wait.request.followAt;value.waitFollowOverdue=now.getTime()>serviceDate(value.waitFollowAt).getTime();}value.assignmentOverdue=value.assignmentDeadline?serviceDate(value.firstAssignedAt||value.assignedAt||serviceNow()).getTime()>serviceDate(value.assignmentDeadline).getTime():null;value.totalHours=(now.getTime()-serviceDate(value.createdAt).getTime())/3600000;return value;}

function serviceTransition(book,actor,input,request){
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
   case 'RESOLVE':if(['EN PROCESO','ASIGNADO'].indexOf(state)<0)adminFail('VALIDATION');next.stageOwners=next.stageOwners||{};if(!next.startedAt){next.startedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.start=actor;set('FECHA INICIO',now);}if(next.priority==='CRITICA'&&!next.containedAt){next.containedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.contain=actor;next.containmentComment=comment;}next.stageOwners.resolve=actor;next.resolvedAt=now;next.waitRequest=null;next.solution=comment;next.evidence=evidence;if(!next.email)next.email=actor;if(!next.responsible)next.responsible=ticket.responsable;set('ESTADO','RESUELTO');set('FECHA TERMINACIÓN',now);break;
   case 'ACCEPT':if(state!=='RESUELTO')adminFail('VALIDATION');next.closedAt=now;next.verdict={conforme:true,comment:comment,actor:actor,date:now};set('ESTADO','CERRADO');break;
   case 'REJECT':if(state!=='RESUELTO')adminFail('VALIDATION');next.cycles.push({assignedAt:next.assignedAt,startedAt:next.startedAt,resolvedAt:next.resolvedAt,containedAt:next.containedAt||null,deadlines:next.deadlines,outcomes:serviceView(meta,ticket).overdue,executor:next.stageOwners&&next.stageOwners.resolve||next.email,stageOwners:next.stageOwners||{},validationOwner:ticket.correo,validationLate:serviceView(meta,ticket).validationOverdue,verdict:{conforme:false,actor:actor,date:now,operationId:input.operationId}});next.assignedAt=now;next.stageOwners={};next.startedAt=null;next.resolvedAt=null;next.containedAt=null;next.waits=[];next.waitRequest=null;next.deadlines={};Object.keys(meta.deadlines).forEach(function(k){if(next.priority==='CRITICA'&&k==='resolve'){next.deadlines[k]=meta.deadlines[k];return;}next.deadlines[k]=Utilities.formatDate(serviceDeadline(serviceDate(now),next.policy.levels[next.priority][k]||0,next.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');});set('ESTADO','ASIGNADO');set('FECHA INICIO','');set('FECHA TERMINACIÓN','');break;
   case 'EXCEPTION':if(['RESUELTO','CERRADO','CANCELADO'].indexOf(state)>=0)adminFail('VALIDATION');next.exceptions=next.exceptions||[];next.exceptions.push({actor:actor,date:now,operationId:input.operationId,commitment:input.commitment});if(!/^\d{4}-\d{2}-\d{2}$/.test(input.commitment||''))adminFail('VALIDATION');serviceDate(input.commitment+' 00:00:00');set('FECHA COMPROMISO',input.commitment);break;
  }
  set('ÚLTIMA ACTUALIZACIÓN',now);var payload={request:input,service:{before:meta,after:next}};if(Utilities.newBlob(JSON.stringify(payload)).getBytes().length>45000)adminFail('PAYLOAD_SIZE');journal.sheet.appendRow([input.operationId,'PENDIENTE',actor,hash,input.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(payload),'SERVICIO']);event={row:[input.operationId,'PENDIENTE',actor,hash,input.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(payload),'SERVICIO'],index:journal.sheet.getLastRow()};SpreadsheetApp.flush();
 }
 var prior=JSON.parse(event.row[5]),target=JSON.parse(event.row[6]),data=JSON.parse(event.row[8]),current=adminSnapshot(raw);if(current.some(function(v,i){return JSON.stringify(v)!==JSON.stringify(prior[i])&&JSON.stringify(v)!==JSON.stringify(target[i]);}))adminFail('CONFLICT');target.forEach(function(v,i){if(JSON.stringify(v)===JSON.stringify(current[i]))return;if(v&&typeof v==='object'&&v.formula)adminFail('SCHEMA');if(['FECHA INICIO','FECHA TERMINACIÓN','FECHA COMPROMISO','ÚLTIMA ACTUALIZACIÓN'].indexOf(raw.table.headers[i])>=0&&v)v=serviceDate(v.length===10?v+' 00:00:00':v);raw.table.sheet.getRange(raw.rowNumber,i+1).setValue(v);});SpreadsheetApp.flush();serviceSaveCase(book,input.ticketId,data.service.before,data.service.after);var confirmedRaw=adminFindTicket(book,input.ticketId);if(adminHash(adminSnapshot(confirmedRaw))!==adminHash(target))adminFail('CONFLICT');journal.sheet.getRange(event.index,2).setValue('CONFIRMADO');SpreadsheetApp.flush();
 var audit=ticketNotifyTransition(book,{event:input.event,operationId:input.operationId,journalSheet:journal.sheet,journalRowNumber:event.index,ticket:adminTicketView(confirmedRaw),meta:data.service.after,actor:actor,comment:input.comment||'',evidence:input.evidence||[],dependency:input.dependency||'',followAt:input.followAt||'',portalBaseUrl:request&&request.portalBaseUrl});
 var detail=serviceDetail(book,actor,input.ticketId);if(audit)detail.notification=audit;return detail;
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

function ticketEscapeHtml(text){
 return String(text==null?'':text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function ticketResolveAdminEmails(book,meta){
 var p=null;
 try{p=(book&&typeof serviceConfig==='function'?serviceConfig(book):null)||(meta&&meta.policy)||null;}catch(e){}
 var emails=[],seen={};
 function add(raw){
  var email=String(raw||'').trim().toLowerCase();
  if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!seen[email]){seen[email]=true;emails.push(email);}
 }
 if(p&&Array.isArray(p.admins)&&p.admins.length){
  p.admins.forEach(function(a){add(typeof a==='string'?a:(a&&a.email));});
 }else if(p&&Array.isArray(p.responsibles)&&p.responsibles.length){
  p.responsibles.forEach(function(r){
   var email=r&&r.email?String(r.email).trim().toLowerCase():'';
   if(email&&(r.admin===true||adminPermission(email)))add(email);
  });
 }
 if(!emails.length){
  ['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx'].forEach(function(email){
   try{if(adminPermission(email))add(email);}catch(e){add(email);}
  });
 }
 return emails;
}
function ticketResolveExecutorEmail(book,ticket,meta){
 if(meta&&meta.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(meta.email).trim()))return String(meta.email).trim().toLowerCase();
 if(meta&&meta.stageOwners){
  var ownerEmail=meta.stageOwners.resolve||meta.stageOwners.contain||meta.stageOwners.start;
  if(ownerEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ownerEmail).trim()))return String(ownerEmail).trim().toLowerCase();
 }
 var resp=ticket&&ticket.responsable?String(ticket.responsable).trim():'';
 if(!resp||resp==='SIN ASIGNAR'||resp==='Sin asignar')return null;
 var cleanResp=resp.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase();
 var p=null;
 try{p=(meta&&meta.policy)||(book&&typeof serviceConfig==='function'?serviceConfig(book):null);}catch(e){}
 if(p&&Array.isArray(p.responsibles)){
  for(var i=0;i<p.responsibles.length;i++){
   var r=p.responsibles[i];
   if(r&&r.email){
    var rName=String(r.name||'').trim();
    var cleanRName=rName.replace(/^PRUEBA\s*[—–-]\s*/i,'').trim().toLowerCase();
    if(rName.toLowerCase()===resp.toLowerCase()||cleanRName===cleanResp||cleanRName===resp.toLowerCase())return String(r.email).trim().toLowerCase();
   }
  }
 }
 if(cleanResp==='daniel lara')return 'd.lara@ciarm.edu.mx';
 if(cleanResp==='ezequiel conesa')return 'e.conesa@ciarm.edu.mx';
 if(cleanResp==='rodrigo valencia')return 'r.valencia@ciarm.edu.mx';
 return null;
}
function ticketBuildNotificationPlan(book,info){
 var ev=info.event,t=info.ticket||{},meta=info.meta||null,messages=[],skipped=[],seen={};
 var ownerEmail=t.correo&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t.correo).trim())?String(t.correo).trim().toLowerCase():null;
 var execEmail=ticketResolveExecutorEmail(book,t,meta);
 var adminEmails=ticketResolveAdminEmails(book,meta);
 var waitReq=(meta&&meta.waitRequest)||(meta&&Array.isArray(meta.waits)&&meta.waits.length?meta.waits[meta.waits.length-1].request:null)||{};
 var dependency=info.dependency||waitReq.dependency||'';
 var followAt=info.followAt||waitReq.followAt||'';
 var comment=String(info.comment||'').trim()||(ev==='ASSIGN'?String(t.observaciones||'').trim():'');
 var evidence=Array.isArray(info.evidence)&&info.evidence.length?info.evidence:(meta&&Array.isArray(meta.evidence)?meta.evidence:[]);

 function enqueue(role,to,subject,heading,intro,ctaLabel,ctaHash){
  if(!to){skipped.push({role:role,reason:'SIN_CORREO_'+role.toUpperCase(),target:role==='responsable'?(t.responsable||'SIN ASIGNAR'):''});return;}
  var norm=String(to).trim().toLowerCase(),seenKey=role+':'+norm;
  if(seen[seenKey]){skipped.push({role:role,reason:'DESTINATARIO_DUPLICADO',target:norm});return;}
  seen[seenKey]=true;
  var rawBase=(info&&info.portalBaseUrl)||(typeof CONFIG!=='undefined'&&CONFIG.PORTAL_BASE_URL)||(typeof PropertiesService!=='undefined'&&PropertiesService.getScriptProperties&&PropertiesService.getScriptProperties().getProperty('PORTAL_BASE_URL'))||'https://portal.ciarm.edu.mx';
  var baseUrl=String(rawBase).replace(/\/+$/,'');
  messages.push({role:role,to:norm,subject:subject,heading:heading,intro:intro,ctaLabel:ctaLabel,ctaUrl:baseUrl+'/'+ctaHash,comment:comment,dependency:dependency,followAt:followAt,evidence:evidence});
 }

 switch(ev){
  case 'CREATE':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud recibida '+t.id+' ('+t.tipo+')','Hemos recibido tu solicitud','Tu solicitud ha sido registrada con el folio '+t.id+' en estado NUEVO y fue turnada a Administración para su clasificación y asignación.','Ver mis solicitudes','#mis-solicitudes');
   adminEmails.forEach(function(adminEmail){
    enqueue('admin',adminEmail,'[Portal CIARM] Nueva solicitud por asignar '+t.id+' — '+t.tipo,'Nueva solicitud pendiente de asignación','Se ha registrado la solicitud '+t.id+' de '+t.solicitante+' ('+t.area+') en estado NUEVO. Ingresa al panel para asignarla.','Asignar solicitud','#admin-solicitudes');
   });
   break;
  case 'ASSIGN':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud asignada '+t.id+' ('+t.estado+')','Tu solicitud ha sido asignada','La solicitud '+t.id+' fue asignada a '+t.responsable+' con prioridad '+t.prioridad+' y fecha compromiso '+(t.fechaCompromiso||'por definir')+'.','Dar seguimiento','#validar-solicitudes');
   enqueue('responsable',execEmail,'[Portal CIARM] Nueva tarea asignada '+t.id+' — Prioridad '+t.prioridad,'Tienes una solicitud asignada','Se te ha asignado la solicitud '+t.id+' ('+t.tipo+') solicitada por '+t.solicitante+' ('+t.area+'), con prioridad '+t.prioridad+' y fecha compromiso '+(t.fechaCompromiso||'por definir')+'.','Gestionar mis tareas','#mis-tareas');
   break;
  case 'START':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud en proceso '+t.id,'Tu solicitud está siendo atendida','El responsable '+t.responsable+' ha iniciado la atención de tu solicitud '+t.id+', cambiando su estado a EN PROCESO.','Ver seguimiento','#validar-solicitudes');
   break;
  case 'CONTAIN':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Contención registrada en solicitud '+t.id,'Avance de contención en tu solicitud','El responsable '+t.responsable+' registró una acción de contención para tu solicitud '+t.id+' ('+t.estado+').','Ver seguimiento','#validar-solicitudes');
   break;
  case 'WAIT_REQUEST':
   adminEmails.forEach(function(adminEmail){
    enqueue('admin',adminEmail,'[Portal CIARM] Solicitud de pausa por autorizar '+t.id,'Solicitud de espera pendiente de autorización','El responsable '+t.responsable+' solicitó poner en espera la solicitud '+t.id+' por dependencia: '+(dependency||'No especificada')+'. Requiere autorización administrativa para pausar el SLA.','Revisar y autorizar','#seguimiento-servicio');
   });
   break;
  case 'WAIT_APPROVE':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud en espera '+t.id,'Tu solicitud se encuentra en espera','Tu solicitud '+t.id+' cambió al estado EN ESPERA debido a la dependencia: '+(dependency||'Externa')+'. Próximo seguimiento programado: '+(followAt||'por definir')+'.','Ver detalle','#validar-solicitudes');
   enqueue('responsable',execEmail,'[Portal CIARM] Pausa autorizada en tarea '+t.id+' (EN ESPERA)','Espera autorizada por Administración','Se ha autorizado la pausa de la solicitud '+t.id+' (EN ESPERA). El reloj de nivel de servicio permanece pausado hasta su reanudación.','Ver mis tareas','#mis-tareas');
   break;
  case 'RESUME':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Atención reanudada en solicitud '+t.id,'Se reanudó la atención de tu solicitud','La atención de tu solicitud '+t.id+' ha sido reanudada y se encuentra nuevamente EN PROCESO.','Ver seguimiento','#validar-solicitudes');
   enqueue('responsable',execEmail,'[Portal CIARM] Tarea reanudada '+t.id+' (EN PROCESO)','Tarea reactivada para atención','Administración ha reanudado la solicitud '+t.id+', regresando al estado EN PROCESO.','Ir a mis tareas','#mis-tareas');
   break;
  case 'RESOLVE':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud resuelta '+t.id+' — Pendiente de tu validación','Tu solicitud ha sido marcada como resuelta','El responsable '+t.responsable+' marcó tu solicitud '+t.id+' como RESUELTO. Por favor ingresa al portal para validar la entrega (Conforme — cerrar o Disconforme — devolver).','Validar mi solicitud','#validar-solicitudes');
   adminEmails.forEach(function(adminEmail){
    enqueue('admin',adminEmail,'[Portal CIARM] Solicitud resuelta por validar '+t.id,'Solicitud en espera de validación del solicitante','El responsable '+t.responsable+' marcó la solicitud '+t.id+' como RESUELTO. Queda pendiente la validación de conformidad por parte de '+t.solicitante+'.','Ver cumplimiento','#seguimiento-servicio');
   });
   break;
  case 'ACCEPT':
   enqueue('solicitante',ownerEmail,'[Portal CIARM] Solicitud cerrada con conformidad '+t.id,'Tu solicitud ha sido cerrada','Se registró tu validación de conformidad y la solicitud '+t.id+' ha quedado concluida en estado CERRADO.','Ver mis solicitudes','#validar-solicitudes');
   enqueue('responsable',execEmail,'[Portal CIARM] Conformidad confirmada en tarea '+t.id+' (CERRADO)','El solicitante validó tu entrega con conformidad','El solicitante '+t.solicitante+' aceptó la solución de la solicitud '+t.id+', quedando formalmente en estado CERRADO.','Ver historial de tareas','#historial-tareas');
   adminEmails.forEach(function(adminEmail){
    enqueue('admin',adminEmail,'[Portal CIARM] Cierre definitivo de solicitud '+t.id+' (CERRADO)','Solicitud cerrada con conformidad','El solicitante '+t.solicitante+' confirmó la resolución de la solicitud '+t.id+' atendida por '+t.responsable+', pasando a estado CERRADO.','Ver cumplimiento','#seguimiento-servicio');
   });
   break;
  case 'REJECT':
   enqueue('responsable',execEmail,'[Portal CIARM] Solicitud devuelta por disconformidad '+t.id+' (ASIGNADO)','Solicitud reabierta por disconformidad del solicitante','El solicitante '+t.solicitante+' devolvió la solicitud '+t.id+' indicando disconformidad. La tarea regresa al estado ASIGNADO para su atención.','Atender en mis tareas','#mis-tareas');
   adminEmails.forEach(function(adminEmail){
    enqueue('admin',adminEmail,'[Portal CIARM] Alerta de devolución en solicitud '+t.id+' (ASIGNADO)','Devolución por disconformidad registrada','El solicitante '+t.solicitante+' rechazó la resolución de la solicitud '+t.id+' asignada a '+t.responsable+'. El ticket regresó al estado ASIGNADO.','Ver cumplimiento','#seguimiento-servicio');
   });
   break;
  default:
   return null;
 }
 return {messages:messages,skipped:skipped};
}
function ticketRenderEmail(msg,t){
 var rows=[
  ['Folio',t.id||''],
  ['Estado actual',t.estado||''],
  ['Tipo de solicitud',t.tipo||''],
  ['Solicitante',(t.solicitante||'')+(t.area?' ('+t.area+')':'')],
  ['Responsable',t.responsable||'SIN ASIGNAR'],
  ['Prioridad',t.prioridad||t.urgencia||'POR DEFINIR'],
  ['Fecha compromiso',t.fechaCompromiso||t.plazo||'Por definir'],
  ['Descripción',t.descripcion||'']
 ];
 if(msg.comment)rows.push(['Comentario / Detalle',msg.comment]);
 if(msg.dependency)rows.push(['Dependencia de espera',msg.dependency]);
 if(msg.followAt)rows.push(['Próximo seguimiento',msg.followAt]);
 var textLines=[
  'PORTAL CIARM — GESTIÓN DE SOLICITUDES',
  msg.heading,
  '',
  msg.intro,
  ''
 ];
 rows.forEach(function(r){textLines.push(r[0]+': '+r[1]);});
 if(msg.evidence&&msg.evidence.length){
  textLines.push('Evidencias:');
  msg.evidence.forEach(function(u,i){textLines.push('  '+(i+1)+'. '+u);});
 }
 textLines.push('','Abrir en el Portal CIARM: '+msg.ctaUrl);
 var htmlRows=rows.map(function(r){
  return '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;width:36%;">'+ticketEscapeHtml(r[0])+'</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">'+ticketEscapeHtml(r[1])+'</td></tr>';
 }).join('');
 var htmlEvidence='';
 if(msg.evidence&&msg.evidence.length){
  htmlEvidence='<p style="margin:14px 0 6px;font-weight:600;color:#334155;">Evidencia adjunta:</p><ul style="margin:0 0 16px;padding-left:20px;">'+msg.evidence.map(function(u,i){return '<li><a href="'+ticketEscapeHtml(u)+'" style="color:#1d4ed8;">Evidencia '+(i+1)+'</a></li>';}).join('')+'</ul>';
 }
 var html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#ffffff;">'
  +'<div style="background:#0f172a;color:#ffffff;padding:16px 20px;"><span style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Portal CIARM · Gestión de Solicitudes</span><h2 style="margin:6px 0 0;font-size:18px;">'+ticketEscapeHtml(msg.heading)+'</h2></div>'
  +'<div style="padding:20px;"><p style="margin:0 0 16px;color:#1e293b;line-height:1.5;">'+ticketEscapeHtml(msg.intro)+'</p>'
  +'<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">'+htmlRows+'</table>'
  +htmlEvidence
  +'<div style="margin-top:20px;"><a href="'+ticketEscapeHtml(msg.ctaUrl)+'" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">'+ticketEscapeHtml(msg.ctaLabel)+'</a></div>'
  +'</div><div style="background:#f8fafc;padding:12px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">Notificación automática del Sistema de Solicitudes CIARM ('+ticketEscapeHtml(t.id||'')+').</div></div>';
 return {text:textLines.join('\n'),html:html};
}
function ticketNotifyTransition(book,info){
 try{
  if(!info||!info.event)return null;
  var existingPayload=null;
  if(info.journalSheet&&info.journalRowNumber){
   try{
    var rawCell=info.journalSheet.getRange(info.journalRowNumber,9).getValues()[0][0];
    if(rawCell)existingPayload=JSON.parse(rawCell);
   }catch(e){}
  }
  if(existingPayload&&existingPayload.notification)return existingPayload.notification;
  var plan=ticketBuildNotificationPlan(book,info);
  if(!plan)return null;
  var deliveries=[],hasMail=typeof MailApp!=='undefined'&&MailApp&&typeof MailApp.sendEmail==='function';
  plan.messages.forEach(function(msg){
   var rendered=ticketRenderEmail(msg,info.ticket||{});
   if(!hasMail){
    deliveries.push({role:msg.role,to:msg.to,subject:msg.subject,status:'SIN_PROVEEDOR_CORREO'});
    return;
   }
   try{
    MailApp.sendEmail({to:msg.to,subject:msg.subject,body:rendered.text,htmlBody:rendered.html,name:'Portal CIARM — Solicitudes'});
    deliveries.push({role:msg.role,to:msg.to,subject:msg.subject,status:'ENVIADO'});
   }catch(sendErr){
    deliveries.push({role:msg.role,to:msg.to,subject:msg.subject,status:'ERROR',error:String(sendErr&&sendErr.message?sendErr.message:sendErr)});
   }
  });
  var sentCount=deliveries.filter(function(d){return d.status==='ENVIADO';}).length;
  var errCount=deliveries.filter(function(d){return d.status==='ERROR';}).length;
  var overallStatus=deliveries.length===0?'OMITIDO':(errCount===0?(sentCount>0?'ENVIADO':'SIN_PROVEEDOR_CORREO'):(sentCount>0?'ERROR_PARCIAL':'ERROR'));
  var audit={event:info.event,timestamp:serviceNow(),status:overallStatus,deliveries:deliveries,skipped:plan.skipped};
  if(info.journalSheet&&info.journalRowNumber&&existingPayload){
   try{
    var updatedPayload=(existingPayload.request||existingPayload.receipts)?existingPayload:{request:existingPayload};
    updatedPayload.notification=audit;
    var serialized=JSON.stringify(updatedPayload);
    if(Utilities.newBlob(serialized).getBytes().length<=45000){
     info.journalSheet.getRange(info.journalRowNumber,9).setValue(serialized);
    }
   }catch(writeErr){}
  }
  return audit;
 }catch(err){
  return null;
 }
}
