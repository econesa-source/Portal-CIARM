import {validateComprasRequest,COMPRAS_OPERATIONS} from './comprasContract.js';

let csrfToken='';
function fail(code){return Object.assign(new Error(code),{code});}
export function comprasUiEnabled(){
  return typeof window!=='undefined' && window.__CIARM_COMPRAS_UI_ENABLED__===true;
}
export function clearComprasClient(){csrfToken='';}
export async function requestCompras(action,payload={},signal){
  if(!comprasUiEnabled())throw fail('SERVICE_UNAVAILABLE');
  const contract=validateComprasRequest(action,payload);
  const method=COMPRAS_OPERATIONS[action].method;
  if(method==='POST'&&!csrfToken)throw fail('CSRF_NOT_READY');
  const init={method,credentials:'same-origin',cache:'no-store',signal,headers:{'Accept':'application/json'}};
  const url='/compras-api.php'+(method==='GET'?'?action='+encodeURIComponent(action):'');
  if(method==='POST'){
    init.headers['Content-Type']='application/json';
    init.body=JSON.stringify({action:contract.action,payload:contract.payload,csrfToken});
  }
  let response;
  try{response=await fetch(url,init);}
  catch(e){if(e?.name==='AbortError')throw e;throw fail('SERVICE_UNAVAILABLE');}
  let body;try{body=await response.json();}catch{throw fail('UPSTREAM_ERROR');}
  if(!response.ok || body?.ok!==true || body.version!=='compras-v1'){
    if(response.status===401 || response.status===403)clearComprasClient();
    throw fail(body?.code||'UPSTREAM_ERROR');
  }
  if(method==='GET'){
    if(typeof body.csrfToken!=='string'||!/^([a-f0-9]{64})$/.test(body.csrfToken))
      throw fail('CSRF_NOT_READY');
    csrfToken=body.csrfToken;
  }
  return body.data;
}
