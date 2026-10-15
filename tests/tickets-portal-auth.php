<?php
declare(strict_types=1);
require_once __DIR__ . '/../tickets-lib.php';
if (file_exists(__DIR__ . '/../tickets-portal-lib.php')) require_once __DIR__ . '/../tickets-portal-lib.php';
function check(bool $value,string $message):void {if(!$value)throw new RuntimeException($message);}
check(function_exists('ciarm_portal_collaborator'),'Collaborator policy is missing');
$rows=[['Correo Ciarm','Nombre','Apellido','Área','Status'],['persona@ciarm.edu.mx','Persona','Prueba','Administración','Activo']];
check(ciarm_portal_collaborator($rows,'persona@ciarm.edu.mx')['area']==='Administración','Canonical area');
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
$_SESSION['ciarm_ticket_collaborator']=[
 'email'=>'persona@ciarm.edu.mx','expires'=>time()+30,
 'person'=>['correo'=>'persona@ciarm.edu.mx','nombre'=>'Persona Prueba','area'=>'Administración']
];
check(ciarm_portal_current_collaborator(['correo'=>'persona@ciarm.edu.mx'])['area']==='Administración',
 'Cached active identity avoids an unnecessary Google read');
unset($_SESSION['ciarm_ticket_collaborator']);
session_write_close();

check(ciarm_portal_collaborator($rows,'other@ciarm.edu.mx')===null,'Unknown denied');
$duplicate=$rows;$duplicate[]=$rows[1];check(ciarm_portal_collaborator($duplicate,'persona@ciarm.edu.mx')===null,'Duplicate denied');
$inactive=$rows;$inactive[1][4]='Baja';check(ciarm_portal_collaborator($inactive,'persona@ciarm.edu.mx')===null,'Inactive denied');
check(ciarm_portal_collaborator([['Correo Ciarm','Status'],['persona@ciarm.edu.mx','Activo']],'persona@ciarm.edu.mx')===null,'Missing headers denied');
$p=ciarm_portal_payload('beginCreate',['operationId'=>'operation-12345678','correo'=>'other@ciarm.edu.mx','actor'=>'other@ciarm.edu.mx','tipo'=>'Limpieza','descripcion'=>'Pedido','prioridadSolicitada'=>'🟢 Normal','fechaProgramada'=>'','files'=>[]]);
check(!isset($p['correo'])&&!isset($p['actor']),'Client identity excluded from signed payload');
check(ciarm_portal_payload('mine',['email'=>'other@ciarm.edu.mx'])===[],'Own read cannot select actor');
check(ciarm_portal_limits(['upload_max_filesize'=>'10M','post_max_size'=>'16M','memory_limit'=>'128M']),'Limits support original files');
check(!ciarm_portal_limits(['upload_max_filesize'=>'2M','post_max_size'=>'16M','memory_limit'=>'128M']),'Unsupported limit denied');
check(ciarm_portal_limits(['upload_max_filesize'=>'10M','post_max_size'=>'16M','memory_limit'=>'-1']),'Unlimited memory accepted');
function fails(callable $action,string $code):void {try{$action();throw new RuntimeException('Expected failure '.$code);}catch(RuntimeException $e){check($e->getMessage()===$code,'Expected '.$code.' got '.$e->getMessage());}}
$tmp=tempnam(sys_get_temp_dir(),'portal-test-');
try{
 $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB6kAAAAASUVORK5CYII=');file_put_contents($tmp,$png);
 $file=['name'=>'foto.png','type'=>'evil/client-mime','tmp_name'=>$tmp,'error'=>UPLOAD_ERR_OK,'size'=>strlen($png)];
 $input=['operationId'=>'operation-12345678','index'=>'0'];
 $upload=ciarm_portal_file_payload($file,$input);
 check($upload['mime']==='image/png','MIME comes from actual bytes');check($upload['sha256']===hash('sha256',$png),'Digest from actual file');check(base64_decode($upload['base64'])===$png,'Bytes preserved');
 fails(fn()=>ciarm_portal_upload(['file'=>$file],$input),'VALIDATION');
 fails(fn()=>ciarm_portal_upload(['file'=>$file,'extra'=>$file],$input),'VALIDATION');
 fails(fn()=>ciarm_portal_file_payload([...$file,'error'=>UPLOAD_ERR_INI_SIZE],$input),'PAYLOAD_SIZE');
 fails(fn()=>ciarm_portal_file_payload([...$file,'size'=>strlen($png)+1],$input),'VALIDATION');
 fails(fn()=>ciarm_portal_file_payload([...$file,'name'=>'../foto.png'],$input),'VALIDATION');
 file_put_contents($tmp,'<?php echo "bad";');clearstatcache(true,$tmp);
 fails(fn()=>ciarm_portal_file_payload([...$file,'size'=>filesize($tmp)],$input),'CONTENT_TYPE');
 file_put_contents($tmp,$png.str_repeat("\0",10*1024*1024-strlen($png)));clearstatcache(true,$tmp);
 check(ciarm_portal_file_payload([...$file,'size'=>filesize($tmp)],$input)['size']===10*1024*1024,'Maximum file size preserved');
 file_put_contents($tmp,"\0",FILE_APPEND);clearstatcache(true,$tmp);
 fails(fn()=>ciarm_portal_file_payload([...$file,'size'=>filesize($tmp)],$input),'PAYLOAD_SIZE');
}finally{unlink($tmp);}
echo "PHP collaborator, identity, upload, MIME and limits checks passed\n";
// Workflow payloads never accept identity/permission fields from the client.
check(ciarm_portal_payload('serviceTransition',['ticketId'=>'TKT-1','event'=>'START','actor'=>'fake','correo'=>'fake','canAdmin'=>true])===['ticketId'=>'TKT-1','event'=>'START'],'Workflow cannot impersonate actor');
check(ciarm_portal_payload('serviceSettings',['actor'=>'fake'])===[],'Settings cannot select actor');
