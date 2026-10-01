/**
 * Backend Serverless Módulo de Solicitudes Internas - Portal CIARM
 * Motor con Lectura Dinámica Tolerante a Fallos sobre DM_03 y BD - Sistema de Tickets
 */

const CONFIG = {
  // Catálogo Maestro de Colaboradores SCGRC (DM03)
  SPREADSHEET_ID_DM03: "1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY",
  
  // Libro 'BD - Sistema de Tickets'
  SPREADSHEET_ID_HT05: "1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs",
  
  ATTACHMENTS_FOLDER_ID: "REEMPLAZAR_CON_ID_CARPETA_DRIVE_ADJUNTOS",
  
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

/**
 * Inspección Inteligente y Tolerante a Fallos de DM_03
 */
function getUserContext(email) {
  if (!email) return { autorizado: false, reason: "Correo no proporcionado" };

  const ssDM03 = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID_DM03);
  let sheetPermisos = ssDM03.getSheetByName(CONFIG.SHEET_NAMES.PERMISOS);

  // Fallback: Si el nombre de la pestaña cambió, tomar la primera hoja activa
  if (!sheetPermisos) {
    sheetPermisos = ssDM03.getSheets()[0];
  }

  const data = sheetPermisos.getDataRange().getValues();
  if (data.length <= 1) {
    return { autorizado: false, reason: "Hoja DM03 sin datos o vacía" };
  }

  const headers = data[0].map(h => h.toString().toLowerCase().trim());

  // Mapeo dinámico de índices de columna independientemente de su posición
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

      if (!portal) {
        return { autorizado: false, reason: "El colaborador no tiene un Rol de Portal asignado" };
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

  const year = new Date().getFullYear();
  const lastRow = sheetTickets.getLastRow();
  const nextFolioNum = String(lastRow).padStart(5, '0');
  const idTicket = `TKT-${year}-${nextFolioNum}`;
  const now = new Date();
  const fechaStr = Utilities.formatDate(now, "GMT-5", "dd/MM/yyyy");
  const horaStr = Utilities.formatDate(now, "GMT-5", "HH:mm:ss");

  const adjuntosUrls = saveAttachmentsToDrive(idTicket, payload.adjuntos);

  const newRow = [
    idTicket,                    // Col A: ID TICKET
    fechaStr,                    // Col B: FECHA SOLICITUD
    horaStr,                     // Col C: HORA SOLICITUD
    payload.area_solicitante,    // Col D: ÁREA SOLICITANTE
    payload.nombre_solicitante,  // Col E: SOLICITANTE
    payload.correo_solicitante,  // Col F: CORREO SOLICITANTE
    payload.tipo_solicitud,      // Col G: TIPO DE SOLICITUD
    payload.descripcion,         // Col H: DESCRIPCIÓN
    "POR DEFINIR",               // Col I: PRIORIDAD
    "SIN ASIGNAR",               // Col J: RESPONSABLE
    "",                          // Col K: FECHA ASIGNACIÓN
    payload.fecha_requerida || "",// Col L: FECHA COMPROMISO
    "NUEVO",                     // Col M: ESTADO
    "",                          // Col N: FECHA INICIO
    "",                          // Col O: FECHA TERMINACIÓN
    "",                          // Col P: TIEMPO EJECUCIÓN
    "",                          // Col Q: TIEMPO TOTAL
    "POR DEFINIR",               // Col R: SLA
    "",                          // Col S: PUNTOS
    "",                          // Col T: OBSERVACIONES
    now,                         // Col U: ÚLTIMA ACTUALIZACIÓN
    payload.urgencia === "SI" ? "🔴 Urgente" : "🟢 Normal", // Col V
    "",                          // Col W
    adjuntosUrls                 // Col X: ARCHIVOS ADJUNTOS
  ];

  sheetTickets.appendRow(newRow);

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
    if (!row[0]) continue;

    const item = {
      id_ticket: row[0],
      fecha_creacion: row[1],
      area_solicitante: row[3],
      correo_solicitante: row[5],
      tipo_solicitud: row[6],
      descripcion: row[7],
      correo_ejecutor: row[9],
      estado_actual: row[12],
      observaciones: row[19],
      adjuntos_urls: row[23] || ""
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
  const data = sheetTickets.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.id_ticket) {
      const rowIdx = i + 1;

      sheetTickets.getRange(rowIdx, 13).setValue(payload.nuevo_estado);
      if (payload.correo_ejecutor) sheetTickets.getRange(rowIdx, 10).setValue(payload.correo_ejecutor);
      if (payload.observaciones) sheetTickets.getRange(rowIdx, 20).setValue(payload.observaciones);
      sheetTickets.getRange(rowIdx, 21).setValue(new Date());

      MailApp.sendEmail({
        to: data[i][5],
        subject: `[Portal CIARM] Solicitud ${payload.id_ticket} -> ${payload.nuevo_estado}`,
        htmlBody: `<p>Estatus de la solicitud <strong>${payload.id_ticket}</strong> actualizado a: <strong>${payload.nuevo_estado}</strong>.</p>`
      });

      return { success: true };
    }
  }
  return { success: false, message: "Ticket no encontrado" };
}

function submitEvaluation(payload) {
  updateTicketStatus({
    id_ticket: payload.id_ticket,
    nuevo_estado: "RECIBI_CONFORME",
    usuario_cambio: payload.usuario,
    observaciones: `Evaluación registrada por usuario. Calidad: ${payload.calificacion_calidad}*, Tiempo: ${payload.calificacion_tiempo}*, Amabilidad: ${payload.calificacion_amabilidad}*`
  });

  return { success: true };
}
