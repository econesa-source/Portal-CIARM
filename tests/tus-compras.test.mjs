import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TUS_COMPRAS_STATES,
  TUS_COMPRAS_OPEX_LIMIT,
  canSeeTusCompras,
  evaluateOrderApprovalRequirement,
  computeAllowedActions
} from '../src/services/tusComprasService.js';
import { allowedRoute } from '../src/components/dashboardAccess.js';

test('Tope mensual Opex de $10,000 MXN por área solicitante y clasificación Capex', () => {
  assert.equal(TUS_COMPRAS_OPEX_LIMIT, 10000);

  // Opex dentro del límite mensual acumulado del área (ej. 4,000 previos + 5,500 nuevos = 9,500 <= 10,000)
  const opexOk = evaluateOrderApprovalRequirement('OPEX', 5500, 4000);
  assert.equal(opexOk.projectedAreaMonthlyOpex, 9500);
  assert.equal(opexOk.exceedsOpexLimit, false);
  assert.equal(opexOk.requiresApproval, false);

  // Opex exactamente en el límite de $10,000 MXN
  const opexExact = evaluateOrderApprovalRequirement('OPEX', 6000, 4000);
  assert.equal(opexExact.projectedAreaMonthlyOpex, 10000);
  assert.equal(opexExact.requiresApproval, false);

  // Opex que supera los $10,000 MXN mensuales acumulados del área (ej. 6,000 previos + 4,001 nuevos = 10,001 > 10,000)
  const opexExceeds = evaluateOrderApprovalRequirement('OPEX', 4001, 6000);
  assert.equal(opexExceeds.projectedAreaMonthlyOpex, 10001);
  assert.equal(opexExceeds.exceedsOpexLimit, true);
  assert.equal(opexExceeds.requiresApproval, true);

  // Capex siempre requiere aprobación de Ezequiel Conesa aunque sea menor a $10,000 MXN
  const capexSmall = evaluateOrderApprovalRequirement('CAPEX', 1500, 0);
  assert.equal(capexSmall.tipo, 'CAPEX');
  assert.equal(capexSmall.requiresApproval, true);
});

test('Máquina de estados: solo 2a) y 2c) pueden avanzar al estado 3) Artículos Recibidos en Adm.', () => {
  const danielAdmin = { correo: 'd.lara@ciarm.edu.mx', canAdmin: true, canApprove: false };
  const ezequielApprover = { correo: 'e.conesa@ciarm.edu.mx', canAdmin: false, canApprove: true };
  const directorDocente = { correo: 'director.docente@ciarm.edu.mx', canAdmin: false, canApprove: false };

  // Estado 1) Solicitud enviada (Opex <= 10,000): Daniel puede recibir en 2a) o enviar a 2b), pero NO pasar a 3)
  const order1Opex = {
    id: 'CMP-2026-00001',
    correo: 'director.docente@ciarm.edu.mx',
    tipo: 'OPEX',
    monto: 3000,
    acumuladoMesArea: 3000,
    requiereAprobacion: false,
    estado: TUS_COMPRAS_STATES.ENVIADA
  };
  assert.deepEqual(computeAllowedActions(order1Opex, danielAdmin), ['RECEIVE_OPEX', 'SEND_APPROVAL']);
  assert.ok(!computeAllowedActions(order1Opex, danielAdmin).includes('RECEIVE_ITEMS_ADM'));

  // Estado 1) Solicitud enviada (Capex o > 10,000): NO permite pasar a 2a), solo a 2b) En aprobación
  const order1Capex = {
    ...order1Opex,
    tipo: 'CAPEX',
    requiereAprobacion: true
  };
  assert.deepEqual(computeAllowedActions(order1Capex, danielAdmin), ['SEND_APPROVAL']);

  // Estado 2a) Solicitud recibida / En proceso: Daniel PUEDE avanzar a 3) Artículos Recibidos en Adm.
  const order2a = { ...order1Opex, estado: TUS_COMPRAS_STATES.EN_PROCESO };
  assert.ok(computeAllowedActions(order2a, danielAdmin).includes('RECEIVE_ITEMS_ADM'));

  // Estado 2b) En aprobación: Daniel NO puede avanzar a 3); solo Ezequiel puede Aprobar (2c) o Rechazar (2d)
  const order2b = { ...order1Capex, estado: TUS_COMPRAS_STATES.EN_APROBACION };
  assert.deepEqual(computeAllowedActions(order2b, danielAdmin), []);
  assert.deepEqual(computeAllowedActions(order2b, ezequielApprover), ['APPROVE_CAPEX', 'REJECT_CAPEX']);

  // Estado 2c) Aprobada / En curso: Daniel PUEDE avanzar a 3) Artículos Recibidos en Adm.
  const order2c = { ...order1Capex, estado: TUS_COMPRAS_STATES.APROBADA };
  assert.deepEqual(computeAllowedActions(order2c, danielAdmin), ['RECEIVE_ITEMS_ADM']);

  // Estado 2d) Rechazada: Estado terminal, NO puede avanzar a 3)
  const order2d = { ...order1Capex, estado: TUS_COMPRAS_STATES.RECHAZADA };
  assert.deepEqual(computeAllowedActions(order2d, danielAdmin), []);
  assert.deepEqual(computeAllowedActions(order2d, ezequielApprover), []);

  // Estado 3) Artículos Recibidos en Adm.: Daniel avanza a 4) Compra Entregada al Solicitante
  const order3 = { ...order1Opex, estado: TUS_COMPRAS_STATES.RECIBIDOS_ADM };
  assert.deepEqual(computeAllowedActions(order3, danielAdmin), ['DELIVER_TO_REQUESTER']);

  // Estado 4) Compra Entregada al Solicitante: Solo el Solicitante evalúa 5) Recepción Conforme / Disconforme
  const order4 = { ...order1Opex, estado: TUS_COMPRAS_STATES.ENTREGADA };
  assert.deepEqual(computeAllowedActions(order4, danielAdmin), []);
  assert.deepEqual(computeAllowedActions(order4, directorDocente), ['CONFIRM_CONFORME', 'CONFIRM_DISCONFORME']);
});

test('Visibilidad y rutas de Tus compras gobernadas por perfil DM03 (AG=docente, AJ=director)', () => {
  const unauthorized = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: { visible: false, canCreate: false, canAdmin: false, canApprove: false }
  };
  assert.equal(canSeeTusCompras(unauthorized), false);
  assert.equal(allowedRoute('#tus-compras', unauthorized), false);
  assert.equal(allowedRoute('#tus-compras-nuevo', unauthorized), false);
  assert.equal(allowedRoute('#admin-tus-compras', unauthorized), false);

  const directorDocente = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: { visible: true, canCreate: true, canAdmin: false, canApprove: false }
  };
  assert.equal(canSeeTusCompras(directorDocente), true);
  assert.equal(allowedRoute('#tus-compras', directorDocente), true);
  assert.equal(allowedRoute('#tus-compras-nuevo', directorDocente), true);
  assert.equal(allowedRoute('#admin-tus-compras', directorDocente), false);

  const danielAdmin = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: { visible: true, canCreate: true, canAdmin: true, canApprove: false }
  };
  assert.equal(allowedRoute('#admin-tus-compras', danielAdmin), true);
});

test('Configuración de doble Base de Datos (Preprod portal2 y Prod portal) y reglas en PHP/GAS', () => {
  const phpLib = readFileSync('tus-compras-lib.php', 'utf8');
  const gasCode = readFileSync('apps-script/tus-compras-backend.gs', 'utf8');
  const dashboard = readFileSync('src/components/dashboardWidget.js', 'utf8');

  // Verificar ambos IDs de Google Sheets
  assert.match(phpLib, /1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso/);
  assert.match(phpLib, /1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ/);
  assert.match(gasCode, /1b2DOU0iY7yw-93NEHDIZKhfZNTBirZiPMMbXvOaXMso/);
  assert.match(gasCode, /1q6mwmL-9JiNGk3TJZoJ1sJZiaR3AOO4OLEGiJuKQraQ/);

  // Verificar columna AG (índice 32) = docente y columna AJ (índice 35) = director en DM03
  assert.match(phpLib, /\$row\[32\]/);
  assert.match(phpLib, /\$row\[35\]/);
  assert.match(phpLib, /docente/i);
  assert.match(phpLib, /director/i);

  // Verificar tarjeta Tus compras en dashboardWidget.js
  assert.match(dashboard, /data-card="tus-compras"/);
  assert.match(dashboard, /<h3 class="exact-card-title">Tus compras<\/h3>/);
});
