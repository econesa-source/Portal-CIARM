const key = email => `ciarm.ticket.creation:${String(email).trim().toLowerCase()}`;
const failure = code => Object.assign(new Error(code), {code});
async function request(action, payload, csrfToken, signal, file) {
  const options = {method: payload ? 'POST' : 'GET', credentials:'same-origin',cache:'no-store',signal};
  let url = `/tickets-api.php?action=${action}`;
  if (action === 'creationStatus') {url += `&operationId=${encodeURIComponent(payload.operationId)}`;options.method='GET';}
  else if(file){const body=new FormData();for(const [k,v] of Object.entries({action,...payload,csrfToken}))body.append(k,String(v));body.append('file',file);options.body=body;}
  else if(payload){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify({action,...payload,csrfToken});}
  const response=await fetch(url,options);let body;
  try{body=await response.json();}catch{throw failure('UPSTREAM');}
  if(!response.ok||body?.ok!==true||body.data===undefined)throw failure(body?.code||'UPSTREAM');
  return body.data;
}
export const getSelfContext = signal => request('selfContext',null,null,signal);
export const listMyTickets = signal => request('mine',null,null,signal);
export const beginCreate = (payload,csrf,signal) => request('beginCreate',payload,csrf,signal);
export const uploadAttachment = (operationId,index,file,csrf,signal) => request('uploadAttachment',{operationId,index},csrf,signal,file);
export const finalizeCreate = (operationId,csrf,signal) => request('finalizeCreate',{operationId},csrf,signal);
export const getCreationStatus = (operationId,signal) => request('creationStatus',{operationId},null,signal);
export function readCreationDraft(email){const raw=sessionStorage.getItem(key(email));return raw?JSON.parse(raw):null;}
export function saveCreationDraft(email,draft){sessionStorage.setItem(key(email),JSON.stringify(draft));}
function clear(email){sessionStorage.removeItem(key(email));}
async function digest(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
export async function prepareCreationDraft(email,fields,files){
  const existing=readCreationDraft(email);if(existing)return existing;
  if(files.length>5||files.some(f=>!f.size||f.size>10*1024*1024))throw failure('FILE_INVALID');
  const manifest=[];for(const [index,file] of files.entries())manifest.push({index,name:file.name,mime:file.type||mimeFor(file.name),size:file.size,sha256:await digest(file)});
  const draft={request:{operationId:crypto.randomUUID(),...fields,files:manifest},finalizeSent:false};saveCreationDraft(email,draft);return draft;
}
function mimeFor(name){const ext=name.split('.').pop().toLowerCase();return {pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext]||'application/octet-stream';}
function confirmed(data){return data?.state==='CONFIRMADO'&&typeof data.ticket?.id==='string'&&data.ticket.id.length>0;}
export async function completeCreationDraft(email,files,csrf,signal,onProgress=()=>{}){
  const draft=readCreationDraft(email);if(!draft)throw failure('NOT_FOUND');
  let state=await beginCreate(draft.request,csrf,signal);
  if(confirmed(state)){clear(email);return state;}
  if(state?.state!=='PENDIENTE'||!Array.isArray(state.uploadedIndexes))throw failure('UPSTREAM');
  const candidates=[];for(const file of files)candidates.push({file,sha256:await digest(file)});
  for(const item of draft.request.files){
    if(state.uploadedIndexes.includes(item.index))continue;
    const match=candidates.find(c=>c.file.name===item.name&&c.file.size===item.size&&c.sha256===item.sha256);
    if(!match)throw failure('FILE_REQUIRED');
    onProgress(`Subiendo archivo ${item.index+1} de ${draft.request.files.length}…`);
    state=await uploadAttachment(draft.request.operationId,item.index,match.file,csrf,signal);
    if(state?.state!=='PENDIENTE'||!state.uploadedIndexes?.includes(item.index))throw failure('UPSTREAM');
  }
  draft.finalizeSent=true;saveCreationDraft(email,draft);onProgress('Confirmando tu solicitud…');
  state=await finalizeCreate(draft.request.operationId,csrf,signal);
  if(!confirmed(state))throw failure('PENDING_OPERATION');
  clear(email);return state;
}
export async function discardCreationDraft(email,signal){
  const draft=readCreationDraft(email);if(!draft)return;
  if(draft.finalizeSent)throw failure('PENDING_OPERATION');
  try{const state=await getCreationStatus(draft.request.operationId,signal);if(state?.finalizing||state?.state==='CONFIRMADO')throw failure('PENDING_OPERATION');if(state?.state!=='PENDIENTE')throw failure('UPSTREAM');}
  catch(error){if(error.code!=='NOT_FOUND')throw error;}
  clear(email);
}
