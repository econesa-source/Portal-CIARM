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
