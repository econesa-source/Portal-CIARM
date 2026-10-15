import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCompras,clearComprasClient} from '../src/services/comprasClient.js';
test('uploads binary file as multipart retaining CSRF and idempotence',async()=>{
 const old={window:globalThis.window,fetch:globalThis.fetch};
 globalThis.window={__CIARM_COMPRAS_UI_ENABLED__:true,__CIARM_COMPRAS_WRITES_ENABLED__:true};
 const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push(init);return {ok:true,status:200,json:async()=>({ok:true,version:'compras-v1',csrfToken:'c'.repeat(64),data:{}})};};
 try{
  clearComprasClient();await requestCompras('contextoSolicitud');
  const payload={tipoSolicitud:'Compra - ya tengo cotización',centroCostos:'CC-05',fechaGeneral:'2026-10-16',responsableRecepcion:'receiver@ciarm.edu.mx',claveEnvio:'unique-request-12345678',renglones:[{descripcion:'Pantalla',cantidad:1,unidad:'unidad'}],adjuntoArchivo:{nombre:'quote.pdf',mime:'application/pdf',base64:btoa('%PDF-test')}};
  await requestCompras('crearSolicitud',payload);
  const sent=calls[1];assert.ok(sent.body instanceof FormData);
  assert.equal(sent.headers['Content-Type'],undefined);
  const metadata=JSON.parse(sent.body.get('request'));
  assert.equal(metadata.csrfToken,'c'.repeat(64));assert.equal(metadata.payload.claveEnvio,payload.claveEnvio);
  assert.equal(metadata.payload.adjuntoArchivo,undefined);
  const file=sent.body.get('adjunto');assert.equal(file.name,'quote.pdf');assert.equal(file.type,'application/pdf');assert.equal(await file.text(),'%PDF-test');
  assert.equal(payload.adjuntoArchivo.base64,btoa('%PDF-test'));
 }finally{clearComprasClient();Object.assign(globalThis,old);}
});
