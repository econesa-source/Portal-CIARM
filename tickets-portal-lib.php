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
    $keys=match($action){'mine','capabilities','serviceContext','serviceSettings'=>[],'serviceDetail'=>['id'],'serviceList','serviceListRaw'=>['kind'],'saveServicePolicy'=>['operationId','expectedVersion','policy'],'serviceTransition'=>['operationId','ticketId','expectedVersion','event','comment','priority','dependency','followAt','evidence','commitment'],'beginCreate'=>['operationId','tipo','descripcion','prioridadSolicitada','fechaProgramada','files'],'creationStatus','finalizeCreate'=>['operationId'],default=>throw new RuntimeException('VALIDATION')};
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
function ciarm_portal_bridge(array $user,string $action,array $payload,bool $perfProbe=false): array {
    $secret=@file_get_contents(ciarm_private_path('tickets-admin.key'));if($secret===false||strlen(trim($secret))<32)throw new RuntimeException('CONFIGURATION');
    $signed=ciarm_ticket_envelope($user,$action,$payload,trim($secret),null,null,$perfProbe);$limit=in_array($action,['uploadAttachment','uploadEvidence'],true)?15*1024*1024:50000;
    if(strlen($signed['envelope'])>$limit)throw new RuntimeException('PAYLOAD_SIZE');
    $webapp=function_exists('ciarm_tickets_active_webapp')?ciarm_tickets_active_webapp():CIARM_TICKETS_WEBAPP;
    $response=ciarm_http_json($webapp,['post'=>true,'headers'=>['Accept: application/json','Content-Type: application/json'],'body'=>json_encode($signed,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),'timeout'=>in_array($action,['uploadAttachment','uploadEvidence','finalizeCreate'],true)?60:25]);
    if($response['status']!==200||!is_bool($response['body']['ok']??null))throw new RuntimeException('UPSTREAM');return $response['body'];
}

function ciarm_upload_evidence_to_drive(array $file, array $user): array {
    $path=(string)($file['tmp_name']??'');
    if(!is_uploaded_file($path))throw new RuntimeException('VALIDATION');
    $originalName=basename((string)($file['name']??'evidencia.jpg'));
    $cleanName=preg_replace('/[^\w.-]/','_',$originalName);
    if(strlen($cleanName)>100)$cleanName=substr($cleanName,-100);
    $fileName='evidencia_'.date('Ymd_His').'_'.$cleanName;
    $finfo=new finfo(FILEINFO_MIME_TYPE);
    $mime=$finfo->file($path)?:'application/octet-stream';
    $fileBytes=file_get_contents($path);
    if($fileBytes===false)throw new RuntimeException('VALIDATION');

    try {
        $gasPayload=['name'=>$cleanName,'mime'=>$mime,'size'=>strlen($fileBytes),'base64'=>base64_encode($fileBytes)];
        $gasRes=ciarm_portal_bridge($user,'uploadEvidence',$gasPayload);
        if(($gasRes['ok']??false)===true&&is_array($gasRes['data']??null)&&!empty($gasRes['data']['url'])){
            return $gasRes['data'];
        }
    } catch(Throwable $gasErr) {
        error_log('GAS uploadEvidence fallback: '.$gasErr->getMessage());
    }

    $raw=@file_get_contents(ciarm_private_path('service-account.json'));
    if($raw===false)throw new RuntimeException('CONFIGURATION');
    $account=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    if(!is_array($account))throw new RuntimeException('CONFIGURATION');
    $token=ciarm_google_access_token($account,'https://www.googleapis.com/auth/drive');
    $folderId='103wSYfCuSwVKW_aTbTFr2O7b-JyuT619';
    $metadata=['name'=>$fileName,'parents'=>[$folderId],'description'=>'Evidencia subida por '.($user['correo']??'colaborador')];
    $boundary='-------314159265358979323846';
    $delimiter="\r\n--".$boundary."\r\n";
    $closeDelim="\r\n--".$boundary."--";
    $multipartBody=$delimiter."Content-Type: application/json; charset=UTF-8\r\n\r\n".json_encode($metadata).$delimiter."Content-Type: ".$mime."\r\n\r\n".$fileBytes.$closeDelim;
    $uploadRes=ciarm_http_json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',[
        'post'=>true,
        'headers'=>['Authorization: Bearer '.$token,'Content-Type: multipart/related; boundary='.$boundary,'Content-Length: '.strlen($multipartBody)],
        'body'=>$multipartBody,
        'timeout'=>45
    ]);
    if($uploadRes['status']<200||$uploadRes['status']>=300||empty($uploadRes['body']['id'])){
        $metadataNoParent=['name'=>$fileName,'description'=>'Evidencia subida por '.($user['correo']??'colaborador')];
        $multipartBodyNoParent=$delimiter."Content-Type: application/json; charset=UTF-8\r\n\r\n".json_encode($metadataNoParent).$delimiter."Content-Type: ".$mime."\r\n\r\n".$fileBytes.$closeDelim;
        $uploadRes=ciarm_http_json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',[
            'post'=>true,
            'headers'=>['Authorization: Bearer '.$token,'Content-Type: multipart/related; boundary='.$boundary,'Content-Length: '.strlen($multipartBodyNoParent)],
            'body'=>$multipartBodyNoParent,
            'timeout'=>45
        ]);
        if($uploadRes['status']<200||$uploadRes['status']>=300||empty($uploadRes['body']['id']))throw new RuntimeException('UPSTREAM');
    }
    $fileId=(string)$uploadRes['body']['id'];
    @ciarm_http_json('https://www.googleapis.com/drive/v3/files/'.$fileId.'/permissions',[
        'post'=>true,
        'headers'=>['Authorization: Bearer '.$token,'Content-Type: application/json'],
        'body'=>json_encode(['role'=>'reader','type'=>'anyone']),
        'timeout'=>10
    ]);
    $url=$uploadRes['body']['webViewLink']??('https://drive.google.com/file/d/'.$fileId.'/view');
    return ['url'=>$url,'name'=>$fileName,'id'=>$fileId];
}

function ciarm_ticket_resolve_admins_php(?array $policy): array {
    $emails=[];$seen=[];
    $add=static function(mixed $raw) use (&$emails,&$seen): void {
        $email=strtolower(trim((string)($raw??'')));
        if($email!==''&&filter_var($email,FILTER_VALIDATE_EMAIL)&&!isset($seen[$email])){
            $seen[$email]=true;$emails[]=$email;
        }
    };
    if(is_array($policy['admins']??null)&&count($policy['admins'])>0){
        foreach($policy['admins'] as $a){
            $add(is_string($a)?$a:($a['email']??''));
        }
        if(count($emails)>0)return $emails;
    }
    if(is_array($policy['responsibles']??null)){
        foreach($policy['responsibles'] as $r){
            $em=strtolower(trim((string)($r['email']??'')));
            if($em!==''&&(($r['admin']??false)===true||in_array($em,['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx','r.valencia@ciarm.edu.mx'],true))){
                $add($em);
            }
        }
    }
    foreach(['d.lara@ciarm.edu.mx','e.conesa@ciarm.edu.mx','r.valencia@ciarm.edu.mx'] as $defaultAdmin){
        $add($defaultAdmin);
    }
    return $emails;
}

function ciarm_ticket_resolve_executor_php(array $ticket, ?array $meta, ?array $policy): ?string {
    $direct=strtolower(trim((string)($meta['email']??'')));
    if($direct!==''&&filter_var($direct,FILTER_VALIDATE_EMAIL))return $direct;
    if(is_array($meta['stageOwners']??null)){
        foreach(['resolve','contain','start'] as $st){
            $stEmail=strtolower(trim((string)($meta['stageOwners'][$st]??'')));
            if($stEmail!==''&&filter_var($stEmail,FILTER_VALIDATE_EMAIL))return $stEmail;
        }
    }
    $resp=trim((string)($ticket['responsable']??''));
    if($resp===''||strtoupper($resp)==='SIN ASIGNAR')return null;
    $cleanResp=strtolower(trim((string)preg_replace('/^PRUEBA\s*[\x{2014}\x{2013}-]\s*/iu','',$resp)));
    if(is_array($policy['responsibles']??null)){
        foreach($policy['responsibles'] as $r){
            $rEmail=strtolower(trim((string)($r['email']??'')));
            $rName=trim((string)($r['name']??''));
            if($rEmail===''||$rName==='')continue;
            $cleanRName=strtolower(trim((string)preg_replace('/^PRUEBA\s*[\x{2014}\x{2013}-]\s*/iu','',$rName)));
            if(strtolower($rName)===strtolower($resp)||$cleanRName===$cleanResp||$cleanRName===strtolower($resp))return $rEmail;
        }
    }
    if($cleanResp==='daniel lara')return 'd.lara@ciarm.edu.mx';
    if($cleanResp==='ezequiel conesa')return 'e.conesa@ciarm.edu.mx';
    if($cleanResp==='rodrigo valencia')return 'r.valencia@ciarm.edu.mx';
    return null;
}

function ciarm_ticket_build_notification_plan_php(string $ev, array $t, ?array $meta, ?array $policy, array $input): ?array {
    $ownerRaw=strtolower(trim((string)($t['correo']??'')));
    $ownerEmail=($ownerRaw!==''&&filter_var($ownerRaw,FILTER_VALIDATE_EMAIL))?$ownerRaw:null;
    $execEmail=ciarm_ticket_resolve_executor_php($t,$meta,$policy);
    $adminEmails=ciarm_ticket_resolve_admins_php($policy);
    $waitReq=$meta['waitRequest']??null;
    if(!is_array($waitReq)&&is_array($meta['waits']??null)&&count($meta['waits'])>0){
        $lastWait=$meta['waits'][count($meta['waits'])-1];
        $waitReq=$lastWait['request']??null;
    }
    $dependency=trim((string)($input['dependency']??($waitReq['dependency']??'')));
    $followAt=trim((string)($input['followAt']??($waitReq['followAt']??'')));
    $comment=trim((string)($input['comment']??($input['changes']['observacion']??($ev==='ASSIGN'?($t['observaciones']??''):''))));
    $evidence=(is_array($input['evidence']??null)&&count($input['evidence'])>0)?$input['evidence']:(is_array($meta['evidence']??null)?$meta['evidence']:[]);
    $baseUrl=function_exists('ciarm_tickets_active_base_url')?rtrim(ciarm_tickets_active_base_url(),'/'):'https://portal2.ciarm.edu.mx';
    $messages=[];$skipped=[];$seen=[];
    $enqueue=static function(string $role,?string $to,string $subject,string $heading,string $intro,string $ctaLabel,string $ctaHash) use (&$messages,&$skipped,&$seen,$t,$comment,$dependency,$followAt,$evidence,$baseUrl): void {
        if($to===null||trim($to)===''){
            $skipped[]=['role'=>$role,'reason'=>'SIN_CORREO_'.strtoupper($role),'target'=>$role==='responsable'?($t['responsable']??'SIN ASIGNAR'):''];
            return;
        }
        $norm=strtolower(trim($to));
        $seenKey=$role.':'.$norm;
        if(isset($seen[$seenKey])){
            $skipped[]=['role'=>$role,'reason'=>'DESTINATARIO_DUPLICADO','target'=>$norm];
            return;
        }
        $seen[$seenKey]=true;
        $messages[]=[
            'role'=>$role,'to'=>$norm,'subject'=>$subject,'heading'=>$heading,'intro'=>$intro,
            'ctaLabel'=>$ctaLabel,'ctaUrl'=>$baseUrl.'/'.$ctaHash,
            'comment'=>$comment,'dependency'=>$dependency,'followAt'=>$followAt,'evidence'=>$evidence
        ];
    };
    $id=(string)($t['id']??'');$tipo=(string)($t['tipo']??'');$sol=(string)($t['solicitante']??'');
    $area=(string)($t['area']??'');$resp=(string)($t['responsable']??'SIN ASIGNAR');
    $prio=(string)($t['prioridad']??'POR DEFINIR');$comp=(string)($t['fechaCompromiso']??'por definir');
    $est=(string)($t['estado']??'');
    switch($ev){
        case 'CREATE':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud recibida {$id} ({$tipo})",'Hemos recibido tu solicitud',"Tu solicitud ha sido registrada con el folio {$id} en estado NUEVO y fue turnada a Administración para su clasificación y asignación.",'Ver mis solicitudes','#validar-solicitudes');
            foreach($adminEmails as $adm){
                $enqueue('admin',$adm,"[Portal CIARM] Nueva solicitud por asignar {$id} — {$tipo}",'Nueva solicitud pendiente de asignación',"Se ha registrado la solicitud {$id} de {$sol} ({$area}) en estado NUEVO. Ingresa al panel para asignarla.",'Asignar solicitud','#admin-solicitudes');
            }
            break;
        case 'ASSIGN':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud asignada {$id} ({$est})",'Tu solicitud ha sido asignada',"La solicitud {$id} fue asignada a {$resp} con prioridad {$prio} y fecha compromiso ".($comp!==''?$comp:'por definir').'.','Dar seguimiento','#validar-solicitudes');
            $enqueue('responsable',$execEmail,"[Portal CIARM] Nueva tarea asignada {$id} — Prioridad {$prio}",'Tienes una solicitud asignada',"Se te ha asignado la solicitud {$id} ({$tipo}) solicitada por {$sol} ({$area}), con prioridad {$prio} y fecha compromiso ".($comp!==''?$comp:'por definir').'.','Gestionar mis tareas','#mis-tareas');
            break;
        case 'START':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud en proceso {$id}",'Tu solicitud está siendo atendida',"El responsable {$resp} ha iniciado la atención de tu solicitud {$id}, cambiando su estado a EN PROCESO.",'Ver seguimiento','#validar-solicitudes');
            break;
        case 'CONTAIN':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Contención registrada en solicitud {$id}",'Avance de contención en tu solicitud',"El responsable {$resp} registró una acción de contención para tu solicitud {$id} ({$est}).",'Ver seguimiento','#validar-solicitudes');
            break;
        case 'WAIT_REQUEST':
            foreach($adminEmails as $adm){
                $enqueue('admin',$adm,"[Portal CIARM] Solicitud de pausa por autorizar {$id}",'Solicitud de espera pendiente de autorización',"El responsable {$resp} solicitó poner en espera la solicitud {$id} por dependencia: ".($dependency!==''?$dependency:'No especificada').'. Requiere autorización administrativa para pausar el SLA.','Revisar y autorizar','#seguimiento-servicio');
            }
            break;
        case 'WAIT_APPROVE':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud en espera {$id}",'Tu solicitud se encuentra en espera',"Tu solicitud {$id} cambió al estado EN ESPERA debido a la dependencia: ".($dependency!==''?$dependency:'Externa').'. Próximo seguimiento programado: '.($followAt!==''?$followAt:'por definir').'.','Ver detalle','#validar-solicitudes');
            $enqueue('responsable',$execEmail,"[Portal CIARM] Pausa autorizada en tarea {$id} (EN ESPERA)",'Espera autorizada por Administración',"Se ha autorizado la pausa de la solicitud {$id} (EN ESPERA). El reloj de nivel de servicio permanece pausado hasta su reanudación.",'Ver mis tareas','#mis-tareas');
            break;
        case 'RESUME':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Atención reanudada en solicitud {$id}",'Se reanudó la atención de tu solicitud',"La atención de tu solicitud {$id} ha sido reanudada y se encuentra nuevamente EN PROCESO.",'Ver seguimiento','#validar-solicitudes');
            $enqueue('responsable',$execEmail,"[Portal CIARM] Tarea reanudada {$id} (EN PROCESO)",'Tarea reactivada para atención',"Administración ha reanudado la solicitud {$id}, regresando al estado EN PROCESO.",'Ir a mis tareas','#mis-tareas');
            break;
        case 'RESOLVE':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud resuelta {$id} — Pendiente de tu validación",'Tu solicitud ha sido marcada como resuelta',"El responsable {$resp} marcó tu solicitud {$id} como RESUELTO. Por favor ingresa al portal para validar la entrega (Conforme — cerrar o Disconforme — devolver).",'Validar mi solicitud','#validar-solicitudes');
            foreach($adminEmails as $adm){
                $enqueue('admin',$adm,"[Portal CIARM] Solicitud resuelta por validar {$id}",'Solicitud en espera de validación del solicitante',"El responsable {$resp} marcó la solicitud {$id} como RESUELTO. Queda pendiente la validación de conformidad por parte de {$sol}.",'Ver cumplimiento','#seguimiento-servicio');
            }
            break;
        case 'ACCEPT':
            $enqueue('solicitante',$ownerEmail,"[Portal CIARM] Solicitud cerrada con conformidad {$id}",'Tu solicitud ha sido cerrada',"Se registró tu validación de conformidad y la solicitud {$id} ha quedado concluida en estado CERRADO.",'Ver mis solicitudes','#validar-solicitudes');
            $enqueue('responsable',$execEmail,"[Portal CIARM] Conformidad confirmada en tarea {$id} (CERRADO)",'El solicitante validó tu entrega con conformidad',"El solicitante {$sol} aceptó la solución de la solicitud {$id}, quedando formalmente en estado CERRADO.",'Ver historial de tareas','#historial-tareas');
            foreach($adminEmails as $adm){
                $enqueue('admin',$adm,"[Portal CIARM] Cierre definitivo de solicitud {$id} (CERRADO)",'Solicitud cerrada con conformidad',"El solicitante {$sol} confirmó la resolución de la solicitud {$id} atendida por {$resp}, pasando a estado CERRADO.",'Ver cumplimiento','#seguimiento-servicio');
            }
            break;
        case 'REJECT':
            $enqueue('responsable',$execEmail,"[Portal CIARM] Solicitud devuelta por disconformidad {$id} (ASIGNADO)",'Solicitud reabierta por disconformidad del solicitante',"El solicitante {$sol} devolvió la solicitud {$id} indicando disconformidad. La tarea regresa al estado ASIGNADO para su atención.",'Atender en mis tareas','#mis-tareas');
            foreach($adminEmails as $adm){
                $enqueue('admin',$adm,"[Portal CIARM] Alerta de devolución en solicitud {$id} (ASIGNADO)",'Devolución por disconformidad registrada',"El solicitante {$sol} rechazó la resolución de la solicitud {$id} asignada a {$resp}. El ticket regresó al estado ASIGNADO.",'Ver cumplimiento','#seguimiento-servicio');
            }
            break;
        default:
            return null;
    }
    return ['messages'=>$messages,'skipped'=>$skipped];
}

function ciarm_ticket_render_email_php(array $msg, array $t): string {
    $esc=static fn(mixed $s): string=>htmlspecialchars((string)($s??''),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $rows=[
        ['Folio',$t['id']??''],
        ['Estado actual',$t['estado']??''],
        ['Tipo de solicitud',$t['tipo']??''],
        ['Solicitante',($t['solicitante']??'').(!empty($t['area'])?' ('.$t['area'].')':'')],
        ['Responsable',!empty($t['responsable'])?$t['responsable']:'SIN ASIGNAR'],
        ['Prioridad',!empty($t['prioridad'])?$t['prioridad']:(!empty($t['urgencia'])?$t['urgencia']:'POR DEFINIR')],
        ['Fecha compromiso',!empty($t['fechaCompromiso'])?$t['fechaCompromiso']:(!empty($t['plazo'])?$t['plazo']:'Por definir')],
        ['Descripción',$t['descripcion']??'']
    ];
    if(!empty($msg['comment']))$rows[]=['Comentario / Detalle',$msg['comment']];
    if(!empty($msg['dependency']))$rows[]=['Dependencia de espera',$msg['dependency']];
    if(!empty($msg['followAt']))$rows[]=['Próximo seguimiento',$msg['followAt']];
    $htmlRows='';
    foreach($rows as $r){
        $htmlRows.='<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;width:36%;">'.$esc($r[0]).'</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">'.$esc($r[1]).'</td></tr>';
    }
    $htmlEvidence='';
    if(!empty($msg['evidence'])&&is_array($msg['evidence'])){
        $items='';
        foreach($msg['evidence'] as $idx=>$u){
            $items.='<li><a href="'.$esc($u).'" style="color:#1d4ed8;">Evidencia '.($idx+1).'</a></li>';
        }
        $htmlEvidence='<p style="margin:14px 0 6px;font-weight:600;color:#334155;">Evidencia adjunta:</p><ul style="margin:0 0 16px;padding-left:20px;">'.$items.'</ul>';
    }
    return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#ffffff;">'
        .'<div style="background:#0f172a;color:#ffffff;padding:16px 20px;"><span style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Portal CIARM · Gestión de Solicitudes</span><h2 style="margin:6px 0 0;font-size:18px;">'.$esc($msg['heading']).'</h2></div>'
        .'<div style="padding:20px;"><p style="margin:0 0 16px;color:#1e293b;line-height:1.5;">'.$esc($msg['intro']).'</p>'
        .'<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">'.$htmlRows.'</table>'
        .$htmlEvidence
        .'<div style="margin-top:20px;"><a href="'.$esc($msg['ctaUrl']).'" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">'.$esc($msg['ctaLabel']).'</a></div>'
        .'</div><div style="background:#f8fafc;padding:12px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">Notificación automática del Sistema de Solicitudes CIARM ('.$esc($t['id']??'').').</div></div>';
}

function ciarm_ticket_smtp_read($fp): string {
    $data='';
    while(!feof($fp)){
        $line=fgets($fp,515);
        if($line===false)break;
        $data.=$line;
        if(isset($line[3])&&$line[3]===' ')break;
    }
    return $data;
}

function ciarm_ticket_smtp_cmd($fp, string $cmd, array $expectCodes = [250]): array {
    fwrite($fp,$cmd."\r\n");
    $resp=ciarm_ticket_smtp_read($fp);
    $code=(int)substr($resp,0,3);
    return ['ok'=>in_array($code,$expectCodes,true),'code'=>$code,'resp'=>trim($resp)];
}

function ciarm_ticket_send_raw_mime(string $to, string $subject, string $html, string $fromEmail = 'no-reply@ciarm.edu.mx'): string {
    $encodedSubject='=?UTF-8?B?'.base64_encode($subject).'?=';
    $fromName='=?UTF-8?B?'.base64_encode('Portal CIARM — Solicitudes').'?=';
    $msgId='<'.bin2hex(random_bytes(12)).'@portal2.ciarm.edu.mx>';
    $date=date('r');
    $headers=[
        "Date: {$date}",
        "Message-ID: {$msgId}",
        "From: {$fromName} <{$fromEmail}>",
        "To: <{$to}>",
        "Subject: {$encodedSubject}",
        'Reply-To: no-reply@ciarm.edu.mx',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'X-Mailer: Portal-CIARM-Tickets/1.0'
    ];
    return implode("\r\n",$headers)."\r\n\r\n".rtrim(chunk_split(base64_encode($html),76,"\r\n"));
}

function ciarm_ticket_smtp_mx_send(string $to, string $subject, string $html, string $mxHost = 'smtp.google.com', int $port = 25): array {
    $errno=0;$errstr='';
    $ipv4=gethostbyname($mxHost);
    $ctx=stream_context_create(['ssl'=>['peer_name'=>$mxHost,'verify_peer'=>false,'verify_peer_name'=>false]]);
    $fp=@stream_socket_client("tcp://{$ipv4}:{$port}",$errno,$errstr,6,STREAM_CLIENT_CONNECT,$ctx);
    if(!$fp)return ['ok'=>false,'stage'=>'connect','ip'=>$ipv4,'error'=>"{$errno}: {$errstr}"];
    stream_set_timeout($fp,8);
    $banner=ciarm_ticket_smtp_read($fp);
    if((int)substr($banner,0,3)!==220){fclose($fp);return ['ok'=>false,'stage'=>'banner','ip'=>$ipv4,'error'=>trim($banner)];}
    $ehlo=ciarm_ticket_smtp_cmd($fp,'EHLO portal2.ciarm.edu.mx',[250]);
    if(!$ehlo['ok']){fclose($fp);return ['ok'=>false,'stage'=>'ehlo','error'=>$ehlo['resp']];}
    if(stripos($ehlo['resp'],'STARTTLS')!==false){
        $tls=ciarm_ticket_smtp_cmd($fp,'STARTTLS',[220]);
        if($tls['ok']&&@stream_socket_enable_crypto($fp,true,STREAM_CRYPTO_METHOD_TLS_CLIENT)){
            $ehlo=ciarm_ticket_smtp_cmd($fp,'EHLO portal2.ciarm.edu.mx',[250]);
        }
    }
    $from='no-reply@ciarm.edu.mx';
    $mailFrom=ciarm_ticket_smtp_cmd($fp,"MAIL FROM:<{$from}>",[250]);
    if(!$mailFrom['ok']){fclose($fp);return ['ok'=>false,'stage'=>'mail_from','error'=>$mailFrom['resp']];}
    $rcpt=ciarm_ticket_smtp_cmd($fp,"RCPT TO:<{$to}>",[250,251]);
    if(!$rcpt['ok']){fclose($fp);return ['ok'=>false,'stage'=>'rcpt_to','error'=>$rcpt['resp']];}
    $dataCmd=ciarm_ticket_smtp_cmd($fp,'DATA',[354]);
    if(!$dataCmd['ok']){fclose($fp);return ['ok'=>false,'stage'=>'data_cmd','error'=>$dataCmd['resp']];}
    $mime=ciarm_ticket_send_raw_mime($to,$subject,$html,$from);
    $safeMime=preg_replace('/^\./m','..',$mime);
    $endData=ciarm_ticket_smtp_cmd($fp,$safeMime."\r\n.",[250]);
    @ciarm_ticket_smtp_cmd($fp,'QUIT',[221,250]);
    fclose($fp);
    if(!$endData['ok'])return ['ok'=>false,'stage'=>'data_body','error'=>$endData['resp']];
    return ['ok'=>true,'stage'=>'sent','ip'=>$ipv4,'resp'=>$endData['resp']];
}

function ciarm_ticket_ensure_notifications(string $action, array $input, array $result, ?callable $mailer = null): array {
    if(($result['ok']??false)!==true||!is_array($result['data']??null))return $result;
    if(!in_array($action,['finalizeCreate','assign','serviceTransition'],true))return $result;
    $gasAudit=$result['data']['notification']??null;
    if(is_array($gasAudit)&&($gasAudit['status']??'')==='ENVIADO')return $result;
    $ev=match($action){'finalizeCreate'=>'CREATE','assign'=>'ASSIGN','serviceTransition'=>(string)($input['event']??''),default=>''};
    if($ev==='')return $result;
    $ticket=is_array($result['data']['ticket']??null)?$result['data']['ticket']:[];
    $meta=is_array($result['data']['service']??null)?$result['data']['service']:null;
    $policy=is_array($meta['policy']??null)?$meta['policy']:null;
    if($policy===null&&function_exists('ciarm_tickets_batch_get')){
        try{
            $cfgRange="'CONFIG SERVICIO'!A:F";
            $sets=ciarm_tickets_batch_get([$cfgRange]);
            $rows=$sets[$cfgRange]??[];
            if(is_array($rows)&&count($rows)>1){
                $last=$rows[count($rows)-1];
                $decoded=json_decode((string)($last[1]??''),true);
                if(is_array($decoded))$policy=$decoded;
            }
        }catch(Throwable $ignored){}
    }
    $plan=ciarm_ticket_build_notification_plan_php($ev,$ticket,$meta,$policy,$input);
    if($plan===null)return $result;
    $alreadySent=[];
    if(is_array($gasAudit['deliveries']??null)){
        foreach($gasAudit['deliveries'] as $d){
            if(($d['status']??'')==='ENVIADO'){
                $alreadySent[($d['role']??'').':'.strtolower(trim((string)($d['to']??'')))]=$d;
            }
        }
    }
    $deliveries=[];
    $sendFn=$mailer??static function(string $to, string $subject, string $html): array|bool {
        $mx=ciarm_ticket_smtp_mx_send($to,$subject,$html,'smtp.google.com',25);
        if(($mx['ok']??false)===true)return ['ok'=>true,'via'=>'smtp-google-mx'];
        $encodedSubject='=?UTF-8?B?'.base64_encode($subject).'?=';
        $fromName='=?UTF-8?B?'.base64_encode('Portal CIARM — Solicitudes').'?=';
        $headers=implode("\r\n",[
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            "From: {$fromName} <no-reply@ciarm.edu.mx>",
            'Reply-To: no-reply@ciarm.edu.mx',
            'X-Mailer: Portal-CIARM-Tickets/1.0'
        ]);
        $mailOk=@mail($to,$encodedSubject,chunk_split(base64_encode($html)),$headers,'-fno-reply@ciarm.edu.mx');
        return ['ok'=>$mailOk,'via'=>'php-mail','mxError'=>$mx['error']??($mx['stage']??'')];
    };
    foreach($plan['messages'] as $msg){
        $key=$msg['role'].':'.$msg['to'];
        if(isset($alreadySent[$key])){
            $deliveries[]=$alreadySent[$key];
            continue;
        }
        $html=ciarm_ticket_render_email_php($msg,$ticket);
        try{
            $res=$sendFn($msg['to'],$msg['subject'],$html);
            $ok=is_array($res)?(bool)($res['ok']??false):(bool)$res;
            $via=is_array($res)?(string)($res['via']??'php'):'php';
            $entry=['role'=>$msg['role'],'to'=>$msg['to'],'subject'=>$msg['subject'],'status'=>$ok?'ENVIADO':'ERROR','via'=>$via];
            if(is_array($res)&&!empty($res['mxError']))$entry['mxError']=$res['mxError'];
            $deliveries[]=$entry;
        }catch(Throwable $mailErr){
            $deliveries[]=['role'=>$msg['role'],'to'=>$msg['to'],'subject'=>$msg['subject'],'status'=>'ERROR','error'=>$mailErr->getMessage(),'via'=>'php'];
        }
    }
    $sentCount=count(array_filter($deliveries,static fn($d)=>($d['status']??'')==='ENVIADO'));
    $errCount=count(array_filter($deliveries,static fn($d)=>($d['status']??'')==='ERROR'));
    $overall=count($deliveries)===0?'OMITIDO':($errCount===0?'ENVIADO':($sentCount>0?'ERROR_PARCIAL':'ERROR'));
    $result['data']['notification']=[
        'event'=>$ev,
        'timestamp'=>gmdate('Y-m-d H:i:s',time()-5*3600),
        'status'=>$overall,
        'deliveries'=>$deliveries,
        'skipped'=>$plan['skipped'],
        'gasStatus'=>$gasAudit['status']??'NONE'
    ];
    return $result;
}


