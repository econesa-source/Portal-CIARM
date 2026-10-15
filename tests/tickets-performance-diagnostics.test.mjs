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
  assert.match(root.textContent,/Lectura/);
  assert.match(root.textContent,/Apps Script \(ms\)/);
  assert.match(root.textContent,/transporte\/inicio/);
  assert.ok(calls.slice(2).every(x => new URL(x.url,'https://portal2.ciarm.edu.mx').searchParams.get('perf')==='1'));

  assert.doesNotMatch(root.textContent,/Dato privado/);
  const actions=calls.slice(2).map(x=>new URL(x.url,'https://portal2.ciarm.edu.mx').searchParams.get('action'));
  assert.deepEqual(actions,['context','list','catalogs','serviceContext','serviceList','detail']);
  assert.ok(calls.every(x=>x.method==='GET' && x.credentials==='same-origin'));
  assert.match(root.textContent,/Lectura directa automática activa/);
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

test('comparación opcional sólo usa GET y no cambia permisos',async()=>{
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
 const button=[...document.querySelectorAll('button')].find(x=>/Comparar datos \(opcional\)/.test(x.textContent));
 assert.equal(button.disabled,false);
 button.click();
 for(let i=0;i<100&&!document.querySelector('main').textContent.includes('Coinciden: listado');i++)
  await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.querySelector('main').textContent,/Coinciden: listado/);
 assert.deepEqual(calls.slice(2).map(x=>x.url),['/tickets-api.php?action=validateDirectReads']);
 assert.ok(calls.every(x=>x.opts.method==='GET'&&x.opts.credentials==='same-origin'));
 dom.window.close();
});

test('HTTP 401 al validar lectura rápida se informa como sesión vencida, no como diferencia de datos',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#diagnostico-permisos'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
   calls.push(url);
   if(url==='/auth-session.php')return {ok:true,status:200,json:async()=>({ok:true,user:{correo:'user@ciarm.edu.mx'}})};
   if(url.startsWith('/portal-permissions.php'))return {ok:true,status:200,json:async()=>({ok:true,data:{verified:true,enforced:true,codes:['INT_GESTION']}})};
   return {ok:false,status:401,json:async()=>({ok:false,code:'UNAUTHENTICATED'})};
 };
 await render(document.querySelector('main'));
 const button=[...document.querySelectorAll('button')].find(x=>x.textContent==='Comparar datos (opcional)');
 assert.equal(button.disabled,false);
 button.click();
 for(let n=0;n<50&&!document.querySelector('main').textContent.includes('La sesión institucional venció');n++)
  await new Promise(resolve=>setImmediate(resolve));
 const content=document.querySelector('main').textContent;
 assert.match(content,/Sesión PHP: NO VERIFICADA/);
 assert.match(content,/Volvé a iniciar sesión/);
 assert.doesNotMatch(content,/existe una diferencia entre las lecturas/);
 assert.equal(button.disabled,true);
 assert.equal([...document.querySelectorAll('button')].find(x=>x.textContent==='Medir velocidad de tickets').disabled,true);
 assert.deepEqual(calls,['/auth-session.php','/portal-permissions.php?preflight=1','/tickets-api.php?action=validateDirectReads']);
 dom.window.close();
});

test('lecturas Sheets muestran la fuente real, sin contabilizarlas como GAS',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://portal2.ciarm.edu.mx/#diagnostico-permisos'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 globalThis.fetch=async(url,opts)=>{
  if(url==='/auth-session.php')return {ok:true,status:200,json:async()=>({ok:true})};
  if(url.startsWith('/portal-permissions.php'))return {ok:true,status:200,json:async()=>({ok:true,data:{verified:true,enforced:true,codes:['INT_GESTION']}})};
  const action=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action');
  const direct=action==='list'||action==='catalogs';
  return {
   ok:true,status:200,
   json:async()=>({ok:true,data:action==='list'?[{id:'TKT-2026-00001'}]:{}}),
   headers:{get:name=>name==='X-CIARM-Tickets-Read-Source'?(direct?'sheets-direct':'apps-script'):
    name==='Server-Timing'?(direct?'session;dur=2.0, sheets_direct;dur=480.0, apps_script;dur=0.0, total;dur=510.0':'apps_script;dur=1800.0, total;dur=1900.0'):null}
  };
 };
 const root=document.querySelector('main');
 await render(root);
 const measure=[...root.querySelectorAll('button')].find(x=>/Medir velocidad/.test(x.textContent));
 measure.click();
 for(let i=0;i<80 && !root.textContent.includes('Apps Script ejecución');i++)await new Promise(resolve=>setImmediate(resolve));
 const text=root.textContent;
 assert.match(text,/Listado de tickets[^\n]*Sheets API/);
 assert.match(text,/Catálogos[^\n]*Sheets API/);
 assert.match(text,/Lectura directa automática activa/);
 dom.window.close();
});
