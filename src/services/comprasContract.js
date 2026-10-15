/**
 * Contrato de transporte SCGRC Compras V1 (Portal CIARM).
 * NO es una fuente de permisos ni invoca APIs: la autorización permanece en DM03/DM05
 * y en los servicios HT06. La ruta PHP / puente GAS aún no está activada.
 */
export const COMPRAS_CONTRACT_VERSION = 'compras-v1';
export const COMPRAS_OPERATIONS = Object.freeze({
  contextoSolicitud: Object.freeze({method:'GET', fields:[]}),
  misPedidos: Object.freeze({method:'GET', fields:[]}),
  alternativas: Object.freeze({method:'GET', fields:[]}),
  pendientesAprobacion: Object.freeze({method:'GET', fields:[]}),
  recepcionesAsignadas: Object.freeze({method:'GET', fields:[]}),
  prorrogasPendientes: Object.freeze({method:'GET', fields:[]}),
  excepcionesPendientes: Object.freeze({method:'GET', fields:[]}),
  crearSolicitud: Object.freeze({method:'POST', fields:['tipoSolicitud','centroCostos','fechaGeneral','responsableRecepcion','areaContexto','renglones','adjuntosVinculos','adjuntoArchivo','claveEnvio']}),
  elegirAlternativa: Object.freeze({method:'POST', fields:['idSolicitud','idAlternativa','motivo']}),
  decidirSolicitud: Object.freeze({method:'POST', fields:['idSolicitud','decision','motivo','reasignacion']}),
  declararRecepcion: Object.freeze({method:'POST', fields:['idSolicitud','idRenglon','cantidadRecibida','cantidadConforme','fechaRecepcion','observacion','claveEnvio']}),
  cancelarRemanente: Object.freeze({method:'POST', fields:['idSolicitud','motivo']}),
  autorizarExcepcionCotizacion: Object.freeze({method:'POST', fields:['idSolicitud','motivo']}),
  firmarProrroga: Object.freeze({method:'POST', fields:['idOC','clave']})
});
const UNSAFE_FIELDS = new Set(['actor','email','correo','correoSolicitante','rol','roles','funciones','permisos','session','token','csrfToken','idAsiento','idTransaccion']);
function fail(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}
const plain = v => v!==null && typeof v==='object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v)===Object.prototype || Object.getPrototypeOf(v)===null);
const nonBlank = s=> typeof s==='string' && s.trim().length>0;
const maxString = (s,n) => typeof s==='string' && s.length<=n;
const id = (s,kind) => typeof s==='string' && new RegExp('^'+kind+'-[0-9]{6,}$').test(s);
/** Validación de FORMA, jamás autorización; el servidor revalida absolutamente todo. */
export function validateComprasRequest(action,payload={},method) {
  if (!Object.prototype.hasOwnProperty.call(COMPRAS_OPERATIONS,action)) fail('UNKNOWN_ACTION');
  const schema=COMPRAS_OPERATIONS[action],httpMethod=method||schema.method;
  if (httpMethod!==schema.method) fail('METHOD_NOT_ALLOWED');
  if (!plain(payload)) fail('INVALID_PAYLOAD');
  const keys=Object.keys(payload);
  if(keys.some(k=>UNSAFE_FIELDS.has(k)||!schema.fields.includes(k))) fail('UNEXPECTED_FIELD');
  if(JSON.stringify(payload).length>(action==='crearSolicitud'&&payload.adjuntoArchivo?2900000:32768)) fail('PAYLOAD_TOO_LARGE');
  if(schema.method==='GET') return {version:COMPRAS_CONTRACT_VERSION,action,payload:{}};
  if(action==='crearSolicitud'){
    if(!nonBlank(payload.tipoSolicitud)||!nonBlank(payload.centroCostos)||!nonBlank(payload.fechaGeneral)||
      !nonBlank(payload.responsableRecepcion)||!nonBlank(payload.claveEnvio)||
      !Array.isArray(payload.renglones)||payload.renglones.length<1||payload.renglones.length>20) fail('INVALID_REQUEST');
    if(!/^[A-Za-z0-9_-]{16,100}$/.test(payload.claveEnvio))fail('INVALID_IDEMPOTENCY_KEY');
    if(payload.renglones.some(r=>!plain(r)||!nonBlank(r.descripcion)||!(Number(r.cantidad)>0)||
      !nonBlank(r.unidad)||Object.keys(r).some(k=>!['descripcion','cantidad','unidad','importeDeclarado'].includes(k))))fail('INVALID_LINES');
    if(payload.adjuntoArchivo!==undefined){
      const a=payload.adjuntoArchivo;
      if(!plain(a)||Object.keys(a).sort().join(',')!=='base64,mime,nombre'||!maxString(a.nombre,180)||!nonBlank(a.nombre)||!['application/pdf','image/jpeg','image/png'].includes(a.mime)||typeof a.base64!=='string'||a.base64.length>2796204||!a.base64.length||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64))fail('INVALID_ATTACHMENT');
    }
    if(payload.areaContexto!==undefined&&!maxString(payload.areaContexto,200))fail('INVALID_CONTEXT');
    if(payload.adjuntosVinculos!==undefined&&!maxString(payload.adjuntosVinculos,4096))fail('INVALID_REFERENCE');
  }else if(action==='elegirAlternativa'){
    if(!id(payload.idSolicitud,'SOL')||!nonBlank(payload.idAlternativa)||!nonBlank(payload.motivo)||payload.motivo.trim().length<8)fail('INVALID_REQUEST');
  }else if(action==='decidirSolicitud'){
    if(!id(payload.idSolicitud,'SOL')||!['Aprobar','Rechazar','Reasignar y aprobar'].includes(payload.decision)||
      (payload.decision!=='Aprobar'&&(!nonBlank(payload.motivo))))fail('INVALID_REQUEST');
    if(payload.reasignacion!==undefined&&!plain(payload.reasignacion))fail('INVALID_REASSIGNMENT');
  }else if(action==='declararRecepcion'){
    const q=payload.cantidadRecibida,c=payload.cantidadConforme;
    if(!id(payload.idSolicitud,'SOL')||!id(payload.idRenglon,'REN')||
      typeof q!=='number'||!Number.isFinite(q)||q<=0||
      typeof c!=='number'||!Number.isFinite(c)||c<0||c>q||
      !/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaRecepcion||'')||
      !/^[A-Za-z0-9:_-]{12,120}$/.test(payload.claveEnvio||''))fail('INVALID_REQUEST');
  }else if(action==='cancelarRemanente'){
    if(!id(payload.idSolicitud,'SOL')||!nonBlank(payload.motivo)||payload.motivo.trim().length<8)fail('INVALID_REQUEST');
  }else if(action==='autorizarExcepcionCotizacion'){
    if(!id(payload.idSolicitud,'SOL')||!nonBlank(payload.motivo)||payload.motivo.trim().length<15)fail('INVALID_REQUEST');
  }else if(action==='firmarProrroga'){
    if(!id(payload.idOC,'OC')||!nonBlank(payload.clave))fail('INVALID_REQUEST');
  }
  return {version:COMPRAS_CONTRACT_VERSION,action,payload};
}
