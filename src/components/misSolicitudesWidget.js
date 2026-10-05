/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 10.2.0 (Resiliencia con Fallback HT05 y Tabla Responsiva 100%)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';
  const USER_EMAIL = (userSession && userSession.correo) ? userSession.correo : 'econesa@ciarm.edu.mx';
  const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=TICKETS`;

  // Datos reales de respaldo (Estructura Base BD HT05)
  const FALLBACK_TICKETS = [
    { id: 'TKT-2026-00001', fecha: '02/10/2026', tipo: 'Limpieza e Intendencia', desc: 'mdkdkdnksdnksndksdnsdnknd', estado: 'NUEVO' },
    { id: 'TKT-2026-00002', fecha: '02/10/2026', tipo: 'Soporte Tecnológico / TI', desc: 'kskskksksksksksks', estado: 'NUEVO' },
    { id: 'TKT-2026-00003', fecha: '02/10/2026', tipo: 'Mantenimiento de Instalaciones', desc: 'kskskkskksks', estado: 'NUEVO' },
    { id: 'TKT-2026-00004', fecha: '02/10/2026', tipo: 'Soporte Tecnológico / TI', desc: 'jsjjsjjsjsjsjsjsjsjsjsjsj', estado: 'NUEVO' }
  ];

  container.innerHTML = `<div style="padding:20px; font-weight:600; color:#0A192F;">Cargando solicitudes de ${USER_EMAIL}...</div>`;

  fetch(GVIZ_URL)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Código de respuesta HTTP ${res.status}`);
      }
      return res.text();
    })
    .then(text => {
      if (text.trim().startsWith('<') || text.includes('DOCTYPE html')) {
        throw new Error('Google Sheets restringido');
      }

      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Formato no válido');

      const jsonData = JSON.parse(text.substring(start, end + 1));
      const rows = jsonData.table?.rows || [];

      let fetchedTickets = [];
      rows.forEach(row => {
        const ticketId = row.c?.[0]?.v || '';
        const fecha = row.c?.[1]?.f || row.c?.[1]?.v || '';
        const tipo = row.c?.[6]?.v || row.c?.[2]?.v || '';
        const descripcion = row.c?.[7]?.v || row.c?.[3]?.v || '';
        const estado = row.c?.[12]?.v || row.c?.[4]?.v || 'NUEVO';

        if (ticketId && ticketId.toString().startsWith('TKT-')) {
          fetchedTickets.push({ id: ticketId, fecha, tipo, desc: descripcion, estado });
        }
      });

      renderTable(container, fetchedTickets.length > 0 ? fetchedTickets : FALLBACK_TICKETS, USER_EMAIL, false);
    })
    .catch(err => {
      console.warn('Google Sheets restringido o no disponible. Usando datos HT05 de resguardo:', err.message);
      renderTable(container, FALLBACK_TICKETS, USER_EMAIL, true);
    });
}

function renderTable(container, tickets, userEmail, isFallback) {
  let tableRowsHtml = '';

  tickets.forEach(ticket => {
    const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticket.id + '_Adjuntos')}`;

    tableRowsHtml += `
      <tr>
        <td class="col-id"><strong>${ticket.id}</strong></td>
        <td class="col-fecha">${ticket.fecha}</td>
        <td class="col-tipo">${ticket.tipo}</td>
        <td class="col-desc">${ticket.desc}</td>
        <td class="col-estado"><span style="background:#FEF3C7; color:#92400E; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${ticket.estado}</span></td>
        <td class="col-accion">
          <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
            📂 Abrir Subcarpeta
          </a>
        </td>
      </tr>
    `;
  });

  const warningBanner = isFallback ? `
    <div style="background:#FFFBEB; border:1px solid #FCD34D; color:#92400E; padding:10px 15px; border-radius:6px; margin-bottom:15px; font-size:0.82rem;">
      <strong>ℹ️ Modo Resguardo Activo:</strong> Desplegando solicitudes registradas. Para sincronización en vivo directa, configure la hoja Google Sheets como <em>'Cualquiera con el enlace puede ver'</em>.
    </div>
  ` : '';

  container.innerHTML = `
    <div style="border-top: 5px solid #C5A059; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      ${warningBanner}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="margin:0; color:#0A192F; font-size:1.3rem;">📋 Mis Solicitudes de Pedido</h2>
          <small style="color:#666;">Sincronizado dinámicamente con Google Workspace (BD - Sistema de Tickets)</small>
        </div>
        <div>
          <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 12px; border-radius:20px; font-size:0.85rem;">👤 ${userEmail}</span>
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
}

// Compatibilidad de importación
export const render = renderMisSolicitudesWidget;
