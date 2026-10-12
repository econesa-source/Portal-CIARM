import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// Keep the test clock aligned with the deliberately dated fixtures.
class FixtureDate extends Date {
 constructor(...args){super(...(args.length?args:['2026-10-07T15:00:00Z']));}
 static now(){return Date.parse('2026-10-07T15:00:00Z');}
 static [Symbol.hasInstance](value){return value instanceof Date;}
}

const headers = ['ID TICKET','FECHA SOLICITUD','HORA SOLICITUD','ÁREA SOLICITANTE','SOLICITANTE','CORREO SOLICITANTE','TIPO DE SOLICITUD','DESCRIPCIÓN','PRIORIDAD','RESPONSABLE','FECHA ASIGNACIÓN','FECHA COMPROMISO','ESTADO','FECHA INICIO','FECHA TERMINACIÓN','TIEMPO EJECUCIÓN','TIEMPO TOTAL','SLA','PUNTOS','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN','PRIORIDAD SOLICITADA','PLAZO SOLICITADO','ARCHIVOS ADJUNTOS'];
function setup() {
 const row=['TKT-2026-00001','07/10/2026','10:00','Administración','Persona','persona@ciarm.edu.mx','Tipo histórico','Descripción','POR DEFINIR','SIN ASIGNAR','','','NUEVO','inicio previo','','','','','','','07/10/2026 10:00','Normal','',''];
 const sheets = new Map(); let failure='';let coerce=false;let calculate=false;
 function sheet(name,rows) {
  const formulas=rows.map(row=>row.map(()=>''));const s={rows,formulas,getLastRow:()=>rows.length,getLastColumn:()=>rows[0]?.length||0,
   getDataRange:()=>s.getRange(1,1,rows.length,rows[0].length),
   getRange:(r,c,n=1,m=1)=>({getFormulas:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>formulas[r+i-1]?.[c+j-1]??'')),getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r+i-1]?.[c+j-1]??'')),getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),setValues:values=>{if(failure===name){failure='';throw Error('simulated interruption');}values.forEach((v,i)=>{rows[r+i-1]??=[];v.forEach((x,j)=>rows[r+i-1][c+j-1]=x);});},setValue:v=>{if(failure===name){failure='';throw Error('simulated interruption');}if(coerce&&typeof v==='string'){if(/^\d{4}-\d{2}-\d{2}$/.test(v))v=new Date(v+'T05:00:00Z');else if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v))v=new Date(v.replace(' ','T')+'-05:00');else if(v.startsWith("'"))v=v.slice(1);}rows[r-1][c-1]=v;}}),appendRow:r=>{rows.push([...r]);}};
  sheets.set(name,s);return s;
 }
 sheet('TICKETS',[headers,[...row]]);
 sheet('CATALOGOS',[['ÁREAS','PRIORIDADES'],['Administración','ALTA'],['','MEDIA'],['','POR DEFINIR']]);
 sheet('RESPONSABLES',[['TIPOS','RESPONSABLE'],['TODAS','Daniel Lara']]);
 sheet('Permisos de usuario',[['Correo Ciarm','Status','Sistema de tickets'],['d.lara@ciarm.edu.mx','Activo','Administrador'],['e.conesa@ciarm.edu.mx','Activo','Administrador']]);
 const book={getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>sheet(n,[])};
 const props={TICKETS_ADMIN_SECRET:'test-secret-only-for-fixtures'};const cache=new Map();
 const context=vm.createContext({CONFIG:{TICKETS_SPREADSHEET_ID:'tickets',DM03_SPREADSHEET_ID:'dm03'},Date:FixtureDate,JSON,Math,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},
  SpreadsheetApp:{openById:()=>book,flush:()=>{if(calculate&&sheets.get('TICKETS').rows[1][8]==='ALTA')sheets.get('TICKETS').rows[1][17]='CALCULATED SLA';}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()],parseDate:(value)=>new Date(value.replace(' ','T')+'-05:00'),formatDate:(value,tz,format)=>{const local=new Date(value.getTime()-5*3600000).toISOString();if(format==='HH:mm:ss')return local.slice(11,19);if(format==='yyyy-MM-dd HH:mm:ss')return local.slice(0,10)+' '+local.slice(11,19);return local.slice(0,10);},getUuid:()=>crypto.randomUUID()}});
 const source=fs.existsSync('apps-script/tickets-admin.gs')?fs.readFileSync('apps-script/tickets-admin.gs','utf8'):'';
 vm.runInContext(source,context);
 function call(action,payload={},actor='d.lara@ciarm.edu.mx',overrides={}) {
  const envelope=JSON.stringify({action,actor,issuedAt:Math.floor(FixtureDate.now()/1000),nonce:crypto.randomUUID(),payload,...overrides});
  const signature=crypto.createHmac('sha256',props.TICKETS_ADMIN_SECRET).update(envelope).digest('hex');
  return context.handleAdminEnvelope(envelope,signature);
 }
 const payload=()=>({operationId:'operation-00000001',ticketId:row[0],expectedVersion:call('detail',{id:row[0]}).data.version,changes:{responsable:'Daniel Lara',prioridad:'ALTA',fechaCompromiso:'2026-10-08',observacion:'Asignación inicial'}});
 return {context,call,sheets,row,payload,interrupt:n=>failure=n,props,coerce:()=>coerce=true,calculate:()=>{calculate=true;sheets.get('TICKETS').formulas[1][17]='=IF(I2="ALTA","CALCULATED SLA","POR DEFINIR")';}};
}

test('invalid signature cannot read tickets',()=>{const s=setup();assert.equal(typeof s.context.handleAdminEnvelope,'function');assert.equal(s.context.handleAdminEnvelope('{}','bad').code,'INVALID_SIGNATURE');});
test('expired and replayed envelopes are denied',()=>{const s=setup();assert.equal(s.call('list',{},undefined,{issuedAt:1}).code,'EXPIRED');const nonce='fixed-nonce-123456';assert.equal(s.call('list',{},undefined,{nonce}).ok,true);assert.equal(s.call('list',{},undefined,{nonce}).code,'REPLAY');});
test('revoked and duplicated permissions deny admin access',()=>{const s=setup();s.sheets.get('Permisos de usuario').rows[1][2]='';assert.equal(s.call('list').code,'FORBIDDEN');s.sheets.get('Permisos de usuario').rows.push(['e.conesa@ciarm.edu.mx','Activo','Administrador']);assert.equal(s.call('list',{},'e.conesa@ciarm.edu.mx').code,'FORBIDDEN');assert.equal(s.call('list',{},'r.valencia@ciarm.edu.mx').code,'FORBIDDEN');});
test('list preserves historical types and omits purchases',()=>{const s=setup();s.sheets.get('TICKETS').rows.push([...s.row]);s.sheets.get('TICKETS').rows[2][0]='TKT-2026-00002';s.sheets.get('TICKETS').rows[2][6]='Compras';const r=s.call('list');assert.equal(r.ok,true);assert.equal(r.data.length,1);assert.equal(r.data[0].tipo,'Tipo histórico');});
test('assignment updates controlled fields and preserves execution fields',()=>{const s=setup();const r=s.call('assign',s.payload());assert.equal(r.ok,true);assert.equal(r.data.ticket.estado,'ASIGNADO');assert.equal(s.sheets.get('TICKETS').rows[1][13],'inicio previo');assert.equal(s.sheets.get('TICKETS').rows[1][9],'Daniel Lara');assert.equal(s.sheets.get('BITACORA TICKETS').rows[1][1],'CONFIRMADO');});
test('stale version cannot overwrite another administrator',()=>{const s=setup();const p=s.payload();s.sheets.get('TICKETS').rows[1][7]='Cambio externo';assert.equal(s.call('assign',p).code,'CONFLICT');assert.equal(s.sheets.get('TICKETS').rows[1][9],'SIN ASIGNAR');});
test('prewrite conflict differs from a journaled operation',()=>{const s=setup();const p=s.payload();p.expectedVersion='wrong';assert.equal(s.call('assign',p).operationPending,false);const t=setup();const q=t.payload();t.interrupt('TICKETS');assert.equal(t.call('assign',q).operationPending,true);});
test('invalid catalog, date, terminal state and duplicate ID never write',()=>{for(const mutate of [p=>p.changes.responsable='Inventado',p=>p.changes.prioridad='POR DEFINIR',p=>p.changes.fechaCompromiso='2026-02-30',p=>p.changes.fechaCompromiso='2026-10-06']){const s=setup();const p=s.payload();mutate(p);assert.equal(s.call('assign',p).code,'VALIDATION');assert.equal(s.sheets.get('TICKETS').rows[1][9],'SIN ASIGNAR');}const s=setup();s.sheets.get('TICKETS').rows[1][12]='CERRADO';assert.equal(s.call('assign',s.payload()).code,'VALIDATION');s.sheets.get('TICKETS').rows.push([...s.row]);assert.equal(s.call('detail',{id:s.row[0]}).code,'DUPLICATE_ID');});
test('retry recovers pending journal exactly once',()=>{const s=setup();const p=s.payload();s.interrupt('TICKETS');assert.equal(s.call('assign',p).ok,false);assert.equal(s.sheets.get('BITACORA TICKETS').rows[1][1],'PENDIENTE');assert.equal(s.call('assign',p).ok,true);assert.equal(s.call('assign',p).ok,true);assert.equal(s.sheets.get('BITACORA TICKETS').rows.length,2);p.changes.prioridad='MEDIA';assert.equal(s.call('assign',p).code,'OPERATION_REUSED');});
test('detail restores original pending payload only for its administrator',()=>{const s=setup();const p=s.payload();s.interrupt('TICKETS');s.call('assign',p);assert.deepEqual(JSON.parse(JSON.stringify(s.call('detail',{id:s.row[0]}).data.pendingOperation)),p);assert.equal(s.call('detail',{id:s.row[0]},'e.conesa@ciarm.edu.mx').data.pendingOperation,undefined);});
test('retry after row commit confirms journal without another mutation',()=>{const s=setup();const p=s.payload();s.call('assign',p);s.sheets.get('BITACORA TICKETS').rows[1][1]='PENDIENTE';assert.equal(s.call('assign',p).ok,true);assert.equal(s.sheets.get('BITACORA TICKETS').rows.length,2);assert.equal(s.sheets.get('BITACORA TICKETS').rows[1][1],'CONFIRMADO');});
test('retry recovers a partially applied assignment',()=>{const s=setup();const p=s.payload();s.interrupt('TICKETS');s.call('assign',p);s.sheets.get('TICKETS').rows[1][9]='Daniel Lara';assert.equal(s.call('assign',p).ok,true);assert.equal(s.sheets.get('TICKETS').rows[1][8],'ALTA');assert.equal(s.sheets.get('BITACORA TICKETS').rows.length,2);});
test('observations that begin with a formula are stored as literal text',()=>{const s=setup();const p=s.payload();p.changes.observacion='=IMPORTXML("https://example.invalid","//x")';s.coerce();assert.equal(s.call('assign',p).ok,true);assert.ok(!s.sheets.get('TICKETS').rows[1][19].startsWith('='));});
test('assignment confirms typed dates from real Sheets coercion',()=>{const s=setup();s.coerce();const r=s.call('assign',s.payload());assert.equal(r.ok,true);assert.equal(r.data.ticket.fechaCompromiso,'2026-10-08');});
test('derived formula recalculation does not conflict with assignment',()=>{const s=setup();s.calculate();const r=s.call('assign',s.payload());assert.equal(r.ok,true);assert.equal(s.sheets.get('TICKETS').rows[1][17],'CALCULATED SLA');assert.equal(s.sheets.get('BITACORA TICKETS').rows[1][1],'CONFIRMADO');});
test('time-valued cells show the request time',()=>{const s=setup();s.sheets.get('TICKETS').rows[1][2]=new Date('1899-12-30T15:30:00Z');assert.equal(s.call('detail',{id:s.row[0]}).data.hora,'10:30:00');});
