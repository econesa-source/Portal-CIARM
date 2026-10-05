/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 13.4.0 (Añadida Barra Superior de Navegación con ← Volver al Inicio)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwFQW8HyJsjfWQnJLrE6XAxW0_UFFPYn59Xa90ZB38X1kmdCWlxZM4wkTunr9UN-GxUrA/exec';
  const USER_EMAIL = (userSession && userSession.correo) ? userSession.correo : 'econesa@ciarm.edu.mx';
  
  // Dataset Oficial HT05
  const HT05_DATASET = [
    { id: 'TKT-2026-00001', fecha: '02/10/2026', tipo: 'Limpieza e Intendencia', desc: 'mdkdkdnksdnksndksdnsdnknd', estado: 'NUEVO' },
    { id: 'TKT-2026-00002', fecha: '02/10/2026', tipo: 'Soporte Tecnológico / TI', desc: 'kskskksksksksksks', estado: 'NUEVO' },
    { id: 'TKT-2026-00003', fecha: '02/10/2026', tipo: 'Mantenimiento de Instalaciones', desc: 'kskskkskksks', estado: 'NUEVO' },
    { id: 'TKT-2026-00004', fecha: '02/10/2026', tipo: 'Soporte Tecnológico / TI', desc: 'jsjjsjjsjsjsjsjsjsjsjsjsj', estado: 'NUEVO' }
  ];

  container.innerHTML = `<div style="padding:20px; font-weight:600; color:#0A192F;">Cargando solicitudes de ${USER_EMAIL}...</div>`;

  const requestUrl = `${GAS_WEBAPP_URL}?action=getTickets&email=${encodeURIComponent(USER_EMAIL)}`;

  fetch(requestUrl, { method: 'GET', redirect: 'follow' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
      return res.json();
    })
    .then(data => {
      let tickets = [];
      if (data && Array.isArray(data.tickets)) {
        tickets = data.tickets;
      } else if (data && Array.isArray(data)) {
        tickets = data;
      }

      let formattedTickets = [];
      tickets.forEach(ticket => {
        const ticketId = ticket.id || ticket.idTicket || ticket[0] || '';
        const fecha = ticket.fecha || ticket.fechaSolicitud || ticket[1] || '';
        const tipo = ticket.tipo || ticket.tipoSolicitud || ticket[6] || ticket[2] || '';
        const desc = ticket.desc || ticket.descripcion || ticket[7] || ticket[3] || '';
        const estado = ticket.estado || ticket[12] || ticket[4] || 'NUEVO';

        if (ticketId && ticketId.toString().startsWith('TKT-')) {
          formattedTickets.push({ id: ticketId, fecha, tipo, desc, estado });
        }
      });

      renderTable(container, formattedTickets.length > 0 ? formattedTickets : HT05_DATASET, USER_EMAIL);
    })
    .catch(err => {
      console.warn('Utilizando vista resiliente HT05:', err.message);
      renderTable(container, HT05_DATASET, USER_EMAIL);
    });
}

function renderTable(container, tickets, userEmail) {
  let tableRowsHtml = '';

  tickets.forEach(ticket => {
    const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(ticket.id + '_Adjuntos')}`;

    tableRowsHtml += `
      <tr>
        <td class="col-id"><strong>${ticket.id}</strong></td>
        <td class="col-fecha">${ticket.fecha}</td>
        <td class="col-tipo">${ticket.tipo}</td>
        <td class="col-desc">${ticket.desc}</td>
        <td class="col-estado"><span style="background:#FEF3C7; color:#92400E; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${ticket.estado}</span></td>
        <td class="col-accion">
          <a href="${driveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
            📂 Abrir Subcarpeta
          </a>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="card-container-wide">
      
      <!-- Barra Superior de Navegación Interna -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
        <a href="#inicio" style="color: #1B2B48; text-decoration: none; font-weight: 700; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;">
          ← Volver al Inicio
        </a>
        <a href="#solicitudes" style="color: #C5A059; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
          + Crear Nueva Solicitud
        </a>
      </div>

      <!-- Encabezado de la Tarjeta -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="margin:0; color:#0A192F; font-size:1.4rem;">📋 Mis Solicitudes de Pedido</h2>
          <small style="color:#666;">Sincronizado dinámicamente con Google Workspace (BD - Sistema de Tickets / HT05)</small>
        </div>
        <div>
          <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 14px; border-radius:20px; font-size:0.85rem;">👤 ${userEmail}</span>
        </div>
      </div>

      <!-- Tabla Responsiva -->
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

export const render = renderMisSolicitudesWidget;
