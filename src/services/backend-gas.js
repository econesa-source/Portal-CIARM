/**
 * Backend Serverless Módulo de Solicitudes Internas - Portal CIARM
 * Google Apps Script WebApp API REST Engine con soporte para Archivos Adjuntos
 */

const CONFIG = {
  SPREADSHEET_ID_DM03: "REEMPLAZAR_CON_ID_SHEET_SCGRC_DM_03",
  SPREADSHEET_ID_HT05: "REEMPLAZAR_CON_ID_SHEET_HT05_TICKETS",
  ATTACHMENTS_FOLDER_ID: "REEMPLAZAR_CON_ID_CARPETA_DRIVE_ADJUNTOS",
  SHEET_NAMES: {
    PERMISOS: "Permisos_de_usuario",
    TICKETS: "HT05_Tickets",
    TRAZABILIDAD: "BIT_Trazabilidad",
    EVALUACION: "EV_Satisfaccion"
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
  const sheetPermisos = ssDM03.getSheetByName(CONFIG.SHEET_NAMES.PERMISOS);
  const data = sheetPermisos.getDataRange().getValues();
  const headers = data[0];

  const colEmail = headers.indexOf("Correo_Ciarm");
  const colStatus = headers.indexOf("Status");
  const colPortal = headers.indexOf("Portal");
  const colNombre = headers.indexOf("Nombre");
  const colArea = headers.indexOf("Area");

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[colEmail] && row[colEmail].toString().toLowerCase() === email.toLowerCase()) {
      const status = row[colStatus] ? row[colStatus].toString().trim() : "";
      const portal = row[colPortal] ? row[colPortal].toString().trim() : "";

      if (status !== "Activo") {
        return { autorizado: false, reason: "Colaborador no está en estatus Activo" };
      }
      if (!portal) {
        return { autorizado: false, reason: "Colaborador no tiene Rol de Portal asignado" };
      }

      return {
        autorizado: true,
        email: row[colEmail],
        nombre: row[colNombre] || "Colaborador CIARM",
        area: row[colArea] || "General",
        rol: portal
      };
    }
  }

  return { autorizado: false, reason: "Correo no encontrado en el catálogo maestro DM03" };
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
      let data = Utilities.base64Decode(file.base64Data);
      let blob = Utilities.newBlob(data, file.mimeType, file.name);
      let driveFile = ticketFolder.createFile(blob);
      fileUrls.push(driveFile.getUrl());
    });

    return fileUrls.join(",");
  } catch (error) {
    console.error("❌ Error al guardar adjuntos en Drive:", error);
    return "";
  }
}

function createTicket(payload) {
  const ssHT05 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_HT05);
  const sheetTickets = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TICKETS);
  const sheetBitacora = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TRAZABILIDAD);

  const year = new Date().getFullYear();
  const lastRow = sheetTickets.getLastRow();
  const nextFolioNum = String(lastRow).padStart(4, '0');
  const idTicket = `TICK-${year}-${nextFolioNum}`;
  const now = new Date();

  const adjuntosUrls = saveAttachmentsToDrive(idTicket, payload.adjuntos);

  const newRow = [
    idTicket,
    now,
    payload.correo_solicitante,
    payload.area_solicitante,
    payload.tipo_solicitud,
    payload.descripcion,
    payload.urgencia,
    payload.fecha_requerida || "",
    "NUEVO",
    "",
    "",
    "",
    adjuntosUrls
  ];

  sheetTickets.appendRow(newRow);
  sheetBitacora.appendRow([`LOG-${now.getTime()}`, idTicket, "", "NUEVO", now, payload.correo_solicitante]);

  MailApp.sendEmail({
    to: payload.correo_solicitante,
    subject: `[Portal CIARM] Solicitud Registrada - Folio ${idTicket}`,
    htmlBody: `
      <h3>Estimado(a) ${payload.nombre_solicitante || 'Colaborador'},</h3>
      <p>Su solicitud ha sido registrada correctamente con el folio <strong>${idTicket}</strong>.</p>
      <p><strong>Tipo:</strong> ${payload.tipo_solicitud}<br><strong>Detalle:</strong> ${payload.descripcion}</p>
      <p><strong>Adjuntos cargados:</strong> ${payload.adjuntos ? payload.adjuntos.length : 0} archivo(s).</p>
      <hr><small>Colegio Internacional Alemán Riviera Maya</small>
    `
  });

  return { id_ticket: idTicket, estado: "NUEVO", adjuntos_urls: adjuntosUrls };
}

function getTickets(userContext) {
  if (!userContext.autorizado) return [];

  const ssHT05 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_HT05);
  const sheetTickets = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TICKETS);
  const data = sheetTickets.getDataRange().getValues();
  if (data.length <= 1) return [];

  const tickets = [];
  const rol = userContext.rol;
  const email = userContext.email;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {
      id_ticket: row[0],
      fecha_creacion: row[1],
      correo_solicitante: row[2],
      area_solicitante: row[3],
      tipo_solicitud: row[4],
      descripcion: row[5],
      urgencia: row[6],
      fecha_requerida: row[7],
      estado_actual: row[8],
      correo_ejecutor: row[9],
      fecha_programada_entrega: row[10],
      observaciones: row[11],
      adjuntos_urls: row[12] || ""
    };

    if (rol === "PORTAL_ADMIN" || rol === "PORTAL_DIRECTOR") {
      tickets.push(item);
    } else if (rol === "PORTAL_USUARIO" && item.correo_solicitante.toLowerCase() === email.toLowerCase()) {
      tickets.push(item);
    }
  }

  return tickets.reverse();
}

function updateTicketStatus(payload) {
  const ssHT05 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_HT05);
  const sheetTickets = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TICKETS);
  const sheetBitacora = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.TRAZABILIDAD);
  const data = sheetTickets.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.id_ticket) {
      const rowIdx = i + 1;
      const estadoAnterior = data[i][8];
      const now = new Date();

      sheetTickets.getRange(rowIdx, 9).setValue(payload.nuevo_estado);
      if (payload.correo_ejecutor) sheetTickets.getRange(rowIdx, 10).setValue(payload.correo_ejecutor);

      sheetBitacora.appendRow([`LOG-${now.getTime()}`, payload.id_ticket, estadoAnterior, payload.nuevo_estado, now, payload.usuario_cambio]);

      MailApp.sendEmail({
        to: data[i][2],
        subject: `[Portal CIARM] Solicitud ${payload.id_ticket} -> ${payload.nuevo_estado}`,
        htmlBody: `<p>Estatus de la solicitud <strong>${payload.id_ticket}</strong> actualizado a: <strong>${payload.nuevo_estado}</strong>.</p>`
      });

      return { success: true };
    }
  }
  return { success: false, message: "Ticket no encontrado" };
}

function submitEvaluation(payload) {
  const ssHT05 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_HT05);
  const sheetEval = ssHT05.getSheetByName(CONFIG.SHEET_NAMES.EVALUACION);

  const idEval = `EV-${new Date().getTime()}`;
  sheetEval.appendRow([
    idEval,
    payload.id_ticket,
    payload.calificacion_calidad,
    payload.calificacion_tiempo,
    payload.calificacion_amabilidad,
    payload.comentarios || ""
  ]);

  updateTicketStatus({
    id_ticket: payload.id_ticket,
    nuevo_estado: "RECIBI_CONFORME",
    usuario_cambio: payload.usuario
  });

  return { success: true, id_evaluacion: idEval };
}
