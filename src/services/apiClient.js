/**
 * Cliente API para el Portal CIARM
 * Conecta el frontend con la Web App de Google Apps Script.
 */

// Reemplazar con la URL desplegada de Google Apps Script
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/TU_SCRIPT_ID/exec";

export async function fetchDriveDocuments() {
  try {
    const res = await fetch(`${GAS_WEB_APP_URL}?action=getDocuments`);
    const json = await res.json();
    if (json.status === "success") return json.data;
    throw new Error(json.message);
  } catch (error) {
    console.error("❌ Error al obtener documentos de Drive:", error);
    return [];
  }
}

export async function fetchCalendarEvents() {
  try {
    const res = await fetch(`${GAS_WEB_APP_URL}?action=getEvents`);
    const json = await res.json();
    if (json.status === "success") return json.data;
    throw new Error(json.message);
  } catch (error) {
    console.error("❌ Error al obtener eventos de Calendar:", error);
    return [];
  }
}
