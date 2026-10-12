export async function ticketRequest(action, payload, signal) {
 const mutation=action==='assign';
 const response=await fetch(mutation?'/tickets-api.php':`/tickets-api.php?action=${encodeURIComponent(action)}${payload?.id?`&id=${encodeURIComponent(payload.id)}`:''}`,{
  method:mutation?'POST':'GET',credentials:'same-origin',cache:'no-store',signal,
  headers:mutation?{Accept:'application/json','Content-Type':'application/json'}:{Accept:'application/json'},
  ...(mutation?{body:JSON.stringify({action,...payload})}:{})
 });
 let body;try{body=await response.json();}catch{body={};}
 if(!response.ok||body.ok!==true){const error=new Error('No se pudo completar la operación.');error.code=body.code||`http_${response.status}`;error.status=response.status;error.operationPending=body.operationPending;throw error;}
 return body.data;
}
export const getAdminContext=signal=>ticketRequest('context',null,signal);
export const listAdminTickets=signal=>ticketRequest('list',null,signal);
export const getAdminCatalogs=signal=>ticketRequest('catalogs',null,signal);
export const getAdminTicket=(id,signal)=>ticketRequest('detail',{id},signal);
export const assignAdminTicket=({operationId,ticketId,expectedVersion,changes},csrfToken,signal)=>ticketRequest('assign',{operationId,ticketId,expectedVersion,changes,csrfToken},signal);
export function escapeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeAttachmentUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['drive.google.com','docs.google.com'].includes(url.hostname)?url.href:null;}catch{return null;}}
export function filterTickets(tickets,filters={}) {
 const query=String(filters.query||'').trim().toLocaleLowerCase('es');
 return tickets.filter(ticket=>['estado','prioridad','urgencia','responsable','tipo','area'].every(key=>!filters[key]||ticket[key]===filters[key])&&(!query||[ticket.id,ticket.tipo,ticket.descripcion,ticket.solicitante,ticket.area].join(' ').toLocaleLowerCase('es').includes(query)));
}
