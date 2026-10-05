/**
 * Componente Mis Solicitudes - Portal CIARM
 * Versión: 16.6.1 (Consulta Dinámica en Vivo con NUEVA URL Sincronizada)
 */

import { GAS_WEBAPP_URL } from '../services/apiClient.js';

export function renderMisSolicitudesWidget(container, userSession) {
  if (!container) return;

  const USER_EMAIL = userSession?.correo || 'econesa@ciarm.edu.mx';
  
  container.innerHTML = `<div style="padding:24px; font-weight:600; color:#0A192F;">⏳ Cargando solicitudes en vivo para ${USER_EMAIL}...</div>`;

  // Petición GET filtrada con rompe-caché (_t=Date.now())
  const requestUrl = `${GAS_WEBAPP_URL}?action=getTickets&email=${encodeURIComponent(USER_EMAIL)}&_t=${Date.now()}`;

  fetch(requestUrl, { method: 'GET', redirect: 'follow' })
    .then(res => res.text())
    .then(textData => {
      let tickets = [];
      try {
        let parsed;
        if (textData.includes('window.CIARM_TICKETS_DATA')) {
          const jsonStr = textData.substring(textData.indexOf('['), textData.lastIndexOf(']') + 1);
          parsed = JSON.parse(jsonStr);
        } else {
          parsed = JSON.parse(textData);
        }

        if (Array.isArray(parsed)) {
          tickets = parsed;
        } else if (parsed && Array.isArray(parsed.data)) {
          tickets = parsed.data;
        } else if (parsed && typeof parsed.data === 'object' && parsed.data !== null) {
          tickets = Array.isArray(parsed.data.tickets) ? parsed.data.tickets : [];
        }
      } catch (e) {
        console.warn('Error parseando JSON de Google Apps Script:', e.message);
      }

      renderTable(container, tickets, USER_EMAIL, () => renderMisSolicitudesWidget(container, userSession));
    })
    .catch(err => {
      console.error('Error de red al consultar Google Sheets:', err.message);
      renderTable(container, [], USER_EMAIL, () => renderMisSolicitudesWidget(container, userSession));
    });
}

function renderTable(container, tickets, userEmail, onRefresh) {
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
      const fechaLimpia = ticket.fecha ? (ticket.fecha.includes('T') ? ticket.fecha.split('T')[0] : ticket.fecha) : '';

      tableRowsHtml += `
        <tr>
          <td class="col-id"><strong>${ticket.id}</strong></td>
          <td class="col-fecha">${fechaLimpia}</td>
          <td class="col-tipo">${ticket.tipo || 'General'}</td>
          <td class="col-desc">${ticket.desc || ''}</td>
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
        <div style="display:flex; gap:12px; align-items:center;">
          <button id="btn-refresh-tickets" style="background:#F1F5F9; color:#0A192F; border:1px solid #CBD5E1; padding:6px 12px; border-radius:4px; font-weight:600; cursor:pointer; font-size:0.8rem;">
            🔄 Actualizar Datos
          </button>
          <a href="#solicitudes" style="color: #C5A059; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
            + Crear Nueva Solicitud
          </a>
        </div>
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

  document.getElementById('btn-refresh-tickets')?.addEventListener('click', () => {
    if (onRefresh) onRefresh();
  });
}

export const render = renderMisSolicitudesWidget;
