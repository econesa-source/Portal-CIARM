/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 * URL de la Versión Activa en Google Apps Script WebApp
 */
const STAGING_CONFIG = {
  // URL de la versión activa confirmada por el usuario:
  WEB_APP_URL: "https://script.google.com/a/macros/ciarm.edu.mx/s/AKfycbxnjpsg4BdZEn-1EL1xXA6BH_emH5Wd7RSuHBPtwpJOQwGgb6a2NKOVCVO-aVpYdO3orw/exec"
};

/**
 * Registra una nueva solicitud interna en Google Sheets (BD - Sistema de Tickets)
 * y almacena los adjuntos en la carpeta de Google Drive.
 */
export async function createTicketAPI(payload) {
  try {
    const cleanUrl = STAGING_CONFIG.WEB_APP_URL.trim();
    const res = await fetch(cleanUrl, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: { 
        "Content-Type": "text/plain;charset=utf-8" 
      },
      body: JSON.stringify({ action: "createTicket", payload })
    });

    if (!res.ok) {
      throw new Error(`Error HTTP del servidor: ${res.status} ${res.statusText}`);
    }

    const textResponse = await res.text();
    try {
      return JSON.parse(textResponse);
    } catch (parseErr) {
      console.error("❌ Respuesta no es un JSON válido:", textResponse);
      return { status: "error", message: "La respuesta del servidor no fue un JSON válido." };
    }
  } catch (e) {
    console.error("❌ Error de red al conectar con la WebApp de Apps Script:", e);
    return { status: "error", message: e.toString() };
  }
}

/**
 * Consulta las solicitudes activas registradas para el colaborador.
 */
export async function fetchTicketsAPI(email) {
  try {
    const cleanUrl = STAGING_CONFIG.WEB_APP_URL.trim();
    const res = await fetch(`${cleanUrl}?action=getTickets&email=${encodeURIComponent(email)}`, {
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
    const cleanUrl = STAGING_CONFIG.WEB_APP_URL.trim();
    const res = await fetch(`${cleanUrl}?action=getUserContext&email=${encodeURIComponent(email)}`, {
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
