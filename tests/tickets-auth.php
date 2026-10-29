<?php
declare(strict_types=1);
require_once __DIR__ . '/../tickets-lib.php';
function check(bool $condition,string $message): void { if(!$condition) throw new RuntimeException($message); }
ciarm_start_session();
check((int)ini_get('session.gc_maxlifetime') >= CIARM_SESSION_TTL,'Session GC cannot expire earlier than authorized TTL');
session_write_close();
$rows=[['Correo Ciarm','Status','Portal','Sistema de tickets'],['d.lara@ciarm.edu.mx','Activo','','Administrador'],['e.conesa@ciarm.edu.mx','Activo','Administrador','Administrador'],['r.valencia@ciarm.edu.mx','Activo','Director','']];
check(ciarm_ticket_permission($rows,'d.lara@ciarm.edu.mx'),'Dany should administer tickets');
check(ciarm_ticket_permission($rows,'e.conesa@ciarm.edu.mx'),'Ezequiel should administer tickets');
check(!ciarm_ticket_permission($rows,'r.valencia@ciarm.edu.mx'),'Portal role must not authorize tickets');
$revoked=$rows;$revoked[1][3]='';check(!ciarm_ticket_permission($revoked,'d.lara@ciarm.edu.mx'),'Revocation must take effect');
$inactive=$rows;$inactive[1][1]='Baja';check(!ciarm_ticket_permission($inactive,'d.lara@ciarm.edu.mx'),'Inactive collaborator denied');
$duplicate=$rows;$duplicate[]=$rows[1];check(!ciarm_ticket_permission($duplicate,'d.lara@ciarm.edu.mx'),'Duplicate identities denied');
check(!ciarm_ticket_permission([['Correo Ciarm','Status'],['d.lara@ciarm.edu.mx','Activo']],'d.lara@ciarm.edu.mx'),'Missing column denied');
check(!ciarm_ticket_permission([['Correo Ciarm','Status','Sistema de tickets'],['other@ciarm.edu.mx','Activo','Administrador']],'other@ciarm.edu.mx'),'Only approved administrators');
$signed=ciarm_ticket_envelope(['correo'=>'d.lara@ciarm.edu.mx'],'assign',['actor'=>'r.valencia@ciarm.edu.mx'],'fixture-secret',1700000000,'nonce-123456789012');
$decoded=json_decode($signed['envelope'],true,512,JSON_THROW_ON_ERROR);
check($decoded['actor']==='d.lara@ciarm.edu.mx','Actor must come from session');
check(hash_equals(hash_hmac('sha256',$signed['envelope'],'fixture-secret'),$signed['signature']),'Signature must bind exact JSON');
check(!array_key_exists('perfProbe',$decoded),'Normal tickets do not request performance details');
$probe=ciarm_ticket_envelope(['correo'=>'d.lara@ciarm.edu.mx'],'list',[],'fixture-secret',1700000000,'nonce-123456789012',true);
$withProbe=json_decode($probe['envelope'],true,512,JSON_THROW_ON_ERROR);
check(($withProbe['perfProbe']??false)===true,'Signed performance probe is explicit');
check(hash_equals(hash_hmac('sha256',$probe['envelope'],'fixture-secret'),$probe['signature']),'Performance probe is HMAC-bound');
check(ciarm_ticket_csrf_valid('stored','stored'),'Matching token');
check(!ciarm_ticket_csrf_valid('stored','wrong'),'Invalid token');
check(!ciarm_ticket_csrf_valid('',''),'Empty token');
check(ciarm_ticket_origin_valid('https://portal2.ciarm.edu.mx','portal2.ciarm.edu.mx'),'Same origin preprod');
check(ciarm_ticket_origin_valid('https://portal.ciarm.edu.mx','portal.ciarm.edu.mx'),'Same origin prod');
check(ciarm_ticket_origin_valid('https://portal.ciarm.mx','portal.ciarm.mx'),'Same origin alias');
check(!ciarm_ticket_origin_valid('https://portal2.ciarm.edu.mx','portal.ciarm.edu.mx'),'Cross-environment origin denied');
check(!ciarm_ticket_origin_valid('https://malicious.invalid','portal2.ciarm.edu.mx'),'Cross origin denied');
echo "Tickets authorization: checks passed\n";

