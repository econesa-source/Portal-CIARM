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
function doGet(e) {
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
/** Administración de solicitudes internas. Requiere puente PHP firmado. */
var ADMIN_TICKET_HEADERS = ['ID TICKET','FECHA SOLICITUD','HORA SOLICITUD','ÁREA SOLICITANTE','SOLICITANTE','CORREO SOLICITANTE','TIPO DE SOLICITUD','DESCRIPCIÓN','PRIORIDAD','RESPONSABLE','FECHA ASIGNACIÓN','FECHA COMPROMISO','ESTADO','FECHA INICIO','FECHA TERMINACIÓN','TIEMPO EJECUCIÓN','TIEMPO TOTAL','SLA','PUNTOS','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN','PRIORIDAD SOLICITADA','PLAZO SOLICITADO','ARCHIVOS ADJUNTOS'];
var ADMIN_JOURNAL_HEADERS = ['OPERACION','ESTADO','ACTOR','PAYLOAD HASH','TICKET','ANTES','DESPUES','FECHA','PAYLOAD'];

function adminFail(code) { var error = new Error(code); error.adminCode = code; throw error; }
function adminHex(bytes) { return bytes.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function adminHash(value) { return adminHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)); }
function adminEqual(a,b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var diff=0; for(var i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
function adminTable(book,name,required) {
 var sheet=book.getSheetByName(name); if(!sheet) adminFail('SCHEMA');
 var range=sheet.getDataRange();var rows=range.getValues();var formulas=range.getFormulas();var headers=rows[0].map(function(v){return String(v).trim();});
 required.forEach(function(h){if(headers.indexOf(h)<0 || headers.indexOf(h)!==headers.lastIndexOf(h)) adminFail('SCHEMA');});
 return {sheet:sheet,headers:headers,rows:rows,formulas:formulas};
}
function adminPermission(actor) {
 if(['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx'].indexOf(actor)<0) return false;
 var table=adminTable(SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID),'Permisos de usuario',['Correo Ciarm','Status','Sistema de tickets']);
 var matches=table.rows.slice(1).filter(function(row){return String(row[table.headers.indexOf('Correo Ciarm')]||'').trim().toLowerCase()===actor;});
 return matches.length===1 && String(matches[0][table.headers.indexOf('Status')]||'').trim().toLowerCase()==='activo' && String(matches[0][table.headers.indexOf('Sistema de tickets')]||'').trim()==='Administrador';
}
function handleAdminEnvelope(envelope,signature) {
 var lock=LockService.getScriptLock();var locked=false;
 try {
  var secret=PropertiesService.getScriptProperties().getProperty('TICKETS_ADMIN_SECRET');
  if(!secret) adminFail('NOT_CONFIGURED');
  if(typeof envelope!=='string'||envelope.length>50000) adminFail('INVALID_SIGNATURE');
  var expected=adminHex(Utilities.computeHmacSha256Signature(envelope,secret,Utilities.Charset.UTF_8));
  if(!adminEqual(expected,signature)) adminFail('INVALID_SIGNATURE');
  var request=JSON.parse(envelope);var now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(request.issuedAt)||Math.abs(now-request.issuedAt)>120) adminFail('EXPIRED');
  if(typeof request.nonce!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(request.nonce)) adminFail('VALIDATION');
  if(typeof request.actor!=='string'||!adminPermission(request.actor)) adminFail('FORBIDDEN');
  locked=lock.tryLock(15000);if(!locked) adminFail('BUSY');
  var cache=CacheService.getScriptCache();var nonceKey='ticket-admin-'+request.nonce;
  if(cache.get(nonceKey)) adminFail('REPLAY');cache.put(nonceKey,'1',300);
  var book=SpreadsheetApp.openById(CONFIG.TICKETS_SPREADSHEET_ID);
  var data;
  switch(request.action) {
   case 'list': data=adminTicketList(book);break;
   case 'detail': data=adminTicketView(adminFindTicket(book,(request.payload||{}).id));var pending=adminPendingOperation(book,data.id,request.actor);if(pending)data.pendingOperation=pending;break;
   case 'catalogs': data=adminCatalogs(book);break;
   case 'assign': data=adminAssign(book,request.actor,request.payload);break;
   default:adminFail('VALIDATION');
  }
  return {ok:true,data:data};
 } catch(err) {
  var result={ok:false,code:err.adminCode||'UPSTREAM'};
  // Tell the client whether it must retain the operation ID for recovery.
  if(request&&request.action==='assign'&&book&&request.payload) {
   try {var history=book.getSheetByName('BITACORA TICKETS');result.operationPending=history?history.getDataRange().getValues().slice(1).some(function(row){return row[0]===request.payload.operationId&&row[2]===request.actor;}):false;}catch(ignored){}
  }
  return result;
 }
 finally { if(locked)lock.releaseLock(); }
}
function adminTicketTable(book) { return adminTable(book,'TICKETS',ADMIN_TICKET_HEADERS); }
function adminPurchase(row,headers) { return String(row[headers.indexOf('TIPO DE SOLICITUD')]||'').trim().toLowerCase()==='compras'; }
function adminFindTicket(book,id) {
 if(typeof id!=='string'||!/^TKT-\d{4}-\d+$/.test(id))adminFail('VALIDATION');
 var table=adminTicketTable(book);var matches=[];
 table.rows.slice(1).forEach(function(row,i){if(String(row[table.headers.indexOf('ID TICKET')]).trim()===id)matches.push({row:row,formulas:table.formulas[i+1],rowNumber:i+2,table:table});});
 if(matches.length===0)adminFail('NOT_FOUND');if(matches.length!==1)adminFail('DUPLICATE_ID');
 if(adminPurchase(matches[0].row,table.headers))adminFail('NOT_FOUND');return matches[0];
}
function adminCellValue(value,header) {
 if(value instanceof Date) { var format=header==='HORA SOLICITUD'?'HH:mm:ss':(['FECHA ASIGNACIÓN','ÚLTIMA ACTUALIZACIÓN'].indexOf(header)>=0?'yyyy-MM-dd HH:mm:ss':'yyyy-MM-dd');return Utilities.formatDate(value,'America/Cancun',format); }
 if(typeof value==='string' && (header.indexOf('FECHA')===0||header==='ÚLTIMA ACTUALIZACIÓN')) {
  var match=value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2})(?::(\d{2}))?)?$/);
  if(match)return match[3]+'-'+match[2]+'-'+match[1]+(match[4]?' '+match[4]+':'+(match[5]||'00'):'');
 }
 return value==null?'':value;
}
function adminSnapshot(ticket) { return ticket.row.map(function(value,i){return ticket.formulas&&ticket.formulas[i]?{formula:ticket.formulas[i]}:adminCellValue(value,ticket.table.headers[i]);}); }
function adminTicketView(ticket) {
 var row=ticket.row;var headers=ticket.table.headers;
 function get(h){return String(adminCellValue(row[headers.indexOf(h)],h)).replace(/^\u200B(?=[=+@-])/,'');}
 return {id:get('ID TICKET'),fecha:get('FECHA SOLICITUD'),hora:get('HORA SOLICITUD'),solicitante:get('SOLICITANTE'),correo:get('CORREO SOLICITANTE'),area:get('ÁREA SOLICITANTE'),tipo:get('TIPO DE SOLICITUD'),descripcion:get('DESCRIPCIÓN'),urgencia:get('PRIORIDAD SOLICITADA'),plazo:get('PLAZO SOLICITADO'),prioridad:get('PRIORIDAD'),responsable:get('RESPONSABLE'),fechaCompromiso:get('FECHA COMPROMISO'),estado:get('ESTADO'),observaciones:get('OBSERVACIONES'),adjuntos:get('ARCHIVOS ADJUNTOS'),version:adminHash(adminSnapshot(ticket))};
}
function adminTicketList(book) {
 var table=adminTicketTable(book);
 return table.rows.slice(1).map(function(row,i){return {row:row,table:table,formulas:table.formulas[i+1]};}).filter(function(ticket){return /^TKT-\d{4}-\d+$/.test(String(ticket.row[table.headers.indexOf('ID TICKET')]))&&!adminPurchase(ticket.row,table.headers);}).map(adminTicketView);
}
function adminCatalogs(book) {
 var priorities=adminTable(book,'CATALOGOS',['PRIORIDADES']);var people=adminTable(book,'RESPONSABLES',['RESPONSABLE']);
 function unique(table,h){var seen={};return table.rows.slice(1).map(function(row){return String(row[table.headers.indexOf(h)]||'').trim();}).filter(function(v){if(!v||seen[v])return false;seen[v]=true;return true;});}
 return {prioridades:unique(priorities,'PRIORIDADES').filter(function(p){return ['CRITICA','URGENTE','ALTA','MEDIA','BAJA'].indexOf(p)>=0;}),responsables:unique(people,'RESPONSABLE')};
}
function adminLiteral(value) { return /^[=+@-]/.test(value)?'\u200B'+value:value; }
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
 var table=adminJournalTable(book);var rows=table.rows.slice(1).filter(function(row){return row[1]==='PENDIENTE'&&row[2]===actor&&row[4]===id;});
 if(rows.length>1)adminFail('PENDING_OPERATION');
 return rows.length===1?JSON.parse(rows[0][8]):null;
}
function adminAssign(book,actor,payload) {
 if(!payload||typeof payload.operationId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(payload.operationId)||typeof payload.expectedVersion!=='string')adminFail('VALIDATION');
 var ticket=adminFindTicket(book,payload.ticketId);var hash=adminHash(payload);
 var journalSheet=book.getSheetByName('BITACORA TICKETS');var journal=journalSheet?adminJournalTable(book):null;
 var events=journal?journal.rows.slice(1).map(function(row,i){return {row:row,rowNumber:i+2};}).filter(function(e){return e.row[0]===payload.operationId;}):[];
 if(events.length>1)adminFail('OPERATION_REUSED');
 if(events.length===1) {
  var event=events[0];if(event.row[2]!==actor||event.row[3]!==hash)adminFail('OPERATION_REUSED');
  if(event.row[1]==='CONFIRMADO')return {ticket:adminTicketView(ticket),operationId:payload.operationId};
  var before=JSON.parse(event.row[5]);var after=JSON.parse(event.row[6]);
  var snapshot=adminSnapshot(ticket);var current=adminHash(snapshot);
  // JSON serialization preserves the canonical representation of date cells.
  if(snapshot.length!==before.length||snapshot.some(function(value,i){return JSON.stringify(value)!==JSON.stringify(before[i])&&JSON.stringify(value)!==JSON.stringify(after[i]);}))adminFail('CONFLICT');
  if(current!==adminHash(after))adminWriteAssignment(ticket,after);
  if(adminHash(adminSnapshot(adminFindTicket(book,payload.ticketId)))!==adminHash(after))adminFail('CONFLICT');
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
 journal.sheet.appendRow([payload.operationId,'PENDIENTE',actor,hash,payload.ticketId,JSON.stringify(before),JSON.stringify(after),now,JSON.stringify(payload)]);SpreadsheetApp.flush();
 var eventNumber=journal.sheet.getLastRow();
 adminWriteAssignment(ticket,after);
 if(adminHash(adminSnapshot(adminFindTicket(book,payload.ticketId)))!==adminHash(after))adminFail('CONFLICT');
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


// Entradas originales preservadas; las operaciones administrativas requieren firma.
function doPost(e) {
  try {
    var raw=(e&&e.parameter&&e.parameter.postData)||(e&&e.postData&&e.postData.contents)||'';
    var data=JSON.parse(raw);
    if (data && (Object.prototype.hasOwnProperty.call(data,'envelope') || Object.prototype.hasOwnProperty.call(data,'signature'))) {
      return ContentService.createTextOutput(JSON.stringify(handleAdminEnvelope(data.envelope,data.signature))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,code:'VALIDATION'})).setMimeType(ContentService.MimeType.JSON);
  }
  return legacyTicketPost(e);
}
