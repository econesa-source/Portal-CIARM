/** Signed self-service protocol; administrative operations retain their verifier. */
var PORTAL_METADATA_LIMIT = 50000;
var PORTAL_UPLOAD_LIMIT = 15 * 1024 * 1024;
function verifyTicketRequest(envelope,signature) {
 var secret=PropertiesService.getScriptProperties().getProperty('TICKETS_ADMIN_SECRET')||PropertiesService.getScriptProperties().getProperty('TICKETS_SHARED_SECRET');
 if(!secret)adminFail('NOT_CONFIGURED');
 if(typeof envelope!=='string'||envelope.length>PORTAL_UPLOAD_LIMIT)adminFail('PAYLOAD_SIZE');
 if(!adminEqual(adminHex(Utilities.computeHmacSha256Signature(envelope,secret,Utilities.Charset.UTF_8)),signature))adminFail('INVALID_SIGNATURE');
 var request;try{request=JSON.parse(envelope);}catch(error){adminFail('VALIDATION');}
 if(!request||typeof request!=='object'||Array.isArray(request))adminFail('VALIDATION');
 var limit=(request.action==='uploadAttachment'||request.action==='uploadEvidence')?PORTAL_UPLOAD_LIMIT:PORTAL_METADATA_LIMIT;
 if(Utilities.newBlob(envelope).getBytes().length>limit)adminFail('PAYLOAD_SIZE');
 if(!Number.isInteger(request.issuedAt)||Math.abs(Math.floor(Date.now()/1000)-request.issuedAt)>120)adminFail('EXPIRED');
 if(typeof request.nonce!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(request.nonce))adminFail('VALIDATION');
 return request;
}
function handleTicketEnvelope(envelope,signature) {
 var lock,locked=false,request,clock=ticketPerfClock();
 try {
  request=verifyTicketRequest(envelope,signature);clock.mark('verify');if(typeof SERVICE_TABLE_CACHE!=='undefined')SERVICE_TABLE_CACHE={};
  var collaborator=portalCollaborator(request.actor);clock.mark('identity');
  if(['list','detail','catalogs','assign'].indexOf(request.action)>=0){
   var delegated=handleAdminEnvelope(envelope,signature);
   if(request.perfProbe===true){
    var initial=clock.snapshot(),inner=delegated._perf||{};
    delegated._perf={
     verify:(initial.verify||0)+(inner.verify||0),
     identity:initial.identity||0,
     authorize:inner.authorize||0,
     lock:inner.lock||0,
     nonce:inner.nonce||0,
     open:inner.open||0,
     work:inner.work||0,
     total:initial.total
    };
   }
   return delegated;
  }
  lock=LockService.getScriptLock();locked=lock.tryLock(15000);clock.mark('lock');if(!locked)adminFail('BUSY');
  var cache=CacheService.getScriptCache(),key='ticket-admin-'+request.nonce;
  if(cache.get(key))adminFail('REPLAY');cache.put(key,'1',300);clock.mark('nonce');
  var book=(typeof ticketResolveBook==='function'?ticketResolveBook(request):SpreadsheetApp.openById(CONFIG.TICKETS_SPREADSHEET_ID)),data;clock.mark('open');
  switch(request.action){
   case 'serviceContext':data={protocol:'tickets-service-v1',enabled:Boolean(serviceConfig(book)),canAdmin:adminPermission(request.actor)};break;
   case 'serviceSettings':data=serviceSettings(book,request.actor);break;
   case 'saveServicePolicy':data=servicePublish(book,request.actor,request.payload);break;
   case 'serviceDetail':data=serviceDetail(book,request.actor,request.payload.id);break;
   case 'serviceTransition':data=serviceTransition(book,request.actor,request.payload,request);break;
   case 'serviceList':data=serviceList(book,request.actor,request.payload.kind);break;
   case 'capabilities':data={protocol:'tickets-portal-v1',serviceProtocol:'tickets-service-v1',maxFiles:5,maxFileBytes:10*1024*1024};break;
   case 'mine':data=adminTicketList(book).filter(function(ticket){return ticket.correo.trim().toLowerCase()===collaborator.correoDM03;});break;
   case 'beginCreate':data=portalBeginCreate(book,request.actor,request.payload);break;
   case 'uploadAttachment':data=portalUploadAttachment(book,request.actor,request.payload);break;
   case 'finalizeCreate':data=portalFinalizeCreate(book,request.actor,request.payload,request);break;
   case 'creationStatus':data=portalCreationStatus(book,request.actor,(request.payload||{}).operationId);break;
   case 'uploadEvidence':data=serviceUploadEvidence(book,request.actor,request.payload);break;
   default:adminFail('VALIDATION');
  }
  clock.mark('work');
  return ticketPerfReply({ok:true,data:data},request,clock);
 }catch(error){var result={ok:false,code:error.adminCode||'UPSTREAM'};if(request&&request.perfProbe&&error.adminDetail)result.detail=error.adminDetail;if(request&&request.action==='serviceTransition'&&book&&request.payload){try{var history=book.getSheetByName('BITACORA TICKETS');result.operationPending=history?history.getDataRange().getValues().slice(1).some(function(r){return r[0]===request.payload.operationId&&r[2]===request.actor;}):false;}catch(ignored){}}return ticketPerfReply(result,request,clock);}
 finally{if(typeof SERVICE_TABLE_CACHE!=='undefined')SERVICE_TABLE_CACHE=null;if(locked)lock.releaseLock();}
}
