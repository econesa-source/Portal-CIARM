import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentPayload} from '../src/services/comprasAttachment.js';
test('encodes PDF attachment and rejects oversized or unsupported content',async()=>{
 const pdf={name:'cotizacion.pdf',type:'application/pdf',size:9,arrayBuffer:async()=>new TextEncoder().encode('%PDF-test').buffer};
 assert.deepEqual(await attachmentPayload(pdf),{nombre:'cotizacion.pdf',mime:'application/pdf',base64:'JVBERi10ZXN0'});
 await assert.rejects(()=>attachmentPayload({...pdf,size:2097153}),/2 MB/);
 await assert.rejects(()=>attachmentPayload({...pdf,type:'text/html'}),/PDF, JPG o PNG/);
});
