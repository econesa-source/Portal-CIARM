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

$accEzequiel = ciarm_tus_compras_evaluate_access_rows($dm03Rows, 'e.conesa@ciarm.edu.mx');
assert_true($accEzequiel['visible'] === true && $accEzequiel['isAdministracion'] === true && $accEzequiel['canApprove'] === true, 'Administracion + Administracion is Approver');

// 2. Verificar acumulado mensual Opex de $10,000 MXN por área solicitante y paso automático a 2b) En aprobación
$existingOrders = [
    ['id' => 'CMP-2026-00001', 'area' => 'Primaria', 'tipo' => 'OPEX', 'monto' => 6000.0, 'fecha' => '2026-11-02', 'estado' => CIARM_TUS_COMPRAS_STATE_EN_PROCESO],
    ['id' => 'CMP-2026-00002', 'area' => 'Primaria', 'tipo' => 'OPEX', 'monto' => 5000.0, 'fecha' => '2026-11-03', 'estado' => CIARM_TUS_COMPRAS_STATE_RECHAZADA], // rechazada no suma
    ['id' => 'CMP-2026-00003', 'area' => 'Secundaria', 'tipo' => 'OPEX', 'monto' => 8000.0, 'fecha' => '2026-11-04', 'estado' => CIARM_TUS_COMPRAS_STATE_ENVIADA],
];
$primariaOpex = ciarm_tus_compras_area_monthly_opex($existingOrders, 'Primaria', '2026-11');
assert_true($primariaOpex === 6000.0, 'Primaria Opex accumulated is 6,000 MXN');

$evalOk = ciarm_tus_compras_requires_approval('OPEX', 3500.0, $primariaOpex);
assert_true($evalOk['requiresApproval'] === false && $evalOk['projectedAreaMonthlyOpex'] === 9500.0 && $evalOk['initialState'] === CIARM_TUS_COMPRAS_STATE_ENVIADA, '6000 + 3500 <= 10000 starts in 1) Solicitud enviada');

$evalEx = ciarm_tus_compras_requires_approval('OPEX', 4500.0, $primariaOpex);
assert_true($evalEx['requiresApproval'] === true && $evalEx['projectedAreaMonthlyOpex'] === 10500.0 && $evalEx['initialState'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, '6000 + 4500 > 10000 automatically starts in 2b) En aprobación');

$evalCapex = ciarm_tus_compras_requires_approval('CAPEX', 2000.0, 0.0);
assert_true($evalCapex['requiresApproval'] === true && $evalCapex['initialState'] === CIARM_TUS_COMPRAS_STATE_EN_APROBACION, 'Capex automatically starts in 2b) En aprobación');

// 3. Verificar que al aprobar un ticket en 2b) En aprobación, pasa a 2a) Solicitud recibida / En proceso y de ahí a 3)
$order2b = [
    'id' => 'CMP-2026-00004',
    'correo' => 'm.gomez@ciarm.edu.mx',
    'solicitante' => 'María Gómez',
    'area' => 'Primaria',
    'tipo' => 'CAPEX',
    'monto' => 12000.0,
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
$toState3 = ciarm_tus_compras_validate_transition($order2a, 'RECEIVE_ITEMS_ADM', $accDaniel);
assert_true($toState3['newState'] === CIARM_TUS_COMPRAS_STATE_RECIBIDOS_ADM, '2a can advance to state 3');

echo "Tus Compras PHP tests: all passed\n";
