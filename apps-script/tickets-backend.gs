/**
 * Backend Google Apps Script - Portal CIARM (v17.6.0)
 * Etapa 4 pequeña:
 * - Alta de tickets existente
 * - Adjuntos existente
 * - Nombre y Área del solicitante obtenidos desde DM03
 * - OAuth todavía NO implementado
 */
var CONFIG = {
  TICKETS_SPREADSHEET_ID: '1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs',
  DM03_SPREADSHEET_ID: '1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY',
  DM03_SHEET_NAME: 'Catálogo de colaboradores',
  ATTACHMENTS_FOLDER_ID: '103wSYfCuSwVKW_aTbTFr2O7b-JyuT619'
};
/**
 * POST — registra una nueva solicitud.
 */
function legacyTicketPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var rawData = "";
    if (e && e.parameter && e.parameter.postData) {
      rawData = e.parameter.postData;
    } else if (e && e.postData && e.postData.contents) {
      rawData = e.postData.contents;
    }
    if (!rawData) {
      throw new Error("No se recibieron datos en la petición POST");
    }
    var data = JSON.parse(rawData);
    var res = registrarSolicitudEnSheets(data);
    return ContentService
      .createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}
/**
 * Busca al colaborador en DM03 por Correo Ciarm.
 *
 * Durante la etapa demo el Portal todavía utiliza
 * econesa@ciarm.edu.mx, mientras DM03 tiene e.conesa@ciarm.edu.mx.
 *
 * Este alias es TEMPORAL y se elimina cuando implementemos OAuth.
 */
function obtenerColaboradorDM03(correoRecibido) {
  if (!correoRecibido) {
    return null;
  }
  var correoBusqueda = correoRecibido.toString().trim().toLowerCase();
  // Alias temporal exclusivamente para el usuario demo actual.
  if (correoBusqueda === 'econesa@ciarm.edu.mx') {
    correoBusqueda = 'e.conesa@ciarm.edu.mx';
  }
  var ssDM03 = SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID);
  var sheet = ssDM03.getSheetByName(CONFIG.DM03_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      'No se encontró la pestaña "' + CONFIG.DM03_SHEET_NAME + '" en DM03'
    );
  }
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 5) {
    throw new Error('DM03 no contiene registros de colaboradores');
  }
  // En DM03 los encabezados vigentes están en la fila 4.
  var headers = sheet
    .getRange(4, 1, 1, lastColumn)
    .getValues()[0]
    .map(function(value) {
      return value ? value.toString().trim() : '';
    });
  var colCorreo = headers.indexOf('Correo Ciarm');
  var colNombre = headers.indexOf('Nombre');
  var colApellido = headers.indexOf('Apellido');
  var colArea = headers.indexOf('Área');
  var colPuesto = headers.indexOf('Puesto');
  var colSeccion = headers.indexOf('Sección / Departamento');
  var colStatus = headers.indexOf('Status');
  if (
    colCorreo === -1 ||
    colNombre === -1 ||
    colApellido === -1 ||
    colArea === -1 ||
    colStatus === -1
  ) {
    throw new Error(
      'DM03 no contiene todas las columnas requeridas: ' +
      'Correo Ciarm, Nombre, Apellido, Área y Status'
    );
  }
  var rows = sheet
    .getRange(5, 1, lastRow - 4, lastColumn)
    .getValues();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var correoDM03 = row[colCorreo]
      ? row[colCorreo].toString().trim().toLowerCase()
      : '';
    if (correoDM03 === correoBusqueda) {
      var status = row[colStatus]
        ? row[colStatus].toString().trim()
        : '';
      if (status.toLowerCase() !== 'activo') {
        throw new Error(
          'El colaborador encontrado en DM03 no tiene Status Activo'
        );
      }
      var nombre = row[colNombre]
        ? row[colNombre].toString().trim()
        : '';
      var apellido = row[colApellido]
        ? row[colApellido].toString().trim()
        : '';
      return {
        correoDM03: correoDM03,
        nombreCompleto: (nombre + ' ' + apellido).trim(),
        area: row[colArea]
          ? row[colArea].toString().trim()
          : '',
        puesto: colPuesto !== -1 && row[colPuesto]
          ? row[colPuesto].toString().trim()
          : '',
        seccion: colSeccion !== -1 && row[colSeccion]
          ? row[colSeccion].toString().trim()
          : '',
        status: status
      };
    }
  }
  return null;
}
/**
 * Registra la solicitud en TICKETS.
 */
function registrarSolicitudEnSheets(data) {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = SpreadsheetApp.openById(CONFIG.TICKETS_SPREADSHEET_ID);
  }
  var sheet = ss.getSheetByName('TICKETS') || ss.getSheets()[0];
  // Determinar la primera fila libre contando folios TKT-
  var colAValues = sheet.getRange("A1:A300").getValues();
  var ticketCount = 0;
  for (var i = 0; i < colAValues.length; i++) {
    var cellVal = colAValues[i][0]
      ? colAValues[i][0].toString().trim()
      : "";
    if (cellVal.indexOf("TKT-") === 0) {
      ticketCount++;
    }
  }
  var nextRow = ticketCount + 2;
  var nextNum = ticketCount + 1;
  var year = new Date().getFullYear();
  var idTicket =
    "TKT-" + year + "-" + String(nextNum).padStart(5, '0');
  var now = new Date();
  var fechaSolicitud = Utilities.formatDate(
    now,
    "GMT-5",
    "dd/MM/yyyy"
  );
  var horaSolicitud = Utilities.formatDate(
    now,
    "GMT-5",
    "HH:mm:ss"
  );
  /**
   * DATOS DEL FORMULARIO
   */
  var tipoFinal =
    (data.tipo && data.tipo.trim() !== "")
      ? data.tipo.trim()
      : "Soporte Tecnológico / TI";
  var descFinal =
    (data.descripcion && data.descripcion.trim() !== "")
      ? data.descripcion.trim()
      : "Sin descripción detallada enviada";
  var correoRecibido =
    (data.correo && data.correo.trim() !== "")
      ? data.correo.trim().toLowerCase()
      : "econesa@ciarm.edu.mx";
  /**
   * DATOS DEL COLABORADOR DESDE DM03
   */
  var colaboradorDM03 = obtenerColaboradorDM03(correoRecibido);
  var solicitanteFinal;
  var areaFinal;
  if (colaboradorDM03) {
    solicitanteFinal =
      colaboradorDM03.nombreCompleto || data.solicitante || "Usuario CIARM";
    areaFinal =
      colaboradorDM03.area || "General";
  } else {
    // Durante esta etapa no bloqueamos todavía el ticket
    // si DM03 no encuentra al usuario.
    // OAuth/autorización se resolverán después.
    solicitanteFinal =
      (data.solicitante && data.solicitante.trim() !== "")
        ? data.solicitante.trim()
        : "Usuario CIARM";
    areaFinal = "General";
  }
  /**
   * IMPORTANTE:
   * Durante esta etapa seguimos guardando el correo recibido
   * por el Portal para mantener visibles los tickets históricos
   * en "Mis Solicitudes".
   *
   * Cuando implementemos OAuth migraremos al Correo Ciarm canónico.
   */
  var correoFinal = correoRecibido;
  /**
   * ADJUNTOS
   */
  var attachmentUrls = [];
  var parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(
      CONFIG.ATTACHMENTS_FOLDER_ID
    );
  } catch (e) {
    parentFolder = DriveApp.getRootFolder();
  }
  var ticketFolder =
    parentFolder.createFolder(idTicket + "_Adjuntos");
  if (
    data.adjuntos &&
    Array.isArray(data.adjuntos) &&
    data.adjuntos.length > 0
  ) {
    data.adjuntos.forEach(function(fileObj) {
      if (fileObj.base64 && fileObj.nombre) {
        var bytes =
          Utilities.base64Decode(fileObj.base64);
        var blob =
          Utilities.newBlob(
            bytes,
            fileObj.mimeType || 'application/octet-stream',
            fileObj.nombre
          );
        var file = ticketFolder.createFile(blob);
        file.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
        attachmentUrls.push(file.getUrl());
      }
    });
  }
  var urlsString =
    attachmentUrls.length > 0
      ? attachmentUrls.join("\n")
      : ticketFolder.getUrl();
  /**
   * FILA TICKETS A:X
   */
  var rowData = [
    idTicket,                           // A ID TICKET
    fechaSolicitud,                     // B FECHA
    horaSolicitud,                      // C HORA
    areaFinal,                          // D ÁREA SOLICITANTE ← DM03
    solicitanteFinal,                   // E SOLICITANTE ← DM03
    correoFinal,                        // F CORREO
    tipoFinal,                          // G TIPO
    descFinal,                          // H DESCRIPCIÓN
    "POR DEFINIR",                      // I PRIORIDAD
    "SIN ASIGNAR",                      // J RESPONSABLE
    "",                                 // K FECHA ASIGNACIÓN
    data.fechaProgramada || "",         // L FECHA COMPROMISO
    "NUEVO",                            // M ESTADO
    "",                                 // N
    "",                                 // O
    "",                                 // P
    "",                                 // Q
    "POR DEFINIR",                      // R SLA
    "",                                 // S PUNTOS
    "",                                 // T OBSERVACIONES
    fechaSolicitud + " " +
      horaSolicitud.substring(0,5),     // U ÚLTIMA ACTUALIZACIÓN
    data.prioridad || "🟢 Normal",      // V PRIORIDAD SOLICITADA
    "",                                 // W PLAZO
    urlsString                          // X ARCHIVOS
  ];
  sheet
    .getRange(nextRow, 1, 1, rowData.length)
    .setValues([rowData]);
  return {
    status: "success",
    idTicket: idTicket,
    rowWritten: nextRow,
    dm03: colaboradorDM03
      ? {
          encontrado: true,
          area: colaboradorDM03.area,
          puesto: colaboradorDM03.puesto,
          seccion: colaboradorDM03.seccion
        }
      : {
          encontrado: false
        }
  };
}
/**
 * GET — listado actual de tickets.
 */
function legacyTicketGet(e) {
  try {
    var ss;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      ss = SpreadsheetApp.openById(
        CONFIG.TICKETS_SPREADSHEET_ID
      );
    }
    var sheet =
      ss.getSheetByName('TICKETS') || ss.getSheets()[0];
    var data = sheet.getDataRange().getDisplayValues();
    var filterEmail =
      (e && e.parameter && e.parameter.email)
        ? e.parameter.email.toLowerCase().trim()
        : "";
    var tickets = [];
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var ticketId =
          data[i][0]
            ? data[i][0].toString().trim()
            : "";
        var correoSolicitante =
          data[i][5]
            ? data[i][5].toString().toLowerCase().trim()
            : "";
        if (ticketId.indexOf('TKT-') === 0) {
          if (
            !filterEmail ||
            correoSolicitante === filterEmail ||
            filterEmail === "admin@ciarm.edu.mx"
          ) {
            var fechaRaw =
              data[i][1]
                ? data[i][1].toString()
                : "";
            var fechaSolicitud = data[i][1] || "";
var horaSolicitud = data[i][2] || "";
tickets.push({
  id: ticketId,
  fecha: fechaSolicitud,
  hora: horaSolicitud,
  tipo: data[i][6] || data[i][3] || 'General',
              desc:
                data[i][7] ||
                'Sin descripción registrada',
              descripcion:
                data[i][7] ||
                'Sin descripción registrada',
              estado:
                data[i][12] ||
                'NUEVO',
              driveUrl:
                data[i][23] ||
                ''
            });
          }
        }
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify(tickets))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
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

function adminFail(code) { var error = new Error(code); error.adminCode = code; throw error; }
function adminHex(bytes) { return bytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function adminHash(value) { return adminHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)); }
function adminEqual(a,b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var diff=0; for(var i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
function adminTable(book,name,required,valuesOnly) {
 var sheet=book.getSheetByName(name); if(!sheet) adminFail('SCHEMA');
 // Catalogs and authorization tables never use formula text. Avoid an extra
 // Spreadsheet service read in those paths. Ticket snapshots remain unchanged.
 var range=sheet.getDataRange();var rows=range.getValues();var formulas=valuesOnly?null:range.getFormulas();var headers=rows[0].map(function(v){return String(v).trim();});
 required.forEach(function(h){if(headers.indexOf(h)<0 || headers.indexOf(h)!==headers.lastIndexOf(h)) adminFail('SCHEMA');});
 return {sheet:sheet,headers:headers,rows:rows,formulas:formulas};
}
function adminPermission(actor) {
 if(['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx'].indexOf(actor)<0) return false;
 var table=adminTable(SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID),'Permisos de usuario',['Correo Ciarm','Status','Sistema de tickets'],true);
 var matches=table.rows.slice(1).filter(function(row){return String(row[table.headers.indexOf('Correo Ciarm')]||'').trim().toLowerCase()===actor;});
 return matches.length===1 && String(matches[0][table.headers.indexOf('Status')]||'').trim().toLowerCase()==='activo' && String(matches[0][table.headers.indexOf('Sistema de tickets')]||'').trim()==='Administrador';
}
function handleAdminEnvelope(envelope,signature) {
 var lock=LockService.getScriptLock();var locked=false,request,clock=ticketPerfClock();
 try {
  var secret=PropertiesService.getScriptProperties().getProperty('TICKETS_ADMIN_SECRET');
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
  var book=SpreadsheetApp.openById(CONFIG.TICKETS_SPREADSHEET_ID);clock.mark('open');
  var data;
  switch(request.action) {
   case 'list': data=adminTicketList(book);break;
   case 'detail': data=adminTicketView(adminFindTicket(book,(request.payload||{}).id));var pending=adminPendingOperation(book,data.id,request.actor);if(pending)data.pendingOperation=pending;break;
   case 'catalogs': data=adminCatalogs(book);break;
   case 'assign': data=adminAssign(book,request.actor,request.payload);break;
   default:adminFail('VALIDATION');
  }
  clock.mark('work');return ticketPerfReply({ok:true,data:data},request,clock);
 } catch(err) {
  var result={ok:false,code:err.adminCode||'UPSTREAM'};
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
 if(ADMIN_JOURNAL_HEADERS.some(function(h,i){return table.headers[i]!==h;}))adminFail('SCHEMA');
 return table;
}
function adminPendingOperation(book,id,actor) {
 if(!book.getSheetByName('BITACORA TICKETS'))return null;
 var table=adminJournalTable(book);var rows=table.rows.slice(1).filter(function(row){return (!row[9]||row[9]==='ASIGNAR')&&row[1]==='PENDIENTE'&&row[2]===actor&&row[4]===id;});
 if(rows.length>1)adminFail('PENDING_OPERATION');
 if(rows.length!==1)return null;var data=JSON.parse(rows[0][8]);return data.request||data;
}
function adminAssign(book,actor,payload) {
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
  return {ticket:adminTicketView(adminFindTicket(book,payload.ticketId)),operationId:payload.operationId};
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
 return {ticket:adminTicketView(adminFindTicket(book,payload.ticketId)),operationId:payload.operationId};
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

/** Signed self-service protocol; administrative operations retain their verifier. */
var PORTAL_METADATA_LIMIT = 50000;
var PORTAL_UPLOAD_LIMIT = 15 * 1024 * 1024;
function verifyTicketRequest(envelope,signature) {
 var secret=PropertiesService.getScriptProperties().getProperty('TICKETS_ADMIN_SECRET');
 if(!secret)adminFail('NOT_CONFIGURED');
 if(typeof envelope!=='string'||envelope.length>PORTAL_UPLOAD_LIMIT)adminFail('PAYLOAD_SIZE');
 if(!adminEqual(adminHex(Utilities.computeHmacSha256Signature(envelope,secret,Utilities.Charset.UTF_8)),signature))adminFail('INVALID_SIGNATURE');
 var request;try{request=JSON.parse(envelope);}catch(error){adminFail('VALIDATION');}
 if(!request||typeof request!=='object'||Array.isArray(request))adminFail('VALIDATION');
 var limit=request.action==='uploadAttachment'?PORTAL_UPLOAD_LIMIT:PORTAL_METADATA_LIMIT;
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
  var book=SpreadsheetApp.openById(CONFIG.TICKETS_SPREADSHEET_ID),data;clock.mark('open');
  switch(request.action){
   case 'serviceContext':data={protocol:'tickets-service-v1',enabled:Boolean(serviceConfig(book)),canAdmin:adminPermission(request.actor)};break;
   case 'serviceSettings':data=serviceSettings(book,request.actor);break;
   case 'saveServicePolicy':data=servicePublish(book,request.actor,request.payload);break;
   case 'serviceDetail':data=serviceDetail(book,request.actor,request.payload.id);break;
   case 'serviceTransition':data=serviceTransition(book,request.actor,request.payload);break;
   case 'serviceList':data=serviceList(book,request.actor,request.payload.kind);break;
   case 'capabilities':data={protocol:'tickets-portal-v1',serviceProtocol:'tickets-service-v1',maxFiles:5,maxFileBytes:10*1024*1024};break;
   case 'mine':data=adminTicketList(book).filter(function(ticket){return ticket.correo.trim().toLowerCase()===collaborator.correoDM03;});break;
   case 'beginCreate':data=portalBeginCreate(book,request.actor,request.payload);break;
   case 'uploadAttachment':data=portalUploadAttachment(book,request.actor,request.payload);break;
   case 'finalizeCreate':data=portalFinalizeCreate(book,request.actor,request.payload);break;
   case 'creationStatus':data=portalCreationStatus(book,request.actor,(request.payload||{}).operationId);break;
   default:adminFail('VALIDATION');
  }
  clock.mark('work');
  return ticketPerfReply({ok:true,data:data},request,clock);
 }catch(error){var result={ok:false,code:error.adminCode||'UPSTREAM'};if(request&&request.action==='serviceTransition'&&book&&request.payload){try{var history=book.getSheetByName('BITACORA TICKETS');result.operationPending=history?history.getDataRange().getValues().slice(1).some(function(r){return r[0]===request.payload.operationId&&r[2]===request.actor;}):false;}catch(ignored){}}return ticketPerfReply(result,request,clock);}
 finally{if(typeof SERVICE_TABLE_CACHE!=='undefined')SERVICE_TABLE_CACHE=null;if(locked)lock.releaseLock();}
}

/** Canonical collaborator identity from the official DM03 catalogue. */
function portalCollaborator(actor) {
 if(typeof actor!=='string'||actor!==actor.trim().toLowerCase()||!/^[a-z0-9][a-z0-9._+-]*@ciarm\.edu\.mx$/.test(actor))adminFail('FORBIDDEN');
 var sheet=SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID).getSheetByName(CONFIG.DM03_SHEET_NAME);
 if(!sheet||sheet.getLastRow()<5)adminFail('FORBIDDEN');
 var headers=sheet.getRange(4,1,1,sheet.getLastColumn()).getValues()[0].map(function(v){return String(v).trim();});
 var names=['Correo Ciarm','Nombre','Apellido','Área','Status'];
 names.forEach(function(h){if(headers.indexOf(h)<0||headers.indexOf(h)!==headers.lastIndexOf(h))adminFail('SCHEMA');});
 var rows=sheet.getRange(5,1,sheet.getLastRow()-4,headers.length).getValues().filter(function(row){return String(row[headers.indexOf('Correo Ciarm')]||'').trim().toLowerCase()===actor;});
 if(rows.length!==1||String(rows[0][headers.indexOf('Status')]||'').trim().toLowerCase()!=='activo')adminFail('FORBIDDEN');
 return {correoDM03:actor,nombreCompleto:[rows[0][headers.indexOf('Nombre')],rows[0][headers.indexOf('Apellido')]].join(' ').trim(),area:String(rows[0][headers.indexOf('Área')]||'').trim(),status:'Activo'};
}

/** Called only while holding the shared script lock. Never counts a fixed range. */
function portalReserveTicketSlot(book,journal,now) {
 var table=adminTicketTable(book),idColumn=table.headers.indexOf('ID TICKET'),maximum=0,seen={},rowNumber=table.sheet.getLastRow()+1;
 function numberOf(value){
  var match=/^TKT-\d{4}-(\d+)$/.exec(value);if(!match)adminFail('SCHEMA');
  var n=Number(match[1]);if(!Number.isSafeInteger(n)||n<1)adminFail('SCHEMA');return n;
 }
 table.rows.slice(1).forEach(function(row){
  var id=String(row[idColumn]||'').trim();if(!id)return;
  if(seen[id])adminFail('DUPLICATE_ID');seen[id]=true;
  if(id.indexOf('TKT-')===0)maximum=Math.max(maximum,numberOf(id));
 });
 if(journal)journal.rows.slice(1).forEach(function(event){
  if(event[4])maximum=Math.max(maximum,numberOf(String(event[4])));
  if(event[1]==='PENDIENTE'&&event[9]==='CREAR'){
   var payload;try{payload=JSON.parse(event[8]);}catch(error){adminFail('SCHEMA');}
   var reserved=payload.reservation;
   if(reserved){if(!Number.isSafeInteger(reserved.rowNumber)||reserved.rowNumber<2)adminFail('SCHEMA');rowNumber=Math.max(rowNumber,reserved.rowNumber+1);}
  }
 });
 if(!Number.isSafeInteger(maximum+1))adminFail('SCHEMA');
 rowNumber=Math.max(2,rowNumber);
 if(typeof table.sheet.getMaxRows==='function'&&rowNumber>table.sheet.getMaxRows())table.sheet.insertRowsAfter(table.sheet.getMaxRows(),rowNumber-table.sheet.getMaxRows());
 var range=table.sheet.getRange(rowNumber,1,1,table.headers.length),before=range.getValues()[0],formulas=range.getFormulas()[0];
 if(before.some(function(value,i){return value!==''&&value!==null&&!formulas[i];}))adminFail('CONFLICT');
 return {id:'TKT-'+Utilities.formatDate(now,'America/Cancun','yyyy-MM-dd').slice(0,4)+'-'+String(maximum+1).padStart(5,'0'),rowNumber:rowNumber,before:before.map(function(value,i){return adminCellValue(value,table.headers[i]);}),formulas:formulas};
}

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

/** Source-local business clock. Pure functions; no ticket mutations or inferred identity. */
function serviceDefaultPolicy(){return {version:1,timeZone:'America/Cancun',startHour:8,endHour:16,days:[1,2,3,4,5],holidays:[],assignmentHours:8,validationHours:16,levels:{CRITICA:{assign:1,start:1,contain:4,resolve:null},URGENTE:{assign:4,start:4,resolve:8},ALTA:{assign:8,start:8,resolve:16},MEDIA:{assign:8,start:16,resolve:40},BAJA:{assign:8,start:24,resolve:80}}};}
function serviceValidatePolicy(value){
 if(!value||value.timeZone!=='America/Cancun'||!Number.isInteger(value.version)||value.version<1||!Number.isInteger(value.startHour)||!Number.isInteger(value.endHour)||value.startHour<0||value.endHour>24||value.startHour>=value.endHour)throw Error('SERVICE_POLICY');
 if(!Array.isArray(value.days)||!value.days.length||new Set(value.days).size!==value.days.length||value.days.some(function(day){return !Number.isInteger(day)||day<0||day>6;}))throw Error('SERVICE_POLICY');
 if(!Array.isArray(value.holidays)||value.holidays.some(function(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return true;var d=new Date(date+'T00:00:00Z');return isNaN(d.getTime())||d.toISOString().slice(0,10)!==date;}))throw Error('SERVICE_POLICY');
 ['assignmentHours','validationHours'].forEach(function(k){if(!Number.isFinite(value[k])||value[k]<=0||value[k]>87600)throw Error('SERVICE_POLICY');});
 ['CRITICA','URGENTE','ALTA','MEDIA','BAJA'].forEach(function(level){var r=value.levels&&value.levels[level];if(!r)throw Error('SERVICE_POLICY');['assign','start'].concat(level==='CRITICA'?['contain']:['resolve']).forEach(function(k){if(!Number.isFinite(r[k])||r[k]<=0||r[k]>87600)throw Error('SERVICE_POLICY');});if(level==='CRITICA'&&r.resolve!==null)throw Error('SERVICE_POLICY');});
 return JSON.parse(JSON.stringify(value));
}
function serviceWindow(date,policy){
 // Cancun is fixed UTC-05:00. The policy rejects other zones rather than reinterpreting dates.
 var local=new Date(date.getTime()-5*3600000),day=local.toISOString().slice(0,10),base=Date.parse(day+'T00:00:00Z')+5*3600000;
 return {start:base+policy.startHour*3600000,end:base+policy.endHour*3600000,next:base+86400000,working:policy.days.indexOf(local.getUTCDay())>=0&&policy.holidays.indexOf(day)<0};
}
function serviceDeadline(received,hours,input){
 var policy=serviceValidatePolicy(input),cursor=new Date(received).getTime(),remaining=hours*3600000;
 if(!Number.isFinite(cursor)||!Number.isFinite(remaining)||remaining<0||hours>87600)throw Error('SERVICE_DATE');
 if(remaining===0)return new Date(cursor);
 for(var i=0;i<36600;i++){var w=serviceWindow(new Date(cursor),policy);cursor=Math.max(cursor,w.start);if(w.working&&cursor<w.end){var available=w.end-cursor;if(remaining<=available)return new Date(cursor+remaining);remaining-=available;}cursor=w.next;}
 throw Error('SERVICE_DATE');
}
function serviceElapsedHours(from,to,input){
 var policy=serviceValidatePolicy(input),cursor=new Date(from).getTime(),end=new Date(to).getTime(),total=0;
 if(!Number.isFinite(cursor)||!Number.isFinite(end)||end<cursor||end-cursor>36600*86400000)throw Error('SERVICE_DATE');
 while(cursor<end){var w=serviceWindow(new Date(cursor),policy);if(w.working)total+=Math.max(0,Math.min(end,w.end)-Math.max(cursor,w.start));cursor=w.next;}
 return total/3600000;
}

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
function serviceAssignmentPlan(book,ticket,changes){var p=serviceConfig(book);if(!p)return null;var target=p.responsibles.filter(function(r){return r.name===changes.responsable;});if(target.length!==1)adminFail('RESPONSIBLE_ACCOUNT');portalCollaborator(target[0].email);var before=serviceCase(book,adminTicketView(ticket).id);if(!before&&['EN PROCESO','EN ESPERA'].indexOf(adminTicketView(ticket).estado)>=0)adminFail('SERVICE_MIGRATION_REQUIRED');var after=before?JSON.parse(JSON.stringify(before)):{policy:p,createdAt:serviceNow(),historical:true,cycles:[],waits:[]};p=after.policy;var now=serviceNow();after.email=target[0].email;after.responsible=changes.responsable;
 if(!after.assignedAt){after.assignedAt=now;after.firstAssignedAt=now;if(after.assignmentDeadline){var limit=serviceDeadline(serviceDate(after.createdAt),p.levels[changes.prioridad].assign,p);if(limit.getTime()<serviceDate(after.assignmentDeadline).getTime())after.assignmentDeadline=Utilities.formatDate(limit,'America/Cancun','yyyy-MM-dd HH:mm:ss');}after.priority=changes.prioridad;after.assignedBy=null;after.deadlines={start:Utilities.formatDate(serviceDeadline(serviceDate(now),p.levels[changes.prioridad].start,p),'America/Cancun','yyyy-MM-dd HH:mm:ss')};var level=p.levels[changes.prioridad];if(level.resolve)after.deadlines.resolve=Utilities.formatDate(serviceDeadline(serviceDate(now),level.resolve,p),'America/Cancun','yyyy-MM-dd HH:mm:ss');if(level.contain){after.deadlines.resolve=Utilities.formatDate(new Date(serviceWindow(serviceDate(changes.fechaCompromiso+' 00:00:00'),p).end),'America/Cancun','yyyy-MM-dd HH:mm:ss');}if(level.contain)after.deadlines.contain=Utilities.formatDate(serviceDeadline(serviceDate(now),level.contain,p),'America/Cancun','yyyy-MM-dd HH:mm:ss');}
 after.stageOwners=after.stageOwners||{};if(!after.originalDeadlines){after.originalDeadlines=JSON.parse(JSON.stringify(after.deadlines));after.originalPriority=after.priority;}if(before&&before.assignedAt&&after.priority!==changes.prioridad){var previous=after.priority;after.priority=changes.prioridad;after.priorityChanges=after.priorityChanges||[];after.priorityChanges.push({from:previous,to:after.priority,date:now});var level=p.levels[after.priority];['start','contain','resolve'].forEach(function(k){if(k==='start'&&after.startedAt||k==='contain'&&after.containedAt||k==='resolve'&&after.resolvedAt)return;var candidate;if(k==='resolve'&&after.priority==='CRITICA')candidate=new Date(serviceWindow(serviceDate(changes.fechaCompromiso+' 00:00:00'),p).end);else if(level[k])candidate=serviceDeadline(serviceDate(now),level[k],p);if(candidate&&(!after.deadlines[k]||candidate.getTime()<serviceDate(after.deadlines[k]).getTime()))after.deadlines[k]=Utilities.formatDate(candidate,'America/Cancun','yyyy-MM-dd HH:mm:ss');});}
 return {before:before,after:after};}
function serviceAssignmentRecover(book,id,payload){if(payload.service)serviceSaveCase(book,id,payload.service.before,payload.service.after);}
function servicePending(book,id,operationId){var sheet=book.getSheetByName('BITACORA TICKETS');return sheet&&sheet.getDataRange().getValues().slice(1).some(function(r){return r[4]===id&&r[1]==='PENDIENTE'&&r[0]!==operationId;});}
function serviceAuthorize(ticket,meta,actor,event){var admin=adminPermission(actor),owner=ticket.correo.trim().toLowerCase()===actor,executor=meta&&meta.email===actor;var allowed=event==='ACCEPT'||event==='REJECT'?owner:event==='WAIT_APPROVE'||event==='EXCEPTION'||event==='TRIAGE'?admin:event==='RESUME'?(executor||admin):executor;if(!allowed)adminFail('FORBIDDEN');}
function serviceDetail(book,actor,id){var raw=adminFindTicket(book,id),ticket=adminTicketView(raw),meta=serviceCase(book,id);if(!adminPermission(actor)&&ticket.correo!==actor&&(!meta||meta.email!==actor))adminFail('FORBIDDEN');var events=book.getSheetByName('BITACORA TICKETS');var history=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[1]==='CONFIRMADO';}).map(function(r){var data;try{data=JSON.parse(r[8]);}catch(e){data={};}return {action:r[9]==='SERVICIO'&&data.request?data.request.event:r[9]||'ASIGNAR',actor:r[2],date:adminCellValue(r[7],'ÚLTIMA ACTUALIZACIÓN'),comment:data.request?data.request.comment||(data.request.changes||{}).observacion||(data.request.priority?'Prioridad: '+data.request.priority:''):data.comment||'',evidence:data.request?data.request.evidence||[]:[]};}):[];
 var pending=events?events.getDataRange().getValues().slice(1).filter(function(r){return r[4]===id&&r[9]==='SERVICIO'&&r[1]==='PENDIENTE'&&r[2]===actor;}):[];if(pending.length>1)adminFail('PENDING_OPERATION');var operation=pending.length?JSON.parse(pending[0][8]).request:null;
 return {ticket:ticket,pendingOperation:operation||undefined,service:meta?serviceView(meta,ticket):null,history:history,roles:{admin:adminPermission(actor),owner:ticket.correo.trim().toLowerCase()===actor,executor:Boolean(meta&&meta.email===actor)}};}
function serviceView(meta,ticket){var value=JSON.parse(JSON.stringify(meta)),now=new Date();value.effectiveDeadlines={};Object.keys(value.deadlines||{}).forEach(function(k){var completed=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;var cutoff=completed?serviceDate(completed):now,pauseHours=0;if(k!=='start')value.waits.forEach(function(w){var from=serviceDate(w.from),to=w.to?serviceDate(w.to):now;if(to>cutoff)to=cutoff;if(to>from)pauseHours+=serviceElapsedHours(from,to,value.policy);});value.effectiveDeadlines[k]=Utilities.formatDate(serviceDeadline(serviceDate(value.deadlines[k]),pauseHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');});value.overdue=Object.keys(value.effectiveDeadlines).filter(function(k){var done=k==='start'?value.startedAt:k==='resolve'?value.resolvedAt:value.containedAt;return serviceDate(done||serviceNow()).getTime()>serviceDate(value.effectiveDeadlines[k]).getTime();});if(value.resolvedAt){value.validationDeadline=Utilities.formatDate(serviceDeadline(serviceDate(value.resolvedAt),value.policy.validationHours,value.policy),'America/Cancun','yyyy-MM-dd HH:mm:ss');value.validationOverdue=serviceDate(value.closedAt||serviceNow()).getTime()>serviceDate(value.validationDeadline).getTime();}var wait=value.waits[value.waits.length-1];if(wait&&!wait.to){value.waitFollowAt=wait.request.followAt;value.waitFollowOverdue=now.getTime()>serviceDate(value.waitFollowAt).getTime();}value.assignmentOverdue=value.assignmentDeadline?serviceDate(value.firstAssignedAt||value.assignedAt||serviceNow()).getTime()>serviceDate(value.assignmentDeadline).getTime():null;value.totalHours=(now.getTime()-serviceDate(value.createdAt).getTime())/3600000;return value;}

function serviceTransition(book,actor,input){
 portalOperationId(input.operationId);if(typeof input.expectedVersion!=='string'||typeof input.ticketId!=='string'||typeof input.comment!=='string'||input.comment.length>4000)adminFail('VALIDATION');var valid=['TRIAGE','START','WAIT_REQUEST','WAIT_APPROVE','RESUME','CONTAIN','RESOLVE','ACCEPT','REJECT','EXCEPTION'];if(valid.indexOf(input.event)<0)adminFail('VALIDATION');var raw=adminFindTicket(book,input.ticketId),ticket=adminTicketView(raw),meta=serviceCase(book,input.ticketId);if(!meta)adminFail('SERVICE_NOT_ENABLED');serviceAuthorize(ticket,meta,actor,input.event);
 var journal=portalJournal(book),hash=adminHash(input),events=journal.rows.slice(1).map(function(r,i){return {row:r,index:i+2};}).filter(function(e){return e.row[0]===input.operationId;});if(events.length>1)adminFail('OPERATION_REUSED');var event;
 if(events.length){event=events[0];if(event.row[9]!=='SERVICIO'||event.row[2]!==actor||event.row[3]!==hash)adminFail('OPERATION_REUSED');if(event.row[1]==='CONFIRMADO')return serviceDetail(book,actor,input.ticketId);}
 else{
  if(servicePending(book,input.ticketId,input.operationId))adminFail('PENDING_OPERATION');if(ticket.version!==input.expectedVersion)adminFail('CONFLICT');var before=adminSnapshot(raw),after=before.slice(),next=JSON.parse(JSON.stringify(meta)),now=serviceNow(),state=ticket.estado;
  function set(header,value){var index=raw.table.headers.indexOf(header);if(raw.formulas[index])adminFail('SCHEMA');after[index]=value;}
  var comment=input.comment.trim();if(['WAIT_REQUEST','CONTAIN','RESOLVE','REJECT','EXCEPTION'].indexOf(input.event)>=0&&!comment)adminFail('VALIDATION');var evidence=input.evidence||[];if(!Array.isArray(evidence)||evidence.length>5||evidence.some(function(u){return typeof u!=='string'||!/^https:\/\/(drive|docs)\.google\.com\//.test(u)||u.length>500;}))adminFail('VALIDATION');
  switch(input.event){
   case 'TRIAGE':if(state!=='NUEVO'||!next.policy.levels[input.priority])adminFail('VALIDATION');next.triagePriority=input.priority;var limit=serviceDeadline(serviceDate(next.createdAt),next.policy.levels[input.priority].assign,next.policy);if(!next.assignmentDeadline||limit.getTime()<serviceDate(next.assignmentDeadline).getTime())next.assignmentDeadline=Utilities.formatDate(limit,'America/Cancun','yyyy-MM-dd HH:mm:ss');set('PRIORIDAD',input.priority);break;
   case 'START':if(state!=='ASIGNADO'||next.startedAt)adminFail('VALIDATION');next.startedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.start=actor;set('ESTADO','EN PROCESO');set('FECHA INICIO',now);break;
   case 'WAIT_REQUEST':if(state!=='EN PROCESO'||next.waitRequest)adminFail('VALIDATION');if(typeof input.dependency!=='string'||!input.dependency.trim()||input.dependency.length>300||serviceDate(input.followAt).getTime()<=new Date().getTime())adminFail('VALIDATION');next.waitRequest={comment:comment,dependency:input.dependency,followAt:input.followAt,requestedBy:actor,requestedAt:now,operationId:input.operationId};break;
   case 'WAIT_APPROVE':if(state!=='EN PROCESO'||!next.waitRequest)adminFail('VALIDATION');next.waits.push({from:now,to:null,approvedBy:actor,request:{dependency:next.waitRequest.dependency,followAt:next.waitRequest.followAt,requestedBy:next.waitRequest.requestedBy,requestedAt:next.waitRequest.requestedAt,operationId:next.waitRequest.operationId}});next.waitRequest=null;set('ESTADO','EN ESPERA');break;
   case 'RESUME':if(state!=='EN ESPERA'||!next.waits.length||next.waits[next.waits.length-1].to)adminFail('VALIDATION');next.waits[next.waits.length-1].to=now;set('ESTADO','EN PROCESO');break;
   case 'CONTAIN':if(state!=='EN PROCESO'||next.priority!=='CRITICA'||next.containedAt)adminFail('VALIDATION');next.containedAt=now;next.stageOwners=next.stageOwners||{};next.stageOwners.contain=actor;next.containmentComment=comment;break;
   case 'RESOLVE':if(state!=='EN PROCESO'||next.priority==='CRITICA'&&!next.containedAt)adminFail('VALIDATION');next.stageOwners=next.stageOwners||{};next.stageOwners.resolve=actor;next.resolvedAt=now;next.waitRequest=null;next.solution=comment;next.evidence=evidence;set('ESTADO','RESUELTO');set('FECHA TERMINACIÓN',now);break;
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
  return kind==='all'||kind==='mine'&&item.ticket.correo.trim().toLowerCase()===actor||kind==='assigned'&&item.meta&&item.meta.email===actor;
 }).map(function(item){
  return {ticket:item.ticket,service:item.meta?serviceView(item.meta,item.ticket):null};
 });
}

function serviceConfigVersion(book,version){var rows=serviceCachedRows(book,'CONFIG SERVICIO',['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']).slice(1).filter(function(r){return r[0]===version;});if(rows.length!==1)adminFail('SCHEMA');return serviceValidatePolicy(JSON.parse(rows[0][1]));}
function serviceCreationPlan(book,request){var policy=serviceConfig(book);return policy?{version:policy.version,receivedAt:serviceNow(),urgent:request.prioridadSolicitada==='🔴 Urgente'}:null;}
function serviceCreationRecover(book,id,creation){if(!creation)return;var policy=serviceConfigVersion(book,creation.version),deadline=serviceDeadline(serviceDate(creation.receivedAt),creation.urgent?policy.levels.URGENTE.assign:policy.assignmentHours,policy);var meta={policy:policy,createdAt:creation.receivedAt,historical:false,assignmentOwner:'d.lara@ciarm.edu.mx',assignmentDeadline:Utilities.formatDate(deadline,'America/Cancun','yyyy-MM-dd HH:mm:ss'),cycles:[],waits:[]};serviceSaveCase(book,id,null,meta);}


// Entradas originales preservadas; las operaciones administrativas requieren firma.
function doPost(e) {
  try {
    var raw=(e&&e.parameter&&e.parameter.postData)||(e&&e.postData&&e.postData.contents)||'';
    var data=JSON.parse(raw);
    if (data && (Object.prototype.hasOwnProperty.call(data,'envelope') || Object.prototype.hasOwnProperty.call(data,'signature'))) {
      return ContentService.createTextOutput(JSON.stringify(handleTicketEnvelope(data.envelope,data.signature))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,code:'VALIDATION'})).setMimeType(ContentService.MimeType.JSON);
  }
  if(PropertiesService.getScriptProperties().getProperty('TICKETS_ALLOW_LEGACY')==='true')return legacyTicketPost(e);
  return ContentService.createTextOutput(JSON.stringify({ok:false,code:'FORBIDDEN'})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
 if(PropertiesService.getScriptProperties().getProperty('TICKETS_ALLOW_LEGACY')==='true')return legacyTicketGet(e);
 return ContentService.createTextOutput(JSON.stringify({ok:false,code:'FORBIDDEN'})).setMimeType(ContentService.MimeType.JSON);
}
