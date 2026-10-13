/** Recoverable creation. Metadata and receipts only; file bytes never enter Sheets. */
function portalOperationId(id){if(typeof id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9-]{15,79}$/.test(id))adminFail('VALIDATION');return id;}
function portalJournal(book){
 var table=adminJournal(book);
 if(!table.headers[9])table.sheet.getRange(1,10).setValue('ACCIÓN');
 else if(table.headers[9]!=='ACCIÓN')adminFail('SCHEMA');
 return adminJournalTable(book);
}
function portalCreationEvent(book,actor,id){
 portalOperationId(id);var table=portalJournal(book),events=[];
 table.rows.slice(1).forEach(function(row,i){if(row[0]===id)events.push({row:row,rowNumber:i+2,table:table});});
 if(events.length>1)adminFail('OPERATION_REUSED');if(!events.length)adminFail('NOT_FOUND');
 var event=events[0];if(event.row[2]!==actor)adminFail('FORBIDDEN');if(event.row[9]!=='CREAR')adminFail('OPERATION_REUSED');
 try{event.payload=JSON.parse(event.row[8]);}catch(error){adminFail('SCHEMA');}
 return event;
}
function portalPersistEvent(event){var raw=JSON.stringify(event.payload);if(Utilities.newBlob(raw).getBytes().length>PORTAL_METADATA_LIMIT)adminFail('PAYLOAD_SIZE');event.table.sheet.getRange(event.rowNumber,9).setValue(raw);event.row[8]=raw;}
function portalCreationView(book,event){
 var result={operationId:event.row[0],state:event.row[1],finalizing:Boolean(event.payload.reservation),uploadedIndexes:event.payload.receipts.map(function(receipt){return receipt.index;})};
 if(result.state==='CONFIRMADO')result.ticket=adminTicketView(adminFindTicket(book,event.row[4]));
 return result;
}
function portalCreateRequest(request){
 if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(function(k){return ['operationId','tipo','descripcion','prioridadSolicitada','fechaProgramada','files'].indexOf(k)<0;}))adminFail('VALIDATION');
 portalOperationId(request.operationId);
 if(['Soporte Tecnológico / TI','Mantenimiento de Instalaciones','Limpieza','Intendencia','RRHH / Admin'].indexOf(request.tipo)<0)adminFail('VALIDATION');
 if(typeof request.descripcion!=='string'||!request.descripcion.trim()||['🟢 Normal','🔴 Urgente'].indexOf(request.prioridadSolicitada)<0)adminFail('VALIDATION');
 if(typeof request.fechaProgramada!=='string')adminFail('VALIDATION');
 if(request.fechaProgramada){var date=new Date(request.fechaProgramada+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(request.fechaProgramada)||isNaN(date.getTime())||date.toISOString().slice(0,10)!==request.fechaProgramada)adminFail('VALIDATION');}
 if(request.tipo==='Intendencia'&&!request.fechaProgramada)adminFail('VALIDATION');
 if(!Array.isArray(request.files)||request.files.length>5)adminFail('VALIDATION');
 var files=request.files.map(function(file,i){
  if(!file||Object.keys(file).some(function(k){return ['index','name','mime','size','sha256'].indexOf(k)<0;})||file.index!==i||!Number.isInteger(file.size)||file.size<1||file.size>10*1024*1024||typeof file.name!=='string'||!file.name.trim()||file.name.length>255||/[\x00-\x1f\\/]/.test(file.name)||typeof file.mime!=='string'||!/^image\/[a-z0-9.+-]+$|^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(file.mime)||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))adminFail('VALIDATION');
  return {index:i,name:file.name,mime:file.mime,size:file.size,sha256:file.sha256};
 });
 return {operationId:request.operationId,tipo:request.tipo,descripcion:request.descripcion.trim(),prioridadSolicitada:request.prioridadSolicitada,fechaProgramada:request.fechaProgramada,files:files};
}
function portalBeginCreate(book,actor,request){
 request=portalCreateRequest(request);var hash=adminHash(request),table=portalJournal(book);
 var found=table.rows.slice(1).filter(function(row){return row[0]===request.operationId;});
 if(found.length){var event=portalCreationEvent(book,actor,request.operationId);if(event.row[3]!==hash)adminFail('OPERATION_REUSED');return portalCreationView(book,event);}
 var projectedReceipts=request.files.map(function(file){return {index:file.index,fileId:'x'.repeat(128),url:'https://drive.google.com/'+ 'x'.repeat(512),sha256:file.sha256};});
 var projected={request:request,receipts:projectedReceipts,folderId:'x'.repeat(128),reservation:portalPreparedReservation(book,actor,request,projectedReceipts,table,adminTicketTable(book))};
 if(Utilities.newBlob(JSON.stringify(projected)).getBytes().length>PORTAL_METADATA_LIMIT-2048)adminFail('PAYLOAD_SIZE');
 table.sheet.appendRow([request.operationId,'PENDIENTE',actor,hash,'','null','null',Utilities.formatDate(new Date(),'America/Cancun','yyyy-MM-dd HH:mm:ss'),JSON.stringify({request:request,receipts:[],serviceCreation:typeof serviceCreationPlan==='function'?serviceCreationPlan(book,request):null}), 'CREAR']);
 return portalCreationView(book,portalCreationEvent(book,actor,request.operationId));
}
function portalPendingCreationIds(book){
 var sheet=book.getSheetByName('BITACORA TICKETS'),ids={};
 if(sheet)sheet.getDataRange().getValues().slice(1).forEach(function(row){if(row[9]==='CREAR'&&row[1]==='PENDIENTE'&&row[4])ids[row[4]]=true;});
 return ids;
}
function portalPendingCreation(book,id){return portalPendingCreationIds(book)[id]===true;}
function portalUploadAttachment(book,actor,input){
 if(!input||Object.keys(input).some(function(k){return ['operationId','index','name','mime','size','sha256','base64'].indexOf(k)<0;}))adminFail('VALIDATION');
 var event=portalCreationEvent(book,actor,input.operationId),expected=event.payload.request.files[input.index];
 if(!Number.isInteger(input.index)||!expected||['index','name','mime','size','sha256'].some(function(k){return expected[k]!==input[k];})||typeof input.base64!=='string'||input.base64.length>Math.ceil(10*1024*1024/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))adminFail('VALIDATION');
 var bytes=Utilities.base64Decode(input.base64);
 if(bytes.length!==expected.size||Utilities.base64Encode(bytes)!==input.base64||adminHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes))!==expected.sha256)adminFail('VALIDATION');
 if(event.payload.receipts.some(function(r){return r.index===input.index;}))return portalCreationView(book,event);
 if(event.row[1]!=='PENDIENTE'||event.payload.reservation)adminFail('CONFLICT');
 var root=DriveApp.getFolderById(CONFIG.ATTACHMENTS_FOLDER_ID),folder;
 if(event.payload.folderId)folder=DriveApp.getFolderById(event.payload.folderId);
 else{var candidates=root.getFoldersByName('portal-'+input.operationId);if(candidates.hasNext()){folder=candidates.next();if(candidates.hasNext())adminFail('CONFLICT');}else folder=root.createFolder('portal-'+input.operationId);event.payload.folderId=folder.getId();portalPersistEvent(event);}
 var name=input.index+'-'+expected.sha256+'_'+expected.name,files=folder.getFilesByName(name),file;
 if(files.hasNext()){file=files.next();if(files.hasNext()||adminHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,file.getBlob().getBytes()))!==expected.sha256)adminFail('CONFLICT');}
 else file=folder.createFile(Utilities.newBlob(bytes,expected.mime,name));
 file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
 event.payload.receipts.push({index:input.index,fileId:file.getId(),url:file.getUrl(),sha256:expected.sha256});
 event.payload.receipts.sort(function(a,b){return a.index-b.index;});portalPersistEvent(event);
 return portalCreationView(book,event);
}
function portalFinalizeCreate(book,actor,input){
 if(!input||Object.keys(input).some(function(k){return k!=='operationId';}))adminFail('VALIDATION');
 var event=portalCreationEvent(book,actor,input.operationId);
 if(event.row[1]==='CONFIRMADO')return portalCreationView(book,event);
 var data=event.payload,request=data.request;
 if(data.receipts.length!==request.files.length||request.files.some(function(file){return !data.receipts.some(function(receipt){return receipt.index===file.index&&receipt.sha256===file.sha256;});}))adminFail('VALIDATION');
 var table=adminTicketTable(book),headers=table.headers;
 if(!data.reservation){
  var slot=portalPreparedReservation(book,actor,request,data.receipts,event.table,table);
  data.reservation=slot;event.row[4]=slot.id;
  event.table.sheet.getRange(event.rowNumber,5).setValue(slot.id);portalPersistEvent(event);
 }
 var reserved=data.reservation,physical=reserved.rowNumber;
 var matches=table.rows.slice(1).map(function(row,i){return {row:row,i:i+2};}).filter(function(t){return String(t.row[headers.indexOf('ID TICKET')]||'')===reserved.id;});
 if(matches.length>1)adminFail('DUPLICATE_ID');if(matches.length===1)physical=matches[0].i;
 var range=table.sheet.getRange(physical,1,1,headers.length),values=range.getValues()[0],formulas=range.getFormulas()[0];
 var before=reserved.before.map(function(value,i){return reserved.formulas[i]?{formula:reserved.formulas[i]}:value;});
 event.table.sheet.getRange(event.rowNumber,6,1,2).setValues([[JSON.stringify(before),JSON.stringify(reserved.after)]]);
 var current=values.map(function(value,i){return formulas[i]?{formula:formulas[i]}:adminCellValue(value,headers[i]);});
 current.forEach(function(value,i){if(JSON.stringify(value)!==JSON.stringify(before[i])&&JSON.stringify(value)!==JSON.stringify(reserved.after[i]))adminFail('CONFLICT');});
 reserved.after.forEach(function(value,i){
  if(value&&typeof value==='object'&&value.formula)return;
  if(JSON.stringify(current[i])===JSON.stringify(value))return;
  if((headers[i].indexOf('FECHA')===0||headers[i]==='ÚLTIMA ACTUALIZACIÓN')&&value)value=Utilities.parseDate(value.length===10?value+' 00:00:00':value,'America/Cancun','yyyy-MM-dd HH:mm:ss');
  table.sheet.getRange(physical,i+1).setValue(value);
 });
 SpreadsheetApp.flush();
 var ticket=adminFindTicket(book,reserved.id,true);
 if(adminHash(adminSnapshot(ticket))!==adminHash(reserved.after))adminFail('CONFLICT');
 if(typeof serviceCreationRecover==='function')serviceCreationRecover(book,reserved.id,data.serviceCreation);
 event.table.sheet.getRange(event.rowNumber,2).setValue('CONFIRMADO');event.row[1]='CONFIRMADO';
 return portalCreationView(book,event);
}
function portalCreationStatus(book,actor,id){return portalCreationView(book,portalCreationEvent(book,actor,id));}

function portalPreparedReservation(book,actor,request,receipts,journal,table){
 var headers=table.headers;
 var slot=portalReserveTicketSlot(book,journal,new Date()),person=portalCollaborator(actor),now=Utilities.formatDate(new Date(),'America/Cancun','yyyy-MM-dd HH:mm:ss');
  var after=slot.before.map(function(value,i){return slot.formulas[i]?{formula:slot.formulas[i]}:value;});
  function set(h,value){var i=headers.indexOf(h);if(slot.formulas[i])adminFail('SCHEMA');after[i]=value;}
  set('ID TICKET',slot.id);set('FECHA SOLICITUD',now.slice(0,10));set('HORA SOLICITUD',now.slice(11));set('ÁREA SOLICITANTE',adminLiteral(person.area));set('SOLICITANTE',adminLiteral(person.nombreCompleto));set('CORREO SOLICITANTE',actor);set('TIPO DE SOLICITUD',request.tipo);set('DESCRIPCIÓN',adminLiteral(request.descripcion));set('PRIORIDAD','POR DEFINIR');set('RESPONSABLE','SIN ASIGNAR');set('ESTADO','NUEVO');if(!slot.formulas[headers.indexOf('SLA')])set('SLA','POR DEFINIR');set('ÚLTIMA ACTUALIZACIÓN',now);set('PRIORIDAD SOLICITADA',request.prioridadSolicitada);set('PLAZO SOLICITADO',request.fechaProgramada);set('ARCHIVOS ADJUNTOS',receipts.map(function(r){return r.url;}).join('\n'));
 slot.after=after;return slot;
}
