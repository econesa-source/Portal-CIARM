import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import crypto from 'node:crypto';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';
const api=await import('../src/services/ticketsPortalService.js').catch(()=>({}));
const actor='persona@ciarm.edu.mx';
const fields={tipo:'Limpieza',descripcion:'Limpiar salón',prioridadSolicitada:'🟢 Normal',fechaProgramada:''};
const file=()=>new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB6kAAAAASUVORK5CYII=','base64')],'foto.png',{type:'image/png'});
function environment(){const dom=new JSDOM('',{url:'https://portal2.ciarm.edu.mx'});Object.assign(globalThis,{window:dom.window,sessionStorage:dom.window.sessionStorage});return dom;}
function server(s,{loseFinal=false,failSecondUpload=false}={}){const calls=[];let lost=false;
 globalThis.fetch=async(url,options)=>{
  const action=options.method==='POST'?(options.body instanceof FormData?options.body.get('action'):JSON.parse(options.body).action):new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action');
  let payload=options.method==='POST'?(options.body instanceof FormData?{operationId:options.body.get('operationId'),index:Number(options.body.get('index'))}:JSON.parse(options.body)):{};
  delete payload.action;delete payload.csrfToken;
  if(action==='creationStatus')payload.operationId=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('operationId');
  if(action==='uploadAttachment'){
   const f=options.body.get('file'),bytes=Buffer.from(await f.arrayBuffer());
   payload={...payload,name:f.name,mime:f.type,size:f.size,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')};
   if(failSecondUpload&&payload.index===1)throw Error('network');
  }
  calls.push({url,options,action,payload});
  const body=action==='selfContext'?{ok:true,data:{canCreate:true,canUpload:true,csrfToken:'csrf'}}:s.call(action,payload,actor);
  if(action==='finalizeCreate'&&loseFinal&&!lost){lost=true;throw Error('lost confirmation');}
  return {ok:body.ok,status:body.ok?200:422,json:async()=>body};
 };return calls;
}
test('own-ticket client never sends an email or actor',async()=>{
 assert.equal(typeof api.listMyTickets,'function');const dom=environment(),s=portalFixture(),calls=server(s);
 await api.listMyTickets();assert.equal(calls[0].url,'/tickets-api.php?action=mine');assert.deepEqual(calls[0].payload,{});dom.window.close();
});
test('lost final response retries stable draft and recovers one ticket',async()=>{
 assert.equal(typeof api.prepareCreationDraft,'function');const dom=environment(),s=portalFixture(),calls=server(s,{loseFinal:true}),f=file();
 const draft=await api.prepareCreationDraft(actor,fields,[f]);const persisted=sessionStorage.getItem(`ciarm.ticket.creation:${actor}`);
 assert.ok(!persisted.includes(Buffer.from(await f.arrayBuffer()).toString('base64')));
 await assert.rejects(api.completeCreationDraft(actor,[f],'csrf'));
 assert.equal(api.readCreationDraft(actor).request.operationId,draft.request.operationId);
 const done=await api.completeCreationDraft(actor,[],'csrf');assert.equal(done.state,'CONFIRMADO');assert.equal(s.rows.length,3);assert.equal(s.files.size,1);
 assert.equal(api.readCreationDraft(actor),null);
 assert.ok(calls.every(c=>!('actor' in c.payload)&&!('correo' in c.payload)));
 dom.window.close();
});
test('partial uploads survive reload and request only missing original file',async()=>{
 assert.equal(typeof api.prepareCreationDraft,'function');const dom=environment(),s=portalFixture();server(s,{failSecondUpload:true});
 const first=file(),second=new File([await first.arrayBuffer()],'otra.png',{type:'image/png'});
 await api.prepareCreationDraft(actor,fields,[first,second]);await assert.rejects(api.completeCreationDraft(actor,[first,second],'csrf'));
 assert.equal(s.files.size,1);const calls=server(s);
 const done=await api.completeCreationDraft(actor,[second],'csrf');assert.equal(done.state,'CONFIRMADO');assert.equal(s.files.size,2);
 assert.deepEqual(calls.filter(c=>c.action==='uploadAttachment').map(c=>c.payload.index),[1]);
 assert.equal(api.readCreationDraft('otra@ciarm.edu.mx'),null);dom.window.close();
});
test('unknown finalization cannot be discarded into another draft',async()=>{
 assert.equal(typeof api.discardCreationDraft,'function');const dom=environment(),s=portalFixture();server(s);
 const draft=await api.prepareCreationDraft(actor,fields,[]);draft.finalizeSent=true;api.saveCreationDraft(actor,draft);
 await assert.rejects(api.discardCreationDraft(actor),e=>e.code==='PENDING_OPERATION');
 dom.window.close();
});
