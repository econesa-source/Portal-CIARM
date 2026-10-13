import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {render} from '../src/components/comprasWidget.js';
import {clearComprasClient} from '../src/services/comprasClient.js';
import {allowedRoute} from '../src/components/dashboardAccess.js';

const CSRF='c'.repeat(64);
const session=(codes)=>({correo:'persona@ciarm.edu.mx',dm05:{verified:true,enforced:true,codes}});
const permissions=codes=>({verified:true,enforced:true,codes});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(responses={},enabled=true){
 const dom=new JSDOM('<main id="root"></main>',{url:'https://portal2.ciarm.edu.mx/#compras'});
 const previous={
  window:globalThis.window,document:globalThis.document,
  FormData:globalThis.FormData,fetch:globalThis.fetch,crypto:Object.getOwnPropertyDescriptor(globalThis,'crypto')
 };
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData});
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID}});
 dom.window.__CIARM_COMPRAS_UI_ENABLED__=enabled;
 dom.window.confirm=()=>true;
 const calls=[];
 globalThis.fetch=async(url,opts)=>{
  const method=opts.method||'GET';
  const action=method==='GET'?new URL(url,dom.window.location.href).searchParams.get('action'):JSON.parse(opts.body).action;
  calls.push({action,method,url,body:method==='POST'?JSON.parse(opts.body):null});
  return {ok:true,status:200,json:async()=>({ok:true,version:'compras-v1',csrfToken:CSRF,
   data:typeof responses[action]==='function'?responses[action](calls):responses[action]??[]})};
 };
 clearComprasClient();
 return{
  root:dom.window.document.getElementById('root'),calls,dom,
  cleanup(){
   clearComprasClient();dom.window.close();
   globalThis.window=previous.window;globalThis.document=previous.document;
   globalThis.FormData=previous.FormData;globalThis.fetch=previous.fetch;
   if(previous.crypto)Object.defineProperty(globalThis,'crypto',previous.crypto);
   else delete globalThis.crypto;
  }
 };
}
const own={ 'ID Solicitud':'SOL-000001','ID OC':'OC-000001','Correo solicitante':'persona@ciarm.edu.mx',
 'Centro de costos':'CC-03',Estado:'Aprobada','Estado compra visible':'Compra parcial'};
const other={...own,'ID Solicitud':'SOL-000002','Correo solicitante':'otro@ciarm.edu.mx'};
const card='COMPRAS_TARJETA';

test('Compras no accede sin tarjeta madre, DM05 y bandera habilitada',async()=>{
 assert.equal(allowedRoute('#compras',permissions(['COMPRAS_CREAR'])),false);
 assert.equal(allowedRoute('#compras',{verified:false,enforced:false,codes:[card,'COMPRAS_CREAR']}),false);
 const env=setup({},false);
 try{
  await render(env.root,session([card,'COMPRAS_CREAR']));
  assert.match(env.root.textContent,/todavía no está habilitado/i);
  assert.equal(env.calls.length,0);
 }finally{env.cleanup();}
});
test('Formulario: tres tipos, centro DM04, unidad, sin preseleccionar alternativa',async()=>{
 const env=setup({contextoSolicitud:{tipos:['Compra - necesito cotización','Compra - ya tengo cotización','Reintegro de gasto'],
  areas:[{codigo:'CC-03',etiqueta:'Primaria'}],unidades:['unidad','servicio'],email:'persona@ciarm.edu.mx',areaSugerida:'CC-03'}});
 try{
  await render(env.root,session([card,'COMPRAS_CREAR']));
  const form=env.root.querySelector('#compras-crear');
  assert.ok(form);
  assert.equal(form.elements.tipoSolicitud.value,'');
  assert.equal(form.elements.centroCostos.value,'CC-03');
  assert.equal(form.querySelectorAll('#compras-lineas > .compras-line').length,1);
  assert.equal(form.querySelector('.compras-importe').hidden,true);
  form.elements.tipoSolicitud.value='Reintegro de gasto';
  form.elements.tipoSolicitud.dispatchEvent(new env.dom.window.Event('change'));
  assert.equal(form.querySelector('.compras-importe').hidden,false);
  assert.equal(form.querySelector('[name=importeDeclarado]').required,true);
  env.root.querySelector('#compras-add').click();
  assert.equal(form.querySelectorAll('#compras-lineas > .compras-line').length,2);
 }finally{env.cleanup();}
});
test('Mis pedidos: cancelación sólo para solicitante original y rol explícito',async()=>{
 const env=setup({misPedidos:[own,other],cancelarRemanente:{ok:true}});
 try{
  await render(env.root,session([card,'COMPRAS_MIS','COMPRAS_CANCELAR']));
  const forms=env.root.querySelectorAll('form[data-cancel]');
  assert.equal(forms.length,1);
  assert.equal(forms[0].dataset.cancel,own['ID Solicitud']);
  forms[0].elements.motivo.value='Cancelar los artículos todavía no recibidos';
  forms[0].dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  const sent=env.calls.find(c=>c.action==='cancelarRemanente');
  assert.equal(sent.method,'POST');
  assert.equal(sent.body.payload.idSolicitud,'SOL-000001');
  assert.equal(sent.body.csrfToken,CSRF);
  assert.equal(env.root.querySelectorAll('form[data-cancel]').length,0);
 }finally{env.cleanup();}
});
test('Rol de consulta sin cancelar no ofrece cancelación de remanente',async()=>{
 const env=setup({misPedidos:[own]});
 try{
  await render(env.root,session([card,'COMPRAS_MIS']));
  assert.equal(env.root.querySelectorAll('form[data-cancel]').length,0);
 }finally{env.cleanup();}
});
test('Prórroga: el rol específico permite abrir la pestaña de firmas sin COMPRAS_FIRMAR',async()=>{
 const env=setup({prorrogasPendientes:[{
  idOC:'OC-000001',idSolicitud:'SOL-000001',nuevaFecha:'2026-11-20',motivo:'Demora del proveedor',clave:'EXTENSION_123456789'
 }],firmarProrroga:{ok:true}});
 try{
  assert.equal(allowedRoute('#compras',permissions([card,'COMPRAS_PRORROGA_FIRMAR'])),true);
  await render(env.root,session([card,'COMPRAS_PRORROGA_FIRMAR']));
  assert.ok(env.root.querySelector('.compras-tabs [data-tab=aprobar]'));
  assert.deepEqual(env.calls.map(x=>x.action),['prorrogasPendientes']);
  assert.match(env.root.textContent,/Prórrogas de órdenes de compra/);
  env.root.querySelector('.compras-extras button').click();
  await settle();
  assert.ok(env.calls.some(c=>c.action==='firmarProrroga'&&c.body.payload.clave==='EXTENSION_123456789'));
 }finally{env.cleanup();}
});
test('Excepción DG: sólo rol específico permite autorizar con fundamento',async()=>{
 const env=setup({excepcionesPendientes:[{
  idSolicitud:'SOL-000004',centroCostos:'CC-04',descripcion:'Material de laboratorio',motivo:'Oferta única'
 }],autorizarExcepcionCotizacion:{ok:true}});
 try{
  await render(env.root,session([card,'COMPRAS_EXCEPCION_COT']));
  assert.deepEqual(env.calls.map(x=>x.action),['excepcionesPendientes']);
  const form=env.root.querySelector('.compras-extras form');
  assert.ok(form);
  form.elements.motivo.value='Se autoriza por especificaciones técnicas exclusivas';
  form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  assert.ok(env.calls.some(c=>c.action==='autorizarExcepcionCotizacion'&&c.body.payload.idSolicitud==='SOL-000004'));
 }finally{env.cleanup();}
});
test('Aprobación no selecciona decisiones y confirma cada firma',async()=>{
 const env=setup({pendientesAprobacion:[{
  'ID Solicitud':'SOL-000021','Centro de costos':'CC-03','Ruta aprobación':'APROBADOR_CENTRO','Monto cotizado total':3500
 }],decidirSolicitud:{ok:true}});
 try{
  await render(env.root,session([card,'COMPRAS_FIRMAR']));
  const form=env.root.querySelector('.compras-item form');
  assert.ok(form);assert.equal(form.elements.decision.value,'');
  form.elements.decision.value='Aprobar';
  form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  const write=env.calls.find(c=>c.action==='decidirSolicitud');
  assert.equal(write.body.payload.decision,'Aprobar');
  assert.equal(write.body.payload.idSolicitud,'SOL-000021');
 }finally{env.cleanup();}
});


test('Dirección Académica elige partida donante, artículo e importe sin reasignación automática',async()=>{
 const sol={
  'ID Solicitud':'SOL-000111','Centro de costos':'CC-03','Ruta aprobación':'DIRECCION_ACADEMICA',
  'Monto cotizado total':14000,_esReintegro:false,
  _renglones:[{'ID Renglón':'REN-000111','Descripción / especificación':'Material didáctico',
   'Fuente presupuestaria':'OPERACIÓN','Partida presupuestaria':'2.2.1.2'}],
  _donantes:[{fuente:'OPERACIÓN',partida:'2.2.1.1'},{fuente:'OPERACIÓN',partida:'2.2.1.2'},
             {fuente:'CAPEX',partida:'100.05.01'}]
 };
 const env=setup({pendientesAprobacion:[sol],decidirSolicitud:{ok:true}});
 try{
  await render(env.root,session([card,'COMPRAS_FIRMAR','COMPRAS_REASIGNAR_ACAD']));
  const form=env.root.querySelector('.compras-item form');
  assert.ok(form);
  assert.equal(form.querySelector('option[value="Reasignar y aprobar"]')!==null,true);
  form.elements.decision.value='Reasignar y aprobar';
  form.elements.decision.dispatchEvent(new env.dom.window.Event('change'));
  assert.equal(form.querySelector('.compras-rea').hidden,false);
  form.elements.renglon.value='REN-000111';
  form.elements.renglon.dispatchEvent(new env.dom.window.Event('change'));
  const opciones=[...form.elements.partidaOrigen.options].map(x=>x.value);
  assert.ok(opciones.includes('2.2.1.1'));
  assert.ok(!opciones.includes('2.2.1.2'));
  assert.ok(!opciones.includes('100.05.01'));
  form.elements.partidaOrigen.value='2.2.1.1';
  form.elements.importe.value='1500';
  form.elements.motivo.value='Cobertura con partida académica disponible';
  form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  const call=env.calls.find(c=>c.action==='decidirSolicitud');
  assert.ok(call);
  assert.equal(call.body.payload.decision,'Reasignar y aprobar');
  assert.deepEqual(
   Object.fromEntries(Object.entries(call.body.payload.reasignacion).filter(([k])=>k!=='idempotencyKey')),
   {idRenglon:'REN-000111',partidaOrigen:'2.2.1.1',importe:1500}
  );
  assert.match(call.body.payload.reasignacion.idempotencyKey,/^PORTAL_[a-f0-9]{32}$/);
 }finally{env.cleanup();}
});
test('Sin COMPRAS_REASIGNAR_ACAD no aparece la opción de reasignar',async()=>{
 const sol={'ID Solicitud':'SOL-000111','Centro de costos':'CC-03','Ruta aprobación':'DIRECCION_ACADEMICA',
  'Monto cotizado total':14000,_esReintegro:false,
  _renglones:[{'ID Renglón':'REN-000111'}],_donantes:[{fuente:'OPERACIÓN',partida:'2.2.1.1'}]};
 const env=setup({pendientesAprobacion:[sol]});
 try{
  await render(env.root,session([card,'COMPRAS_FIRMAR']));
  assert.equal(env.root.querySelector('option[value="Reasignar y aprobar"]'),null);
 }finally{env.cleanup();}
});
