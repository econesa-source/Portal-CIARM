/**
 * Backend Google Apps Script - Portal CIARM (v17.6.0)
 * Etapa 4 pequeña:
 * - Alta de tickets existente
 * - Adjuntos existente
 * - Nombre y Área del solicitante obtenidos desde DM03
 * - OAuth todavía NO implementado
 */
var CONFIG = {
  TICKETS_SPREADSHEET_ID: (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties && PropertiesService.getScriptProperties().getProperty('TICKETS_SPREADSHEET_ID')) || '1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs',
  DM03_SPREADSHEET_ID: (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties && PropertiesService.getScriptProperties().getProperty('DM03_SPREADSHEET_ID')) || '1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY',
  DM03_SHEET_NAME: 'Catálogo de colaboradores',
  ATTACHMENTS_FOLDER_ID: (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties && PropertiesService.getScriptProperties().getProperty('ATTACHMENTS_FOLDER_ID')) || '103wSYfCuSwVKW_aTbTFr2O7b-JyuT619',
  PORTAL_BASE_URL: (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties && PropertiesService.getScriptProperties().getProperty('PORTAL_BASE_URL')) || 'https://portal2.ciarm.edu.mx'
};
/**
 * Ejecuta esta función una vez con "▷ Ejecutar" en el editor de Apps Script
 * para autorizar el permiso de envío de correos (MailApp.sendEmail).
 */
function autorizarPermisosCorreo() {
  var quota = typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota ? MailApp.getRemainingDailyQuota() : 0;
  Logger.log('Permiso MailApp autorizado correctamente. Cuota restante: ' + quota);
}
/**
 * POST — registra una nueva solicitud.
 */
function doPost(e) {
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