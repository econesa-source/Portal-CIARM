/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 17.3.0 (Fix Definitivo: Declaración Segura de USER_EMAIL)
 */

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  // URL Oficial de la WebApp Vinculada
  const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwFQW8HyJsjfWQnJLrE6XAxW0_UFFPYn59Xa90ZB38X1kmdCWlxZM4wkTunr9UN-GxUrA/exec';
  
  // DECLARACIÓN DEFENSIVA Y SEGURA DE USER_EMAIL
  const USER_EMAIL = (userSession && userSession.correo) 
    ? userSession.correo 
    : (window.CIARM_USER_EMAIL || 'econesa@ciarm.edu.mx');
  
  container.innerHTML = `<div style="padding:24px; font-weight:600; color:#0A192F;">⏳ Cargando solicitudes en vivo para ${USER_EMAIL}...</div>`;

  // Petición GET filtrada con rompe-caché (_t=Date.now())
  const requestUrl = `${GAS_WEBAPP_URL}?action=getTickets&email=${encodeURIComponent(USER_EMAIL)}&_t=${Date.now()}`;

  fetch(requestUrl, { method: 'GET', redirect: 'follow' })
    .then(res => res.text())
    .then(textData => {
      let tickets = [];
      try {
        if (textData.includes('window.CIARM_TICKETS_DATA')) {
          const jsonStr = textData.substring(textData.indexOf('['), textData.lastIndexOf(']') + 1);
          tickets = JSON.parse(jsonStr);
        } else {
          tickets = JSON.parse(textData);
        }
      } catch (e) {
        console.warn('Error parseando JSON de Google Apps Script:', e.message);
      }

      renderTable(container, tickets, USER_EMAIL);
    })
    .catch(err => {
      console.error('Error de red al consultar Google Sheets:', err.message);
      renderTable(container, [], USER_EMAIL);
    });
}

function renderTable(container, tickets, userEmail) {
  let tableRowsHtml = '';

  if (!Array.isArray(tickets) || tickets.length === 0) {
    tableRowsHtml = `
      <tr>
        <td colspan="6" style="text-align:center; padding:20px; color:#64748B;">
          No se encontraron solicitudes registradas para <strong>${userEmail}</strong>.
        </td>
      </tr>
    `;
  } else {
    tickets.forEach(ticket => {
      const driveUrl = ticket.driveUrl ? ticket.driveUrl.split('\n')[0] : `https://drive.google.com/drive/search?q=${encodeURIComponent(ticket.id + '_Adjuntos')}`;

      tableRowsHtml += `
        <tr>
          <td class="col-id"><strong>${ticket.id}</strong></td>
          <td class="col-fecha">${ticket.fecha}</td>
          <td class="col-tipo">${ticket.tipo}</td>
          <td class="col-desc">${ticket.desc}</td>
          <td class="col-estado">
            <span style="background:#FEF3C7; color:#92400E; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">
              ${ticket.estado || 'NUEVO'}
            </span>
          </td>
          <td class="col-accion">
            <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="btn-drive-subfolder">
              📂 Abrir Subcarpeta
            </a>
          </td>
        </tr>
      `;
    });
  }

  container.innerHTML = `
    <div class="card-container-wide">
      
      <!-- Navegación Superior -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
        <a href="#inicio" style="color: #1B2B48; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
          ← Volver al Inicio
        </a>
        <a href="#solicitudes" style="color: #C5A059; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
          + Crear Nueva Solicitud
        </a>
      </div>

      <!-- Encabezado -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="margin:0; color:#0A192F; font-size:1.4rem;">📋 Mis Solicitudes de Pedido</h2>
          <small style="color:#666;">Sincronizado en tiempo real con Google Workspace (BD - Sistema de Tickets / HT05)</small>
        </div>
        <div>
          <span style="font-weight:600; color:#0A192F; background:#F1F5F9; padding:6px 14px; border-radius:20px; font-size:0.85rem;">👤 ${userEmail}</span>
        </div>
      </div>

      <!-- Tabla de Solicitudes -->
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
