import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import http from 'node:http';
const server=spawn('php',['-S','127.0.0.1:18786'],{stdio:'ignore',env:{...process.env,
 CIARM_COMPRAS_ENABLED:'1',CIARM_COMPRAS_WRITES_ENABLED:'0',
 CIARM_COMPRAS_ORIGIN:'https://portal2.ciarm.edu.mx',
 CIARM_COMPRAS_GAS_URL:'https://script.google.com/macros/s/test/exec',
 CIARM_COMPRAS_HMAC_KEY:'isolated-test-only-'.repeat(4)}});
try{
 for(let i=0;i<40;i++){
  try{await fetch('http://127.0.0.1:18786/compras-api.php');break;}
  catch{await new Promise(r=>setTimeout(r,100));}
 }
 const request=(opts={})=>new Promise((resolve,reject)=>{
  const req=http.request('http://127.0.0.1:18786/compras-api.php?action=misPedidos',
   {method:opts.method||'GET',headers:{Host:'portal2.ciarm.edu.mx',...opts.headers}},res=>{
    let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);
    res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(body)}));
   });req.on('error',reject);req.end(opts.body);
 });
 let r=await request();assert.equal(r.status,401);assert.equal((await r.json()).code,'UNAUTHENTICATED');
 r=await request({headers:{Origin:'https://evil.example'}});assert.equal(r.status,403);
 r=await request({headers:{'Sec-Fetch-Site':'cross-site'}});assert.equal(r.status,403);
 r=await request({method:'POST',headers:{Origin:'https://portal2.ciarm.edu.mx','Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,503);assert.equal((await r.json()).code,'SERVICE_UNAVAILABLE');
 r=await request({method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
 r=await request({method:'DELETE'});assert.equal(r.status,405);
 console.log('Compras real PHP HTTP: 6 negative/read-only checks PASS');
}finally{server.kill();}
