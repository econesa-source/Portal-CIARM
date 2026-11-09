<?php
declare(strict_types=1);

require_once __DIR__ . '/../tus-compras-lib.php';

function assert_true(bool $cond, string $msg): void {
    if (!$cond) {
        throw new RuntimeException('Assertion failed: ' . $msg);
    }
}

// 1. Verificar perfil DM03 (Columna AG = índice 32 = "docente" y Columna AJ = índice 35 = "director")
$headers = array_fill(0, 40, 'Col');
$headers[0] = 'Nombre';
$headers[1] = 'Apellido';
$headers[2] = 'Correo Ciarm';
$headers[3] = 'Área';
$headers[4] = 'Sección / Departamento';
$headers[5] = 'Puesto';
$headers[6] = 'Status';
$headers[32] = 'Area AG';
$headers[35] = 'Nivel AJ';

$rowDocenteDirector = array_fill(0, 40, '');
$rowDocenteDirector[0] = 'María';
$rowDocenteDirector[1] = 'Gómez';
$rowDocenteDirector[2] = 'm.gomez@ciarm.edu.mx';
$rowDocenteDirector[3] = 'Primaria';
$rowDocenteDirector[6] = 'Activo';
$rowDocenteDirector[32] = 'Docente';
$rowDocenteDirector[35] = 'Director';

$rowDocenteCoordinador = $rowDocenteDirector;
$rowDocenteCoordinador[2] = 'coord@ciarm.edu.mx';
$rowDocenteCoordinador[35] = 'Coordinador';

$rowAdminDirector = $rowDocenteDirector;
$rowAdminDirector[2] = 'admin.dir@ciarm.edu.mx';
$rowAdminDirector[32] = 'Administrativo';
$rowAdminDirector[35] = 'Director';

$rowDaniel = $rowDocenteDirector;
$rowDaniel[0] = 'Daniel';
$rowDaniel[1] = 'Lara';
$rowDaniel[2] = 'd.lara@ciarm.edu.mx';
$rowDaniel[3] = 'Administración';
$rowDaniel[32] = 'Administración';
$rowDaniel[35] = 'Administración';

$rowEzequiel = $rowDocenteDirector;
$rowEzequiel[0] = 'Ezequiel';
$rowEzequiel[1] = 'Conesa';
$rowEzequiel[2] = 'e.conesa@ciarm.edu.mx';
$rowEzequiel[3] = 'Dirección General';
$rowEzequiel[32] = 'Administración';
$rowEzequiel[35] = 'Administración';

$dm03Rows = [$headers, $rowDocenteDirector, $rowDocenteCoordinador, $rowAdminDirector, $rowDaniel, $rowEzequiel];

$accDocDir = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'm.gomez@ciarm.edu.mx');
assert_true($accDocDir['visible'] === true && $accDocDir['canCreate'] === true, 'Docente + Director must see card and create');
assert_true($accDocDir['isDocenteDirector'] === true && $accDocDir['isAdministracion'] === false, 'Docente + Director flags');
assert_true($accDocDir['canAdmin'] === false && $accDocDir['canApprove'] === false, 'Docente + Director is not admin/approver');

$accCoord = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'coord@ciarm.edu.mx');
assert_true($accCoord['visible'] === false && $accCoord['canCreate'] === false, 'Docente + Coordinador must not see card');

$accAdmDir = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'admin.dir@ciarm.edu.mx');
assert_true($accAdmDir['visible'] === false && $accAdmDir['canCreate'] === false, 'Administrativo + Director must not see card');

$accDaniel = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'd.lara@ciarm.edu.mx');
assert_true($accDaniel['visible'] === true && $accDaniel['isAdministracion'] === true && $accDaniel['canAdmin'] === true, 'Administracion + Administracion is Admin');
assert_true($accDaniel['canCreate'] === false, 'Daniel Lara cannot create purchase requests');
assert_true($accDaniel['canGerencial'] === false, 'Daniel Lara does not see Vista Gerencial');

$accEzequiel = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'e.conesa@ciarm.edu.mx');
assert_true($accEzequiel['visible'] === true && $accEzequiel['isAdministracion'] === true && $accEzequiel['canApprove'] === true, 'Administracion + Administracion is Approver');
assert_true($accEzequiel['canCreate'] === true, 'Administracion + Administracion (except Daniel Lara) CAN create purchase requests');
assert_true($accEzequiel['canGerencial'] === true, 'Administracion + Administracion (except Daniel Lara) CAN see Vista Gerencial');
assert_true($accDocDir['canGerencial'] === false, 'Docente + Director does not see Vista Gerencial');

// 2. Verificar acumulado mensual Opex de $8,000 MXN por área solicitante (usando montoOrdenCompra como único monto válido) y paso automático a 2b) En aprobación
assert_true(CIARM_TUS_COMPRAS_OPEX_LIMIT === 8000.0, 'OPEX monthly limit must be 8,000 MXN');
assert_true(CIARM_TUS_COMPRAS_QUOTE_THRESHOLD === 3000.0, 'Quote threshold must be 3,000 MXN');

$existingOrders = [
    ['id' => 'CMP-2026-00001', 'area' => 'Primaria', 'tipo' => 'OPEX', 'monto' => 5000.0, 'montoEstimado' => 5000.0, 'montoOrdenCompra' => 4200.0, 'fecha' => '2026-11-02', 'estado' => CIARM_TUS_COMPRAS_STATE_OC_GENERADA], // descuenta 4,200 MXN (montoOrdenCompra ajustado)
    ['id' => 'CMP-2026-00002', 'area' => 'Primaria', 'tipo' => 'OPEX', 'monto' => 5000.0, 'fecha' => '2026-11-03', 'estado' => CIARM_TUS_COMPRAS_STATE_RECHAZADA], // rechazada no suma
    ['id' => 'CMP-2026-00003', 'area' => 'Secundaria', 'tipo' => 'OPEX', 'monto' => 7000.0, 'fecha' => '2026-11-04', 'estado' => CIARM_TUS_COMPRAS_STATE_ENVIADA],
];
$primariaOpex = ciarm_tus_compras_area_monthly_opex($existingOrders, 'Primaria', '2026-11');
assert_true($primariaOpex === 4200.0, 'Primaria Opex accumulated uses adjusted PO amount (4,200 MXN)');

$evalOk = ciarm_tus_compras_requires_approval('OPEX', 3500.0, $primariaOpex);
assert_true($evalOk['requiresApproval'] === false && $evalOk['projectedAreaMonthlyOpex'] === 7700.0 && $evalOk['initialState'] === CIARM_TUS_COMPRAS_STATE_ENVIADA, '4200 + 3500 <= 8000 starts in 1) Solicitud enviada');

$evalEx = ciarm_tus_compras_requires_approval('OPEX', 4000.0, $primariaOpex);
assert_true($evalEx['requiresApproval'] === true && $evalEx['projectedAreaMonthlyOpex'] === 8200.0 && $evalEx['initialState'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, '4200 + 4000 > 8000 automatically starts in 2b) En aprobación');

$evalCapex = ciarm_tus_compras_requires_approval('CAPEX', 2000.0, 0.0);
assert_true($evalCapex['requiresApproval'] === true && $evalCapex['initialState'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, 'Capex automatically starts in 2b) En aprobación');

// 3. Verificar flujo por umbral de $3,000 MXN:
//    - Pedido > $3,000 MXN: 2b -> 2a -> 2a-1 (START_QUOTING) -> 2a-2 (RECEIVE_QUOTES) -> 2c (ISSUE_PURCHASE_ORDER) -> 3 (RECEIVE_ITEMS_ADM)
//    - Pedido <= $3,000 MXN: 1 o 2a -> 2c (ISSUE_PURCHASE_ORDER) -> 3 (RECEIVE_ITEMS_ADM)
$order2b = [
    'id' => 'CMP-2026-00004',
    'correo' => 'm.gomez@ciarm.edu.mx',
    'solicitante' => 'María Gómez',
    'area' => 'Primaria',
    'tipo' => 'CAPEX',
    'monto' => 12000.0,
    'montoEstimado' => 12000.0,
    'acumuladoMesArea' => 12000.0,
    'requiereAprobacion' => true,
    'estado' => CIARM_TUS_COMPRAS_STATE_EN_APROBACION,
];

$blockedFrom2b = false;
try {
    ciarm_tus_compras_validate_transition($order2b, 'RECEIVE_ITEMS_ADM', $accDaniel);
} catch (RuntimeException $e) {
    $blockedFrom2b = ($e->getMessage() === 'INVALID_TRANSITION_STATE_3');
}
assert_true($blockedFrom2b, '2b cannot advance directly to state 3');

$approved = ciarm_tus_compras_validate_transition($order2b, 'APPROVE_CAPEX', $accEzequiel, 'Autorizado');
assert_true($approved['newState'] === CIARM_TUS_COMPRAS_STATE_EN_PROCESO, 'Approver approves 2b -> 2a) Solicitud recibida / En proceso');

$order2a = $order2b;
$order2a['estado'] = CIARM_TUS_COMPRAS_STATE_EN_PROCESO;

// Como es > $3,000 MXN ($12,000), debe pasar por cotización
$quoting = ciarm_tus_compras_validate_transition($order2a, 'START_QUOTING', $accDaniel, 'Iniciando cotización', ['fechaCierreCotizacion' => '2026-11-12']);
assert_true($quoting['newState'] === CIARM_TUS_COMPRAS_STATE_EN_COTIZACION, '2a (> $3,000) advances to 2a-1) En cotización');

$order2a1 = $order2a;
$order2a1['estado'] = CIARM_TUS_COMPRAS_STATE_EN_COTIZACION;
$quotesRec = ciarm_tus_compras_validate_transition($order2a1, 'RECEIVE_QUOTES', $accDaniel, '3 cotizaciones recibidas', ['adjuntoCotizacionesAdm' => 'https://portal2.ciarm.edu.mx/uploads/tus-compras/cot.pdf']);
assert_true($quotesRec['newState'] === CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS, '2a-1 advances to 2a-2) Cotizaciones recibidas with attachment');

$order2a2 = $order2a1;
$order2a2['estado'] = CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS;
$poIssued = ciarm_tus_compras_validate_transition($order2a2, 'ISSUE_PURCHASE_ORDER', $accDaniel, 'OC emitida', [
    'fechaOrdenCompra' => '2026-11-13',
    'fechaEntregaEstimada' => '2026-11-20',
    'montoOrdenCompra' => 11450.0,
]);
assert_true($poIssued['newState'] === CIARM_TUS_COMPRAS_STATE_OC_GENERADA && $poIssued['montoOrdenCompra'] === 11450.0, '2a-2 advances to 2c) Orden de Compra generada with adjusted PO amount');

$order2c = $order2a2;
$order2c['estado'] = CIARM_TUS_COMPRAS_STATE_OC_GENERADA;
$toState3 = ciarm_tus_compras_validate_transition($order2c, 'RECEIVE_ITEMS_ADM', $accDaniel);
assert_true($toState3['newState'] === CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM, '2c can advance to state 3');

// 4. Verificar regla estricta de asignación de estado al parsear filas de PEDIDOS (tickets 1, 2 y 3) y archivos opcionales diferenciados
$rawPedidosRows = [
    CIARM_TUS_COMPRAS_PEDIDOS_HEADERS,
    ['CMP-2026-00001', '2026-11-05', '10:00:00', 'Dir', 'm.gomez@ciarm.edu.mx', 'Docente', 'OPEX', '3000.00', '3000.00', 'NO', 'una regla 2 plumones y mas cosas', '', '1) Solicitud enviada', 'Daniel Lara', '', '', '', '', '', '', '', '', '2026-11-05 10:00:00', 'v1'],
    ['CMP-2026-00002', '2026-11-05', '10:05:00', 'Dir', 'm.gomez@ciarm.edu.mx', 'Docente', 'OPEX', '20000.00', '23000.00', 'NO', 'un kilo dfe plomo de prueba', '', '1) Solicitud enviada', 'Daniel Lara', '', '', '', '', '', '', '', '', '2026-11-05 10:05:00', 'v1'],
    ['CMP-2026-00003', '2026-11-05', '10:10:00', 'Dir', 'm.gomez@ciarm.edu.mx', 'Docente', 'CAPEX', '350000.00', '23000.00', 'NO', 'otra prueba esto es capex', '', '1) Solicitud enviada', 'Daniel Lara', '', '', '', '', '', '', '', '', '2026-11-05 10:10:00', 'v1'],
];
$parsedPedidos = ciarm_tus_compras_parse_pedidos($rawPedidosRows);
assert_true($parsedPedidos[0]['estado'] === CIARM_TUS_COMPRAS_STATE_ENVIADA, 'Ticket 1 (OPEX $3,000 <= $8,000) stays in 1) Solicitud enviada');
assert_true($parsedPedidos[1]['estado'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, 'Ticket 2 (OPEX $20,000 > $8,000) must be 2b) En aprobación');
assert_true($parsedPedidos[2]['estado'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, 'Ticket 3 (CAPEX $350,000) must be 2b) En aprobación');

// 5. Verificar tope de 10 MB por archivo y enlaces clicables de adjuntos en los correos electrónicos
assert_true(CIARM_TUS_COMPRAS_MAX_ATTACHMENT_BYTES === 10485760, 'Max attachment size is 10 MB');
$emailOrder = [
    'id' => 'CMP-2026-00010',
    'estado' => CIARM_TUS_COMPRAS_STATE_COTIZACIONES_RECIBIDAS,
    'tipo' => 'OPEX',
    'monto' => 5000.0,
    'montoEstimado' => 5000.0,
    'montoOrdenCompra' => 0.0,
    'acumuladoMesArea' => 5000.0,
    'solicitante' => 'María Gómez',
    'area' => 'Docente',
    'descripcion' => 'Proyector interactivo',
    'adjuntoDetalle' => 'https://drive.google.com/file/d/det123/view',
    'adjuntoCotizacionPreliminar' => 'https://drive.google.com/file/d/pre456/view',
    'adjuntoCotizacionesAdm' => 'https://drive.google.com/file/d/adm789/view',
];
$emailHtml = ciarm_tus_compras_render_email([
    'heading' => 'Cotizaciones recibidas',
    'intro' => 'Prueba de enlaces en correo',
    'ctaUrl' => 'https://portal2.ciarm.edu.mx/#admin-tus-compras',
    'ctaLabel' => 'Ver en portal',
    'comment' => 'Nota',
], $emailOrder);
assert_true(str_contains($emailHtml, 'https://drive.google.com/file/d/det123/view'), 'Email includes Detalle del pedido link');
assert_true(str_contains($emailHtml, 'https://drive.google.com/file/d/pre456/view'), 'Email includes Cotizacion preliminar link');
assert_true(str_contains($emailHtml, 'https://drive.google.com/file/d/adm789/view'), 'Email includes Cotizaciones Administracion link');

echo "Tus Compras PHP tests: all passed\n";
