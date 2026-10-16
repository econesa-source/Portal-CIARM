import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyDashboardAccess } from '../src/components/dashboardAccess.js';
test('IB module imports and exposes its renderer', async () => {
 const m = await import('../src/components/ibWidget.js');
 assert.equal(typeof m.render, 'function');
 assert.equal(m.renderIbWidget, m.render);
});
test('Card access follows identifiers across additions and reordering', () => {
 const dom = new JSDOM('<div class="dashboard-grid-exact"><div class="exact-card" data-card="ib"><a href="#ib">IB</a></div><div class="exact-card" data-card="new-module">New</div><div class="exact-card" data-card="solicitudes">Requests</div></div>');
 globalThis.document = dom.window.document;
 applyDashboardAccess(document.body, { enforced:true, verified:true, codes:['IB_TARJETA','IB_ACCEDER'] });
 assert.ok(document.querySelector('[data-card="ib"] a'));
 assert.equal(document.querySelectorAll('.exact-card').length, 1);
});
test('IB chat uses backend messages and keeps one conversation', async () => {
 const { render } = await import('../src/components/ibWidget.js');
 const dom = new JSDOM('<main></main>');
 globalThis.document = dom.window.document;
 const calls=[];
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (url, options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({messages:['Respuesta real del motor']})};};
 try {
 await render(document.querySelector('main'), {nombre:'Test',correo:'test@ciarm.edu.mx'});
 for (const message of ['primera consulta','segunda consulta']) {
 document.querySelector('#ib-chat-input').value=message;
 document.querySelector('#ib-chat-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));
 }
 assert.match(document.querySelector('#ib-chat-box').textContent,/Respuesta real del motor/);
 assert.equal(calls[0].conversationID,calls[1].conversationID);
 assert.equal(calls[0].launch,true);
 assert.equal(calls[1].launch,false);
 } finally {globalThis.fetch=oldFetch;}
});
test('IB sidebar follows the same route permission', async () => {
 const access = await import('../src/components/dashboardAccess.js');
 assert.equal(typeof access.syncIbNavigation,'function');
 const dom=new JSDOM('<nav><a href="#ib">IB</a></nav>');
 access.syncIbNavigation(dom.window.document,{enforced:true,verified:true,codes:[]});
 assert.equal(dom.window.document.querySelector('a').hidden,true);
 access.syncIbNavigation(dom.window.document,{enforced:true,verified:true,codes:['IB_TARJETA','IB_ACCEDER']});
 assert.equal(dom.window.document.querySelector('a').hidden,false);
});
test('Cleared permissions cannot be repopulated by an old request', async () => {
 const client=await import('../src/services/portalPermissionsClient.js');
 client.clearPortalPermissionsCache();
 const oldFetch=globalThis.fetch;
 let release;
 globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});
 try {
 const pending=client.getPortalPermissions();
 client.clearPortalPermissionsCache();
 release({ok:true,json:async()=>({ok:true,data:{enforced:true,verified:true,codes:['IB_TARJETA','IB_ACCEDER']}})});
 await assert.rejects(pending);
 } finally {globalThis.fetch=oldFetch;client.clearPortalPermissionsCache();}
});
