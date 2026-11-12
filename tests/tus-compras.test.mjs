import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TUS_COMPRAS_STATES,
  TUS_COMPRAS_OPEX_LIMIT,
  TUS_COMPRAS_THREE_QUOTES_THRESHOLD,
  TUS_COMPRAS_QUOTE_THRESHOLD,
  TUS_COMPRAS_MAX_ATTACHMENT_BYTES,
  canSeeTusCompras,
  getEffectiveOrderAmount,
  getRequiredQuotesCount,
  requiresQuotationProcess,
  validateTusCompraAttachmentFile,
  evaluateOrderApprovalRequirement,
  resolveEffectiveOrderState,
  normalizeOrdersStates,
  computeAllowedActions,
  computeTusComprasExecutiveMetrics
} from '../src/services/tusComprasService.js';
import { allowedRoute } from '../src/components/dashboardAccess.js';

test('Simplificación en 2 pasos (< $8,000 MXN pasa directo a OC sin cotización previa; >= $8,000 MXN pasa por 2b y exige 3 cotizaciones) y sin límite por área', () => {
  assert.equal(TUS_COMPRAS_OPEX_LIMIT, 8000);
  assert.equal(TUS_COMPRAS_THREE_QUOTES_THRESHOLD, 8000);
  assert.equal(TUS_COMPRAS_QUOTE_THRESHOLD, 8000);
  assert.equal(TUS_COMPRAS_MAX_ATTACHMENT_BYTES, 10 * 1024 * 1024);

  // Validación estricta de tamaño de archivo adjunto (máx. 10 MB por archivo)
  assert.equal(validateTusCompraAttachmentFile({ name: 'detalle.pdf', size: 10 * 1024 * 1024 }), true);
  assert.throws(
    () => validateTusCompraAttachmentFile({ name: 'pesado.pdf', size: 10 * 1024 * 1024 + 1 }, 'Detalle del pedido'),
    /supera el límite máximo permitido de 10 MB/
  );

  // Paso 1: Compras < $8,000 MXN (ej. $4,500 o $7,999.99) pasan directo a generación de OC sin requerir cotización previa (0 cotizaciones) ni aprobación OPEX, sin importar el acumulado del área
  const opexUnder8000 = evaluateOrderApprovalRequirement('OPEX', 4500, 7000);
  assert.equal(opexUnder8000.projectedAreaMonthlyOpex, 11500);
  assert.equal(opexUnder8000.exceedsOpexLimit, false);
  assert.equal(opexUnder8000.requiresApproval, false);
  assert.equal(opexUnder8000.requiresQuotation, false);
  assert.equal(opexUnder8000.requiresThreeQuotes, false);
  assert.equal(opexUnder8000.requiredQuotesCount, 0);
  assert.equal(opexUnder8000.initialState, TUS_COMPRAS_STATES.ENVIADA);

  // Paso 2: Compras >= $8,000 MXN (ej. $8,000.00 o más) pasan por aprobación (2b) y exigen 3 cotizaciones de Daniel Lara
  const opexAt8000 = evaluateOrderApprovalRequirement('OPEX', 8000, 0);
  assert.equal(opexAt8000.exceedsOpexLimit, true);
  assert.equal(opexAt8000.requiresApproval, true);
  assert.equal(opexAt8000.requiresQuotation, true);
  assert.equal(opexAt8000.requiresThreeQuotes, true);
  assert.equal(opexAt8000.requiredQuotesCount, 3);
  assert.equal(opexAt8000.initialState, TUS_COMPRAS_STATES.EN_APROBACION);

  const opexOver8000 = evaluateOrderApprovalRequirement('OPEX', 8001, 0);
  assert.equal(opexOver8000.exceedsOpexLimit, true);
  assert.equal(opexOver8000.requiresApproval, true);
  assert.equal(opexOver8000.requiresThreeQuotes, true);
  assert.equal(opexOver8000.requiredQuotesCount, 3);
  assert.equal(opexOver8000.initialState, TUS_COMPRAS_STATES.EN_APROBACION);

  // Capex pasa automáticamente a 2b) En aprobación aunque sea menor a $8,000 MXN (y al ser < $8,000 no requiere cotización previa)
  const capexSmall = evaluateOrderApprovalRequirement('CAPEX', 1500, 0);
  assert.equal(capexSmall.tipo, 'CAPEX');
  assert.equal(capexSmall.requiresApproval, true);
  assert.equal(capexSmall.requiredQuotesCount, 0);
  assert.equal(capexSmall.initialState, TUS_COMPRAS_STATES.EN_APROBACION);

  // Conteo de cotizaciones requeridas según monto de la compra (2 pasos: < 8000 -> 0, >= 8000 -> 3)
  assert.equal(getRequiredQuotesCount({ monto: 3000 }), 0);
  assert.equal(getRequiredQuotesCount({ monto: 7999.99 }), 0);
  assert.equal(getRequiredQuotesCount({ monto: 8000 }), 3);
  assert.equal(getRequiredQuotesCount({ monto: 8000.01 }), 3);
  assert.equal(requiresQuotationProcess({ monto: 7999.99 }), false);
  assert.equal(requiresQuotationProcess({ monto: 8000 }), true);

  // Monto de Orden de Compra ajustado reemplaza al monto estimado del usuario como único monto válido para presupuesto
  assert.equal(getEffectiveOrderAmount({ montoEstimado: 5000, montoOrdenCompra: 0 }), 5000);
  assert.equal(getEffectiveOrderAmount({ montoEstimado: 5000, montoOrdenCompra: 4200 }), 4200);

  // Verificar caso exacto de tickets 1, 2 y 3 (normalización de estado y recálculo de presupuesto con montoOrdenCompra)
  const sampleOrders = [
    { id: 'CMP-2026-00003', fecha: '2026-11-05', area: 'Docente', tipo: 'CAPEX', monto: 350000, estado: '1) Solicitud enviada' },
    { id: 'CMP-2026-00002', fecha: '2026-11-05', area: 'Docente', tipo: 'OPEX', monto: 20000, estado: '1) Solicitud enviada' },
    { id: 'CMP-2026-00001', fecha: '2026-11-05', area: 'Docente', tipo: 'OPEX', monto: 3000, montoEstimado: 3000, montoOrdenCompra: 2650, estado: '2c) Orden de Compra generada' }
  ];
  normalizeOrdersStates(sampleOrders);
  const t1 = sampleOrders.find(x => x.id === 'CMP-2026-00001');
  const t2 = sampleOrders.find(x => x.id === 'CMP-2026-00002');
  const t3 = sampleOrders.find(x => x.id === 'CMP-2026-00003');
  assert.equal(t1.estado, TUS_COMPRAS_STATES.OC_GENERADA);
  assert.equal(t1.monto, 2650); // Monto ajustado por Daniel al generar la OC
  assert.equal(t2.estado, TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(t3.estado, TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(resolveEffectiveOrderState(t2), TUS_COMPRAS_STATES.EN_APROBACION);
  assert.equal(resolveEffectiveOrderState(t3), TUS_COMPRAS_STATES.EN_APROBACION);
});

test('Máquina de estados en 2 pasos: < $8,000 MXN pasa directo a ISSUE_PURCHASE_ORDER; >= $8,000 MXN pasa por cotización (3 archivos) y luego OC', () => {
  const adminAutorizador = { correo: 'd.lara@ciarm.edu.mx', isAdministracion: true, canAdmin: true, canApprove: true };
  const directorDocente = { correo: 'director.docente@ciarm.edu.mx', isDocenteDirector: true, isAdministracion: false, canAdmin: false, canApprove: false };

  // Caso A: Pedido < $8,000 MXN (ej. $3,000 o $6,500) en 1) Solicitud enviada -> Daniel genera directamente la Orden de Compra (ISSUE_PURCHASE_ORDER)
  const orderUnder8000 = {
    id: 'CMP-2026-00001',
    correo: 'director.docente@ciarm.edu.mx',
    tipo: 'OPEX',
    monto: 6500,
    acumuladoMesArea: 6500,
    requiereAprobacion: false,
    estado: TUS_COMPRAS_STATES.ENVIADA
  };
  assert.deepEqual(computeAllowedActions(orderUnder8000, adminAutorizador, 'all'), ['ISSUE_PURCHASE_ORDER']);
  assert.deepEqual(computeAllowedActions(orderUnder8000, directorDocente, 'mine'), []);

  // Caso B: Pedido >= $8,000 MXN (ej. $8,000 o $12,000) ya aprobado en 2a) -> Daniel debe iniciar cotización (START_QUOTING)
  const orderAtOrOver8000 = {
    ...orderUnder8000,
    id: 'CMP-2026-00002',
    monto: 8000,
    requiereAprobacion: true,
    estado: TUS_COMPRAS_STATES.EN_PROCESO
  };
  assert.deepEqual(computeAllowedActions(orderAtOrOver8000, adminAutorizador, 'all'), ['START_QUOTING']);

  // En cotización (2a-1) -> Daniel debe informar recepción de las 3 cotizaciones y adjuntarlas (RECEIVE_QUOTES)
  const orderQuoting = { ...orderAtOrOver8000, estado: TUS_COMPRAS_STATES.EN_COTIZACION };
  assert.deepEqual(computeAllowedActions(orderQuoting, adminAutorizador, 'all'), ['RECEIVE_QUOTES']);

  // Cotizaciones recibidas (2a-2) -> Daniel genera la Orden de Compra y ajusta el monto (ISSUE_PURCHASE_ORDER)
  const orderQuotesReceived = { ...orderAtOrOver8000, estado: TUS_COMPRAS_STATES.COTIZACIONES_RECIBIDAS };
  assert.deepEqual(computeAllowedActions(orderQuotesReceived, adminAutorizador, 'all'), ['ISSUE_PURCHASE_ORDER']);

  // Orden de Compra generada (2c) -> Daniel registra llegada de artículos a Adm. (RECEIVE_ITEMS_ADM)
  const orderOcGenerated = { ...orderAtOrOver8000, estado: TUS_COMPRAS_STATES.OC_GENERADA };
  assert.deepEqual(computeAllowedActions(orderOcGenerated, adminAutorizador, 'all'), ['RECEIVE_ITEMS_ADM']);

  // Estado 2b) En aprobación: Autorizador puede Aprobar (pasa a 2a) o Rechazar (2d)
  const order2b = {
    ...orderUnder8000,
    tipo: 'CAPEX',
    monto: 2500,
    requiereAprobacion: true,
    estado: TUS_COMPRAS_STATES.EN_APROBACION
  };
  assert.deepEqual(computeAllowedActions(order2b, adminAutorizador, 'all'), ['APPROVE_CAPEX', 'REJECT_CAPEX']);
  assert.deepEqual(computeAllowedActions(order2b, directorDocente, 'mine'), []);

  // Estado 2a) Solicitud recibida / En proceso tras aprobar en 2b):
  // Si < $8,000 -> ISSUE_PURCHASE_ORDER directo; si >= $8,000 -> START_QUOTING
  const order2aSmall = { ...order2b, estado: TUS_COMPRAS_STATES.EN_PROCESO };
  assert.deepEqual(computeAllowedActions(order2aSmall, adminAutorizador, 'all'), ['ISSUE_PURCHASE_ORDER']);
  const order2aLarge = { ...order2b, monto: 8000, estado: TUS_COMPRAS_STATES.EN_PROCESO };
  assert.deepEqual(computeAllowedActions(order2aLarge, adminAutorizador, 'all'), ['START_QUOTING']);

  // Estado 2d) Rechazada: Estado terminal, NO puede avanzar a 3)
  const order2d = { ...order2b, estado: TUS_COMPRAS_STATES.RECHAZADA };
  assert.deepEqual(computeAllowedActions(order2d, adminAutorizador, 'all'), []);

  // Estado 3) Artículos Recibidos en Adm.: Administración avanza a 4) Compra Entregada al Solicitante
  const order3 = { ...orderUnder8000, estado: TUS_COMPRAS_STATES.RECIBIDOS_ADM };
  assert.deepEqual(computeAllowedActions(order3, adminAutorizador, 'all'), ['DELIVER_TO_REQUESTER']);
  assert.deepEqual(computeAllowedActions(order3, directorDocente, 'mine'), []);

  // Estado 4) Compra Entregada al Solicitante: El Solicitante en Mis Compras ('mine') SÍ ve los botones de cierre Recepción Conforme / Disconforme
  const order4 = { ...orderUnder8000, estado: TUS_COMPRAS_STATES.ENTREGADA };
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
    tusCompras: { visible: true, canCreate: false, canAdmin: true, canApprove: false, canGerencial: true }
  };
  assert.equal(allowedRoute('#admin-tus-compras', danielAdmin), true);
  assert.equal(allowedRoute('#vision-gerencial-compras', danielAdmin), true);

  const ezequielAdmin = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: { visible: true, canCreate: true, canAdmin: true, canApprove: true, canGerencial: true }
  };
  assert.equal(allowedRoute('#admin-tus-compras', ezequielAdmin), true);
  assert.equal(allowedRoute('#vision-gerencial-compras', ezequielAdmin), true);

  const angelicaObserver = {
    verified: true,
    enforced: true,
    codes: ['INT_TARJETA'],
    tusCompras: {
      visible: true,
      canCreate: false,
      canAdmin: false,
      canApprove: false,
      canViewAll: true,
      canGerencial: true,
      isObserver: true
    }
  };
  assert.equal(canSeeTusCompras(angelicaObserver), true);
  assert.equal(allowedRoute('#tus-compras', angelicaObserver), true);
  assert.equal(allowedRoute('#admin-tus-compras', angelicaObserver), true);
  assert.equal(allowedRoute('#vision-gerencial-compras', angelicaObserver), true);
  assert.equal(allowedRoute('#tus-compras-nuevo', angelicaObserver), false);
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
  assert.ok(metrics.danielPerformance);
  assert.equal(metrics.quality.satisfactionRatePct, 100);
});

test('Indicadores gerenciales ejecutivos: cumplimiento a tiempo de Daniel Lara (cotizaciones y entrega OC) y nuevos estados', () => {
  const orders = [
    {
      id: 'CMP-2026-00010',
      fecha: '2026-11-01',
      hora: '09:00:00',
      area: 'Administración',
      solicitante: 'Ezequiel Conesa',
      tipo: 'OPEX',
      monto: 12000,
      requiereAprobacion: true,
      estado: TUS_COMPRAS_STATES.CONFORME,
      fechaAprobacion: '2026-11-01 12:00:00',
      fechaInicioCotizacion: '2026-11-01 14:00:00',
      fechaCierreCotizacion: '2026-11-03',
      fechaRecepcionCotizacion: '2026-11-02 18:00:00', // A tiempo (<= 2026-11-03)
      fechaOrdenCompra: '2026-11-03 10:00:00',
      fechaEntregaEstimada: '2026-11-06',
      fechaRecepcionAdm: '2026-11-04 16:00:00',
      fechaEntrega: '2026-11-05 14:00:00', // A tiempo (<= 2026-11-06)
      ultimaActualizacion: '2026-11-05 17:00:00'
    },
    {
      id: 'CMP-2026-00011',
      fecha: '2026-11-02',
      hora: '10:00:00',
      area: 'Docente',
      solicitante: 'Dir Docente',
      tipo: 'OPEX',
      monto: 5000,
      requiereAprobacion: false,
      estado: TUS_COMPRAS_STATES.OC_GENERADA,
      fechaOrdenCompra: '2026-11-02 14:00:00',
      fechaEntregaEstimada: '2099-12-31'
    }
  ];

  const metrics = computeTusComprasExecutiveMetrics(orders, { tipo: 'ALL' });
  assert.equal(metrics.danielPerformance.quotesOnTimeCount, 1);
  assert.equal(metrics.danielPerformance.quotesLateCount, 0);
  assert.equal(metrics.danielPerformance.deliveredOnTimeCount, 1);
  assert.equal(metrics.danielPerformance.deliveredLateCount, 0);
  assert.equal(metrics.danielPerformance.onTimeRatePct, 100);
  assert.equal(metrics.danielPerformance.inCourtCount, 1);
  assert.equal(metrics.danielBacklog[0].scheduleStatus, 'ON_TIME');
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
