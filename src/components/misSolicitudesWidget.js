import { getMisSolicitudes } from '../services/ticketsService.js';

export async function renderMisSolicitudesWidget(containerElement, userEmail) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <p style="color: #1B2B48; font-weight: 600;">Sincronizando solicitudes en tiempo real...</p>
    </div>
  `;

  try {
    const tickets = await getMisSolicitudes(userEmail);

    if (!tickets || tickets.length === 0) {
      containerElement.innerHTML = `
        <div style="background: #F9FAFB; border: 1px dashed #D1D5DB; border-radius: 8px; padding: 2.5rem; text-align: center; margin: 1rem 0;">
          <h3 style="color: #1B2B48;">Sin solicitudes registradas</h3>
          <p style="color: #6B7280;">No hay tickets registrados para <strong>${userEmail}</strong>.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = tickets.map(ticket => `
      <div style="background: #FFF; border: 1px solid #E5E7EB; border-left: 4px solid #C5A059; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-size: 1.1rem; font-weight: bold; color: #1B2B48;">${ticket.folio}</span>
          <span style="background: #DBEAFE; color: #1E40AF; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: bold;">
            ${ticket.estado}
          </span>
        </div>
        <div style="color: #374151; font-weight: 600;">${ticket.tipo} — <span style="color: #6B7280;">${ticket.area}</span></div>
        <p style="color: #4B5563; font-size: 0.95rem; margin: 0.5rem 0;">${ticket.descripcion}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F3F4F6; padding-top: 0.75rem; font-size: 0.85rem; color: #9CA3AF;">
          <span>📅 ${ticket.fecha} ${ticket.hora}</span>
          ${ticket.driveUrl ? `
            <a href="${ticket.driveUrl}" target="_blank" rel="noopener noreferrer" style="color: #1B2B48; font-weight: bold; text-decoration: none;">
              📎 Ver Archivo Adjunto en Google Drive ↗
            </a>
          ` : '<span style="color: #9CA3AF; font-style: italic;">Sin archivos adjuntos</span>'}
        </div>
      </div>
    `).join('');

    containerElement.innerHTML = `<div>${cardsHtml}</div>`;

  } catch (error) {
    containerElement.innerHTML = `
      <div style="background: #FEF2F2; color: #991B1B; padding: 1rem; border-radius: 8px;">
        Error al cargar las solicitudes.
      </div>
    `;
  }
}
