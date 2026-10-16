import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePortalPermissions, canSeeCard, canSeeAction } from '../src/services/portalPermissions.js';
import { allowedRoute } from '../src/components/dashboardAccess.js';

test('Sin respuesta verificada no existen permisos de DM05', () => {
  assert.equal(resolvePortalPermissions({}), null);
  assert.equal(canSeeCard(null, 'solicitudes'), false);
  assert.equal(canSeeAction(null, 'solicitudes', 'crear'), false);
});
test('La tarjeta madre y la función son ambas necesarias', () => {
  const p = new Set(['INT_CREAR']);
  assert.equal(canSeeAction(p, 'solicitudes', 'crear'), false);
  p.add('INT_TARJETA');
  assert.equal(canSeeAction(p, 'solicitudes', 'crear'), true);
  assert.equal(canSeeAction(p, 'solicitudes', 'gestionar'), false);
});
test('Rutas de solicitudes se protegen en modo DM05 activo', () => {
  const response = { verified: true, enforced: true, codes: ['INT_TARJETA','INT_MIS'] };
  assert.equal(allowedRoute('#mis-solicitudes', response), true);
  assert.equal(allowedRoute('#solicitudes', response), false);
  // No hay segunda política local: cada módulo exige contexto autenticado de servidor.
  assert.equal(allowedRoute('#admin-solicitudes', response), true);
  assert.equal(allowedRoute('#vision-gerencial', response), true);
  assert.equal(allowedRoute('#inicio', response), true);
});
test('Modo legado respeta el Portal vigente durante la transición', () => {
  assert.equal(allowedRoute('#solicitudes', { verified: false, enforced: false, codes: [] }), true);
  assert.equal(allowedRoute('#ib', { verified: false, enforced: false, codes: [] }), true);
});
test('INT_GESTION se verifica en el servidor en ambas rutas administrativas', async () => {
  const { readFileSync } = await import('node:fs');
  const backend = readFileSync('tickets-lib.php','utf8');
  const admin = readFileSync('src/components/adminSolicitudesWidget.js','utf8');
  const gerencial = readFileSync('src/components/ticketsManagementWidget.js','utf8');
  const api = readFileSync('tickets-api.php','utf8');
  assert.match(backend, /ciarm_rbac_has_function\(\$sessionUser, 'INT_GESTION'\)/);
  assert.match(api, /ciarm_ticket_context\(\$user\)/);
  assert.match(admin, /context=await getAdminContext\(signal\)/);
  assert.match(admin, /if\(!context\.canAdmin\)/);
  assert.match(gerencial, /context=await getAdminContext\(signal\)/);
  assert.match(gerencial, /if\(!context\.canAdmin\)/);
});

test('Ruta de IB se protege en modo DM05 activo', () => {
  const responseWithoutIb = { verified: true, enforced: true, codes: ['INT_TARJETA'] };
  assert.equal(allowedRoute('#ib', responseWithoutIb), false);
  const responseWithCardOnly = { verified: true, enforced: true, codes: ['IB_TARJETA'] };
  assert.equal(allowedRoute('#ib', responseWithCardOnly), false);
  const responseWithActionOnly = { verified: true, enforced: true, codes: ['IB_ACCEDER'] };
  assert.equal(allowedRoute('#ib', responseWithActionOnly), false);
  const responseWithIb = { verified: true, enforced: true, codes: ['IB_TARJETA', 'IB_ACCEDER'] };
  assert.equal(allowedRoute('#ib', responseWithIb), true);
});

test('Tarjeta de tareas y función gestionar en DM05', () => {
  const p = new Set(['TAREAS_GESTION']);
  assert.equal(canSeeCard(p, 'tareas'), false);
  assert.equal(canSeeAction(p, 'tareas', 'gestionar'), false);
  p.add('TAREAS_TARJETA');
  assert.equal(canSeeCard(p, 'tareas'), true);
  assert.equal(canSeeAction(p, 'tareas', 'gestionar'), true);
});

test('Rutas de tareas (#mis-tareas, #historial-tareas) se protegen en modo DM05 activo', () => {
  const responseTareas = { verified: true, enforced: true, codes: ['TAREAS_TARJETA', 'TAREAS_GESTION'] };
  assert.equal(allowedRoute('#mis-tareas', responseTareas), true);
  assert.equal(allowedRoute('#historial-tareas', responseTareas), true);
  assert.equal(allowedRoute('#solicitudes', responseTareas), false);

  const responseAdmin = { verified: true, enforced: true, codes: ['INT_TARJETA', 'INT_GESTION'] };
  assert.equal(allowedRoute('#mis-tareas', responseAdmin), true);
  assert.equal(allowedRoute('#historial-tareas', responseAdmin), true);

  const responseSinPermiso = { verified: true, enforced: true, codes: ['INT_TARJETA', 'INT_MIS'] };
  assert.equal(allowedRoute('#mis-tareas', responseSinPermiso), false);
  assert.equal(allowedRoute('#historial-tareas', responseSinPermiso), false);
});

