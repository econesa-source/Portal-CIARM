import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';

function policy(s) {
 const p = s.context.serviceDefaultPolicy();
 p.responsibles = [
  {name: 'Daniel Lara', email: 'd.lara@ciarm.edu.mx'},
  {name: 'PRUEBA — Rodrigo Valencia', email: 'r.valencia@ciarm.edu.mx', test: true},
  {name: 'PRUEBA — Ezequiel Conesa', email: 'e.conesa@ciarm.edu.mx', test: true}
 ];
 p.admins = [
  {name: 'Daniel Lara', email: 'd.lara@ciarm.edu.mx'},
  {name: 'Ezequiel Conesa', email: 'e.conesa@ciarm.edu.mx'}
 ];
 return p;
}

function activate(s, customPolicy) {
 const r = s.call('saveServicePolicy', {
  operationId: crypto.randomUUID(),
  expectedVersion: 0,
  policy: customPolicy || policy(s)
 });
 assert.equal(r.ok, true, JSON.stringify(r));
 return r;
}

function transition(s, ticketId, action, actor = 'd.lara@ciarm.edu.mx', extra = {}) {
 const d = s.call('serviceDetail', {id: ticketId});
 return s.call('serviceTransition', {
  operationId: crypto.randomUUID(),
  ticketId,
  expectedVersion: d.data.ticket.version,
  event: action,
  comment: 'Comentario de prueba',
  ...extra
 }, actor);
}

test('notificaciones cubren las 9 transiciones validadas, usan admins de CONFIG SERVICIO y registran en BITACORA TICKETS', () => {
 const s = portalFixture();
 activate(s);
 s.sheets.get('RESPONSABLES').rows.push(['TODAS', 'Rodrigo Valencia']);

 // 1. Alta de Solicitud (CREATE -> NUEVO): Solicitante + Administradores en CONFIG SERVICIO
 const createOp = {
  operationId: crypto.randomUUID(),
  tipo: 'Soporte Tecnológico / TI',
  descripcion: 'Falla en proyector de aula',
  prioridadSolicitada: '🔴 Urgente',
  fechaProgramada: '',
  files: []
 };
 assert.equal(s.call('beginCreate', createOp, 'persona@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 0, 'beginCreate (PENDIENTE) no envía correos');

 const created = s.call('finalizeCreate', {operationId: createOp.operationId}, 'persona@ciarm.edu.mx');
 assert.equal(created.ok, true);
 const ticketId = created.data.ticket.id;

 assert.equal(s.sentEmails.length, 3);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'd.lara@ciarm.edu.mx',
  'e.conesa@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud recibida ${ticketId}`));
 assert.match(s.sentEmails[1].subject, new RegExp(`Nueva solicitud por asignar ${ticketId}`));

 // Reintento idempotente de finalizeCreate no duplica correos
 assert.equal(s.call('finalizeCreate', {operationId: createOp.operationId}, 'persona@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 3);

 // Verificar registro en BITACORA TICKETS
 const journalRows = s.sheets.get('BITACORA TICKETS').rows;
 const createAudit = JSON.parse(journalRows[1][8]).notification;
 assert.equal(createAudit.event, 'CREATE');
 assert.equal(createAudit.status, 'ENVIADO');
 assert.equal(createAudit.deliveries.length, 3);

 // 2. Asignación (ASSIGN -> ASIGNADO): Solicitante + Responsable asignado
 s.sentEmails.length = 0;
 const detailBeforeAssign = s.call('detail', {id: ticketId}).data;
 const assignOp = {
  operationId: crypto.randomUUID(),
  ticketId,
  expectedVersion: detailBeforeAssign.version,
  changes: {
   responsable: 'Rodrigo Valencia',
   prioridad: 'ALTA',
   fechaCompromiso: '2026-10-08',
   observacion: 'Revisar cable HDMI'
  }
 };
 assert.equal(s.call('assign', assignOp, 'd.lara@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 2);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'r.valencia@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[1].subject, new RegExp(`Nueva tarea asignada ${ticketId}`));
 assert.match(s.sentEmails[1].body, /Revisar cable HDMI/);

 // Reintento idempotente de assign no duplica correos
 assert.equal(s.call('assign', assignOp, 'd.lara@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 2);

 // 3. Inicio de Ejecución (START -> EN PROCESO): Solicitante
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'START', 'r.valencia@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 1);
 assert.equal(s.sentEmails[0].to, 'persona@ciarm.edu.mx');
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud en proceso ${ticketId}`));

 // 4. Solicitud de Espera (WAIT_REQUEST): Administradores en CONFIG SERVICIO
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'WAIT_REQUEST', 'r.valencia@ciarm.edu.mx', {
  dependency: 'Proveedor de lámparas',
  followAt: '2026-10-08 12:00:00',
  comment: 'Esperando refacción'
 }).ok, true);
 assert.equal(s.sentEmails.length, 2);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'd.lara@ciarm.edu.mx',
  'e.conesa@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud de pausa por autorizar ${ticketId}`));
 assert.match(s.sentEmails[0].body, /Proveedor de lámparas/);

 // 5. Espera Autorizada (WAIT_APPROVE -> EN ESPERA): Solicitante + Responsable
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'WAIT_APPROVE', 'd.lara@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 2);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'r.valencia@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud en espera ${ticketId}`));
 assert.match(s.sentEmails[1].subject, new RegExp(`Pausa autorizada en tarea ${ticketId}`));

 // 6. Reanudación (RESUME -> EN PROCESO): Solicitante + Responsable
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'RESUME', 'd.lara@ciarm.edu.mx').ok, true);
 assert.equal(s.sentEmails.length, 2);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'r.valencia@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Atención reanudada en solicitud ${ticketId}`));
 assert.match(s.sentEmails[1].subject, new RegExp(`Tarea reanudada ${ticketId}`));

 // 7. Resolución Propuesta (RESOLVE -> RESUELTO): Solicitante + Administradores
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'RESOLVE', 'r.valencia@ciarm.edu.mx', {
  comment: 'Se reemplazó lámpara y cable HDMI',
  evidence: ['https://drive.google.com/file/d/evidencia1/view']
 }).ok, true);
 assert.equal(s.sentEmails.length, 3);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'd.lara@ciarm.edu.mx',
  'e.conesa@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud resuelta ${ticketId} — Pendiente de tu validación`));
 assert.match(s.sentEmails[0].htmlBody, /#validar-solicitudes/);

 // 9. Disconformidad / Reapertura (REJECT -> ASIGNADO): Responsable + Administradores
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'REJECT', 'persona@ciarm.edu.mx', {
  comment: 'Sigue parpadeando la imagen'
 }).ok, true);
 assert.equal(s.sentEmails.length, 3);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'r.valencia@ciarm.edu.mx',
  'd.lara@ciarm.edu.mx',
  'e.conesa@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud devuelta por disconformidad ${ticketId}`));
 assert.match(s.sentEmails[0].body, /Sigue parpadeando la imagen/);

 // Volver a resolver y 8. Conformidad y Cierre (ACCEPT -> CERRADO): Solicitante + Responsable + Administradores
 assert.equal(transition(s, ticketId, 'RESOLVE', 'r.valencia@ciarm.edu.mx', {
  comment: 'Ajuste definitivo de conector'
 }).ok, true);
 s.sentEmails.length = 0;
 assert.equal(transition(s, ticketId, 'ACCEPT', 'persona@ciarm.edu.mx', {
  comment: 'Excelente servicio, funcionando al 100%'
 }).ok, true);
 assert.equal(s.sentEmails.length, 4);
 assert.deepEqual(s.sentEmails.map(m => m.to), [
  'persona@ciarm.edu.mx',
  'r.valencia@ciarm.edu.mx',
  'd.lara@ciarm.edu.mx',
  'e.conesa@ciarm.edu.mx'
 ]);
 assert.match(s.sentEmails[0].subject, new RegExp(`Solicitud cerrada con conformidad ${ticketId}`));

 // Verificar que todas las transiciones quedaron auditadas en BITACORA TICKETS y en serviceDetail.history
 const finalDetail = s.call('serviceDetail', {id: ticketId}).data;
 assert.ok(finalDetail.history.every(h => h.notification && h.notification.status === 'ENVIADO'));
});

test('fallo de MailApp se registra en BITACORA TICKETS sin abortar la confirmación del ticket', () => {
 const s = portalFixture();
 activate(s);
 s.failMailOnce('Quota limit reached');

 const res = s.call('assign', s.payload());
 assert.equal(res.ok, true, 'La asignación debe confirmarse aunque MailApp falle');
 assert.equal(res.data.ticket.estado, 'ASIGNADO');
 // El primer correo (solicitante) falló y el segundo (responsable) se envió
 assert.equal(s.sentEmails.length, 1);
 assert.equal(s.sentEmails[0].to, 'd.lara@ciarm.edu.mx');

 const journalPayload = JSON.parse(s.sheets.get('BITACORA TICKETS').rows[1][8]);
 assert.equal(journalPayload.notification.status, 'ERROR_PARCIAL');
 assert.equal(journalPayload.notification.deliveries[0].status, 'ERROR');
 assert.match(journalPayload.notification.deliveries[0].error, /Quota limit reached/);
 assert.equal(journalPayload.notification.deliveries[1].status, 'ENVIADO');
});

test('cuando el solicitante también es administrador recibe ambos correos (solicitante y admin) y se expone notification en la respuesta', async () => {
 const s = portalFixture();
 activate(s);

 const createOp = {
  operationId: crypto.randomUUID(),
  tipo: 'Soporte Tecnológico / TI',
  descripcion: 'Prueba desde cuenta de administrador',
  prioridadSolicitada: '🔴 Urgente',
  fechaProgramada: '',
  files: []
 };
 assert.equal(s.call('beginCreate', createOp, 'e.conesa@ciarm.edu.mx').ok, true);
 const created = s.call('finalizeCreate', {operationId: createOp.operationId}, 'e.conesa@ciarm.edu.mx');
 assert.equal(created.ok, true);
 assert.equal(created.data.notification.status, 'ENVIADO');
 assert.equal(s.sentEmails.length, 3);
 assert.deepEqual(
  s.sentEmails.map(m => ({to: m.to, isAdmin: /Nueva solicitud por asignar/.test(m.subject)})),
  [
   {to: 'e.conesa@ciarm.edu.mx', isAdmin: false},
   {to: 'd.lara@ciarm.edu.mx', isAdmin: true},
   {to: 'e.conesa@ciarm.edu.mx', isAdmin: true}
  ]
 );

 const fs = await import('node:fs');
 const phpLib = fs.readFileSync(new URL('../tickets-portal-lib.php', import.meta.url), 'utf8');
 const phpApi = fs.readFileSync(new URL('../tickets-api.php', import.meta.url), 'utf8');
 assert.match(phpLib, /function ciarm_ticket_ensure_notifications\(/);
 assert.match(phpApi, /ciarm_ticket_ensure_notifications\(\$action,\s*\$input,\s*\$result\)/);
});

