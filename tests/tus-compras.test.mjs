import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TUS_COMPRAS_STATES,
  TUS_COMPRAS_OPEX_LIMIT,
  canSeeTusCompras,
  evaluateOrderApprovalRequirement,
  resolveEffectiveOrderState,
  normalizeOrdersStates,
  computeAllowedActions,
  computeTusComprasExecutiveMetrics
} from '../src/services/tusComprasService.js';
import { allowedRoute } from '../src/components/dashboardAccess.js';

test('Tope mensual Opex de $10,000 MXN por área solicitante y clasificación Capex', () => {
  assert.equal(TUS_COMPRAS_OPEX_LIMIT, 10000);

  // Opex dentro del límite mensual acumulado del área (ej. 4,000 previos + 5,500 nuevos = 9,500 <= 10,000)
  const opexOk = evaluateOrderApprovalRequirement('OPEX', 5500, 4000);
  assert.equal(opexOk.projectedAreaMonthlyOpex, 9500);
  assert.equal(opexOk.exceedsOpexLimit, false);
  assert.equal(opexOk.requiresApproval, false);
  assert.equal(opexOk.initialState, TUS_COMPRAS_STATES.ENVIADA);

  // Opex exactamente en el límite de $10,000 MXN
  const opexExact = evaluateOrderApprovalRequirement('OPEX', 6000, 4000);
  assert.equal(opexExact.projectedAreaMonthlyOpex, 10000);
  assert.equal(opexExact.requiresApproval, false);
  assert.equal(opexExact.initialState, TUS_COMPRAS_STATES.ENVIADA);

  // Opex que supera los $10,000 MXN mensuales acumulados del área: pasa automáticamente a 2b) En aprobación
  const opexExceeds = evaluateOrderApprovalRequirement('OPEX', 4001, 6000);
  assert.equal(opexExceeds.projectedAreaMonthlyOpex, 10001);
  assert.equal(opexExceeds.exceedsOpexLimit, true);
  assert.equal(opexExceeds.requiresApproval, true);
  assert.equal(opexExceeds.initialState, TUS_COMPRAS_STATES.EN_APROBACION);

  // Capex pasa automáticamente a 2b) En aprobación aunque sea menor a $10,000 MXN
  const capexSmall = evaluateOrderApprovalRequirement('CAPEX', 1500, 0);
  assert.equal(capexSmall.tipo, 'CAPEX');
  assert.equal(capexSmall.requiresApproval, true);
  assert.equal(capexSmall.initialState, TUS_COMPRAS_STATES.EN_APROBACION);

  // Verificar caso exacto de tickets 1, 2 y 3 (normalización de estado si en la hoja estaban en '1) Solicitud enviada')
  const sampleOrders = [
    { id: 'CMP-2026-00003', fecha: '2026-11-05', area: 'Docente', tipo: 'CAPEX', monto: 350000, estado: '1) Solicitud enviada' },
    { id: 'CMP-2026-00002', fecha: '2026-11-05', area: 'Docente', tipo: 'OPEX', monto: 20000, estado: '1) Solicitud enviada' },
    { id: 'CMP-2026-00001', fecha: '2026-11-05', area: 'Docente', tipo: 'OPEX', monto: 3000, estado: '1) Solicitud enviada' }
  ];
  normalizeOrdersStates(sampleOrders);
  const t1 = sampleOrders.find(x => x.id === 'CMP-2026-00001');
  const t2 = sampleOrders.find(x => x.id === 'CMP-2026-00002');
  const t3 = sampleOrders.find(x => x.id === 'CMP-2026-00003');
  assert.equal(t1.estado, TUS_COMPRAS_STATES.ENVIADA);
  assert.equal(t2.estado, TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(t3.estado, TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(resolveEffectiveOrderState(t2), TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(resolveEffectiveOrderState(t3), TUS_COMPRAS_STATES.EN_APROBACION);
});

test('Máquina de estados: vista solicitante informativa y flujo de aprobación hacia 2a)', () => {
  const adminAutorizador = { correo: 'd.lara@ciarm.edu.mx', isAdministracion: true, canAdmin: true, canApprove: true };
  const directorDocente = { correo: 'director.docente@ciarm.edu.mx', isDocenteDirector: true, isAdministracion: false, canAdmin: false, canApprove: false };

  // Estado 1) Solicitud enviada (Opex <= 10,000): Administración recibe en 2a); el solicitante en Mis Compras ('mine') no ve botones de acción
  const order1Opex = {
    id: 'CMP-2026-00001',
    correo: 'director.docente@ciarm.edu.mx',
    tipo: 'OPEX',
    monto: 3000,
    acumuladoMesArea: 3000,
    requiereAprobacion: false,
    estado: TUS_COMPRAS_STATES.ENVIADA
  };
  assert.deepEqual(computeAllowedActions(order1Opex, adminAutorizador, 'all'), ['RECEIVE_OPEX']);
  assert.deepEqual(computeAllowedActions(order1Opex, directorDocente, 'mine'), []);
  assert.ok(!computeAllowedActions(order1Opex, adminAutorizador, 'all').includes('RECEIVE_ITEMS_ADM'));

  // Estado 2b) En aprobación (entra automáticamente al crearse si supera $10,000 o es Capex):
  // Administración / Autorizador puede Aprobar (pasa a 2a) o Rechazar (2d); solicitante en 'mine' no ve botones de acción
  const order2b = {
    ...order1Opex,
    tipo: 'CAPEX',
    requiereAprobacion: true,
    estado: TUS_COMPRAS_STATES.EN_APROBACION
  };
  assert.deepEqual(computeAllowedActions(order2b, adminAutorizador, 'all'), ['APPROVE_CAPEX', 'REJECT_CAPEX']);
  assert.deepEqual(computeAllowedActions(order2b, directorDocente, 'mine'), []);

  // Estado 2a) Solicitud recibida / En proceso: Administración avanza a 3) Artículos Recibidos en Adm.
  const order2a = { ...order1Opex, estado: TUS_COMPRAS_STATES.EN_PROCESO };
  assert.deepEqual(computeAllowedActions(order2a, adminAutorizador, 'all'), ['RECEIVE_ITEMS_ADM']);
  assert.deepEqual(computeAllowedActions(order2a, directorDocente, 'mine'), []);

  // Estado 2d) Rechazada: Estado terminal, NO puede avanzar a 3)
  const order2d = { ...order2b, estado: TUS_COMPRAS_STATES.RECHAZADA };
  assert.deepEqual(computeAllowedActions(order2d, adminAutorizador, 'all'), []);

  // Estado 3) Artículos Recibidos en Adm.: Administración avanza a 4) Compra Entregada al Solicitante
  const order3 = { ...order1Opex, estado: TUS_COMPRAS_STATES.RECIBIDOS_ADM };
  assert.deepEqual(computeAllowedActions(order3, adminAutorizador, 'all'), ['DELIVER_TO_REQUESTER']);
  assert.deepEqual(computeAllowedActions(order3, directorDocente, 'mine'), []);

  // Estado 4) Compra Entregada al Solicitante: El Solicitante en Mis Compras ('mine') SÍ ve los botones de cierre Recepción Conforme / Disconforme
  const order4 = { ...order1Opex, estado: TUS_COMPRAS_STATES.ENTREGADA };
  assert.deepEqual(computeAllowedActions(order4, adminAutorizador, 'all'), []);
  assert.deepEqual(computeAllowedActions(order4, directorDocente, 'mine'), ['CONFIRM_CONFORME', 'CONFIRM_DISCONFORME']);
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
    tusCompras: { visible: true, canCreate: false, canAdmin: true, canApprove: false, canGerencial: false }
  };
  assert.equal(allowedRoute('#admin-tus-compras', danielAdmin), true);
  assert.equal(allowedRoute('#vision-gerencial-compras', danielAdmin), false);

  const ezequielAdmin = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: { visible: true, canCreate: true, canAdmin: true, canApprove: true, canGerencial: true }
  };
  assert.equal(allowedRoute('#admin-tus-compras', ezequielAdmin), true);
  assert.equal(allowedRoute('#vision-gerencial-compras', ezequielAdmin), true);
});

test('Indicadores gerenciales: tiempos de entrega, cierre y gestión de Daniel Lara separados por OPEX y CAPEX', () => {
  const orders = [
    {
      id: 'CMP-2026-00001',
      fecha: '2026-11-01',
      hora: '08:00:00',
      area: 'Docente',
      solicitante: 'Dir Docente',
      tipo: 'OPEX',
      monto: 3000,
      requiereAprobacion: false,
      estado: TUS_COMPRAS_STATES.CONFORME,
      fechaRecepcionAdm: '2026-11-02 08:00:00', // 24h en abastecimiento por Daniel
      fechaEntrega: '2026-11-02 20:00:00',      // 12h en entrega interna por Daniel (total gestión Daniel = 36h, entrega total = 36h)
      ultimaActualizacion: '2026-11-03 08:00:00' // 12h validación solicitante (total cierre = 48h)
    },
    {
      id: 'CMP-2026-00003',
      fecha: '2026-11-01',
      hora: '08:00:00',
      area: 'Docente',
      solicitante: 'Dir Docente',
      tipo: 'CAPEX',
      monto: 350000,
      requiereAprobacion: true,
      estado: TUS_COMPRAS_STATES.CONFORME,
      fechaAprobacion: '2026-11-02 08:00:00',   // 24h en aprobación ejecutiva (no imputable a Daniel)
      fechaRecepcionAdm: '2026-11-04 08:00:00', // 48h en abastecimiento por Daniel desde aprobación
      fechaEntrega: '2026-11-05 08:00:00',      // 24h en entrega interna por Daniel (total gestión Daniel = 72h, entrega total = 96h)
      ultimaActualizacion: '2026-11-06 08:00:00' // 24h validación solicitante (total cierre = 120h)
    }
  ];

  const metrics = computeTusComprasExecutiveMetrics(orders, { tipo: 'ALL' });
  assert.equal(metrics.totalOrders, 2);
  assert.equal(metrics.opex.count, 1);
  assert.equal(metrics.capex.count, 1);

  // Entrega y cierre OPEX vs CAPEX
  assert.equal(Math.round(metrics.opex.avgEndToEndDeliveryHours), 36);
  assert.equal(Math.round(metrics.opex.avgEndToEndClosureHours), 48);
  assert.equal(Math.round(metrics.capex.avgEndToEndDeliveryHours), 96);
  assert.equal(Math.round(metrics.capex.avgEndToEndClosureHours), 120);

  // Tiempo neto de gestión de Daniel Lara (descontando las 24h de aprobación en CAPEX)
  assert.equal(Math.round(metrics.opex.avgDanielTotalCompletedHours), 36);
  assert.equal(Math.round(metrics.capex.avgDanielTotalCompletedHours), 72);
  assert.equal(Math.round(metrics.capex.avgApprovalHours), 24);
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
