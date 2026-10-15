// El propio serviceContext del backend incorpora el CSRF de la sesión.
async function request(action,payload,token,signal){const mutate=['saveServicePolicy','serviceTransition'].includes(action);const query=new URLSearchParams({action,...(!mutate?payload:{})});const response=await fetch(`/tickets-api.php?${query}`,{method:mutate?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,...(mutate?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload,csrfToken:token})}:{})});let body;try{body=await response.json();}catch{throw Object.assign(Error('Respuesta inválida'),{code:'UPSTREAM'});}if(!response.ok||body?.ok!==true||body.data===undefined)throw Object.assign(Error('No se pudo confirmar la operación.'),{code:body?.code||'UPSTREAM',status:response.status,operationPending:body?.operationPending});return body.data;}
export async function serviceContext(signal){
 const context=await request('serviceContext',{},null,signal);
 if(typeof context?.csrfToken!=='string'||!context.csrfToken)
   throw Object.assign(Error('El contexto institucional no está disponible.'),{code:'CONFIGURATION'});
 return context;
}
export const serviceList=(kind,signal)=>request('serviceList',{kind},null,signal);
export const serviceDetail=(id,signal)=>request('serviceDetail',{id},null,signal);
export const serviceSettings=signal=>request('serviceSettings',{},null,signal);
export const saveServicePolicy=(payload,token,signal)=>request('saveServicePolicy',payload,token,signal);
export const serviceTransition=(payload,token,signal)=>request('serviceTransition',payload,token,signal);
const key=(email,id)=>`ciarm.ticket.service:${String(email).toLowerCase()}:${id}`;
export function pendingServiceAction(email,id){const raw=sessionStorage.getItem(key(email,id));return raw?JSON.parse(raw):null;}
export async function performServiceAction(email,id,payload,token,signal){const previous=pendingServiceAction(email,id);const request=previous||{operationId:crypto.randomUUID(),ticketId:id,...payload};if(!previous)sessionStorage.setItem(key(email,id),JSON.stringify(request));try{const done=await serviceTransition(request,token,signal);sessionStorage.removeItem(key(email,id));return done;}catch(error){if(error.operationPending===false&&['VALIDATION','CONFLICT','RESPONSIBLE_ACCOUNT'].includes(error.code))sessionStorage.removeItem(key(email,id));throw error;}}

export function restoreServiceAction(email,id,request){if(request&&!pendingServiceAction(email,id))sessionStorage.setItem(key(email,id),JSON.stringify(request));}
