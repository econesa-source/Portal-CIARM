<?php
 declare(strict_types=1);
require_once __DIR__ . '/tickets-portal-lib.php';
// Diagnóstico por tiempos, sin IDs, actores ni contenido de las solicitudes.
// Los nombres de las etapas son fijos: no se publica información sensible.
$ticketPerfStart=microtime(true);
$ticketPerf=['session'=>0.0,'identity'=>0.0,'rbac'=>0.0,'apps_script'=>0.0];
function ciarm_ticket_perf_headers(array $durations, float $start): void {
 $durations['total']=(microtime(true)-$start)*1000;
 $parts=[];
 foreach(['session','identity','rbac','apps_script','total'] as $stage){
  $ms=max(0.0,(float)($durations[$stage]??0));
  $parts[]=$stage.';dur='.number_format($ms,1,'.','');
 }
 header('Server-Timing: '.implode(', ',$parts));
}
$user=ciarm_session_user();
$ticketPerf['session']=(microtime(true)-$ticketPerfStart)*1000;
if($user===null)ciarm_json_response(401,['ok'=>false,'code'=>'UNAUTHENTICATED']);
$method=$_SERVER['REQUEST_METHOD']??'';
if(!in_array($method,['GET','POST'],true))ciarm_json_response(405,['ok'=>false,'code'=>'METHOD']);
function ticket_http_status(string $code): int {
 return match($code){'FORBIDDEN','ORIGIN','CSRF'=>403,'NOT_FOUND'=>404,'CONFLICT','OPERATION_REUSED','PENDING_OPERATION','DUPLICATE_ID'=>409,'PAYLOAD_SIZE'=>413,'CONTENT_TYPE'=>415,'VALIDATION'=>422,'BUSY','CONFIGURATION'=>503,default=>502};
}
try {
 if($method==='GET'){
  $action=$_GET['action']??'';if(!is_string($action))throw new RuntimeException('VALIDATION');
  if($action==='context'){
   $stamp=microtime(true);
   $data=ciarm_ticket_context($user);
   $ticketPerf['rbac']=(microtime(true)-$stamp)*1000;
   ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
   ciarm_json_response(200,['ok'=>true,'data'=>$data]);
  }
  if($action==='selfContext'){
   $stamp=microtime(true);
   $data=ciarm_portal_context($user);
   $ticketPerf['identity']=(microtime(true)-$stamp)*1000;
   ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
   ciarm_json_response(200,['ok'=>true,'data'=>$data]);
  }
  if(!in_array($action,['mine','creationStatus','list','catalogs','detail','serviceContext','serviceSettings','serviceList','serviceDetail'],true))throw new RuntimeException('VALIDATION');
  $input=$_GET;
 } else {
  if(!ciarm_ticket_origin_valid($_SERVER['HTTP_ORIGIN']??'',$_SERVER['HTTP_HOST']??''))throw new RuntimeException('ORIGIN');
  $contentType=strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]));
  if($contentType==='application/json'){
   $raw=file_get_contents('php://input',false,null,0,50001);if($raw===false||strlen($raw)>50000)throw new RuntimeException('PAYLOAD_SIZE');
   $input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($input))throw new RuntimeException('VALIDATION');
  } elseif($contentType==='multipart/form-data') {
   if((int)($_SERVER['CONTENT_LENGTH']??0)>16*1024*1024)throw new RuntimeException('PAYLOAD_SIZE');$input=$_POST;
  } else throw new RuntimeException('CONTENT_TYPE');
  $action=$input['action']??'';
  if(!is_string($action)||!in_array($action,['assign','beginCreate','uploadAttachment','finalizeCreate','saveServicePolicy','serviceTransition'],true))throw new RuntimeException('VALIDATION');
  if(($action==='uploadAttachment')!==($contentType==='multipart/form-data'))throw new RuntimeException('CONTENT_TYPE');
  if(!ciarm_ticket_csrf_valid((string)($_SESSION['ciarm_ticket_csrf']??''),is_string($input['csrfToken']??null)?$input['csrfToken']:''))throw new RuntimeException('CSRF');
 }
 $selfService=in_array($action,['mine','creationStatus','beginCreate','uploadAttachment','finalizeCreate','serviceContext','serviceSettings','serviceList','serviceDetail','saveServicePolicy','serviceTransition'],true);

 // Protección de acciones directas; la visibilidad del dashboard no es autorización.
 if(ciarm_rbac_enforced()){
  if($action==='mine'&&!ciarm_rbac_has_function($user,'INT_MIS'))throw new RuntimeException('FORBIDDEN');
  if(in_array($action,['creationStatus','beginCreate','uploadAttachment','finalizeCreate'],true)
      &&!ciarm_rbac_has_function($user,'INT_CREAR'))throw new RuntimeException('FORBIDDEN');
 }
 if($selfService){
  $stamp=microtime(true);
  ciarm_portal_current_collaborator($user);
  $ticketPerf['identity']=(microtime(true)-$stamp)*1000;
  if(in_array($action,['serviceSettings','saveServicePolicy'],true)||($action==='serviceList'&&($input['kind']??'')==='all')){
   $stamp=microtime(true);
   $allowed=ciarm_ticket_current_permission($user);
   $ticketPerf['rbac']=(microtime(true)-$stamp)*1000;
   if(!$allowed)throw new RuntimeException('FORBIDDEN');
  }
  $payload=$action==='uploadAttachment'?ciarm_portal_upload($_FILES,$input):ciarm_portal_payload($action,$input);
 } else {
  $stamp=microtime(true);
  $allowed=ciarm_ticket_current_permission($user);
  $ticketPerf['rbac']=(microtime(true)-$stamp)*1000;
  if(!$allowed)throw new RuntimeException('FORBIDDEN');
  if($action==='assign')$payload=array_intersect_key($input,array_flip(['operationId','ticketId','expectedVersion','changes']));
  else $payload=$action==='detail'?['id'=>$input['id']??null]:[];
  if($action==='detail'&&!is_string($payload['id']))throw new RuntimeException('VALIDATION');
 }
 // La respuesta serviceContext ya proviene de un puente autenticado.
 // Entregar el CSRF en esta respuesta evita pedir primero selfContext
 // (que generaba otra lectura a DM03 y otra ejecución Apps Script).
 $serviceContextCsrf = null;
 if($action==='serviceContext'){
  if(empty($_SESSION['ciarm_ticket_csrf']))$_SESSION['ciarm_ticket_csrf']=bin2hex(random_bytes(32));
  $serviceContextCsrf=$_SESSION['ciarm_ticket_csrf'];
 }
 session_write_close();
 $stamp=microtime(true);
 $result=$selfService?ciarm_portal_bridge($user,$action,$payload):ciarm_ticket_bridge($user,$action,$payload);
 $ticketPerf['apps_script']=(microtime(true)-$stamp)*1000;
 if($action==='serviceContext'&&($result['ok']??false)===true&&is_array($result['data']??null)){
  $result['data']['csrfToken']=$serviceContextCsrf;
 }
 ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
 ciarm_json_response(($result['ok']??false)===true?200:ticket_http_status((string)($result['code']??'')),$result);
} catch(JsonException $error){
 ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
 ciarm_json_response(422,['ok'=>false,'code'=>'VALIDATION']);
}
catch(Throwable $error){
 ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
 $code=in_array($error->getMessage(),['FORBIDDEN','ORIGIN','CSRF','VALIDATION','PAYLOAD_SIZE','CONTENT_TYPE','CONFIGURATION'],true)?$error->getMessage():'UPSTREAM';
 ciarm_json_response(ticket_http_status($code),['ok'=>false,'code'=>$code]);
}
