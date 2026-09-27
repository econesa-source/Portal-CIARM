/**
 * Backend Serverless para Portal CIARM - Google Apps Script
 * Copia este código dentro de tu proyecto en https://script.google.com
 */

const CONFIG = {
  DRIVE_FOLDER_ID: "REEMPLAZAR_CON_ID_DE_CARPETA_DRIVE",
  CALENDAR_ID: "primary",
  ALLOWED_DOMAIN: "ciarm.edu.mx"
};

function doGet(e) {
  const action = e.parameter ? e.parameter.action : "";
  let responseData = { status: "error", message: "Acción no válida" };

  try {
    if (action === "getDocuments") {
      responseData = { status: "success", data: getDriveDocuments() };
    } else if (action === "getEvents") {
      responseData = { status: "success", data: getCalendarEvents() };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDriveDocuments() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  const fileList = [];

  while (files.hasNext()) {
    const file = files.next();
    fileList.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      url: file.getUrl(),
      updatedAt: file.getLastUpdated()
    });
  }
  return fileList;
}

function getCalendarEvents() {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const now = new Date();
  const nextMonth = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  const events = calendar.getEvents(now, nextMonth);

  return events.map(evt => ({
    id: evt.getId(),
    title: evt.getTitle(),
    description: evt.getDescription(),
    startTime: evt.getStartTime(),
    endTime: evt.getEndTime()
  }));
}
