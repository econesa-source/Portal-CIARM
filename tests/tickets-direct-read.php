<?php
declare(strict_types=1);
require_once __DIR__.'/../tickets-direct-read.php';
function assertRead(bool $pass,string $msg): void {if(!$pass)throw new RuntimeException($msg);}
function expectsReadError(callable $run,string $code): void{
 try{$run();throw new RuntimeException('Expected '.$code);}
 catch(RuntimeException $e){assertRead($e->getMessage()===$code,'Incorrect error '.$e->getMessage());}
}
$url=ciarm_tickets_batch_url(["'TICKETS'!A:X","'BITACORA TICKETS'!A:J"],'UNFORMATTED_VALUE');
assertRead(substr_count($url,'&ranges=')===2,'BatchGet must repeat ranges');
assertRead(!str_contains($url,'ranges%5B0%5D'),'No PHP encoded range indexes');
assertRead(str_contains($url,'dateTimeRenderOption=SERIAL_NUMBER'),'Sheets date option must be explicit');
$headers=CIARM_TICKETS_HEADERS;
$index=static function(string $name)use($headers):int{return array_search($name,$headers,true);};
$ticket=array_fill(0,count($headers),'');
$ticket[$index('ID TICKET')]='TKT-2026-00001';
$ticket[$index('FECHA SOLICITUD')]='02/10/2026';
$ticket[$index('HORA SOLICITUD')]='10:10:00';
$ticket[$index('SOLICITANTE')]='Solicitante';
$ticket[$index('CORREO SOLICITANTE')]='solicitante@ciarm.edu.mx';
$ticket[$index('TIPO DE SOLICITUD')]='Limpieza';
$ticket[$index('DESCRIPCIÓN')]='Trabajo';
$ticket[$index('PRIORIDAD')]='MEDIA';
$ticket[$index('ESTADO')]='NUEVO';
$ticket[$index('OBSERVACIONES')]="\u{200B}=1+1";
$purchase=$ticket;$purchase[$index('ID TICKET')]='TKT-2026-00002';$purchase[$index('TIPO DE SOLICITUD')]='Compras';
$pending=$ticket;$pending[$index('ID TICKET')]='TKT-2026-00003';
$journal=[['OPERACION','ESTADO','ACTOR','PAYLOAD HASH','TICKET','ANTES','DESPUES','FECHA','PAYLOAD','ACCIÓN'],
 ['op','PENDIENTE','actor','','TKT-2026-00003','','','','','CREAR']];
$list=ciarm_tickets_direct_list([$headers,$ticket,$purchase,$pending],$journal);
assertRead(count($list)===1,'Purchases and pending creations must not be exposed');
assertRead($list[0]['fecha']==='2026-10-02','Formatted date must be normalized');
assertRead(ciarm_tickets_date_text(46313.5,'FECHA ASIGNACIÓN')==='2026-10-18 12:00:00','DateTime serial formatted in Cancun wall time');
assertRead(ciarm_tickets_date_text(46313.5,'FECHA COMPROMISO')==='2026-10-18','Canonical commitment date discards time');
assertRead(ciarm_tickets_date_text(0.5,'HORA SOLICITUD')==='12:00:00','Time serial formatted as clock');

assertRead($list[0]['observaciones']==='=1+1','Literal protection character hidden from presentation');
assertRead(array_key_exists('version',$list[0])&&$list[0]['version']===null,'List version must never be used as canonical write token');
expectsReadError(fn()=>ciarm_tickets_direct_list([['bad','headers']],$journal),'SCHEMA');
expectsReadError(fn()=>ciarm_tickets_direct_list([$headers,$ticket],[['bad','headers']]),'SCHEMA');
$cats=[['ÁREAS','PRIORIDADES','ESTADOS'],['A','CRITICA','NUEVO'],['A','CRITICA','NUEVO'],['B','BAJA','NUEVO'],['C','Unknown','NUEVO']];
$people=[['TIPOS','RESPONSABLE'],['A','Persona A'],['B','Persona B'],['B','Persona A']];
$policy=['responsibles'=>[['name'=>'Persona B','email'=>'b@ciarm.edu.mx'],['name'=>'Persona C','email'=>'c@ciarm.edu.mx']]];
$config=[['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH'],[1,json_encode($policy),'e','h','o','x']];
$result=ciarm_tickets_direct_catalogs($cats,$people,$config);
assertRead($result===['prioridades'=>['CRITICA','BAJA'],'responsables'=>['Persona A','Persona B','Persona C']],'Deduplicate and preserve ordering');
$fake=function(array $ranges,string $render)use($headers,$ticket,$journal):array{
 assertRead($render==='UNFORMATTED_VALUE','Only read data');
 return [$ranges[0]=>[$headers,$ticket],$ranges[1]=>$journal];
};
assertRead(count(ciarm_tickets_direct_read('list',$fake))===1,'Read uses injected readonly sources');
expectsReadError(fn()=>ciarm_tickets_direct_read('assign',$fake),'VALIDATION');
$legacy=[['id'=>'TKT-2026-00001','fecha'=>'2026-10-02','observaciones'=>'private text']];
$directDifferent=[['id'=>'TKT-2026-00001','fecha'=>'2026-10-03','observaciones'=>'different private text']];
$parity=ciarm_tickets_parity_report('list',$legacy,$directDifferent);
assertRead($parity['same']===false,'Mismatched values must block activation');
assertRead(in_array('fecha',$parity['fields'],true),'Report must name differing field');
assertRead(in_array('observaciones',$parity['fields'],true),'Report must name other field');
assertRead(!str_contains(json_encode($parity),'private text'),'No private values in diagnostics');
$match=ciarm_tickets_parity_report('catalogs',['prioridades'=>['ALTA']],['prioridades'=>['ALTA']]);
assertRead($match['same']===true && !$match['fields'],'Identical catalogs can activate');
$catalogDifference=ciarm_tickets_parity_report('catalogs',['prioridades'=>['ALTA']],['prioridades'=>['BAJA']]);
assertRead($catalogDifference['fields']===['prioridades'],'Only approved schema keys are exposed');
echo "Ticket direct read adapter checks passed\n";
