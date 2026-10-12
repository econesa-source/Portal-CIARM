import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from '../src/components/adminSolicitudesWidget.js';
import {installDialog} from './dialog-fixture.mjs';

function setup(id='TKT-2026-00001',canAdmin=true,postResult=()=>({ok:true,data:{}})) {
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#admin-solicitudes'});
 installDialog(dom);
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData});
 const ticket={id,fecha:'2026-10-07',hora:'10:00:00',tipo:'Tipo histórico',descripcion:'<img src=x onerror=alert(1)>',solicitante:'Persona',correo:'persona@ciarm.edu.mx',area:'TI',estado:'NUEVO',urgencia:'Alta solicitada',prioridad:'POR DEFINIR',responsable:'SIN ASIGNAR',fechaCompromiso:'',observaciones:'',adjuntos:'javascript:alert(1) https://drive.google.com/file/d/test/view',version:'version-1'};
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});let body;let status=200;
  if(options.method==='POST'){body=await postResult(JSON.parse(options.body));status=body.ok?200:409;}
  else{const action=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action');body={ok:true,data:action==='context'?{canAdmin,csrfToken:'csrf'}:action==='list'?[ticket]:action==='catalogs'?{responsables:['Daniel Lara'],prioridades:['ALTA','MEDIA']}:ticket};}
  return {ok:status===200,status,json:async()=>body};
 };
 const root=document.querySelector('main');
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 async function detail(){await render(root);root.querySelector('[data-id]').click();await flush();}
 function edit(){root.querySelector('[name=responsable]').value='Daniel Lara';root.querySelector('[name=prioridad]').value='ALTA';root.querySelector('[name=fechaCompromiso]').value='2026-10-08';root.querySelector('[name=observacion]').value='Asignación';}
 async function submit(){root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();}
 return {dom,root,calls,detail,edit,submit,flush,ticket};
}
test('direct route denies unauthorized user before loading tickets',async()=>{const s=setup('TKT-2026-00002',false);await render(s.root);assert.equal(s.calls.length,1);assert.match(s.root.textContent,/No tienes permiso/);s.dom.window.close();});
test('inbox separates requested urgency and assigned priority and escapes description',async()=>{const s=setup('TKT-2026-00003');await s.detail();assert.match(s.root.querySelector('table').textContent,/2026-10-07/);assert.match(s.root.querySelector('table').textContent,/Alta solicitada/);assert.ok(s.root.querySelector('[data-filter=urgencia]'));assert.equal(s.root.querySelector('img'),null);assert.equal(s.root.querySelector('#ticket-detail a').href,'https://drive.google.com/file/d/test/view');s.dom.window.close();});
test('journaled conflict retains identical operation for retry',async()=>{const s=setup('TKT-2026-00004',true,()=>({ok:false,code:'CONFLICT',operationPending:true}));await s.detail();s.edit();await s.submit();assert.equal(s.root.querySelector('[name=observacion]').value,'Asignación');assert.equal(s.root.querySelector('[name=observacion]').disabled,true);await s.submit();const posts=s.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body));assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);s.dom.window.close();});
test('prewrite conflict keeps editable values for explicit reload',async()=>{const s=setup('TKT-2026-00005',true,()=>({ok:false,code:'CONFLICT',operationPending:false}));await s.detail();s.edit();await s.submit();assert.equal(s.root.querySelector('[name=observacion]').value,'Asignación');assert.equal(s.root.querySelector('[name=observacion]').disabled,false);assert.match(s.root.querySelector('#ticket-feedback').textContent,/Otro administrador/);s.dom.window.close();});
test('navigation aborts pending read signals',async()=>{const s=setup('TKT-2026-00006');await render(s.root);s.dom.window.dispatchEvent(new s.dom.window.HashChangeEvent('hashchange'));assert.ok(s.calls.every(call=>call.options.signal.aborted));s.dom.window.close();});
test('assignment opens in a modal outside the pending list',async()=>{
 const s=setup('TKT-2026-00007');await s.detail();
 const dialog=s.root.querySelector('dialog');assert.ok(dialog,'assignment modal exists');assert.ok(dialog.open);
 assert.ok(dialog.contains(s.root.querySelector('#ticket-assignment')));
 assert.equal(s.root.querySelector('#ticket-pending').contains(dialog),false);
 s.dom.window.close();
});
test('confirmed assignment closes modal and announces success on dashboard',async()=>{
 const s=setup('TKT-2026-00008',true,post=>({ok:true,data:{ticket:{...s.ticket,...post.changes,estado:'ASIGNADO',version:'v2'}}}));
 await s.detail();s.edit();await s.submit();
 assert.equal(s.root.querySelector('dialog')?.open,false);
 assert.equal(s.root.querySelector('#ticket-pending-body [data-id]'),null);
 assert.match(s.root.querySelector('#ticket-notice').textContent,/guardada y registrada/);
 s.dom.window.close();
});
test('failed assignment stays open with entered values',async()=>{
 const s=setup('TKT-2026-00009',true,()=>({ok:false,code:'CONFLICT',operationPending:false}));
 await s.detail();s.edit();await s.submit();
 assert.ok(s.root.querySelector('dialog')?.open);
 assert.equal(s.root.querySelector('[name=observacion]').value,'Asignación');
 s.dom.window.close();
});
test('modal cannot be dismissed while assignment is being confirmed',async()=>{
 let confirm;const gate=new Promise(resolve=>{confirm=resolve;});
 const s=setup('TKT-2026-00010',true,async post=>{await gate;return {ok:true,data:{ticket:{...s.ticket,...post.changes,estado:'ASIGNADO',version:'v2'}}};});
 await s.detail();s.edit();await s.submit();
 const modal=s.root.querySelector('dialog');const cancel=new s.dom.window.Event('cancel',{cancelable:true});
 modal.dispatchEvent(cancel);
 assert.ok(cancel.defaultPrevented);
 assert.ok(s.root.querySelector('#ticket-modal-close').disabled);
 assert.ok(modal.open);
 confirm();await s.flush();assert.equal(modal.open,false);
 s.dom.window.close();
});
test('closing loading modal prevents late detail from reopening it',async()=>{
 const s=setup('TKT-2026-00011');const initialFetch=globalThis.fetch;
 let finish;
 globalThis.fetch=(url,options)=>url.includes('action=detail')?new Promise(resolve=>{finish=resolve;}):initialFetch(url,options);
 await render(s.root);s.root.querySelector('[data-id]').click();
 const modal=s.root.querySelector('dialog');assert.ok(modal.open);
 s.root.querySelector('#ticket-modal-close').click();
 finish({ok:true,status:200,json:async()=>({ok:true,data:s.ticket})});await s.flush();
 assert.equal(modal.open,false);assert.equal(modal.querySelector('form'),null);
 s.dom.window.close();
});
test('leaving route closes modal and aborts pending requests',async()=>{
 const s=setup('TKT-2026-00012');await s.detail();
 s.dom.window.dispatchEvent(new s.dom.window.HashChangeEvent('hashchange'));
 assert.equal(s.root.querySelector('dialog').open,false);
 assert.ok(s.calls.every(call=>call.options.signal.aborted));
 s.dom.window.close();
});
test('compact assignment places request summary beside all editable fields',async()=>{
 const s=setup('TKT-2026-00013');await s.detail();
 const layout=s.root.querySelector('.ticket-assignment-layout');assert.ok(layout);
 assert.ok(layout.querySelector('.ticket-summary'));
 assert.ok(layout.querySelector('#ticket-assignment'));
 for(const name of ['responsable','prioridad','fechaCompromiso','observacion'])assert.ok(layout.querySelector(`[name=${name}]`));
 assert.equal(layout.querySelector('textarea').rows,2);
 s.dom.window.close();
});
