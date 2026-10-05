/**
 * Portal CIARM - Componente Mis Solicitudes
 * Versión: 10.0.1 (Hotfix: Restablecimiento de firma de exportación ES6)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';
  const USER_EMAIL = (userSession && userSession.correo) ? userSession.correo : 'econesa@ciarm.edu.mx';
  const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=TICKETS`;

  container.innerHTML = `<div style="padding:20px; font-weight:600; color:#0A192F;">Cargando solicitudes de ${USER_EMAIL}...</div>`;

  fetch(GVIZ_URL)
    .then(res => res.text())
    .then(text => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Respuesta inválida de Google Sheets');

      const jsonData = JSON.parse(text.substring(start, end + 1));
      const rows = jsonData.table?.rows || [];

      let tableRowsHtml = '';

      rows.forEach(row => {
        const ticketId = row.c?.[0]?.v || '';
        const fecha = row.c?.[1]?.f || row.c?.[1]?.v || '';
        const tipo = row.c?.[6]?.v || row.c?.[2]?.v || '';
        const descripcion = row.c?.[7]?.v || row.c?.[3]?.v || '';
        const estado = row.c?.[12]?.v || row.c?.[4]?.v || 'NUEVO';
        const email = row.c?.[5]?.v || row.c?.[2]?.v || '';

        if (ticketId) {
          const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticketId + '_Adjuntos')}`;

          tableRowsHtml += `
            <tr>
              <td class="col-id"><strong>${ticketId}</strong></td>
              <td class="col-fecha">${fecha}</td>
              <td class="col-tipo">${tipo}</td>
              <td class="col-desc">${descripcion}</td>
              <td class="col-estado"><span style="background:#FEF3C7; color:#92400E; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${estado}</span></td>
              <td class="col-accion">
                <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
                  📂 Abrir Subcarpeta Ticket
                </a>
              </td>
            </tr>
          `;
        }
      });

      container.innerHTML = `
        <div style="border-top: 5px solid #C5A059; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h2 style="margin:0; color:#0A192F;">📋 Mis Solicitudes de Pedido</h2>
              <small style="color:#666;">Sincronizado dinámicamente con Google Workspace (BD - Sistema de Tickets)</small>
            </div>
            <div>
              <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 12px; border-radius:20px; font-size:0.85rem;">👤 ${USER_EMAIL}</span>
            </div>
          </div>

          <div class="table-responsive-container">
            <table class="tickets-table">
              <thead>
                <tr style="background-color: #0A192F; color: #FFF;">
                  <th class="col-id">ID Ticket</th>
                  <th class="col-fecha">Fecha</th>
                  <th class="col-tipo">Tipo / Área</th>
                  <th class="col-desc">Descripción</th>
                  <th class="col-estado">Estado</th>
                  <th class="col-accion">Subcarpeta de Adjuntos (Drive)</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .catch(err => {
      console.error('Error al cargar solicitudes:', err);
      container.innerHTML = `<div style="padding:20px; color:red;">No se pudieron cargar las solicitudes desde Google Sheets.</div>`;
    });
}

// Alias de exportación para compatibilidad
export const render = renderMisSolicitudesWidget;
