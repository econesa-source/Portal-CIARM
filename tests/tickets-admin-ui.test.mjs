import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from '../src/components/adminSolicitudesWidget.js';

function setup(id='TKT-2026-00001',canAdmin=true,postResult=()=>({ok:true,data:{}})) {
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#admin-solicitudes'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData});
 const ticket={id,fecha:'2026-10-07',hora:'10:00:00',tipo:'Tipo histórico',descripcion:'<img src=x onerror=alert(1)>',solicitante:'Persona',correo:'persona@ciarm.edu.mx',area:'TI',estado:'NUEVO',urgencia:'Alta solicitada',prioridad:'POR DEFINIR',responsable:'SIN ASIGNAR',fechaCompromiso:'',observaciones:'',adjuntos:'javascript:alert(1) https://drive.google.com/file/d/test/view',version:'version-1'};
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});let body;let status=200;
  if(options.method==='POST'){body=postResult(JSON.parse(options.body));status=body.ok?200:409;}
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
