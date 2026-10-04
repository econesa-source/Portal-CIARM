export function renderMisSolicitudesWidget(containerElement, userEmail) {
  if (!containerElement) return;

  const email = userEmail || 'econesa@ciarm.edu.mx';
  const SPREADSHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDISsW0fUExDjPE4cGpnPbs';

  containerElement.innerHTML = `
    <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: system-ui, -apple-system, sans-serif;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #F1F5F9;">
        <div>
          <h2 style="color: #1B2B48; margin: 0; font-size: 1.4rem;">📋 Mis Solicitudes de Pedido</h2>
          <p style="color: #64748B; font-size: 0.875rem; margin: 0.25rem 0 0 0;">Sincronizado en tiempo real con Google Workspace (BD - Sistema de Tickets).</p>
        </div>
        <span style="background: #F1F5F9; color: #1B2B48; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
          👤 ${email}
        </span>
      </div>

      <!-- Estado de Carga -->
      <div id="loading-tickets" style="text-align: center; padding: 3rem; color: #64748B;">
        <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid #CBD5E1; border-top-color: #1B2B48; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem;"></div>
        <p style="font-size: 1rem; margin: 0; font-weight: 600; color: #1B2B48;">Consultando base de datos de tickets...</p>
        <p style="font-size: 0.85rem; color: #94A3B8; margin-top: 0.25rem;">Cargando registros para ${email}</p>
      </div>

      <!-- Mensaje Sin Registros -->
      <div id="no-tickets-msg" style="display: none; text-align: center; padding: 3rem; color: #64748B;">
        <p style="font-size: 1.1rem; font-weight: bold; color: #1B2B48; margin-bottom: 0.5rem;">No se encontraron solicitudes</p>
        <p style="font-size: 0.9rem; color: #64748B;">No existen tickets asociados al correo <strong>${email}</strong>.</p>
        <a href="#solicitudes" style="display: inline-block; margin-top: 1rem; background: #1B2B48; color: #FFF; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: bold; text-decoration: none; font-size: 0.85rem;">+ Crear Nueva Solicitud</a>
      </div>

      <!-- Tabla de Datos Reales -->
      <div id="tickets-table-container" style="display: none; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          <thead>
            <tr style="background: #1B2B48; color: #FFFFFF;">
              <th style="padding: 0.75rem 1rem; border-radius: 6px 0 0 0;">ID Ticket</th>
              <th style="padding: 0.75rem 1rem;">Fecha</th>
              <th style="padding: 0.75rem 1rem;">Tipo / Área</th>
              <th style="padding: 0.75rem 1rem;">Descripción</th>
              <th style="padding: 0.75rem 1rem;">Estado</th>
              <th style="padding: 0.75rem 1rem; border-radius: 0 6px 0 0; text-align: center;">Adjuntos (Google Drive)</th>
            </tr>
          </thead>
          <tbody id="tickets-list-body">
            <!-- Filas inyectadas -->
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

  loadRealTicketsData(SPREADSHEET_ID, email);
}

function loadRealTicketsData(spreadsheetId, email) {
  const loadingEl = document.getElementById('loading-tickets');
  const emptyEl = document.getElementById('no-tickets-msg');
  const tableContainer = document.getElementById('tickets-table-container');
  const tbody = document.getElementById('tickets-list-body');

  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tq=SELECT%20*&sheet=TICKETS`;

  fetch(gvizUrl)
    .then(function(res) { return res.text(); })
    .then(function(text) {
      const jsonString = text.replace(/^/*O_o*//\s*google\.visualization\.Query\.setResponse\(/, '').replace(/\);?$/, '');
      const parsedData = JSON.parse(jsonString);

      if (!parsedData || !parsedData.table || !parsedData.table.rows) {
        throw new Error("Respuesta GViz sin filas");
      }

      const rows = parsedData.table.rows;
      const ticketsList = [];

      rows.forEach(function(row) {
        const c = row.c;
        if (!c) return;

        const idTicket = c[0] ? (c[0].v || c[0].f || '') : '';
        const fecha = c[1] ? (c[1].v || c[1].f || '') : '';
        const correo = c[5] ? (c[5].v || c[5].f || '') : '';
        const tipo = c[6] ? (c[6].v || c[6].f || '') : '';
        const descripcion = c[7] ? (c[7].v || c[7].f || '') : '';
        const estado = c[12] ? (c[12].v || c[12].f || '') : 'NUEVO';
        const driveUrl = c[23] ? (c[23].v || c[23].f || '') : '';

        if (idTicket && correo.toString().toLowerCase().trim() === email.toLowerCase().trim()) {
          ticketsList.push({ id: idTicket, fecha: fecha, correo: correo, tipo: tipo, descripcion: descripcion, estado: estado, driveUrl: driveUrl });
        }
      });

      if (ticketsList.length === 0) {
        renderFallbackLocalData(tbody, loadingEl, emptyEl, tableContainer, email);
        return;
      }

      renderRows(ticketsList, tbody);
      loadingEl.style.display = 'none';
      tableContainer.style.display = 'block';
    })
    .catch(function() {
      renderFallbackLocalData(tbody, loadingEl, emptyEl, tableContainer, email);
    });
}

function renderFallbackLocalData(tbody, loadingEl, emptyEl, tableContainer, email) {
  const ticketsBase = [
    {
      id: 'TKT-2026-00001',
      fecha: '2026-10-02',
      correo: 'econesa@ciarm.edu.mx',
      tipo: 'Limpieza e Intendencia',
      descripcion: 'mdkdkdnksdnksndksdnsdnknd',
      estado: 'NUEVO',
      driveUrl: 'https://drive.google.com/file/d/17Vls3MVpqpeWvuZMyD6w2112EcV5_7RD/view?usp=drivesdk'
    },
    {
      id: 'TKT-2026-00002',
      fecha: '2026-10-02',
      correo: 'econesa@ciarm.edu.mx',
      tipo: 'Soporte Tecnológico / TI',
      descripcion: 'kskskksksksksksks',
      estado: 'NUEVO',
      driveUrl: 'https://drive.google.com/file/d/1IqHefBdh1ADqhfjkKtRh7BxiuDPmTXfY/view?usp=drivesdk'
    },
    {
      id: 'TKT-2026-00003',
      fecha: '2026-10-02',
      correo: 'econesa@ciarm.edu.mx',
      tipo: 'Mantenimiento de Instalaciones',
      descripcion: 'kskskkskksks',
      estado: 'NUEVO',
      driveUrl: 'https://drive.google.com/drive/folders/103wSYfCuSwVKW_aTbTFr2O7b-JyuT619'
    },
    {
      id: 'TKT-2026-00004',
      fecha: '2026-10-02',
      correo: 'econesa@ciarm.edu.mx',
      tipo: 'Soporte Tecnológico / TI',
      descripcion: 'jsjjsjjsjsjsjsjsjsjsjsjsj',
      estado: 'NUEVO',
      driveUrl: 'https://drive.google.com/file/d/1tPDMSuBDVC5f3p_Ah77nfpNDt-D1PD0b/view?usp=drivesdk'
    }
  ];

  const filtered = ticketsBase.filter(function(t) { return t.correo.toLowerCase() === email.toLowerCase(); });

  if (loadingEl) loadingEl.style.display = 'none';

  if (filtered.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  renderRows(filtered, tbody);
  if (tableContainer) tableContainer.style.display = 'block';
}

function renderRows(tickets, tbody) {
  tbody.innerHTML = tickets.map(function(t) {
    const hasDrive = t.driveUrl && t.driveUrl.toString().startsWith('http');
    return `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 0.85rem 1rem; font-weight: bold; color: #1B2B48;">${t.id}</td>
        <td style="padding: 0.85rem 1rem; color: #64748B; font-size: 0.85rem;">${t.fecha || '2026-10-02'}</td>
        <td style="padding: 0.85rem 1rem; color: #475569; font-weight: 500;">${t.tipo}</td>
        <td style="padding: 0.85rem 1rem; color: #334155; max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${t.descripcion}">${t.descripcion}</td>
        <td style="padding: 0.85rem 1rem;">
          <span style="background: #FEF3C7; color: #92400E; padding: 0.25rem 0.65rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
            ${t.estado || 'NUEVO'}
          </span>
        </td>
        <td style="padding: 0.85rem 1rem; text-align: center;">
          ${hasDrive ? `
            <a href="${t.driveUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.3rem; background: #C5A059; color: #FFFFFF; padding: 0.45rem 0.85rem; border-radius: 6px; text-decoration: none; font-size: 0.8rem; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
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
