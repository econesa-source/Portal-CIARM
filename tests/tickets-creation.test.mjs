import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';
const actor='persona@ciarm.edu.mx';
const request=()=>({operationId:crypto.randomUUID(),tipo:'Limpieza',descripcion:'Limpiar salón',prioridadSolicitada:'🟢 Normal',fechaProgramada:'',files:[]});
function attachment(index=0,size=16){const bytes=Buffer.alloc(size);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);return {index,name:`foto${index}.png`,mime:'image/png',size,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')};}
function begin(s,r){const result=s.call('beginCreate',r,actor);assert.equal(result.ok,true,JSON.stringify(result));return result;}
test('creation derives identity from DM03 and confirms exactly one ticket on retry',()=>{
 const s=portalFixture();const r=request();begin(s,r);assert.equal(s.call('mine',{},actor).data.length,1);
 const done=s.call('finalizeCreate',{operationId:r.operationId},actor);assert.equal(done.ok,true,JSON.stringify(done));assert.equal(done.data.state,'CONFIRMADO');
 assert.equal(done.data.ticket.solicitante,'Persona Prueba');assert.equal(done.data.ticket.area,'Administración');
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).data.ticket.id,done.data.ticket.id);
 assert.equal(s.rows.length,3);assert.equal(s.sheets.get('BITACORA TICKETS').rows.length,2);
});
test('missing, mismatched and alien attachments never finalize a creation',()=>{
 const s=portalFixture();const r=request(),a=attachment();r.files=[(({base64,...meta})=>meta)(a)];begin(s,r);
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).code,'VALIDATION');
 assert.equal(s.call('uploadAttachment',{operationId:r.operationId,...a,base64:'AAAA'},actor).code,'VALIDATION');
 assert.equal(s.call('uploadAttachment',{operationId:r.operationId,...a},'otra@ciarm.edu.mx').code,'FORBIDDEN');
 assert.equal(s.rows.length,2);assert.equal(s.files.size,0);
});
test('upload interrupted after file creation recovers one original file',()=>{
 const s=portalFixture();const r=request(),a=attachment();r.files=[(({base64,...meta})=>meta)(a)];begin(s,r);
 s.failOnce('afterFileCreate');assert.equal(s.call('uploadAttachment',{operationId:r.operationId,...a},actor).ok,false);
 assert.equal(s.files.size,1);assert.equal(s.call('uploadAttachment',{operationId:r.operationId,...a},actor).ok,true);assert.equal(s.files.size,1);
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).data.ticket.adjuntos,'https://drive.google.com/file/d/file-0/view');
});
for(const point of ['afterPartialRow','afterRowWrite','beforeConfirmation'])test(`creation recovers ${point} without exposing an incomplete ticket`,()=>{
 const s=portalFixture();const r=request();begin(s,r);s.failOnce(point);
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).ok,false);
 assert.equal(s.call('mine',{},actor).data.length,1);assert.equal(s.call('list',{},'d.lara@ciarm.edu.mx').data.length,1);
 const done=s.call('finalizeCreate',{operationId:r.operationId},actor);assert.equal(done.ok,true,JSON.stringify(done));assert.equal(s.rows.length,3);
 assert.equal(s.call('mine',{},actor).data.length,2);
});
test('payload changes, revocation and cross-action operation IDs are denied',()=>{
 const s=portalFixture();const r=request();begin(s,r);
 assert.equal(s.call('beginCreate',{...r,descripcion:'otra'},actor).code,'OPERATION_REUSED');
 const admin=s.payload();admin.operationId=r.operationId;assert.equal(s.call('assign',admin,'d.lara@ciarm.edu.mx').code,'OPERATION_REUSED');
 s.sheets.get('Catálogo de colaboradores').rows[4][4]='Baja';assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).code,'FORBIDDEN');assert.equal(s.rows.length,2);
});
test('literal input and historical journal rows preserve existing formulas and events',()=>{
 const s=portalFixture();s.calculate();const r=request();r.descripcion='=IMPORTXML("x","y")';begin(s,r);
 const result=s.call('finalizeCreate',{operationId:r.operationId},actor);assert.equal(result.ok,true);
 assert.ok(s.rows[2][7].startsWith('\u200B'));assert.equal(s.sheets.get('TICKETS').formulas[1][17],'=IF(I2="ALTA","CALCULATED SLA","POR DEFINIR")');
});
test('retry restores audit snapshots after reservation is persisted',()=>{
 const s=portalFixture(),r=request();begin(s,r);s.failOnce('beforeSnapshots');
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).ok,false);
 assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).ok,true);
 const event=s.sheets.get('BITACORA TICKETS').rows[1];
 assert.ok(Array.isArray(JSON.parse(event[5])));assert.ok(Array.isArray(JSON.parse(event[6])));
});
test('list reads creation journal once rather than once per ticket',()=>{
 const s=portalFixture({rows:Array.from({length:100},(_,i)=>{const r=Array(24).fill('');r[0]=`TKT-2026-${i+1}`;r[5]=actor;return r;})});
 begin(s,request());const journal=s.sheets.get('BITACORA TICKETS'),get=journal.getDataRange;let calls=0;
 journal.getDataRange=()=>{calls++;return get();};
 assert.equal(s.call('mine',{},actor).data.length,100);assert.ok(calls<=1,`journal read ${calls} times`);
});
test('five maximum-sized files upload individually without changing metadata limits',()=>{
 const s=portalFixture(),r=request(),uploads=Array.from({length:5},(_,i)=>attachment(i,10*1024*1024));
 r.files=uploads.map(({base64,...meta})=>meta);begin(s,r);
 for(const a of uploads)assert.equal(s.call('uploadAttachment',{operationId:r.operationId,...a},actor).ok,true);
 assert.equal(s.files.size,5);assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).data.state,'CONFIRMADO');
});
test('large descriptions are rejected before accepting an unrecoverable journal',()=>{const s=portalFixture(),r=request();r.descripcion='x'.repeat(26000);assert.equal(s.call('beginCreate',r,actor).code,'PAYLOAD_SIZE');assert.equal(s.sheets.get('BITACORA TICKETS')?.rows.length||1,1);});
test('leading apostrophe remains literal through Sheets coercion and retries',()=>{const s=portalFixture(),r=request();s.coerce();r.descripcion="'Texto con comilla inicial";begin(s,r);const done=s.call('finalizeCreate',{operationId:r.operationId},actor);assert.equal(done.ok,true,JSON.stringify(done));assert.equal(done.data.ticket.descripcion,r.descripcion);assert.equal(s.call('finalizeCreate',{operationId:r.operationId},actor).ok,true);});
