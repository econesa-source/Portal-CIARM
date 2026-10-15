import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {applyDashboardAccess,allowedRoute} from '../src/components/dashboardAccess.js';
const response=codes=>({verified:true,enforced:true,codes});
test('Compras card is added only for verified grant without changing existing card mapping',()=>{
 for(const [codes,enabled,expected] of [[['COMPRAS_TARJETA','COMPRAS_CREAR'],true,true],[['COMPRAS_CREAR'],true,false],[['COMPRAS_TARJETA'],true,false],[['COMPRAS_TARJETA','COMPRAS_CREAR'],false,false]]){
  const dom=new JSDOM('<main><div class="dashboard-grid-exact">'+Array(6).fill('<div class="exact-card"></div>').join('')+'</div></main>');
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  window.__CIARM_COMPRAS_UI_ENABLED__=enabled;
  const root=document.querySelector('main');applyDashboardAccess(root,response(codes));
  assert.equal(Boolean(root.querySelector('a[href="#compras"]')),expected);
  dom.window.close();
 }
});
test('Compras integration preserves Tickets and IB route behavior',()=>{
 assert.equal(allowedRoute('#admin-solicitudes',response([])),true);
 assert.equal(allowedRoute('#vision-gerencial',response([])),true);
 assert.equal(allowedRoute('#ib',response([])),false);
 assert.equal(allowedRoute('#ib',response(['IB_TARJETA','IB_ACCEDER'])),true);
 assert.equal(allowedRoute('#compras',response(['COMPRAS_TARJETA','COMPRAS_CREAR'])),true);
 assert.equal(allowedRoute('#compras',response(['COMPRAS_CREAR'])),false);
});
