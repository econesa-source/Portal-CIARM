/**
 * Componente Mis Solicitudes - Renderizado Responsivo
 * Versión: 11.0.2
 */
export function render(container) {
  if (!container) return;

  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';
  const USER_EMAIL = 'econesa@ciarm.edu.mx';
  const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=TICKETS`;

  container.innerHTML = `<div class="loading" style="padding:20px; font-weight:600;">Cargando solicitudes de ${USER_EMAIL}...</div>`;

  fetch(GVIZ_URL)
    .then(res => res.text())
    .then(text => {
      const jsonData = JSON.parse(text.substring(47, text.length - 2));
      const rows = jsonData.table.rows;

      let tableRowsHtml = '';

      rows.forEach(row => {
        const ticketId = row.c[0]?.v || '';
        const fecha = row.c[1]?.f || row.c[1]?.v || '';
        const tipo = row.c[2]?.v || '';
        const descripcion = row.c[3]?.v || '';
        const estado = row.c[4]?.v || 'NUEVO';

        if (ticketId) {
          const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticketId + '_Adjuntos')}`;

          tableRowsHtml += `
            <tr>
              <td class="col-id"><strong>${ticketId}</strong></td>
              <td class="col-fecha">${fecha}</td>
              <td class="col-tipo">${tipo}</td>
              <td class="col-desc">${descripcion}</td>
              <td class="col-estado"><span class="badge badge-nuevo" style="background:#E2E8F0; padding:3px 8px; border-radius:4px;">${estado}</span></td>
              <td class="col-accion">
                <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
                  📂 Abrir Subcarpeta
                </a>
              </td>
            </tr>
          `;
        }
      });

      container.innerHTML = `
        <div class="card-container" style="border-top: 5px solid #C5A059; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h2 style="margin:0; color:#0A192F;">📋 Mis Solicitudes de Pedido</h2>
              <small style="color:#666;">Sincronizado dinámicamente con Google Workspace (BD - Sistema de Tickets)</small>
            </div>
            <div>
              <span style="font-weight:600; color:#0A192F;">👤 ${USER_EMAIL}</span>
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
                  <th class="col-accion">Subcarpeta Adjuntos</th>
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
      console.error('Error al obtener datos de GViz:', err);
      if (container) {
        container.innerHTML = `<div class="error-box" style="padding:20px; color:red;">No se pudieron cargar las solicitudes desde Google Sheets.</div>`;
      }
    });
}
