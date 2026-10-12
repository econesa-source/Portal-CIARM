import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {render} from '../src/components/adminSolicitudesWidget.js';
import {installDialog} from './dialog-fixture.mjs';

function setup(empty=false,beforePost) {
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#admin-solicitudes'});
 installDialog(dom);
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData});
 const base={fecha:'2026-10-12',solicitante:'Persona',area:'Primaria',tipo:'Mantenimiento',descripcion:'Reparar equipo',urgencia:'ALTA',prioridad:'ALTA',fechaCompromiso:'2026-10-15',version:'v1',observaciones:''};
 const tickets=empty?[]:[
  {...base,id:'NEW',estado:'NUEVO',responsable:'SIN ASIGNAR'},
  {...base,id:'WAIT',estado:'EN ESPERA',responsable:'  '},
  {...base,id:'WORK',estado:'EN PROCESO',responsable:'Daniel Lara'},
  {...base,id:'DONE',estado:'CERRADO',responsable:'SIN ASIGNAR'},
  {...base,id:'HISTORY',estado:'HISTÓRICO',responsable:'Daniel Lara',tipo:'<img src=x onerror=alert(1)>'}
 ];
 globalThis.fetch=async(url,options)=>{
  const action=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action');
  let data;
  if(options.method==='POST'){
   await beforePost?.();
   const post=JSON.parse(options.body);const ticket={...tickets.find(t=>t.id===post.ticketId),...post.changes,estado:'ASIGNADO',version:'v2'};
   data={ticket};
  } else data=action==='context'?{canAdmin:true,csrfToken:'csrf'}:action==='list'?tickets:action==='catalogs'?{responsables:['Daniel Lara'],prioridades:['ALTA','MEDIA']}:tickets.find(t=>t.id===new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('id'));
  return {ok:true,json:async()=>({ok:true,data})};
 };
 return {dom,root:document.querySelector('main'),flush:()=>new Promise(r=>setImmediate(r))};
}
test('dashboard includes every real state, including historical values',async()=>{
 const s=setup();await render(s.root);
 assert.equal(s.root.querySelector('[data-state="EN PROCESO"] [data-count]').textContent,'1');
 assert.equal(s.root.querySelector('[data-state="HISTÓRICO"] [data-count]').textContent,'1');
 assert.equal(s.root.querySelector('#ticket-total').textContent,'5 solicitudes');
 s.dom.window.close();
});
test('administrator opens with only pending assignments and no expanded subset',async()=>{
 const s=setup();await render(s.root);
 assert.ok(s.root.querySelector('#ticket-subset').hidden);
 assert.equal(s.root.querySelector('#ticket-pending').hidden,false);
 assert.equal(s.root.querySelectorAll('#ticket-subset-body [data-id]').length,0);
 assert.deepEqual([...s.root.querySelectorAll('#ticket-pending-body [data-id]')].map(e=>e.dataset.id),['NEW','WAIT']);
 s.dom.window.close();
});
test('state selection replaces pending list immediately below dashboard',async()=>{
 const s=setup();await render(s.root);
 s.root.querySelector('[data-state="EN PROCESO"]').click();
 assert.deepEqual([...s.root.querySelectorAll('#ticket-subset-body [data-id]')].map(e=>e.dataset.id),['WORK']);
 assert.ok(s.root.querySelector('#ticket-pending').hidden);
 assert.equal(s.root.querySelector('#ticket-dashboard').nextElementSibling,s.root.querySelector('#ticket-subset'));
 assert.equal(s.root.querySelector('#ticket-subset').hidden,false);
 s.dom.window.close();
});
test('distribution grouping filters tickets and never interprets labels as markup',async()=>{
 const s=setup();await render(s.root);
 const selector=s.root.querySelector('#ticket-group');selector.value='tipo';selector.dispatchEvent(new s.dom.window.Event('change'));
 const historical=[...s.root.querySelectorAll('[data-group-value]')].find(b=>b.dataset.groupValue.startsWith('<img'));
 historical.click();
 assert.deepEqual([...s.root.querySelectorAll('#ticket-subset-body [data-id]')].map(e=>e.dataset.id),['HISTORY']);
 assert.equal(s.root.querySelector('img'),null);
 assert.ok(s.root.querySelector('#ticket-pending').hidden);
 s.root.querySelector('#ticket-clear-group').click();
 assert.equal(s.root.querySelectorAll('#ticket-subset-body [data-id]').length,0);
 assert.ok(s.root.querySelector('#ticket-subset').hidden);
 assert.equal(s.root.querySelector('#ticket-pending').hidden,false);
 assert.ok(s.root.ownerDocument.activeElement.matches('[data-state]'));
 s.dom.window.close();
});
test('ordinary filters refine selected grouping without restoring pending list',async()=>{
 const s=setup();await render(s.root);
 s.root.querySelector('[data-state="EN PROCESO"]').click();
 const query=s.root.querySelector('#ticket-query');query.value='nonexistent';query.dispatchEvent(new s.dom.window.Event('input'));
 assert.equal(s.root.querySelectorAll('#ticket-subset-body [data-id]').length,0);
 assert.ok(s.root.querySelector('#ticket-pending').hidden);
 assert.equal(s.root.querySelector('#ticket-subset').hidden,false);
 s.dom.window.close();
});
test('closing a grouped ticket restores focus to its visible list',async()=>{
 const s=setup();await render(s.root);
 s.root.querySelector('[data-state="NUEVO"]').click();
 s.root.querySelector('#ticket-subset-body [data-id="NEW"]').click();await s.flush();
 s.root.querySelector('#ticket-modal-close').click();
 assert.equal(s.root.ownerDocument.activeElement,s.root.querySelector('#ticket-subset-body [data-id="NEW"]'));
 s.dom.window.close();
});
test('saving assignment updates dashboard and removes the assigned pending ticket',async()=>{
 const s=setup();await render(s.root);
 s.root.querySelector('#ticket-pending-body [data-id="NEW"]').click();await s.flush();
 s.root.querySelector('[name=responsable]').value='Daniel Lara';
 s.root.querySelector('[name=prioridad]').value='ALTA';
 s.root.querySelector('[name=fechaCompromiso]').value='2026-10-15';
 s.root.querySelector('form').dispatchEvent(new s.dom.window.Event('submit',{bubbles:true,cancelable:true}));await s.flush();
 assert.equal(s.root.querySelector('#ticket-pending-body [data-id="NEW"]'),null);
 assert.equal(s.root.querySelector('[data-state="ASIGNADO"] [data-count]').textContent,'1');
 assert.match(s.root.querySelector('#ticket-notice').textContent,/guardada y registrada/);
 s.dom.window.close();
});
test('empty source has zero indicators and actionable empty messages',async()=>{
 const s=setup(true);await render(s.root);
 assert.equal(s.root.querySelector('#ticket-total').textContent,'0 solicitudes');
 assert.match(s.root.querySelector('#ticket-pending').textContent,/No hay solicitudes pendientes de asignación/);
 assert.equal(s.root.querySelectorAll('[data-id]').length,0);
 s.dom.window.close();
});
test('delayed save refreshes dashboard while another ticket detail remains open',async()=>{
 let confirm;
 const gate=new Promise(resolve=>{confirm=resolve;});
 const s=setup(false,()=>gate);await render(s.root);
 s.root.querySelector('#ticket-pending-body [data-id="NEW"]').click();await s.flush();
 s.root.querySelector('[name=responsable]').value='Daniel Lara';
 s.root.querySelector('[name=prioridad]').value='ALTA';
 s.root.querySelector('[name=fechaCompromiso]').value='2026-10-15';
 s.root.querySelector('form').dispatchEvent(new s.dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await s.flush();
 s.root.querySelector('[data-state="EN PROCESO"]').click();
 s.root.querySelector('#ticket-subset-body [data-id="WORK"]').click();await s.flush();
 confirm();await s.flush();
 assert.equal(s.root.querySelector('#ticket-pending-body [data-id="NEW"]'),null);
 assert.equal(s.root.querySelector('[data-state="ASIGNADO"] [data-count]').textContent,'1');
 assert.equal(s.root.querySelector('#ticket-detail h2').textContent,'WORK');
 s.dom.window.close();
});
