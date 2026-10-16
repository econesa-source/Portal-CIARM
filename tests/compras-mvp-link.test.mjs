import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {applyDashboardAccess, HT06_MVP_URL, allowedRoute} from '../src/components/dashboardAccess.js';

const ctx = codes => ({enforced:true,verified:true,codes,comprasEnabled:false,comprasWritesEnabled:false});
const page = () => new JSDOM('<main><div class="dashboard-grid-exact"></div></main>',{url:'https://portal2.ciarm.edu.mx/#inicio'});

test('MVP: tarjeta Compras enlaza a la hoja HT06 sin depender del proxy Portal', () => {
 const dom=page();
 const previous=globalThis.document;
 try {
  globalThis.document=dom.window.document;
  const main=dom.window.document.querySelector('main');
  const permissions=ctx(['COMPRAS_TARJETA','COMPRAS_CREAR']);
  assert.equal(allowedRoute('#compras',permissions),true);
  applyDashboardAccess(main,permissions);
  const link=main.querySelector('[data-card="compras"] a');
  assert.ok(link);
  assert.equal(link.href,HT06_MVP_URL);
  assert.equal(link.target,'_blank');
  assert.match(link.rel,/noopener/);
  assert.equal(main.querySelector('a[href="#compras"]'),null);
  applyDashboardAccess(main,permissions);
  assert.equal(main.querySelectorAll('[data-card="compras"]').length,1);
 } finally {globalThis.document=previous;dom.window.close();}
});

test('MVP: no mostrar Compras cuando falta tarjeta madre, función o DM05 verificado', () => {
 const original=globalThis.document;
 try {
  for(const permissions of [ctx(['COMPRAS_CREAR']),ctx(['COMPRAS_TARJETA']),{enforced:true,verified:false,codes:['COMPRAS_TARJETA','COMPRAS_CREAR']}]) {
   const dom=page();
   globalThis.document=dom.window.document;
   const main=dom.window.document.querySelector('main');
   assert.equal(allowedRoute('#compras',permissions),false);
   applyDashboardAccess(main,permissions);
   assert.equal(main.querySelector('[data-card="compras"]'),null);
   dom.window.close();
  }
 } finally {globalThis.document=original;}
});

test('MVP: el antiguo #compras ya no llama al módulo GAS y el sidebar enlaza a HT06', () => {
 const code=readFileSync('src/main.js','utf8');
 assert.match(code,/if \(hash === '#compras'\) \{/);
 assert.match(code,/link\.href=HT06_MVP_URL/);
 assert.match(code,/nav\.querySelector\('a\[href="#compras"\]'\)\?\.remove\(\)/);
 assert.doesNotMatch(code,/comprasUiEnabled\(\)/);
});
