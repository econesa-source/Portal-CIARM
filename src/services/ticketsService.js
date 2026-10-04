const SPREADSHEET_ID = '103wSYfCuSwVKW_aTbTFr2O7b-JyuT619';
const SHEET_NAME = 'TICKETS';

export async function getMisSolicitudes(userEmail) {
  try {
    const query = encodeURIComponent("SELECT A, B, C, D, E, F, G, H, I, M, X");
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${SHEET_NAME}&tq=${query}&tqx=out:json&cacheBust=${Date.now()}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const textData = await response.text();
    const jsonMatch = textData.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!jsonMatch || !jsonMatch[1]) throw new Error("Respuesta GViz inválida");

    const parsedData = JSON.parse(jsonMatch[1]);
    const rows = parsedData.table.rows || [];

    const allTickets = rows.map(row => {
      const c = row.c;
      if (!c) return null;

      // Extrae estrictamente la Columna X (índice 10 en la consulta SELECT)
      const rawDriveUrl = c[10] && c[10].v ? String(c[10].v).trim() : '';

      return {
        folio: c[0] && c[0].v ? c[0].v : 'SIN-FOLIO',
        fecha: c[1] && c[1].v ? c[1].v : '',
        hora: c[2] && c[2].v ? c[2].v : '',
        area: c[3] && c[3].v ? c[3].v : '',
        solicitante: c[4] && c[4].v ? c[4].v : '',
        correo: c[5] && c[5].v ? String(c[5].v).trim().toLowerCase() : '',
        tipo: c[6] && c[6].v ? c[6].v : 'General',
        descripcion: c[7] && c[7].v ? c[7].v : '',
        urgencia: c[8] && c[8].v ? c[8].v : 'No',
        estado: c[9] && c[9].v ? c[9].v : 'NUEVO',
        driveUrl: rawDriveUrl.startsWith('http') ? rawDriveUrl : null
      };
    }).filter(Boolean);

    const targetEmail = String(userEmail).trim().toLowerCase();
    return allTickets.filter(ticket => ticket.correo === targetEmail);

  } catch (error) {
    console.error("[ticketsService] Error consultando solicitudes:", error);
    return [];
  }
}
