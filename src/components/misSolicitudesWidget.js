/**
 * Componente Mis Solicitudes - GViz Parser Robusto
 * Versión: 11.0.5
 */
export function render(container) {
  if (!container) return;

  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';
  const USER_EMAIL = 'econesa@ciarm.edu.mx';
  // URL limpia de GViz API
  const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=TICKETS`;

  container.innerHTML = `<div class="loading" style="padding:20px; font-weight:600; color:#0A192F;">Cargando solicitudes de ${USER_EMAIL}...</div>`;

  fetch(GVIZ_URL)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Error en respuesta HTTP de Google Sheets: Status ${res.status}`);
      }
      return res.text();
    })
    .then(text => {
      // Extracción segura de JSON mediante Expresión Regular sobre la respuesta JSONP
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      let jsonData = null;

      if (jsonMatch && jsonMatch[1]) {
        jsonData = JSON.parse(jsonMatch[1]);
      } else {
        // Resguardo si la respuesta viene con formato directo
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          jsonData = JSON.parse(text.substring(startIdx, endIdx + 1));
        } else {
          throw new Error('Respuesta de Google Sheets no contiene un JSON valido.');
        }
      }

      if (jsonData.status === 'error') {
        throw new Error(`Error en la consulta GViz: ${jsonData.errors?.[0]?.detailed_message || 'Tabla no encontrada'}`);
      }

      const rows = jsonData.table?.rows || [];
      let tableRowsHtml = '';

      rows.forEach(row => {
        const ticketId = row.c?.[0]?.v || '';
        const fecha = row.c?.[1]?.f || row.c?.[1]?.v || '';
        const tipo = row.c?.[2]?.v || '';
        const descripcion = row.c?.[3]?.v || '';
        const estado = row.c?.[4]?.v || 'NUEVO';

        if (ticketId) {
          const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticketId + '_Adjuntos')}`;

          tableRowsHtml += `
            <tr>
              <td class="col-id"><strong>${ticketId}</strong></td>
              <td class="col-fecha">${fecha}</td>
              <td class="col-tipo">${tipo}</td>
              <td class="col-desc">${descripcion}</td>
              <td class="col-estado"><span class="badge badge-nuevo" style="background:#E2E8F0; padding:3px 8px; border-radius:4px; font-size:0.75rem;">${estado}</span></td>
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
        tableRowsHtml = `<tr><td colspan="6" style="text-align:center; padding:20px;">No se encontraron solicitudes registradas para el usuario.</td></tr>`;
      }

      container.innerHTML = `
        <div class="card-container" style="border-top: 5px solid #C5A059; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-top:15px;">
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
      console.error('Error al procesar datos de GViz:', err);
      if (container) {
        container.innerHTML = `
          <div class="error-box" style="padding:20px; color:#D32F2F; background:#FFEBEE; border-radius:6px; border:1px solid #FFCDD2; margin-top:15px;">
            <strong>⚠️ Error de Sincronización:</strong> No se pudieron cargar las solicitudes desde Google Sheets.<br>
            <small style="color:#555;">Detalle técnico: ${err.message}</small>
          </div>
        `;
      }
    });
}
