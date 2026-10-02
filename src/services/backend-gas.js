/**
 * Backend Serverless Módulo de Solicitudes Internas - Portal CIARM
 * Generador de Folios Consecutivos Basado en Celdas con Datos
 */

const CONFIG = {
  SPREADSHEET_ID_DM03: "1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY",
  SPREADSHEET_ID_HT05: "1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs",
  ATTACHMENTS_FOLDER_ID: "103wSYfCuSwVKW_aTbTFr2O7b-JyuT619",
  SHEET_NAMES: {
    PERMISOS: "Permisos_de_usuario",
    TICKETS: "TICKETS",
    TRAZABILIDAD: "REGISTRO SOLICITUDES",
    EVALUACION: "CATALOGOS"
  }
};

function doGet(e) {
  const action = e.parameter ? e.parameter.action : "";
  const email = e.parameter ? e.parameter.email : "";
  let responseData = { status: "error", message: "Acción no válida" };

  try {
    if (action === "getUserContext") {
      responseData = { status: "success", data: getUserContext(email) };
    } else if (action === "getTickets") {
      const user = getUserContext(email);
      responseData = { status: "success", data: getTickets(user) };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let responseData = { status: "error", message: "Petición no válida" };
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Sin contenido POST" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;

    if (action === "createTicket") {
      responseData = { status: "success", data: createTicket(contents.payload) };
    } else if (action === "updateTicketStatus") {
      responseData = { status: "success", data: updateTicketStatus(contents.payload) };
    } else if (action === "submitEvaluation") {
      responseData = { status: "success", data: submitEvaluation(contents.payload) };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function getUserContext(email) {
  if (!email) return { autorizado: false, reason: "Correo no proporcionado" };

  const ssDM03 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_DM03);
  let sheetPermisos = ssDM03.getSheetByName(CONFIG.SHEET_NAMES.PERMISOS);

  if (!sheetPermisos) {
    sheetPermisos = ssDM03.getSheets()[0];
  }

  const data = sheetPermisos.getDataRange().getValues();
  if (data.length <= 1) {
    return { autorizado: false, reason: "Hoja DM03 sin datos o vacía" };
  }

  const headers = data[0].map(h => h.toString().toLowerCase().trim());

  const colEmail = headers.findIndex(h => h.includes("correo") || h.includes("email"));
  const colStatus = headers.findIndex(h => h.includes("status") || h.includes("estatus") || h.includes("estado"));
  const colPortal = headers.findIndex(h => h.includes("portal") || h.includes("rol"));
  const colNombre = headers.findIndex(h => h.includes("nombre") || h.includes("colaborador"));
  const colArea = headers.findIndex(h => h.includes("area") || h.includes("seccion") || h.includes("departamento"));

  if (colEmail === -1) {
    return { autorizado: false, reason: "No se encontró la columna de correo en DM03" };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const userEmail = row[colEmail] ? row[colEmail].toString().trim().toLowerCase() : "";

    if (userEmail === email.toLowerCase()) {
      const status = colStatus !== -1 && row[colStatus] ? row[colStatus].toString().trim() : "Activo";
      const portal = colPortal !== -1 && row[colPortal] ? row[colPortal].toString().trim() : "PORTAL_USUARIO";

      if (status.toLowerCase() !== "activo") {
        return { autorizado: false, reason: "El colaborador no tiene estatus Activo en DM03" };
      }

      return {
        autorizado: true,
        email: userEmail,
        nombre: colNombre !== -1 && row[colNombre] ? row[colNombre].toString().trim() : "Colaborador CIARM",
        area: colArea !== -1 && row[colArea] ? row[colArea].toString().trim() : "General",
        rol: portal
      };
    }
  }

  return { autorizado: false, reason: `El correo ${email} no existe en la base de datos DM03` };
}

function saveAttachmentsToDrive(idTicket, attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }

  try {
    let parentFolder = DriveApp.getFolderById(CONFIG.ATTACHMENTS_FOLDER_ID);
    let ticketFolder = parentFolder.createFolder(`${idTicket}_Adjuntos`);
    let fileUrls = [];

    attachments.forEach(file => {
      if (file && file.base64Data && file.name) {
        let data = Utilities.base64Decode(file.base64Data);
        let blob = Utilities.newBlob(data, file.mimeType || "application/octet-stream", file.name);
        let driveFile = ticketFolder.createFile(blob);
        fileUrls.push(driveFile.getUrl());
      }
    });

    return fileUrls.join(",");
  } catch (error) {
    console.error("❌ Error al guardar adjuntos en Drive:", error);
    return "";
  }
}

/**
 * Calcula las filas reales que contienen datos en la Columna A
 */
function getRealRowsCount(sheet) {
  const colAValues = sheet.getRange("A:A").getValues();
  let count = 0;
  for (let i = 0; i < colAValues.length; i++) {
    if (colAValues[i][0] && colAValues[i][0].toString().trim() !== "") {
      count++;
    }
  }
  return count > 0 ? count : 1;
}

function createTicket(payload) {
  const data = payload || {};
  const adjuntos = data.adjuntos || [];

  const ssHT05 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_HT05);
  const sheetTickets = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TICKETS);

  const year = new Date().getFullYear();
  const totalRealRows = getRealRowsCount(sheetTickets);
  const nextFolioNum = String(totalRealRows).padStart(5, '0');
  const idTicket = `TKT-${year}-${nextFolioNum}`;
  const now = new Date();
  const fechaStr = Utilities.formatDate(now, "GMT-5", "dd/MM/yyyy");
  const horaStr = Utilities.formatDate(now, "GMT-5", "HH:mm:ss");

  const adjuntosUrls = saveAttachmentsToDrive(idTicket, adjuntos);

  const newRow = [
    idTicket,                             // Col A: ID TICKET
    fechaStr,                             // Col B: FECHA SOLICITUD
    horaStr,                              // Col C: HORA SOLICITUD
    data.area_solicitante || "General",   // Col D: ÁREA SOLICITANTE
    data.nombre_solicitante || "Usuario", // Col E: SOLICITANTE
    data.correo_solicitante || "",        // Col F: CORREO SOLICITANTE
    data.tipo_solicitud || "General",     // Col G: TIPO DE SOLICITUD
    data.descripcion || "",               // Col H: DESCRIPCIÓN
    "POR DEFINIR",                        // Col I: PRIORIDAD
    "SIN ASIGNAR",                        // Col J: RESPONSABLE
    "",                                   // Col K: FECHA ASIGNACIÓN
    data.fecha_requerida || "",           // Col L: FECHA COMPROMISO
    "NUEVO",                              // Col M: ESTADO
    "",                                   // Col N: FECHA INICIO
    "",                                   // Col O: FECHA TERMINACIÓN
    "",                                   // Col P: TIEMPO EJECUCIÓN
    "",                                   // Col Q: TIEMPO TOTAL
    "POR DEFINIR",                        // Col R: SLA
    "",                                   // Col S: PUNTOS
    "",                                   // Col T: OBSERVACIONES
    now,                                  // Col U: ÚLTIMA ACTUALIZACIÓN
    data.urgencia === "SI" ? "🔴 Urgente" : "🟢 Normal", // Col V: PRIORIDAD SOLICITADA
    "",                                   // Col W: PLAZO SOLICITADO
    adjuntosUrls                          // Col X: ARCHIVOS ADJUNTOS
  ];

  sheetTickets.appendRow(newRow);

  if (data.correo_solicitante) {
    try {
      MailApp.sendEmail({
        to: data.correo_solicitante,
        subject: `[Portal CIARM] Solicitud Registrada - Folio ${idTicket}`,
        htmlBody: `
          <h3>Estimado(a) ${data.nombre_solicitante || 'Colaborador'},</h3>
          <p>Su solicitud ha sido registrada correctamente con el folio <strong>${idTicket}</strong>.</p>
          <p><strong>Tipo:</strong> ${data.tipo_solicitud}<br><strong>Detalle:</strong> ${data.descripcion}</p>
          <p><strong>Adjuntos cargados:</strong> ${adjuntos.length} archivo(s).</p>
          <hr><small>Colegio Internacional Alemán Riviera Maya</small>
        `
      });
    } catch (e) {
      console.warn("⚠️ No se envió correo de notificación:", e);
    }
  }

  return { id_ticket: idTicket, estado: "NUEVO", adjuntos_urls: adjuntosUrls };
}

function testManual() {
  var res = createTicket({
    nombre_solicitante: "Ezequiel Conesa",
    correo_solicitante: "econesa@ciarm.edu.mx",
    area_solicitante: "Coordinación Pedagógica",
    tipo_solicitud: "Prueba Directa Console",
    urgencia: "NO",
    descripcion: "Prueba manual con contador de filas reales",
    adjuntos: []
  });
  Logger.log("📌 Resultado Test: " + JSON.stringify(res));
}
