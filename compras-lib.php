<?php
declare(strict_types=1);
require_once __DIR__ . '/portal-permissions-lib.php';

/** Secrets use the existing private directory outside the web root. Environment
 * values take precedence. Missing configuration and writes fail closed. */
function ciarm_compras_config(): array {
    $raw = @file_get_contents(ciarm_private_path('compras.json'));
    $stored = $raw === false ? [] : json_decode($raw, true);
    $config = is_array($stored) ? $stored : [];
    foreach (['enabled'=>'CIARM_COMPRAS_ENABLED','writes_enabled'=>'CIARM_COMPRAS_WRITES_ENABLED',
      'gas_url'=>'CIARM_COMPRAS_GAS_URL','hmac_key'=>'CIARM_COMPRAS_HMAC_KEY',
      'origin'=>'CIARM_COMPRAS_ORIGIN'] as $field=>$env) {
        $v=getenv($env);
        if($v!==false)$config[$field]=$v;
    }
    return $config;
}
function ciarm_compras_config_valid(array $c): bool {
    return ($c['enabled']??'')==='1' && is_string($c['hmac_key']??null) && strlen($c['hmac_key'])>=48 &&
      is_string($c['gas_url']??null) && preg_match('~^https://script\.google\.com/macros/s/[a-zA-Z0-9_-]+/exec$~',$c['gas_url'])===1 &&
      is_string($c['origin']??null) && preg_match('~^https://[a-z0-9.-]+\.ciarm\.edu\.mx$~i',$c['origin'])===1;
}
function ciarm_compras_writes_enabled(array $c): bool {
    return ciarm_compras_config_valid($c) && ($c['writes_enabled']??'')==='1';
}

/** SCGRC Compras V1. Transporte autenticado del Portal.
 * El backend de HT06 revalidará identidad/centro/firma. No se entrega acceso a Sheets.
 */
function ciarm_compras_actions(): array {
    return [
        'contextoSolicitud' => ['GET', ['COMPRAS_CREAR']],
        'misPedidos' => ['GET', ['COMPRAS_MIS','COMPRAS_AREA','COMPRAS_TODOS']],
        'alternativas' => ['GET', ['COMPRAS_ELEGIR']],
        'pendientesAprobacion' => ['GET', ['COMPRAS_FIRMAR']],
        'recepcionesAsignadas' => ['GET', ['COMPRAS_RECIBIR_ASIGNADA']],
        'prorrogasPendientes' => ['GET', ['COMPRAS_PRORROGA_FIRMAR']],
        'excepcionesPendientes' => ['GET', ['COMPRAS_EXCEPCION_COT']],
        'crearSolicitud' => ['POST', ['COMPRAS_CREAR']],
        'elegirAlternativa' => ['POST', ['COMPRAS_ELEGIR']],
        'decidirSolicitud' => ['POST', ['COMPRAS_FIRMAR']],
        'declararRecepcion' => ['POST', ['COMPRAS_RECIBIR_ASIGNADA']],
        'cancelarRemanente' => ['POST', ['COMPRAS_CANCELAR']],
        'autorizarExcepcionCotizacion' => ['POST', ['COMPRAS_EXCEPCION_COT']],
        'firmarProrroga' => ['POST', ['COMPRAS_PRORROGA_FIRMAR']]
    ];
}
function ciarm_compras_require_permission(array $user,string $action,string $method): void {
    $actions=ciarm_compras_actions();
    if(!isset($actions[$action])||$method!==$actions[$action][0])throw new RuntimeException('INVALID_REQUEST');
    // La bandera transitoria de DM05 NO puede abrir operaciones financieras.
    if(!ciarm_rbac_enforced())throw new RuntimeException('SERVICE_UNAVAILABLE');
    $effective=ciarm_rbac_effective($user);
    if(($effective['verified']??false)!==true)throw new RuntimeException('SERVICE_UNAVAILABLE');
    $codes=$effective['codes']??[];
    if(!array_intersect($actions[$action][1],$codes))throw new RuntimeException('FORBIDDEN');
}
function ciarm_compras_shape(string $action,array $payload): array {
    $allowed=[
      'crearSolicitud'=>['tipoSolicitud','centroCostos','fechaGeneral','responsableRecepcion','areaContexto','renglones','adjuntosVinculos','claveEnvio'],
      'elegirAlternativa'=>['idSolicitud','idAlternativa','motivo'],
      'decidirSolicitud'=>['idSolicitud','decision','motivo','reasignacion'],
      'declararRecepcion'=>['idSolicitud','idRenglon','cantidadRecibida','cantidadConforme','fechaRecepcion','observacion','claveEnvio'],
      'cancelarRemanente'=>['idSolicitud','motivo'],
      'autorizarExcepcionCotizacion'=>['idSolicitud','motivo'],
      'firmarProrroga'=>['idOC','clave']
    ];
    $keys=array_keys($payload);$expected=$allowed[$action]??[];
    if(array_diff($keys,$expected)!==[])throw new RuntimeException('INVALID_REQUEST');
    if(strlen(json_encode($payload,JSON_THROW_ON_ERROR))>24576)throw new RuntimeException('INVALID_REQUEST');
    if($action==='crearSolicitud') {
        if(!preg_match('/^[A-Za-z0-9_-]{16,100}$/',(string)($payload['claveEnvio']??''))||
            !is_array($payload['renglones']??null)||count($payload['renglones'])<1||count($payload['renglones'])>20)
            throw new RuntimeException('INVALID_REQUEST');
        foreach($payload['renglones'] as $r){
            if(!is_array($r)||!is_string($r['descripcion']??null)||trim($r['descripcion'])===''||
                !(is_numeric($r['cantidad']??null)&&floatval($r['cantidad'])>0))
                throw new RuntimeException('INVALID_REQUEST');
        }
    }
    if($action==='elegirAlternativa'&&(!preg_match('/^SOL-\d{6,}$/',(string)($payload['idSolicitud']??''))||
        strlen(trim((string)($payload['motivo']??'')))<8))throw new RuntimeException('INVALID_REQUEST');
    if($action==='decidirSolicitud'&&(!in_array($payload['decision']??'',['Aprobar','Rechazar','Reasignar y aprobar'],true)||
       !preg_match('/^SOL-\d{6,}$/',(string)($payload['idSolicitud']??''))))throw new RuntimeException('INVALID_REQUEST');
    if($action==='declararRecepcion'){
        $q=$payload['cantidadRecibida']??null;$c=$payload['cantidadConforme']??null;
        if(!is_numeric($q)||!is_numeric($c)||(float)$q<=0||(float)$c<0||(float)$c>(float)$q||
           !preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($payload['fechaRecepcion']??''))||
           !preg_match('/^[A-Za-z0-9:_-]{12,120}$/',(string)($payload['claveEnvio']??'')))
           throw new RuntimeException('INVALID_REQUEST');
    }
    if($action==='cancelarRemanente'&&strlen(trim((string)($payload['motivo']??'')))<8)throw new RuntimeException('INVALID_REQUEST');
    if($action==='autorizarExcepcionCotizacion'&&strlen(trim((string)($payload['motivo']??'')))<15)throw new RuntimeException('INVALID_REQUEST');
    return $payload;
}
function ciarm_compras_forward(array $user,string $action,array $payload): array {
    $config=ciarm_compras_config();
    if(!ciarm_compras_config_valid($config))throw new RuntimeException('SERVICE_UNAVAILABLE');
    if((ciarm_compras_actions()[$action][0]??'')!=='GET' && !ciarm_compras_writes_enabled($config))
        throw new RuntimeException('SERVICE_UNAVAILABLE');
    $url=$config['gas_url'];$key=$config['hmac_key'];
    $actor=strtolower(trim((string)($user['correo']??'')));
    if(!preg_match('/^[a-z0-9][a-z0-9._+\-]*@ciarm\.edu\.mx$/',$actor))throw new RuntimeException('FORBIDDEN');
    // No aceptar actor/rol desde el body: se toma exclusivamente de la sesión PHP.
    $envelope=json_encode([
      'version'=>'compras-v1','action'=>$action,'actor'=>$actor,
      'issuedAt'=>time(),'nonce'=>bin2hex(random_bytes(24)),'payload'=>(object)$payload
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $signed=['envelope'=>$envelope,'signature'=>hash_hmac('sha256',$envelope,$key)];
    $resp=ciarm_http_json($url,['post'=>true,'headers'=>[
      'Accept: application/json','Content-Type: application/json'
    ],'body'=>json_encode($signed,JSON_THROW_ON_ERROR),'timeout'=>30]);
    if($resp['status']!==200||!is_array($resp['body'])||
      ($resp['body']['version']??'')!=='compras-v1'||!is_bool($resp['body']['ok']??null))
      throw new RuntimeException('UPSTREAM_ERROR');
    return $resp['body'];
}
function ciarm_compras_csrf_token(): string {
    if(empty($_SESSION['ciarm_compras_csrf']))$_SESSION['ciarm_compras_csrf']=bin2hex(random_bytes(32));
    return (string)$_SESSION['ciarm_compras_csrf'];
}
/** No devolver columnas técnicas internas en la lista de seguimiento. */
function ciarm_compras_public_data(string $action,mixed $data): mixed {
    if($action!=='misPedidos'||!is_array($data))return $data;
    $fields=['ID Solicitud','Fecha creación','Correo solicitante','Centro de costos','Estado','Monto cotizado total','ID OC','Estado compra visible','Tipo de solicitud','Área / contexto de uso','Fecha última acción'];
    return array_map(static function($r)use($fields){
      if(!is_array($r))return [];
      return array_intersect_key($r,array_flip($fields));
    },$data);
}
