/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 10.3.0 (Lectura 100% Dinámica en Vivo y Tarjeta Ampliada)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';
  const SHEET_GID = '313146014'; // GID exacto de la pestaña TICKETS
  const USER_EMAIL = (userSession && userSession.correo) ? userSession.correo : 'econesa@ciarm.edu.mx';
  
  const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

  container.innerHTML = `<div style="padding:20px; font-weight:600; color:#0A192F;">Cargando solicitudes en tiempo real para ${USER_EMAIL}...</div>`;

  fetch(GVIZ_URL)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Acceso restringido en Google Sheets (HTTP ${res.status}). Asegúrese de habilitar 'Cualquiera con el enlace' en el libro.`);
      }
      return res.text();
    })
    .then(text => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Respuesta inválida de Google Workspace.');

      const jsonData = JSON.parse(text.substring(start, end + 1));
      const rows = jsonData.table?.rows || [];

      let tableRowsHtml = '';

      rows.forEach(row => {
        const ticketId = row.c?.[0]?.v || '';
        const fecha = row.c?.[1]?.f || row.c?.[1]?.v || '';
        const tipo = row.c?.[6]?.v || row.c?.[2]?.v || '';
        const descripcion = row.c?.[7]?.v || row.c?.[3]?.v || '';
        const estado = row.c?.[12]?.v || row.c?.[4]?.v || 'NUEVO';
        const email = row.c?.[5]?.v || '';

        // Filtro por usuario o despliegue de tickets válidos
        if (ticketId && ticketId.toString().startsWith('TKT-')) {
          const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticketId + '_Adjuntos')}`;

          tableRowsHtml += `
            <tr>
              <td class="col-id"><strong>${ticketId}</strong></td>
              <td class="col-fecha">${fecha}</td>
              <td class="col-tipo">${tipo}</td>
              <td class="col-desc">${descripcion}</td>
              <td class="col-estado"><span style="background:#FEF3C7; color:#92400E; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${estado}</span></td>
              <td class="col-accion">
                <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
                  📂 Abrir Subcarpeta
                </a>
              </td>
            </tr>
          `;
        }
      });

      if (!tableRowsHtml) {
        tableRowsHtml = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#666;">No se encontraron solicitudes registradas en la base de datos.</td></tr>`;
      }

      container.innerHTML = `
        <div class="card-container-wide">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h2 style="margin:0; color:#0A192F; font-size:1.4rem;">📋 Mis Solicitudes de Pedido</h2>
              <small style="color:#666;">Sincronizado en vivo con Google Workspace (BD - Sistema de Tickets / HT05)</small>
            </div>
            <div>
              <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 14px; border-radius:20px; font-size:0.85rem;">👤 ${USER_EMAIL}</span>
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
                  <th class="col-accion">Subcarpeta Adjuntos (Drive)</th>
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
      console.error('Error de lectura dinámicamente desde Sheets:', err);
      container.innerHTML = `
        <div style="padding:20px; color:#D32F2F; background:#FFEBEE; border-radius:6px; border:1px solid #FFCDD2; margin-top:15px;">
          <strong>⚠️ Error de Sincronización en Vivo:</strong> No se pudieron leer los datos desde Google Sheets.<br>
          <small style="color:#555;">${err.message}</small>
        </div>
      `;
    });
}

export const render = renderMisSolicitudesWidget;
