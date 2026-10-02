/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 * Conexión viva con Google Apps Script WebApp REST API
 */
const STAGING_CONFIG = {
  // Reemplaza esta URL con la tuya terminada en /exec
  WEB_APP_URL: "https://script.google.com/macros/s/TU_URL_REAL_AQUI/exec"
};

/**
 * Envía la solicitud con sus adjuntos al backend de Apps Script
 */
export async function createTicketAPI(payload) {
  try {
    const res = await fetch(STAGING_CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createTicket", payload })
    });
    return await res.json();
  } catch (e) {
    console.error("❌ Error al conectar con el backend de Google Apps Script:", e);
    return { status: "error", message: e.toString() };
  }
}

/**
 * Consulta la lista de solicitudes activas para un colaborador
 */
export async function fetchTicketsAPI(email) {
  try {
    const res = await fetch(`${STAGING_CONFIG.WEB_APP_URL}?action=getTickets&email=${encodeURIComponent(email)}`);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.error("❌ Error al consultar tickets desde el backend:", e);
    return [];
  }
}

/**
 * Obtiene el contexto y permisos del usuario desde SCGRC DM03
 */
export async function fetchUserContextAPI(email) {
  try {
    const res = await fetch(`${STAGING_CONFIG.WEB_APP_URL}?action=getUserContext&email=${encodeURIComponent(email)}`);
    const json = await res.json();
    return json.data || { autorizado: false };
  } catch (e) {
    console.error("❌ Error al consultar contexto de usuario desde DM03:", e);
    return { autorizado: false, reason: "Error de conexión HTTP" };
  }
}
