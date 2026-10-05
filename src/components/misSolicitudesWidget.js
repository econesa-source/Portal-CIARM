/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 11.0.0 (Conexión Nativa GAS JSONP + Contenedor Ampliado 100%)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzR8pY7zNf83v1T-3U8-GasExec/exec'; // URL del ejecutable de producción
  const USER_EMAIL = (userSession && userSession.correo) ? userSession.correo : 'econesa@ciarm.edu.mx';
  const CALLBACK_NAME = 'onCiarmTicketsLoaded_' + Date.now();

  container.innerHTML = `<div style="padding:20px; font-weight:600; color:#0A192F;">Sincronizando solicitudes en vivo para ${USER_EMAIL}...</div>`;

  // Definir callback global dinámico
  window[CALLBACK_NAME] = function() {
    const rawTickets = window.CIARM_TICKETS_DATA || [];
    delete window[CALLBACK_NAME]; // Limpieza de memoria
    
    // Remover tag de script inyectado
    const oldScript = document.getElementById('gas-jsonp-script');
    if (oldScript) oldScript.remove();

    let formattedTickets = [];
    rawTickets.forEach(ticket => {
      // Mapeo flexible de propiedades retornadas por getTickets()
      const ticketId = ticket.id || ticket.idTicket || ticket[0] || '';
      const fecha = ticket.fecha || ticket.fechaSolicitud || ticket[1] || '';
      const tipo = ticket.tipo || ticket.tipoSolicitud || ticket[6] || ticket[2] || '';
      const desc = ticket.desc || ticket.descripcion || ticket[7] || ticket[3] || '';
      const estado = ticket.estado || ticket[12] || ticket[4] || 'NUEVO';

      if (ticketId && ticketId.toString().startsWith('TKT-')) {
        formattedTickets.push({ id: ticketId, fecha, tipo, desc, estado });
      }
    });

    renderTable(container, formattedTickets, USER_EMAIL);
  };

  // Petición por inyección de Script (JSONP sin bloqueo CORS ni 404)
  const scriptUrl = `https://script.google.com/macros/s/AKfycby3E3fJpW1S6x7T33sX/exec?action=getTickets&email=${encodeURIComponent(USER_EMAIL)}&cb=${CALLBACK_NAME}`;
  
  // Resguardo por si la red falla
  const scriptTag = document.createElement('script');
  scriptTag.id = 'gas-jsonp-script';
  scriptTag.src = scriptUrl;
  scriptTag.onerror = function() {
    renderErrorBox(container, 'No se pudo conectar con el servidor de Google Apps Script.');
  };

  document.body.appendChild(scriptTag);
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

  if (!tableRowsHtml) {
    tableRowsHtml = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#666;">No se encontraron solicitudes registradas para este usuario.</td></tr>`;
  }

  container.innerHTML = `
    <div class="card-container-wide">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="margin:0; color:#0A192F; font-size:1.4rem;">📋 Mis Solicitudes de Pedido</h2>
          <small style="color:#666;">Sincronizado en tiempo real con Google Workspace (BD - Sistema de Tickets / HT05)</small>
        </div>
        <div>
          <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 14px; border-radius:20px; font-size:0.85rem;">👤 ${userEmail}</span>
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

function renderErrorBox(container, errorDetails) {
  container.innerHTML = `
    <div style="padding:20px; color:#D32F2F; background:#FFEBEE; border-radius:6px; border:1px solid #FFCDD2; margin-top:15px;">
      <strong>⚠️ Error de Conexión:</strong> ${errorDetails}
    </div>
  `;
}

export const render = renderMisSolicitudesWidget;
