<?php
 declare(strict_types=1);
require_once __DIR__ . '/tickets-portal-lib.php';
$user=ciarm_session_user();
if($user===null)ciarm_json_response(401,['ok'=>false,'code'=>'UNAUTHENTICATED']);
$method=$_SERVER['REQUEST_METHOD']??'';
if(!in_array($method,['GET','POST'],true))ciarm_json_response(405,['ok'=>false,'code'=>'METHOD']);
function ticket_http_status(string $code): int {
 return match($code){'FORBIDDEN','ORIGIN','CSRF'=>403,'NOT_FOUND'=>404,'CONFLICT','OPERATION_REUSED','PENDING_OPERATION','DUPLICATE_ID'=>409,'PAYLOAD_SIZE'=>413,'CONTENT_TYPE'=>415,'VALIDATION'=>422,'BUSY','CONFIGURATION'=>503,default=>502};
}
try {
 if($method==='GET'){
  $action=$_GET['action']??'';if(!is_string($action))throw new RuntimeException('VALIDATION');
  if($action==='context')ciarm_json_response(200,['ok'=>true,'data'=>ciarm_ticket_context($user)]);
  if($action==='selfContext')ciarm_json_response(200,['ok'=>true,'data'=>ciarm_portal_context($user)]);
  if(!in_array($action,['mine','creationStatus','list','catalogs','detail'],true))throw new RuntimeException('VALIDATION');
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
  if(!is_string($action)||!in_array($action,['assign','beginCreate','uploadAttachment','finalizeCreate'],true))throw new RuntimeException('VALIDATION');
  if(($action==='uploadAttachment')!==($contentType==='multipart/form-data'))throw new RuntimeException('CONTENT_TYPE');
  if(!ciarm_ticket_csrf_valid((string)($_SESSION['ciarm_ticket_csrf']??''),is_string($input['csrfToken']??null)?$input['csrfToken']:''))throw new RuntimeException('CSRF');
 }
 $selfService=in_array($action,['mine','creationStatus','beginCreate','uploadAttachment','finalizeCreate'],true);
 if($selfService){
  ciarm_portal_current_collaborator($user);
  $payload=$action==='uploadAttachment'?ciarm_portal_upload($_FILES,$input):ciarm_portal_payload($action,$input);
 } else {
  if(!ciarm_ticket_current_permission($user))throw new RuntimeException('FORBIDDEN');
  if($action==='assign')$payload=array_intersect_key($input,array_flip(['operationId','ticketId','expectedVersion','changes']));
  else $payload=$action==='detail'?['id'=>$input['id']??null]:[];
  if($action==='detail'&&!is_string($payload['id']))throw new RuntimeException('VALIDATION');
 }
 session_write_close();
 $result=$selfService?ciarm_portal_bridge($user,$action,$payload):ciarm_ticket_bridge($user,$action,$payload);
 ciarm_json_response(($result['ok']??false)===true?200:ticket_http_status((string)($result['code']??'')),$result);
} catch(JsonException $error){ciarm_json_response(422,['ok'=>false,'code'=>'VALIDATION']);}
catch(Throwable $error){
 $code=in_array($error->getMessage(),['FORBIDDEN','ORIGIN','CSRF','VALIDATION','PAYLOAD_SIZE','CONTENT_TYPE','CONFIGURATION'],true)?$error->getMessage():'UPSTREAM';
 ciarm_json_response(ticket_http_status($code),['ok'=>false,'code'=>$code]);
}
