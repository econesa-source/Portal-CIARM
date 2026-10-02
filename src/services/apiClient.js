/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 */
const STAGING_CONFIG = {
  WEB_APP_URL: "PEGA_AQUI_TU_URL_EXEC_APPS_SCRIPT"
};

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
