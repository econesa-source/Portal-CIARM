/**
 * Cliente API de Integración Preproductiva - Portal CIARM
 */
const STAGING_CONFIG = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxx_dPOsx1x1y4KDyaJpn9U8UKxnF4WXj5lrBeDUQ41j0loNURBSryyyXqDF-0AJFkJ1w/exec"
};

export async function createTicketAPI(payload) {
  try {
    const cleanUrl = STAGING_CONFIG.WEB_APP_URL.trim();
    console.log("🚀 Enviando petición a la WebApp:", cleanUrl);

    const res = await fetch(cleanUrl, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createTicket", payload })
    });

    if (!res.ok) {
      throw new Error(`Estado HTTP: ${res.status}`);
    }

    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ Error de conexión:", e);
    return { status: "error", message: e.toString() };
  }
}

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
    console.error("❌ Error al consultar tickets:", e);
    return [];
  }
}
