import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

for (const variant of ['dashboardWidget', 'dashboardVoiceflow-v1782']) {
 const {render} = await import(`../src/components/${variant}.js`);
 for (const permission of [true, false, 'error']) {
  test(`${variant}: card administrator access for ${permission}`, async () => {
   const dom = new JSDOM('<main></main>', {url:'https://portal2.ciarm.edu.mx/#inicio'});
   Object.assign(globalThis, {window:dom.window, document:dom.window.document, requestAnimationFrame:fn=>fn()});
   globalThis.fetch = async () => {
    if (permission === 'error') throw new Error('Unavailable');
    return {ok:true, json:async()=>({ok:true,data:{canAdmin:permission}})};
   };
   const root = document.querySelector('main');
   render(root, {});
   await new Promise(resolve=>setImmediate(resolve));
   const link = root.querySelector('a[href="#admin-solicitudes"]');
   if (permission === true) {
    assert.ok(link, 'administrator sees card access');
    assert.match(link.closest('.exact-card').textContent, /Solicitudes internas/);
    assert.equal(link.className, root.querySelector('a[href="#solicitudes"]').className);
    assert.ok(link.closest('.ticket-card-header'));
   } else assert.equal(link, null);
   dom.window.close();
  });
 }
 test(`${variant}: delayed permission does not change a later page`, async () => {
  const dom = new JSDOM('<main></main>', {url:'https://portal2.ciarm.edu.mx/#inicio'});
  Object.assign(globalThis, {window:dom.window, document:dom.window.document, requestAnimationFrame:fn=>fn()});
  let resolveRequest;
  globalThis.fetch = () => new Promise(resolve=>{resolveRequest=resolve;});
  const root=document.querySelector('main');
  render(root, {});
  root.innerHTML='<p>Otra página</p>';
  resolveRequest?.({ok:true,json:async()=>({ok:true,data:{canAdmin:true}})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(root.innerHTML,'<p>Otra página</p>');
  dom.window.close();
 });
}
