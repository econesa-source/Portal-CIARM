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
if (($_GET['action'] ?? '') === 'ping') {
    header('Content-Type: application/json; charset=utf-8');
    $canRead = false;
    $sheetErr = null;
    $ticketCount = null;
    try {
        $sets = ciarm_tickets_batch_get(["'TICKETS'!A1:B20"]);
        $canRead = is_array($sets);
        $ticketCount = count($sets["'TICKETS'!A1:B20"] ?? []);
    } catch (Throwable $e) {
        $sheetErr = $e->getMessage();
    }
    echo json_encode([
        'ok' => true,
        'http_host' => $_SERVER['HTTP_HOST'] ?? '',
        'server_name' => $_SERVER['SERVER_NAME'] ?? '',
        'is_production' => ciarm_tickets_is_production_host(),
        'active_sheet' => ciarm_tickets_active_sheet_id(),
        'active_webapp' => ciarm_tickets_active_webapp(),
        'active_base_url' => ciarm_tickets_active_base_url(),
        'tickets_env_file_exists' => @file_exists(ciarm_private_path('tickets-env.json')),
        'service_account_exists' => @file_exists(ciarm_private_path('service-account.json')),
        'admin_key_exists' => @file_exists(ciarm_private_path('tickets-admin.key')),
        'can_read_sheets' => $canRead,
        'sheet_read_error' => $sheetErr,
        'ticket_rows_read' => $ticketCount,
    ], JSON_PRETTY_PRINT);
    exit;
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
  if(!in_array($action,['mine','creationStatus','list','catalogs','detail','serviceContext','serviceSettings','serviceList','serviceListRaw','serviceDetail','detailPreview','validateDirectReads'],true))throw new RuntimeException('VALIDATION');
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
  if(!is_string($action)||!in_array($action,['assign','beginCreate','uploadAttachment','uploadEvidence','finalizeCreate','saveServicePolicy','serviceTransition'],true))throw new RuntimeException('VALIDATION');
  if(in_array($action,['uploadAttachment','uploadEvidence'],true)!==($contentType==='multipart/form-data'))throw new RuntimeException('CONTENT_TYPE');
  if(!ciarm_ticket_csrf_valid((string)($_SESSION['ciarm_ticket_csrf']??''),is_string($input['csrfToken']??null)?$input['csrfToken']:''))throw new RuntimeException('CSRF');
 }
 $selfService=in_array($action,['mine','creationStatus','beginCreate','uploadAttachment','uploadEvidence','finalizeCreate','serviceContext','serviceSettings','serviceList','serviceListRaw','serviceDetail','saveServicePolicy','serviceTransition'],true);
 // Métricas sólo cuando las solicita explícitamente un gestor autorizado.
 // Nunca reenvíe el indicador sin una firma HMAC del backend.
 $perfProbe=$method==='GET'&&($_GET['perf']??'')==='1'&&ciarm_ticket_current_permission($user);

 // Protección de acciones directas; la visibilidad del dashboard no es autorización.
 if(ciarm_rbac_enforced()){
  if($action==='mine'&&!ciarm_rbac_has_function($user,'INT_MIS'))throw new RuntimeException('FORBIDDEN');
  if(in_array($action,['creationStatus','beginCreate','uploadAttachment','finalizeCreate'],true)
      &&!ciarm_rbac_has_function($user,'INT_CREAR'))throw new RuntimeException('FORBIDDEN');
  if($action==='uploadEvidence'&&!ciarm_rbac_has_function($user,'TAREAS_GESTION')&&!ciarm_rbac_has_function($user,'INT_GESTION'))throw new RuntimeException('FORBIDDEN');
 }
 if($selfService){
  $stamp=microtime(true);
  ciarm_portal_current_collaborator($user);
  $ticketPerf['identity']=(microtime(true)-$stamp)*1000;
  if($action==='uploadEvidence'){
   if(array_keys($_FILES)!==['file']||!is_array($_FILES['file'])||!is_string($_FILES['file']['tmp_name']??null)||!is_uploaded_file($_FILES['file']['tmp_name']))throw new RuntimeException('VALIDATION');
   $file=$_FILES['file'];
   if(($file['error']??-1)!==UPLOAD_ERR_OK)throw new RuntimeException('VALIDATION');
   $size=(int)($file['size']??0);
   if($size<1||$size>10*1024*1024)throw new RuntimeException('PAYLOAD_SIZE');
   $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
   $allowed=is_string($mime)&&(str_starts_with($mime,'image/')||$mime==='application/pdf');
   if(!$allowed)throw new RuntimeException('CONTENT_TYPE');
   $res=ciarm_upload_evidence_to_drive($file,$user);
   ciarm_json_response(200,['ok'=>true,'data'=>$res]);
  }
  if(in_array($action,['serviceSettings','saveServicePolicy'],true)||(in_array($action,['serviceList','serviceListRaw'],true)&&($input['kind']??'')==='all')){
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
  else $payload=in_array($action,['detail','detailPreview'],true)?['id'=>$input['id']??null]:[];
  if(in_array($action,['detail','detailPreview'],true)&&!is_string($payload['id']))throw new RuntimeException('VALIDATION');
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
 $serviceContextCanAdmin = null;
 if($action==='serviceContext'){
  if(empty($_SESSION['ciarm_ticket_csrf']))$_SESSION['ciarm_ticket_csrf']=bin2hex(random_bytes(32));
  $serviceContextCsrf=$_SESSION['ciarm_ticket_csrf'];
  // DM05 is the sole source of Portal authorization; do not copy GAS allowlists.
  $serviceContextCanAdmin=ciarm_ticket_current_permission($user);
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
   if($action==='serviceContext'){
    $configRange="'CONFIG SERVICIO'!A:F";
    $sets=ciarm_tickets_batch_get([$configRange]);
    if(!isset($sets[$configRange])||!is_array($sets[$configRange]))throw new RuntimeException('SCHEMA');
    $context=ciarm_tickets_direct_service_context($sets[$configRange],(bool)$serviceContextCanAdmin);
    $context['csrfToken']=$serviceContextCsrf;
    $result=['ok'=>true,'data'=>$context];
   }elseif($action==='detailPreview'){
    $id=$payload['id']??null;
    if(!is_string($id))throw new RuntimeException('VALIDATION');
    $result=['ok'=>true,'data'=>ciarm_tickets_direct_detail_preview($id)];
   }elseif($action==='serviceListRaw'){
    if(!in_array($payload['kind']??null,['all','mine','assigned'],true))throw new RuntimeException('VALIDATION');
    $ranges=["'TICKETS'!A:X","'BITACORA TICKETS'!A:J","'SEGUIMIENTO SERVICIO'!A:B"];
    $sets=ciarm_tickets_batch_get($ranges);
    foreach($ranges as $range){
     if(!isset($sets[$range])||!is_array($sets[$range]))throw new RuntimeException('SCHEMA');
    }
    $actor=strtolower(trim((string)($user['correo']??'')));
    $collaborator=ciarm_portal_current_collaborator($user);
    $actorName=(string)($collaborator['nombre']??'');
    $result=['ok'=>true,'data'=>ciarm_tickets_direct_service_list(
     $sets[$ranges[0]],$sets[$ranges[1]],$sets[$ranges[2]],$actor,$payload['kind'],$actorName
    )];
   }else{
    $result=['ok'=>true,'data'=>ciarm_tickets_direct_read($action)];
   }
   $ticketPerf['sheets_direct']=(microtime(true)-$stamp)*1000;
   header('X-CIARM-Tickets-Read-Source: sheets-direct');
  }catch(Throwable $directReadError){
   // Never show partial or unvalidated data. Fallback retains the same
   // authorization already checked above and the canonical GAS behavior.
   $ticketPerf['sheets_direct']=(microtime(true)-$stamp)*1000;
   header('X-CIARM-Tickets-Read-Source: apps-script-fallback');
   header('X-CIARM-Tickets-Fallback-Reason: ' . substr(rawurlencode($directReadError->getMessage() . ' in ' . basename($directReadError->getFile()) . ':' . $directReadError->getLine()), 0, 200));
   error_log('tickets-api sheets-direct fallback: ' . $directReadError->getMessage() . ' in ' . $directReadError->getFile() . ':' . $directReadError->getLine());
  }
 }
 if($result===null){
  $gasStamp=microtime(true);
  $bridgeAction=$action==='serviceListRaw'?'serviceList':($action==='detailPreview'?'detail':$action);
  $result=$selfService?ciarm_portal_bridge($user,$bridgeAction,$payload,$perfProbe):ciarm_ticket_bridge($user,$bridgeAction,$payload,$perfProbe);
  if($action==='serviceListRaw'&&($result['ok']??false)===true&&is_array($result['data']??null))
    $result['data']=['computed'=>true,'items'=>$result['data']];
  if($action==='detailPreview'&&($result['ok']??false)===true&&is_array($result['data']??null)){
    unset($result['data']['pendingOperation']);
    $result['data']['version']=null;
    $result['data']['readOnly']=true;
  }
  $ticketPerf['apps_script']=(microtime(true)-$gasStamp)*1000;
  if(!$readDirect)header('X-CIARM-Tickets-Read-Source: apps-script');
  if($method==='POST'&&($result['ok']??false)===true){
   $result=ciarm_ticket_ensure_notifications($action,$input,$result);
  }
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
 error_log('tickets-api exception: ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());
 $code=in_array($error->getMessage(),['FORBIDDEN','ORIGIN','CSRF','VALIDATION','PAYLOAD_SIZE','CONTENT_TYPE','CONFIGURATION'],true)?$error->getMessage():'UPSTREAM';
 ciarm_json_response(ticket_http_status($code),['ok'=>false,'code'=>$code]);
}
