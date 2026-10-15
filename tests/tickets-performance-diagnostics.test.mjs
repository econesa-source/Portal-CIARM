import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { render } from '../src/components/portalDiagnosticsWidget.js';

test('la medición usa sesión institucional y solo consulta acciones de lectura', async () => {
  const dom = new JSDOM('<main></main>', {url:'https://portal2.ciarm.edu.mx/#diagnostico-permisos'});
  Object.assign(globalThis, {document:dom.window.document, window:dom.window});
  const calls=[];
  globalThis.fetch=async (url, options) => {
    calls.push({url,method:options.method,credentials:options.credentials});
    let data={};
    if(url==='/auth-session.php') data={ok:true};
    else if(url.startsWith('/portal-permissions.php')) data={ok:true,data:{verified:true,enforced:true,codes:['INT_GESTION']}};
    else {
      const action=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action');
      data={ok:true,data:action==='list'?[{id:'TKT-2026-00001',solicitante:'Dato privado'}]:action==='context'?{canAdmin:true}:{}};
    }
    return {ok:true,status:200,json:async()=>data,
      headers:{get:()=> 'session;dur=1.0, identity;dur=2.0, rbac;dur=3.0, apps_script;dur=4.0, total;dur=5.0, gas_identity;dur=52.0, gas_authorize;dur=14.0, gas_lock;dur=3.0, gas_nonce;dur=2.0, gas_open;dur=20.0, gas_work;dur=100.0, gas_total;dur=192.0'}};
  };
  const root=document.querySelector('main');
  await render(root);
  const button=[...root.querySelectorAll('button')].find(x=>/Medir velocidad/.test(x.textContent));
  assert.equal(button.disabled,false);
  button.click();
  for(let i=0;i<100 && !root.textContent.includes('Apps Script ejecución');i++)
    await new Promise(resolve=>setImmediate(resolve));
  assert.match(root.textContent,/Detalle de ticket/);
  assert.match(root.textContent,/Puente GAS/);
  assert.match(root.textContent,/Apps Script \(ms\)/);
  assert.match(root.textContent,/transporte\/inicio/);
  assert.ok(calls.slice(2).every(x => new URL(x.url,'https://portal2.ciarm.edu.mx').searchParams.get('perf')==='1'));

  assert.doesNotMatch(root.textContent,/Dato privado/);
  const actions=calls.slice(2).map(x=>new URL(x.url,'https://portal2.ciarm.edu.mx').searchParams.get('action'));
  assert.deepEqual(actions,['context','list','catalogs','serviceContext','serviceList','detail']);
  assert.ok(calls.every(x=>x.method==='GET' && x.credentials==='same-origin'));
  dom.window.close();
});

test('el usuario sin INT_GESTION no puede iniciar el diagnóstico de tickets',async()=>{
  const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#diagnostico-permisos'});
  Object.assign(globalThis,{document:dom.window.document,window:dom.window});
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push(url);
    return {ok:true,status:200,json:async()=>url==='/auth-session.php'?{ok:true}:{ok:true,data:{verified:true,enforced:true,codes:['INT_MIS']}}};
  };
  await render(document.querySelector('main'));
  const button=[...document.querySelectorAll('button')].find(x=>/Medir velocidad/.test(x.textContent));
  assert.equal(button.disabled,true);
  assert.deepEqual(calls,['/auth-session.php','/portal-permissions.php?preflight=1']);
  dom.window.close();
});

test('activar lectura rápida requiere verificación y nunca envía modificaciones',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#diagnostico-permisos'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,status:200,json:async()=>url==='/auth-session.php'?{ok:true}:
   url.startsWith('/portal-permissions.php')?{ok:true,data:{verified:true,enforced:true,codes:['INT_GESTION']}}:
   {ok:true,data:{enabled:true,checks:{catalogs:{same:true},list:{same:true}}}}};
 };
 await render(document.querySelector('main'));
 const button=[...document.querySelectorAll('button')].find(x=>/Validar lectura rápida/.test(x.textContent));
 assert.equal(button.disabled,false);
 button.click();
 for(let i=0;i<100&&!document.querySelector('main').textContent.includes('Lectura rápida activada');i++)
  await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.querySelector('main').textContent,/Lectura rápida activada/);
 assert.deepEqual(calls.slice(2).map(x=>x.url),['/tickets-api.php?action=validateDirectReads']);
 assert.ok(calls.every(x=>x.opts.method==='GET'&&x.opts.credentials==='same-origin'));
 dom.window.close();
});
