<?php
declare(strict_types=1);
require_once __DIR__ . '/tickets-lib.php';

function ciarm_portal_collaborator(array $rows,string $email): ?array {
    $email=strtolower(trim($email));
    if(!preg_match('/^[a-z0-9][a-z0-9._+\-]*@ciarm\.edu\.mx$/',$email)||count($rows)<2)return null;
    $headers=array_map(static fn($v)=>trim((string)$v),$rows[0]);$columns=[];
    foreach(['Correo Ciarm','Nombre','Apellido','Área','Status'] as $header){$matches=array_keys($headers,$header,true);if(count($matches)!==1)return null;$columns[$header]=$matches[0];}
    $matches=array_values(array_filter(array_slice($rows,1),static fn($r)=>strtolower(trim((string)($r[$columns['Correo Ciarm']]??'')))===$email));
    if(count($matches)!==1||strtolower(trim((string)($matches[0][$columns['Status']]??'')))!=='activo')return null;
    $r=$matches[0];return ['correo'=>$email,'nombre'=>trim(($r[$columns['Nombre']]??'').' '.($r[$columns['Apellido']]??'')),'area'=>trim((string)($r[$columns['Área']]??''))];
}
function ciarm_portal_current_collaborator(array $user): array {
    // Resuelve identidad en DM03 una vez por sesión durante un intervalo corto:
    // no vuelve a intercambiar un JWT OAuth ni a leer toda la tabla en cada clic.
    // Las autorizaciones DM05 se siguen verificando de forma independiente.
    $email = strtolower(trim((string)($user['correo'] ?? '')));
    if ($email === '') throw new RuntimeException('FORBIDDEN');
    $cached = $_SESSION['ciarm_ticket_collaborator'] ?? null;
    if (session_status() === PHP_SESSION_ACTIVE && is_array($cached)
        && ($cached['email'] ?? '') === $email
        && (int)($cached['expires'] ?? 0) > time()
        && is_array($cached['person'] ?? null)) {
        return $cached['person'];
    }
    $raw=@file_get_contents(ciarm_private_path('service-account.json'));if($raw===false)throw new RuntimeException('CONFIGURATION');
    $account=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($account))throw new RuntimeException('CONFIGURATION');
    $response=ciarm_http_json('https://sheets.googleapis.com/v4/spreadsheets/'.CIARM_DM03_SPREADSHEET_ID.'/values/'.rawurlencode(CIARM_DM03_RANGE),['headers'=>['Accept: application/json','Authorization: Bearer '.ciarm_google_access_token($account)]]);
    if($response['status']!==200)throw new RuntimeException('UPSTREAM');
    $person=ciarm_portal_collaborator($response['body']['values']??[],$email);
    if($person===null)throw new RuntimeException('FORBIDDEN');
    if(session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION['ciarm_ticket_collaborator']=[
            'email'=>$email, 'expires'=>time()+45, 'person'=>$person
        ];
    }
    return $person;
}
function ciarm_portal_ini_bytes(string $value): int {
    $value=trim($value);if($value==='-1')return -1;
    if(!preg_match('/^(\d+)\s*([KMG])?$/i',$value,$m))return 0;
    return (int)$m[1]*(match(strtoupper($m[2]??'')){'K'=>1024,'M'=>1024**2,'G'=>1024**3,default=>1});
}
function ciarm_portal_limits(array $ini): bool {
    $memory=ciarm_portal_ini_bytes((string)($ini['memory_limit']??'0'));
    return ciarm_portal_ini_bytes((string)($ini['upload_max_filesize']??'0'))>=10*1024*1024&&ciarm_portal_ini_bytes((string)($ini['post_max_size']??'0'))>=16*1024*1024&&($memory===-1||$memory>=128*1024*1024);
}
function ciarm_portal_upload_supported(): bool {
    return class_exists('finfo')&&class_exists('ZipArchive')&&ciarm_portal_limits(['upload_max_filesize'=>ini_get('upload_max_filesize'),'post_max_size'=>ini_get('post_max_size'),'memory_limit'=>ini_get('memory_limit')]);
}
function ciarm_portal_context(array $user): array {
    ciarm_portal_current_collaborator($user);
    $cap=ciarm_portal_bridge($user,'capabilities',[]);
    if(($cap['ok']??false)!==true||($cap['data']['protocol']??'')!=='tickets-portal-v1')throw new RuntimeException('CONFIGURATION');
    if(empty($_SESSION['ciarm_ticket_csrf']))$_SESSION['ciarm_ticket_csrf']=bin2hex(random_bytes(32));
    return ['canCreate'=>true,'csrfToken'=>$_SESSION['ciarm_ticket_csrf'],'canUpload'=>ciarm_portal_upload_supported(),'serviceAvailable'=>($cap['data']['serviceProtocol']??'')==='tickets-service-v1'];
}
function ciarm_portal_payload(string $action,array $input): array {
    $keys=match($action){'mine','capabilities','serviceContext','serviceSettings'=>[],'serviceDetail'=>['id'],'serviceList'=>['kind'],'saveServicePolicy'=>['operationId','expectedVersion','policy'],'serviceTransition'=>['operationId','ticketId','expectedVersion','event','comment','priority','dependency','followAt','evidence','commitment'],'beginCreate'=>['operationId','tipo','descripcion','prioridadSolicitada','fechaProgramada','files'],'creationStatus','finalizeCreate'=>['operationId'],default=>throw new RuntimeException('VALIDATION')};
    return array_intersect_key($input,array_flip($keys));
}
function ciarm_portal_file_payload(array $file,array $input): array {
    if(($file['error']??-1)!==UPLOAD_ERR_OK)throw new RuntimeException(in_array($file['error']??-1,[UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE],true)?'PAYLOAD_SIZE':'VALIDATION');
    $id=$input['operationId']??'';$index=$input['index']??'';$name=$file['name']??'';$path=$file['tmp_name']??'';
    if(!is_string($id)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9-]{15,79}$/',$id)||!is_string($index)||!preg_match('/^[0-4]$/',$index)||!is_string($name)||trim($name)===''||strlen($name)>255||preg_match('/[\x00-\x1f\\\\\/]/',$name)||!is_string($path)||!is_file($path))throw new RuntimeException('VALIDATION');
    clearstatcache(true,$path);$size=filesize($path);if($size===false||$size<1||$size>10*1024*1024)throw new RuntimeException('PAYLOAD_SIZE');
    if(!is_int($file['size']??null)||$file['size']!==$size)throw new RuntimeException('VALIDATION');
    if(!class_exists('finfo'))throw new RuntimeException('CONFIGURATION');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);$extension=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    if($extension==='docx'&&in_array($mime,['application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],true)){
        if(!class_exists('ZipArchive'))throw new RuntimeException('CONFIGURATION');
        $zip=new ZipArchive();if($zip->open($path)!==true)throw new RuntimeException('CONTENT_TYPE');
        $valid=$zip->locateName('[Content_Types].xml')!==false&&$zip->locateName('word/document.xml')!==false;$zip->close();if(!$valid)throw new RuntimeException('CONTENT_TYPE');
        $mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    $allowed=is_string($mime)&&((str_starts_with($mime,'image/'))||($mime==='application/pdf'&&$extension==='pdf')||($mime==='application/msword'&&$extension==='doc')||($mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&$extension==='docx'));
    if(!$allowed)throw new RuntimeException('CONTENT_TYPE');
    $bytes=file_get_contents($path);if($bytes===false)throw new RuntimeException('VALIDATION');
    return ['operationId'=>$id,'index'=>(int)$index,'name'=>$name,'mime'=>$mime,'size'=>$size,'sha256'=>hash('sha256',$bytes),'base64'=>base64_encode($bytes)];
}
function ciarm_portal_upload(array $files,array $input): array {
    if(array_keys($files)!==['file']||!is_array($files['file'])||!is_string($files['file']['tmp_name']??null)||!is_uploaded_file($files['file']['tmp_name']))throw new RuntimeException('VALIDATION');
    if(!ciarm_portal_upload_supported())throw new RuntimeException('CONFIGURATION');
    return ciarm_portal_file_payload($files['file'],$input);
}
function ciarm_portal_bridge(array $user,string $action,array $payload): array {
    $secret=@file_get_contents(ciarm_private_path('tickets-admin.key'));if($secret===false||strlen(trim($secret))<32)throw new RuntimeException('CONFIGURATION');
    $signed=ciarm_ticket_envelope($user,$action,$payload,trim($secret));$limit=$action==='uploadAttachment'?15*1024*1024:50000;
    if(strlen($signed['envelope'])>$limit)throw new RuntimeException('PAYLOAD_SIZE');
    $response=ciarm_http_json(CIARM_TICKETS_WEBAPP,['post'=>true,'headers'=>['Accept: application/json','Content-Type: application/json'],'body'=>json_encode($signed,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),'timeout'=>in_array($action,['uploadAttachment','finalizeCreate'],true)?60:25]);
    if($response['status']!==200||!is_bool($response['body']['ok']??null))throw new RuntimeException('UPSTREAM');return $response['body'];
}
