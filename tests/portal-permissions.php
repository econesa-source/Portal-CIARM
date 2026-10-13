<?php
declare(strict_types=1);
require_once __DIR__ . '/../portal-permissions-lib.php';
function ensure(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
}
$dm03 = [
    ['Correo Ciarm', 'Status', 'Roles DM05'],
    ['persona@ciarm.edu.mx', 'Activo', 'PORTAL_USUARIO, TICKETS_GESTION'],
    ['otro@ciarm.edu.mx', 'Baja', 'PORTAL_ADMIN']
];
ensure(ciarm_rbac_user_roles($dm03, 'PERSONA@ciarm.edu.mx') === ['PORTAL_USUARIO','TICKETS_GESTION'], 'Multiple roles');
try { ciarm_rbac_user_roles($dm03, 'otro@ciarm.edu.mx'); throw new RuntimeException('Inactive accepted'); }
catch (RuntimeException $e) { ensure($e->getMessage() === 'rbac_inactive', 'Inactive denied'); }
$roleRows = [
    ['Código','Rol','Ámbito','Activo'],
    ['PORTAL_USUARIO','Usuario','General','Sí'],
    ['TICKETS_GESTION','Tickets','Servicios','Sí']
];
$functions = [
    ['Código','Módulo','Función','Descripción','Estado','Tarjeta madre','Tipo'],
    ['INT_TARJETA','','','','','','TARJETA'],
    ['INT_CREAR','','','','','INT_TARJETA','FUNCIÓN'],
    ['INT_GESTION','','','','','INT_TARJETA','FUNCIÓN'],
    ['COMPRAS_OC','','','','','INT_TARJETA','INTERNA']
];
$matrix = [
    ['Código función','Tarjeta / función','PORTAL_USUARIO','TICKETS_GESTION'],
    ['INT_TARJETA','',true,true],
    ['INT_CREAR','',true,false],
    ['INT_GESTION','',true,true],
    ['COMPRAS_OC','',true,true]
];
$grants = ciarm_rbac_permissions(['PORTAL_USUARIO','TICKETS_GESTION'],$roleRows,$functions,$matrix);
ensure(in_array('INT_TARJETA',$grants,true), 'Card');
ensure(in_array('INT_CREAR',$grants,true), 'Create');
ensure(in_array('INT_GESTION',$grants,true), 'Manage');
ensure(!in_array('COMPRAS_OC',$grants,true), 'Internal prohibited');
$matrix[1][3] = false; // Tickets role without its mother card
$matrix[3][2] = false; // User does not manage
$denied = ciarm_rbac_permissions(['PORTAL_USUARIO','TICKETS_GESTION'],$roleRows,$functions,$matrix);
ensure(!in_array('INT_GESTION',$denied,true), 'Parent must be granted within same role');
echo "DM05 permissions: tests passed\n";
