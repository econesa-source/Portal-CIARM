<?php
declare(strict_types=1);
require_once __DIR__ . '/compras-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Vary: Origin');

function compras_result(int $status,array $result): never {
  http_response_code($status);
  echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
  exit;
}
$config=ciarm_compras_config();
$expected=(string)($config['origin']??'');
$origin=(string)($_SERVER['HTTP_ORIGIN']??'');
$expectedHost=(string)(parse_url($expected,PHP_URL_HOST)?:'');
$currentHost=strtolower((string)($_SERVER['HTTP_HOST']??''));
$currentHost=explode(':',$currentHost,2)[0];
$fetchSite=(string)($_SERVER['HTTP_SEC_FETCH_SITE']??'');
$method=(string)($_SERVER['REQUEST_METHOD']??'');
// El navegador no siempre envía Origin en solicitudes GET del mismo origen.
// La sesión y permisos se verifican también en GET; para POST exigimos Origin + CSRF.
if($expected===''||!preg_match('~^https://[a-z0-9.-]+\.ciarm\.edu\.mx$~i',$expected)||
   !hash_equals(strtolower($expectedHost),$currentHost)||
   ($origin!==''&&!hash_equals($expected,$origin))||
   ($method==='POST'&&!hash_equals($expected,$origin))||
   ($fetchSite!==''&&!in_array($fetchSite,['same-origin','none'],true))){
  compras_result(403,['ok'=>false,'version'=>'compras-v1','code'=>'FORBIDDEN']);
}
header('Access-Control-Allow-Origin: '.$expected);
header('Access-Control-Allow-Credentials: true');
if($method==='OPTIONS'){
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Max-Age: 300');
  http_response_code(204);exit;
}
if(!in_array($method,['GET','POST'],true))
  compras_result(405,['ok'=>false,'version'=>'compras-v1','code'=>'METHOD_NOT_ALLOWED']);
if(!ciarm_compras_config_valid($config) || ($method==='POST'&&!ciarm_compras_writes_enabled($config)))
  compras_result(503,['ok'=>false,'version'=>'compras-v1','code'=>'SERVICE_UNAVAILABLE']);

$user=ciarm_session_user();
if(!is_array($user))compras_result(401,['ok'=>false,'version'=>'compras-v1','code'=>'UNAUTHENTICATED']);
$phase='PARSE';
try{
  if($method==='GET'){
    $action=$_GET['action']??null;$payload=[];
  }else{
    $data=ciarm_compras_request_body();
    if(!is_array($data)||array_is_list($data)||array_diff(array_keys($data),['action','payload','csrfToken'])!==[])
      throw new RuntimeException('INVALID_REQUEST');
    $action=$data['action']??null;$payload=$data['payload']??null;
    if(!is_string($data['csrfToken']??null)||!hash_equals(ciarm_compras_csrf_token(),$data['csrfToken']))
      throw new RuntimeException('FORBIDDEN');
  }
  if(!is_string($action)||!isset(ciarm_compras_actions()[$action])||!is_array($payload)||
      ($payload!==[]&&array_is_list($payload)))throw new RuntimeException('INVALID_REQUEST');
  $phase='PERMISSION';
  ciarm_compras_require_permission($user,$action,$method);
  $phase='VALIDATION';
  $payload=ciarm_compras_shape($action,$payload);
  $csrf=ciarm_compras_csrf_token();
  session_write_close();
  $phase='TRANSPORT';
  $reply=ciarm_compras_forward($user,$action,$payload);
  if(($reply['ok']??false)!==true){
    $code=(string)($reply['code']??'UPSTREAM_ERROR');
    $allowed=['INVALID_REQUEST','REPLAY','SERVICE_UNAVAILABLE'];
    if(!in_array($code,$allowed,true))$code='UPSTREAM_ERROR_GAS';
    $status=$code==='INVALID_REQUEST'?422:($code==='REPLAY'?409:503);
    compras_result($status,['ok'=>false,'version'=>'compras-v1','code'=>$code]);
  }
  $data=ciarm_compras_public_data($action,$reply['data']??null);
  $result=['ok'=>true,'version'=>'compras-v1','data'=>$data];
  if($method==='GET')$result['csrfToken']=$csrf;
  compras_result(200,$result);
}catch(Throwable $e){
  $code=$e->getMessage();
  $allowed=['INVALID_REQUEST'=>422,'FORBIDDEN'=>403,'UNAUTHENTICATED'=>401,
    'SERVICE_UNAVAILABLE'=>503];
  if(!isset($allowed[$code])){
    $transportCodes=['upstream_unreachable'=>'UPSTREAM_UNREACHABLE','upstream_invalid_json'=>'UPSTREAM_INVALID_JSON'];
    $code=$transportCodes[$code]??('UPSTREAM_ERROR_'.$phase);
  }
  compras_result($allowed[$code]??502,['ok'=>false,'version'=>'compras-v1','code'=>$code]);
}
