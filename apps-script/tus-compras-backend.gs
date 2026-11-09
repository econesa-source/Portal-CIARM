/**
 * Portal CIARM - Backend Google Apps Script para "Tus Compras"
 * Soporta ambos ambientes:
 * - Preproducción (portal2.ciarm.edu.mx): 1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso
 * - Producción (portal.ciarm.edu.mx):     1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ
 *
 * Incluye inicializador automático de pestañas (PEDIDOS, BITACORA PEDIDOS, CONFIG COMPRAS),
 * máquina de estados 1 a 5 (con subestados 2a, 2b, 2c, 2d), tope Opex de $10,000 MXN mensuales
 * por área solicitante y notificaciones por correo a Daniel Lara, Solicitante y Ezequiel Conesa.
 */

var TUS_COMPRAS_CONFIG = {
  STAGING_SHEET_ID: '1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso',
  PROD_SHEET_ID: '1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ',
  OPEX_MONTHLY_LIMIT: 8000,
  QUOTE_THRESHOLD: 3000,
  ADMIN_EMAIL: 'd.lara@ciarm.edu.mx',
  APPROVER_EMAIL: 'e.conesa@ciarm.edu.mx',
  TIMEZONE: 'America/Cancun'
};

var TUS_COMPRAS_PEDIDOS_HEADERS = [
  'ID PEDIDO',
  'FECHA SOLICITUD',
  'HORA SOLICITUD',
  'SOLICITANTE',
  'CORREO SOLICITANTE',
  'ÁREA SOLICITANTE',
  'TIPO COMPRA',
  'MONTO ESTIMADO',
  'ACUMULADO MES ÁREA',
  'REQUIERE APROBACIÓN',
  'ARTÍCULOS / DESCRIPCIÓN',
  'JUSTIFICACIÓN / PROVEEDOR',
  'ESTADO',
  'RESPONSABLE ADM',
  'APROBADOR',
  'FECHA APROBACIÓN',
  'COMENTARIO APROBACIÓN',
  'FECHA RECEPCIÓN ADM',
  'FECHA ENTREGA',
  'EVALUACIÓN SOLICITANTE',
  'COMENTARIO RECEPCIÓN',
  'ARCHIVOS ADJUNTOS',
  'ÚLTIMA ACTUALIZACIÓN',
  'VERSIÓN',
  'MONTO ORDEN COMPRA',
  'FECHA CIERRE COTIZACIÓN EST.',
  'FECHA RECEPCIÓN COTIZACIÓN',
  'FECHA ORDEN COMPRA',
  'FECHA ENTREGA ESTIMADA',
  'ADJUNTO DETALLE PEDIDO',
  'ADJUNTO COTIZACIÓN PRELIMINAR',
  'ADJUNTO COTIZACIONES ADM'
];

var TUS_COMPRAS_BITACORA_HEADERS = [
  'ID EVENTO',
  'ID PEDIDO',
  'FECHA HORA',
  'ACTOR CORREO',
  'ACTOR NOMBRE',
  'ROL',
  'EVENTO',
  'ESTADO ANTERIOR',
  'ESTADO NUEVO',
  'MONTO',
  'ACUMULADO ÁREA',
  'COMENTARIO',
  'NOTIFICACIÓN'
];

var TUS_COMPRAS_CONFIG_HEADERS = [
  'CLAVE',
  'VALOR',
  'DESCRIPCIÓN',
  'ACTUALIZADO POR',
  'FECHA ACTUALIZACIÓN'
];

function tusComprasResolveBook(request) {
  var requestedId = request && typeof request.spreadsheetId === 'string' ? request.spreadsheetId.trim() : '';
  if (requestedId) {
    return SpreadsheetApp.openById(requestedId);
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) {
      return active;
    }
  } catch (err) {}
  var propId = PropertiesService.getScriptProperties().getProperty('TUS_COMPRAS_SPREADSHEET_ID') || '';
  if (propId.trim()) {
    return SpreadsheetApp.openById(propId.trim());
  }
  return SpreadsheetApp.openById(TUS_COMPRAS_CONFIG.PROD_SHEET_ID);
}

/**
 * Ejecuta esta función desde el editor de Apps Script (▷ Ejecutar) si deseas inicializar
 * manualmente las pestañas y dar formato al encabezado del libro activo.
 */
function inicializarHojasTusCompras(book) {
  var ss = book || tusComprasResolveBook(null);
  var ensureTab = function(name, headers) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() < 1) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1e3a8a')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    return sheet;
  };

  ensureTab('PEDIDOS', TUS_COMPRAS_PEDIDOS_HEADERS);
  ensureTab('BITACORA PEDIDOS', TUS_COMPRAS_BITACORA_HEADERS);
  var cfg = ensureTab('CONFIG COMPRAS', TUS_COMPRAS_CONFIG_HEADERS);
  if (cfg.getLastRow() < 2) {
    var now = Utilities.formatDate(new Date(), TUS_COMPRAS_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    cfg.getRange(2, 1, 3, 5).setValues([
      ['TOPE_OPEX_MENSUAL_AREA', '10000', 'Tope mensual acumulado Opex por área solicitante (MXN)', 'sistema', now],
      ['ADMIN_COMPRAS_EMAIL', TUS_COMPRAS_CONFIG.ADMIN_EMAIL, 'Encargado de Administración (Compras)', 'sistema', now],
      ['APROBADOR_CAPEX_EMAIL', TUS_COMPRAS_CONFIG.APPROVER_EMAIL, 'Aprobador de Capex y excesos > $10,000 MXN', 'sistema', now]
    ]);
  }
  return { ok: true, spreadsheetId: ss.getId(), name: ss.getName() };
}

/**
 * Paso 1: Implementar como Aplicación Web (Ejecutar como: Yo | Acceso: Cualquier persona).
 * Paso 2: Seleccionar esta función "registrarWebAppYProbarCorreo" arriba y pulsar "▷ Ejecutar".
 * Esto autoriza MailApp y guarda automáticamente la URL del WebApp en la pestaña "CONFIG COMPRAS"
 * para que el Portal CIARM envíe todas las notificaciones de Tus Compras por Google Workspace.
 */
function registrarWebAppYProbarCorreo() {
  var ss = tusComprasResolveBook(null);
  inicializarHojasTusCompras(ss);
  var cfg = ss.getSheetByName('CONFIG COMPRAS');
  var webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl() || '';
  } catch (e) {}

  var now = Utilities.formatDate(new Date(), TUS_COMPRAS_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var actor = '';
  try {
    actor = Session.getActiveUser().getEmail() || 'admin';
  } catch (e) {
    actor = 'admin';
  }

  if (webAppUrl) {
    var rows = cfg.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === 'WEBAPP_URL_CORREOS') {
        foundRow = i + 1;
        break;
      }
    }
    var newRow = ['WEBAPP_URL_CORREOS', webAppUrl, 'URL de la Aplicación Web de Apps Script para envío de correos MailApp', actor, now];
    if (foundRow > 0) {
      cfg.getRange(foundRow, 1, 1, 5).setValues([newRow]);
    } else {
      cfg.appendRow(newRow);
    }
  }

  var quota = typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota ? MailApp.getRemainingDailyQuota() : 0;
  Logger.log('Permiso MailApp autorizado. Cuota diaria restante: ' + quota);
  Logger.log('URL de WebApp detectada y guardada en CONFIG COMPRAS: ' + (webAppUrl || '(Falta implementar como Aplicación Web)'));
  return { ok: true, webAppUrl: webAppUrl, quota: quota };
}

function autorizarPermisosCorreoTusCompras() {
  return registrarWebAppYProbarCorreo();
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, code: 'FORBIDDEN', module: 'tus-compras' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    if (body && body.action === 'sendNotifications' && Array.isArray(body.messages)) {
      var deliveries = [];
      for (var i = 0; i < body.messages.length; i++) {
        var msg = body.messages[i] || {};
        try {
          MailApp.sendEmail({
            to: String(msg.to || ''),
            subject: String(msg.subject || ''),
            body: String(msg.text || msg.intro || ''),
            htmlBody: String(msg.html || ''),
            name: 'Portal CIARM — Tus Compras'
          });
          deliveries.push({ role: msg.role || '', to: msg.to || '', status: 'ENVIADO', via: 'gas-mailapp' });
        } catch (mailErr) {
          deliveries.push({ role: msg.role || '', to: msg.to || '', status: 'ERROR', error: String(mailErr), via: 'gas-mailapp' });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, deliveries: deliveries }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var ss = tusComprasResolveBook(body);
    inicializarHojasTusCompras(ss);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, spreadsheetId: ss.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, code: 'ERROR', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
