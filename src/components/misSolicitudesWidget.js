export function renderMisSolicitudesWidget(containerElement, userEmail) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #E2E8F0;">
      <div style="display:flex; justify-style:space-between; align-items:center; margin-bottom: 1rem;">
        <h2 style="color: #1B2B48; margin: 0;">📋 Mis Solicitudes de Pedido</h2>
        <span style="font-size: 0.85rem; color: #64748B;">Usuario: <strong>${userEmail || 'econesa@ciarm.edu.mx'}</strong></span>
      </div>
      <p style="color: #475569; font-size: 0.95rem;">Cargando historial de solicitudes registradas en Google Sheets (HT05)...</p>
      <div id="tabla-mis-solicitudes" style="margin-top: 1rem;">
        <p style="color: #94A3B8; font-style: italic;">Consultando registros...</p>
      </div>
    </div>
  `;
}
