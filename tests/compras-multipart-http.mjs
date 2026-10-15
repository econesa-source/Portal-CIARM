// Temporary PHP router exercises genuine HTTP uploads; never deployed as an endpoint.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(join(tmpdir(),'compras-upload-'));
const router=join(temp,'router.php');
await writeFile(router,`<?php require ${JSON.stringify(resolve('compras-lib.php'))}; header('Content-Type: application/json'); try { $data=ciarm_compras_request_body(); echo json_encode($data); } catch(Throwable $e) { http_response_code(422); echo json_encode(['code'=>'INVALID_REQUEST']); }`);
const server=spawn('php',['-d','upload_max_filesize=3M','-d','post_max_size=4M','-S','127.0.0.1:18787',router],{stdio:'ignore'});
const url='http://127.0.0.1:18787';
const metadata={action:'crearSolicitud',payload:{claveEnvio:'unique-request-12345678'},csrfToken:'c'.repeat(64)};
function form(bytes='%PDF-test',mime='application/pdf',data=metadata){const f=new FormData();f.append('request',JSON.stringify(data));f.append('adjunto',new Blob([bytes],{type:mime}),'quote.pdf');return f;}
try{
 for(let i=0;i<40;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 let r=await fetch(url,{method:'POST',body:form()});assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.csrfToken,metadata.csrfToken);assert.equal(data.payload.claveEnvio,metadata.payload.claveEnvio);
 assert.deepEqual(data.payload.adjuntoArchivo,{nombre:'quote.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-test').toString('base64')});
 for(const body of [form('<html>bad</html>'),form('%PDF-test','text/html'),form('%PDF-'+ 'x'.repeat(2097152)),form('%PDF-test','application/pdf',{...metadata,action:'decidirSolicitud'}),form('%PDF-test','application/pdf',{...metadata,payload:{adjuntoArchivo:{}}})]){
  r=await fetch(url,{method:'POST',body});assert.equal(r.status,422);
 }
 const extra=form();extra.append('actor','other@ciarm.edu.mx');r=await fetch(url,{method:'POST',body:extra});assert.equal(r.status,422);
 r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(metadata)});assert.equal(r.status,200);assert.deepEqual(await r.json(),metadata);
 console.log('Compras multipart PHP HTTP: valid upload, exact bytes, CSRF/idempotence preservation, 6 invalid uploads and JSON compatibility PASS');
}finally{server.kill();await rm(temp,{recursive:true,force:true});}
