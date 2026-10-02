/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 * Conexión resiliente con Google Apps Script WebApp (Tenant ciarm.edu.mx)
 */
const STAGING_CONFIG = {
  WEB_APP_URL: "https://script.google.com/a/macros/ciarm.edu.mx/s/AKfycbxx_dPOsx1x1y4KDyaJpn9U8UKxnF4WXj5lrBeDUQ41j0loNURBSryyyXqDF-0AJFkJ1w/exec"
};

/**
 * Registra una nueva solicitud interna en Google Sheets (BD - Sistema de Tickets)
 * y almacena los adjuntos en la carpeta de Google Drive.
 */
export async function createTicketAPI(payload) {
  try {
    const res = await fetch(STAGING_CONFIG.WEB_APP_URL, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify({ action: "createTicket", payload })
    });

    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }

    return await res.json();
  } catch (e) {
    console.error("❌ Error en la conexión con la WebApp de Google Apps Script:", e);
    return { status: "error", message: e.toString() };
  }
}

/**
 * Consulta las solicitudes activas registradas para el colaborador.
 */
export async function fetchTicketsAPI(email) {
  try {
    const res = await fetch(`${STAGING_CONFIG.WEB_APP_URL}?action=getTickets&email=${encodeURIComponent(email)}`, {
      method: "GET",
      mode: "cors",
      redirect: "follow"
    });
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("❌ Error al consultar tickets desde el backend:", e);
    return [];
  }
}

/**
 * Consulta el perfil y contexto de permisos del usuario desde SCGRC DM03.
 */
export async function fetchUserContextAPI(email) {
  try {
    const res = await fetch(`${STAGING_CONFIG.WEB_APP_URL}?action=getUserContext&email=${encodeURIComponent(email)}`, {
      method: "GET",
      mode: "cors",
      redirect: "follow"
    });
    const json = await res.json();
    return json.data || { autorizado: false };
  } catch (e) {
    console.error("❌ Error al consultar contexto de usuario desde DM03:", e);
    return { autorizado: false, reason: "Error de conexión HTTP" };
  }
}
