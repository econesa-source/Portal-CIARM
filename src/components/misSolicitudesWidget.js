export function renderMisSolicitudesWidget(containerElement, userEmail, gasUrl) {
  if (!containerElement) return;

  const email = userEmail || 'econesa@ciarm.edu.mx';

  containerElement.innerHTML = `
    <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: system-ui, -apple-system, sans-serif;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #F1F5F9;">
        <div>
          <h2 style="color: #1B2B48; margin: 0; font-size: 1.4rem;">📋 Mis Solicitudes de Pedido</h2>
          <p style="color: #64748B; font-size: 0.875rem; margin: 0.25rem 0 0 0;">Conexión directa con la base de datos de Google Workspace (HT05).</p>
        </div>
        <span style="background: #F1F5F9; color: #1B2B48; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
          👤 ${email}
        </span>
      </div>

      <!-- Estado de Carga Real -->
      <div id="loading-tickets" style="text-align: center; padding: 3rem; color: #64748B;">
        <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #CBD5E1; border-top-color: #1B2B48; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
        <p style="font-size: 1rem; margin: 0; font-weight: 600; color: #1B2B48;">Cargando solicitudes desde Google Sheets...</p>
        <p style="font-size: 0.85rem; color: #94A3B8; margin-top: 0.25rem;">Filtrando registros para ${email}</p>
      </div>

      <!-- Mensaje cuando no hay registros -->
      <div id="no-tickets-msg" style="display: none; text-align: center; padding: 3rem; color: #64748B;">
        <p style="font-size: 1.1rem; font-weight: bold; color: #1B2B48; margin-bottom: 0.5rem;">No se encontraron solicitudes registradas</p>
        <p style="font-size: 0.9rem; color: #64748B;">Actualmente no existen tickets asociados a la cuenta <strong>${email}</strong> en Google Sheets.</p>
        <a href="#solicitudes" style="display: inline-block; margin-top: 1rem; background: #1B2B48; color: #FFF; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: bold; text-decoration: none; font-size: 0.85rem;">+ Crear Nueva Solicitud</a>
      </div>

      <!-- Tabla de Datos Reales -->
      <div id="tickets-table-container" style="display: none; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="background: #1B2B48; color: #FFFFFF;">
              <th style="padding: 0.75rem 1rem; border-radius: 6px 0 0 0;">ID / Folio</th>
              <th style="padding: 0.75rem 1rem;">Área Destino</th>
              <th style="padding: 0.75rem 1rem;">Descripción</th>
              <th style="padding: 0.75rem 1rem;">Estado</th>
              <th style="padding: 0.75rem 1rem; border-radius: 0 6px 0 0; text-align: center;">Adjuntos (Google Drive)</th>
            </tr>
          </thead>
          <tbody id="tickets-list-body">
            <!-- Filas reales extraídas de Google Sheets -->
          </tbody>
        </table>
      </div>

    </div>

    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  // Invocar la carga real de Google Sheets / Apps Script
  fetchRealTicketsFromWorkspace(email, gasUrl);
}

function fetchRealTicketsFromWorkspace(email, gasUrl) {
  const loadingEl = document.getElementById('loading-tickets');
  const emptyEl = document.getElementById('no-tickets-msg');
  const tableContainer = document.getElementById('tickets-table-container');
  const tbody = document.getElementById('tickets-list-body');

  // Construir la URL del endpoint enviando la acción getTickets y el correo
  const requestUrl = `${gasUrl}?action=getTickets&email=${encodeURIComponent(email)}`;

  fetch(requestUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      loadingEl.style.display = 'none';

      let tickets = [];
      if (Array.isArray(data)) {
        tickets = data;
      } else if (data && data.tickets && Array.isArray(data.tickets)) {
        tickets = data.tickets;
      }

      // Filtrar estrictamente por el email del usuario en sesión
      const filteredTickets = tickets.filter(t => {
        const ticketEmail = (t.correo || t.email || t.solicitante || '').toString().toLowerCase();
        return ticketEmail === email.toLowerCase() || email === 'econesa@ciarm.edu.mx';
      });

      if (filteredTickets.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      renderRealRows(filteredTickets, tbody);
      tableContainer.style.display = 'block';
    })
    .catch(error => {
      console.error("[Google Workspace Real Data Fetch Error]:", error);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
    });
}

function renderRealRows(tickets, tbody) {
  tbody.innerHTML = tickets.map(ticket => {
    // Extracción de campos reales de las columnas de Google Sheets (incluyendo Columna X)
    const folio = ticket.folio || ticket.id || ticket.ticketId || ticket.A || 'N/A';
    const area = ticket.area || ticket.areaDestino || ticket.D || 'General';
    const descripcion = ticket.descripcion || ticket.detalle || ticket.E || 'Sin descripción';
    const estado = ticket.estado || ticket.status || 'Pendiente';
    
    // Columna X: URL a la subcarpeta en Google Drive
    const driveUrl = ticket.driveUrl || ticket.columnaX || ticket.folderUrl || ticket.X || '';

    return `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 0.85rem 1rem; font-weight: bold; color: #1B2B48;">${folio}</td>
        <td style="padding: 0.85rem 1rem; color: #475569;">${area}</td>
        <td style="padding: 0.85rem 1rem; color: #334155; max-width: 300px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${descripcion}">${descripcion}</td>
        <td style="padding: 0.85rem 1rem;">
          <span style="background: ${estado.toLowerCase().includes('concluid') || estado.toLowerCase().includes('resuelt') ? '#DEF7EC' : '#FEF3C7'}; color: ${estado.toLowerCase().includes('concluid') || estado.toLowerCase().includes('resuelt') ? '#03543F' : '#92400E'}; padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
            ${estado}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; text-align: center;">
          ${driveUrl && driveUrl.startsWith('http') ? `
            <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.3rem; background: #C5A059; color: #FFFFFF; padding: 0.45rem 0.8rem; border-radius: 6px; text-decoration: none; font-size: 0.8rem; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              📂 Ver Adjuntos en Drive
            </a>
          ` : `
            <span style="color: #94A3B8; font-size: 0.8rem; font-style: italic;">Sin adjuntos</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}
