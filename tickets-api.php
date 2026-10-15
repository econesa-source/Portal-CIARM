<?php
 declare(strict_types=1);
require_once __DIR__ . '/tickets-portal-lib.php';
require_once __DIR__ . '/tickets-direct-read.php';
// Diagnóstico por tiempos, sin IDs, actores ni contenido de las solicitudes.
// Los nombres de las etapas son fijos: no se publica información sensible.
$ticketPerfStart=microtime(true);
$ticketPerf=['session'=>0.0,'identity'=>0.0,'rbac'=>0.0,'apps_script'=>0.0];
function ciarm_ticket_perf_headers(array $durations, float $start): void {
 $durations['total']=(microtime(true)-$start)*1000;
 $parts=[];
 foreach(array_merge(['session','identity','rbac','sheets_direct','apps_script','total'],['gas_verify','gas_identity','gas_authorize','gas_lock','gas_nonce','gas_open','gas_work','gas_total']) as $stage){
  if(!array_key_exists($stage,$durations))continue;
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
  if(!in_array($action,['mine','creationStatus','list','catalogs','detail','serviceContext','serviceSettings','serviceList','serviceDetail','validateDirectReads'],true))throw new RuntimeException('VALIDATION');
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
 // Métricas sólo cuando las solicita explícitamente un gestor autorizado.
 // Nunca reenvíe el indicador sin una firma HMAC del backend.
 $perfProbe=$method==='GET'&&($_GET['perf']??'')==='1'&&ciarm_ticket_current_permission($user);

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
 // Optional authenticated parity audit: compare GAS with Sheets and
 // disable direct reads for the session if any mismatch is detected.
 // Version tokens on the list are excluded: the detail endpoint remains canonical GAS.
 if($action==='validateDirectReads'){
  if($method!=='GET'||!ciarm_ticket_current_permission($user))throw new RuntimeException('FORBIDDEN');
  $started=microtime(true);
  $matched=true;
  $results=[];
  foreach(['catalogs','list'] as $kind){
   $direct=ciarm_tickets_direct_read($kind);
   $legacy=ciarm_ticket_bridge($user,$kind,[]);
   if(($legacy['ok']??false)!==true||!is_array($legacy['data']??null))throw new RuntimeException('UPSTREAM');
   $old=$legacy['data'];
   if($kind==='list'){
    $old=array_map(static function($ticket){
     if(!is_array($ticket))throw new RuntimeException('SCHEMA');
     unset($ticket['version']);return $ticket;
    },$old);
    $direct=array_map(static function($ticket){unset($ticket['version']);return $ticket;},$direct);
   }
   $report=ciarm_tickets_parity_report($kind,$old,$direct);
   $matched=$matched&&$report['same'];
   $results[$kind]=$report;
  }
  // An explicit failed parity check stops fast reads in this session.
  // Normal reads never depend on pressing a diagnostic button or a TTL.
  if($matched)unset($_SESSION['ciarm_ticket_direct_blocked']);
  else $_SESSION['ciarm_ticket_direct_blocked']=true;
  ciarm_ticket_perf_headers($ticketPerf,$ticketPerfStart);
  ciarm_json_response(200,['ok'=>true,'data'=>[
   'enabled'=>$matched,'checks'=>$results,'elapsedMs'=>(int)round((microtime(true)-$started)*1000)
  ]]);
 }
 // La respuesta serviceContext ya proviene de un puente autenticado.
 // Entregar el CSRF en esta respuesta evita pedir primero selfContext
 // (que generaba otra lectura a DM03 y otra ejecución Apps Script).
 $serviceContextCsrf = null;
 if($action==='serviceContext'){
  if(empty($_SESSION['ciarm_ticket_csrf']))$_SESSION['ciarm_ticket_csrf']=bin2hex(random_bytes(32));
  $serviceContextCsrf=$_SESSION['ciarm_ticket_csrf'];
 }
 // Read-only operations use the authoritative Google Sheets API by default.
 // DM03/DM05 authorization has already passed above, and mutation/version
 // operations continue through the signed Apps Script endpoint.
 // The legacy GAS path is only used if the Sheets read fails.
 $readDirect = ciarm_tickets_direct_eligible($method,$action)
   && empty($_SESSION['ciarm_ticket_direct_blocked']);
 session_write_close();
 $stamp=microtime(true);
 $result=null;
 if($readDirect){
  try{
   $result=['ok'=>true,'data'=>ciarm_tickets_direct_read($action)];
   $ticketPerf['sheets_direct']=(microtime(true)-$stamp)*1000;
   header('X-CIARM-Tickets-Read-Source: sheets-direct');
  }catch(Throwable $directReadError){
   // Never show partial or unvalidated data. Fallback retains the same
   // authorization already checked above and the canonical GAS behavior.
   $ticketPerf['sheets_direct']=(microtime(true)-$stamp)*1000;
   header('X-CIARM-Tickets-Read-Source: apps-script-fallback');
  }
 }
 if($result===null){
  $gasStamp=microtime(true);
  $result=$selfService?ciarm_portal_bridge($user,$action,$payload,$perfProbe):ciarm_ticket_bridge($user,$action,$payload,$perfProbe);
  $ticketPerf['apps_script']=(microtime(true)-$gasStamp)*1000;
  if(!$readDirect)header('X-CIARM-Tickets-Read-Source: apps-script');
 }
 $gasPerf=$result['_perf']??null;
 unset($result['_perf']);
 if($perfProbe&&is_array($gasPerf)){
  foreach(['verify','identity','authorize','lock','nonce','open','work','total'] as $stage){
   $value=$gasPerf[$stage]??null;
   if(is_numeric($value)&&is_finite((float)$value)&&(float)$value>=0&&(float)$value<=60000){
    $ticketPerf['gas_'.$stage]=(float)$value;
   }
  }
 }
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
