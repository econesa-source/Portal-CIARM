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
      headers:{get:()=> 'session;dur=1.0, identity;dur=2.0, rbac;dur=3.0, apps_script;dur=4.0, total;dur=5.0'}};
  };
  const root=document.querySelector('main');
  await render(root);
  const button=[...root.querySelectorAll('button')].find(x=>/Medir velocidad/.test(x.textContent));
  assert.equal(button.disabled,false);
  button.click();
  for(let i=0;i<100 && !root.textContent.includes('Para separar Apps Script');i++)
    await new Promise(resolve=>setImmediate(resolve));
  assert.match(root.textContent,/Detalle de ticket/);
  assert.match(root.textContent,/Puente GAS/);
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