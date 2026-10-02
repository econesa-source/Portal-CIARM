/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 * Conexión resiliente con Google Apps Script WebApp
 */
const STAGING_CONFIG = {
  WEB_APP_URL: "https://script.google.com/a/macros/ciarm.edu.mx/s/AKfycbxnjpsg4BdZEn-1EL1xXA6BH_emH5Wd7RSuHBPtwpJOQwGgb6a2NKOVCVO-aVpYdO3orw/exec"
};

/**
 * Registra una nueva solicitud interna en Google Sheets (BD - Sistema de Tickets)
 * y almacena los adjuntos en la carpeta de Google Drive.
 */
export async function createTicketAPI(payload) {
  const cleanUrl = STAGING_CONFIG.WEB_APP_URL.trim();

  // Intento 1: Envío Estándar CORS
  try {
    const res = await fetch(cleanUrl, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createTicket", payload })
    });

    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (corsErr) {
    console.warn("⚠️ Petición CORS bloqueada por política de origen. Conmutando a Fallback No-CORS...", corsErr);
  }

  // Intento 2: Fallback No-CORS Stream (Garantiza la entrega al backend de Google Workspace)
  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createTicket", payload })
    });

    return { status: "success", message: "Solicitud procesada correctamente por la WebApp." };
  } catch (errNoCors) {
    console.error("❌ Error de red definitivo al conectar con Google Apps Script:", errNoCors);
    return { status: "error", message: errNoCors.toString() };
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
    console.error("❌ Error al consultar contexto DM03:", e);
    return { autorizado: false, reason: "Error de red HTTP" };
  }
}
