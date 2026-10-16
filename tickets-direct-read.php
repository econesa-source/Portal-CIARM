<?php
declare(strict_types=1);
require_once __DIR__ . '/tickets-lib.php';

/**
 * Read-only adapter for the authoritative BD Sistema de Tickets.
 * PHP authenticates via DM03/DM05 before calling this adapter.
 * Never changes Sheets; mutations and their canonical version validation stay in GAS.
 */
const CIARM_TICKETS_SHEET_ID = '1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs';
const CIARM_TICKETS_HEADERS = [
 'ID TICKET','FECHA SOLICITUD','HORA SOLICITUD','ÁREA SOLICITANTE',
 'SOLICITANTE','CORREO SOLICITANTE','TIPO DE SOLICITUD','DESCRIPCIÓN',
 'PRIORIDAD','RESPONSABLE','FECHA ASIGNACIÓN','FECHA COMPROMISO','ESTADO',
 'FECHA INICIO','FECHA TERMINACIÓN','TIEMPO EJECUCIÓN','TIEMPO TOTAL',
 'SLA','PUNTOS','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN',
 'PRIORIDAD SOLICITADA','PLAZO SOLICITADO','ARCHIVOS ADJUNTOS'
];

function ciarm_tickets_batch_url(array $ranges, string $render): string {
 if (!in_array($render,['UNFORMATTED_VALUE','FORMULA'],true)) throw new RuntimeException('CONFIGURATION');
 // The REST API expects repeated "ranges" query keys (not PHP's ranges[0]).
 $query='valueRenderOption='.rawurlencode($render).'&dateTimeRenderOption=SERIAL_NUMBER';
 foreach($ranges as $range) $query.='&ranges='.rawurlencode($range);
 return 'https://sheets.googleapis.com/v4/spreadsheets/'.CIARM_TICKETS_SHEET_ID
    .'/values:batchGet?'.$query;
}

/** $http injection only for deterministic tests; never from request parameters. */
function ciarm_tickets_batch_get(array $ranges, string $render='UNFORMATTED_VALUE', ?callable $http=null): array {
 $raw=@file_get_contents(ciarm_private_path('service-account.json'));
 if ($raw===false) throw new RuntimeException('CONFIGURATION');
 $account=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
 if (!is_array($account)) throw new RuntimeException('CONFIGURATION');
 $token=ciarm_google_access_token($account);
 $fetch=$http??'ciarm_http_json';
 $response=$fetch(ciarm_tickets_batch_url($ranges,$render),[
  'headers'=>['Accept: application/json','Authorization: Bearer '.$token],
  'timeout'=>12
 ]);
 if (($response['status']??0)!==200||!is_array($response['body']['valueRanges']??null)
     ||count($response['body']['valueRanges'])!==count($ranges))throw new RuntimeException('UPSTREAM');
 $result=[];
 foreach($ranges as $i=>$range){
  $values=$response['body']['valueRanges'][$i]['values']??[];
  if(!is_array($values))throw new RuntimeException('UPSTREAM');
  $result[$range]=$values;
 }
 return $result;
}

function ciarm_tickets_table(array $values,array $required): array {
 if(!$values || !is_array($values[0]))throw new RuntimeException('SCHEMA');
 $headers=array_map(static fn($v)=>trim((string)$v),$values[0]);
 foreach($required as $header) {
  if(count(array_keys($headers,$header,true))!==1) throw new RuntimeException('SCHEMA');
 }
 return ['headers'=>$headers,'rows'=>array_slice($values,1)];
}
function ciarm_tickets_column(array $table,string $name): int {
 $index=array_search($name,$table['headers'],true);
 if($index===false) throw new RuntimeException('SCHEMA');
 return $index;
}
function ciarm_tickets_value(array $row,array $table,string $name): mixed {
 return $row[ciarm_tickets_column($table,$name)]??'';
}
function ciarm_tickets_text(mixed $value): string {return $value===null?'':(string)$value;}

/** Maps the GAS adminCellValue string rules. Used only for read presentation;
 * canonical mutation tokens are ALWAYS freshly acquired from GAS detail. */
function ciarm_tickets_date_text(mixed $value,string $header): string {
 if(is_float($value)||is_int($value)){
  // Sheets serial numbers are local wall-clock days since 1899-12-30.
  // Match the date/time formatting in the Apps Script read contract.
  if($header==='HORA SOLICITUD'&&$value>=0&&$value<2)
    return gmdate('H:i:s',(int)round(fmod((float)$value,1.0)*86400));
  if($header==='ÚLTIMA ACTUALIZACIÓN'||$header==='PLAZO SOLICITADO'||str_starts_with($header,'FECHA')){
   if($value>=20000&&$value<90000){
    $seconds=(int)round(((float)$value-25569)*86400);
    return gmdate(in_array($header,['FECHA ASIGNACIÓN','FECHA INICIO','FECHA TERMINACIÓN','ÚLTIMA ACTUALIZACIÓN'],true)
      ?'Y-m-d H:i:s':'Y-m-d',$seconds);
   }
  }
  return ciarm_tickets_text($value);
 }
 if(!is_string($value))return ciarm_tickets_text($value);
 if($header!=='ÚLTIMA ACTUALIZACIÓN'&&!str_starts_with($header,'FECHA'))return $value;
 if(!preg_match('/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2})(?::(\d{2}))?)?$/',$value,$m))return $value;
 return $m[3].'-'.$m[2].'-'.$m[1].(!empty($m[4])?' '.$m[4].':'.($m[5]??'00'):'');
}
function ciarm_tickets_ticket_view(array $row,array $table): array {
 $get=static function(string $name)use($row,$table): string {
  $value=ciarm_tickets_date_text(ciarm_tickets_value($row,$table,$name),$name);
  // Canonical backend strips protection characters for read presentation.
  return preg_replace('/^\x{200B}(?=[=+@\x27-])/u','',$value)??$value;
 };
 return [
  'id'=>$get('ID TICKET'),'fecha'=>$get('FECHA SOLICITUD'),
  'hora'=>$get('HORA SOLICITUD'),'solicitante'=>$get('SOLICITANTE'),
  'correo'=>$get('CORREO SOLICITANTE'),'area'=>$get('ÁREA SOLICITANTE'),
  'tipo'=>$get('TIPO DE SOLICITUD'),'descripcion'=>$get('DESCRIPCIÓN'),
  'urgencia'=>$get('PRIORIDAD SOLICITADA'),'plazo'=>$get('PLAZO SOLICITADO'),
  'prioridad'=>$get('PRIORIDAD'),'responsable'=>$get('RESPONSABLE'),
  'fechaAsignacion'=>$get('FECHA ASIGNACIÓN'),
  'fechaCompromiso'=>$get('FECHA COMPROMISO'),'estado'=>$get('ESTADO'),
  'observaciones'=>$get('OBSERVACIONES'),'adjuntos'=>$get('ARCHIVOS ADJUNTOS')
 ];
}
function ciarm_tickets_pending_ids(array $values): array {
 $table=ciarm_tickets_table($values,['ESTADO','TICKET','ACCIÓN']);
 $out=[];
 foreach($table['rows'] as $row){
  if(ciarm_tickets_value($row,$table,'ACCIÓN')==='CREAR'
     &&ciarm_tickets_value($row,$table,'ESTADO')==='PENDIENTE'){
   $id=ciarm_tickets_text(ciarm_tickets_value($row,$table,'TICKET'));
   if($id!=='')$out[$id]=true;
  }
 }
 return $out;
}
function ciarm_tickets_direct_list(array $tickets,array $journal): array {
 $table=ciarm_tickets_table($tickets,CIARM_TICKETS_HEADERS);
 $pending=ciarm_tickets_pending_ids($journal);
 $out=[];
 foreach($table['rows'] as $row){
  $ticket=ciarm_tickets_ticket_view($row,$table);
  $id=$ticket['id'];
  if(!preg_match('/^TKT-\d{4}-\d+$/',$id))continue;
  if(strtolower(trim($ticket['tipo']))==='compras'||isset($pending[$id]))continue;
  // A list is a read-only projection: its version is intentionally not trusted
  // for writes. A fresh GAS detail supplies canonical expectedVersion.
  $ticket['version']=null;
  $out[]=$ticket;
 }
 return $out;
}
function ciarm_tickets_direct_catalogs(array $catalogs,array $people,array $config): array {
 $catalogs=ciarm_tickets_table($catalogs,['PRIORIDADES']);
 $people=ciarm_tickets_table($people,['RESPONSABLE']);
 $config=ciarm_tickets_table($config,['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']);
 $priorityAllowed=['CRITICA','URGENTE','ALTA','MEDIA','BAJA'];
 $priorities=[];$names=[];
 foreach($catalogs['rows'] as $row){
  $v=trim(ciarm_tickets_text(ciarm_tickets_value($row,$catalogs,'PRIORIDADES')));
  if($v!==''&&in_array($v,$priorityAllowed,true)&&!in_array($v,$priorities,true))$priorities[]=$v;
 }
 foreach($people['rows'] as $row){
  $v=trim(ciarm_tickets_text(ciarm_tickets_value($row,$people,'RESPONSABLE')));
  if($v!==''&&!in_array($v,$names,true))$names[]=$v;
 }
 if($config['rows']){
  $last=end($config['rows']);
  $policy=json_decode(ciarm_tickets_text(ciarm_tickets_value($last,$config,'REGLAS')),true,512,JSON_THROW_ON_ERROR);
  if(!is_array($policy)||!isset($policy['responsibles'])||!is_array($policy['responsibles']))throw new RuntimeException('SCHEMA');
  foreach($policy['responsibles'] as $person) {
   $name=trim(ciarm_tickets_text($person['name']??''));
   if($name!==''&&!in_array($name,$names,true))$names[]=$name;
  }
 }
 return ['prioridades'=>$priorities,'responsables'=>$names];
}
/**
 * Eligibility is not authorization. tickets-api.php MUST validate the session
 * and DM05 role before routing any read through this function.
 * Set CIARM_TICKETS_DIRECT_READ=0 in hosting for emergency rollback.
 */
function ciarm_tickets_direct_eligible(string $method,string $action): bool {
 return $method==='GET'
   && in_array($action,['list','catalogs','serviceContext','serviceListRaw','detailPreview'],true)
   && getenv('CIARM_TICKETS_DIRECT_READ')!=='0';
}

function ciarm_tickets_direct_read(string $action,?callable $batch=null): array {
 if(!in_array($action,['list','catalogs','detailPreview'],true))throw new RuntimeException('VALIDATION');
 $ranges=in_array($action,['list','detailPreview'],true)
  ? ["'TICKETS'!A:X","'BITACORA TICKETS'!A:J"]
  : ["'CATALOGOS'!A:E","'RESPONSABLES'!A:B","'CONFIG SERVICIO'!A:F"];
 $load=$batch??'ciarm_tickets_batch_get';
 $sets=$load($ranges,'UNFORMATTED_VALUE');
 foreach($ranges as $r)if(!array_key_exists($r,$sets))throw new RuntimeException('UPSTREAM');
 return in_array($action,['list','detailPreview'],true)?ciarm_tickets_direct_list($sets[$ranges[0]],$sets[$ranges[1]])
   :ciarm_tickets_direct_catalogs($sets[$ranges[0]],$sets[$ranges[1]],$sets[$ranges[2]]);
}


/** Read-only projection. Mutation tokens and pending operation payloads are never returned.
 * Institutional session and admin permission are validated by tickets-api.php. */
function ciarm_tickets_direct_detail_preview(string $id,?callable $batch=null): array {
 if(!preg_match('/^TKT-\d{4}-\d+$/',$id))throw new RuntimeException('VALIDATION');
 $tickets=ciarm_tickets_direct_read('detailPreview',$batch);
 $matches=array_values(array_filter($tickets,static fn($ticket)=>$ticket['id']===$id));
 if(count($matches)>1)throw new RuntimeException('DUPLICATE_ID');
 if(!$matches)throw new RuntimeException('NOT_FOUND');
 $ticket=$matches[0];
 $ticket['version']=null;
 $ticket['readOnly']=true;
 unset($ticket['pendingOperation']);
 return $ticket;
}

/**
 * Privacy-safe read parity report. Only reports schema key names and counts;
 * neither ticket IDs, field values, names, emails, descriptions nor URLs leave
 * the backend as diagnostics.
 */
function ciarm_tickets_parity_report(string $kind,array $legacy,array $direct): array {
 if(!in_array($kind,['list','catalogs'],true))throw new RuntimeException('VALIDATION');
 $report=['same'=>$legacy===$direct,'legacyCount'=>count($legacy),'directCount'=>count($direct),'fields'=>[]];
 if($report['same'])return $report;
 $fields=[];
 if($kind==='list'){
  foreach($legacy as $index=>$old){
   $fresh=$direct[$index]??null;
   if(!is_array($old)||!is_array($fresh)||($old['id']??null)!==($fresh['id']??null)){
    $fields['rowCountOrOrder']=true;
    continue;
   }
   foreach(array_unique(array_merge(array_keys($old),array_keys($fresh))) as $field){
    if(!is_string($field)||!preg_match('/^[a-zA-Z]{2,30}$/',$field))continue;
    if(!array_key_exists($field,$old)||!array_key_exists($field,$fresh)||$old[$field]!==$fresh[$field]){
     $fields[$field]=true;
    }
   }
  }
  if(count($legacy)!==count($direct))$fields['rowCountOrOrder']=true;
 }else{
  foreach(['prioridades','responsables'] as $field){
   if(($legacy[$field]??null)!==($direct[$field]??null))$fields[$field]=true;
  }
 }
 $report['fields']=array_slice(array_keys($fields),0,18);
 return $report;
}

/**
 * Read-only service context. The caller authenticates DM03 and validates
 * DM05 permissions before invoking; this function does not authorize writes.
 * The current policy remains defined exclusively by CONFIG SERVICIO.
 */
function ciarm_tickets_direct_service_context(array $configRows,bool $canAdmin): array {
 $sheet=ciarm_tickets_table($configRows,['VERSION','REGLAS','ACTOR','FECHA','OPERACION','HASH']);
 $enabled=false;
 if($sheet['rows']){
  $latest=end($sheet['rows']);
  $raw=ciarm_tickets_value($latest,$sheet,'REGLAS');
  if(!is_string($raw)||trim($raw)==='')throw new RuntimeException('SCHEMA');
  $policy=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
  if(!is_array($policy)||!isset($policy['version'],$policy['responsibles'],$policy['levels'])
     ||!is_array($policy['responsibles'])||!is_array($policy['levels'])){
   throw new RuntimeException('SCHEMA');
  }
  $enabled=true;
 }
 return ['protocol'=>'tickets-service-v1','enabled'=>$enabled,'canAdmin'=>$canAdmin];
}

/**
 * Read-only service projection. The canonical service metadata is stored in
 * SEGUIMIENTO SERVICIO. The business calculations are sourced from GAS in the
 * generated browser module, not reimplemented in PHP.
 */
function ciarm_tickets_direct_service_list(array $ticketRows,array $journalRows,array $serviceRows,string $actor,string $kind): array {
 if(!in_array($kind,['all','mine','assigned'],true))throw new RuntimeException('VALIDATION');
 if(!preg_match('/^[a-z0-9._+\-]+@ciarm\.edu\.mx$/',$actor))throw new RuntimeException('FORBIDDEN');
 $table=ciarm_tickets_table($serviceRows,['FOLIO','SEGUIMIENTO']);
 $cases=[];
 foreach($table['rows'] as $row){
  $id=trim(ciarm_tickets_text(ciarm_tickets_value($row,$table,'FOLIO')));
  if($id==='')continue;
  if(array_key_exists($id,$cases))throw new RuntimeException('DUPLICATE_ID');
  $raw=ciarm_tickets_value($row,$table,'SEGUIMIENTO');
  if(!is_string($raw)||trim($raw)==='')throw new RuntimeException('SCHEMA');
  $meta=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
  if(!is_array($meta)||array_is_list($meta))throw new RuntimeException('SCHEMA');
  $cases[$id]=$meta;
 }
 $items=[];
 foreach(ciarm_tickets_direct_list($ticketRows,$journalRows) as $ticket){
  $meta=$cases[$ticket['id']]??null;
  $owner=strtolower(trim($ticket['correo']))===$actor;
  $executor=is_array($meta)&&($meta['email']??null)===$actor;
  if($kind==='mine'&&!$owner||$kind==='assigned'&&!$executor)continue;
  $items[]=['ticket'=>$ticket,'meta'=>$meta];
 }
 return ['items'=>$items,'serverNow'=>gmdate('Y-m-d\TH:i:s\Z')];
}
