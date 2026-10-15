import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPRAS_CONTRACT_VERSION,COMPRAS_OPERATIONS,validateComprasRequest} from '../src/services/comprasContract.js';

const solicitud=()=>({
  tipoSolicitud:'Compra - necesito cotización',
  centroCostos:'CC-01',
  fechaGeneral:'2026-10-14',
  responsableRecepcion:'receptor@ciarm.edu.mx',
  areaContexto:'Laboratorio',
  renglones:[{descripcion:'Microscopio',cantidad:1,unidad:'unidad'}],
  claveEnvio:'operation_123456789012'
});

test('versión y catálogo cerrado de 14 acciones',()=>{
  assert.equal(COMPRAS_CONTRACT_VERSION,'compras-v1');
  assert.equal(Object.keys(COMPRAS_OPERATIONS).length,14);
});

test('GET de consulta no admite datos de otro actor',()=>{
  assert.deepEqual(validateComprasRequest('misPedidos',{},'GET'),{version:'compras-v1',action:'misPedidos',payload:{}});
  assert.throws(()=>validateComprasRequest('misPedidos',{actor:'otro@ciarm.edu.mx'}),/UNEXPECTED_FIELD/);
});

test('rechaza verbos y acciones no publicadas',()=>{
  assert.throws(()=>validateComprasRequest('misPedidos',{},'POST'),/METHOD_NOT_ALLOWED/);
  assert.throws(()=>validateComprasRequest('comprar',{}),/UNKNOWN_ACTION/);
});

test('solicitud multirrenglón en contrato, sin inventar ID de SOL',()=>{
  const x=solicitud();x.renglones.push({descripcion:'Reactivos',cantidad:2,unidad:'paquete'});
  assert.equal(validateComprasRequest('crearSolicitud',x).payload.renglones.length,2);
});

test('rechaza ausencia de idempotency key y líneas vacías',()=>{
  const x=solicitud();delete x.claveEnvio;
  assert.throws(()=>validateComprasRequest('crearSolicitud',x),/INVALID_REQUEST/);
  const y=solicitud();y.renglones=[{descripcion:'',cantidad:2,unidad:'unidad'}];
  assert.throws(()=>validateComprasRequest('crearSolicitud',y),/INVALID_LINES/);
});

test('no transporta tokens, roles, asientos ni correo elegido por navegador',()=>{
  for(const campo of ['email','roles','token','idAsiento','actor','funciones']){
    assert.throws(()=>validateComprasRequest('crearSolicitud',{...solicitud(),[campo]:'usuario arbitrario'}),/UNEXPECTED_FIELD/);
  }
});

test('rechaza más de veinte renglones',()=>{
  const x=solicitud();x.renglones=Array.from({length:21},()=>({descripcion:'Material',cantidad:1,unidad:'unidad'}));
  assert.throws(()=>validateComprasRequest('crearSolicitud',x),/INVALID_REQUEST/);
});

test('la elección requiere alternativa explícita y motivo',()=>{
  assert.equal(validateComprasRequest('elegirAlternativa',{idSolicitud:'SOL-000001',idAlternativa:'LCT-ABCD',motivo:'Criterio técnico'}).action,'elegirAlternativa');
  assert.throws(()=>validateComprasRequest('elegirAlternativa',{idSolicitud:'SOL-000001',idAlternativa:'LCT-ABCD',motivo:'precio'}),/INVALID_REQUEST/);
});

test('decisión acepta sólo actos canónicos del backend',()=>{
  assert.equal(validateComprasRequest('decidirSolicitud',{idSolicitud:'SOL-000001',decision:'Aprobar'}).action,'decidirSolicitud');
  assert.throws(()=>validateComprasRequest('decidirSolicitud',{idSolicitud:'SOL-000001',decision:'Firmar'}),/INVALID_REQUEST/);
});

test('recepción parcial no admite conforme superior a recibido',()=>{
  const x={idSolicitud:'SOL-000001',idRenglon:'REN-000001',cantidadRecibida:2,cantidadConforme:1,fechaRecepcion:'2026-10-14',claveEnvio:'REC_123456789012'};
  assert.equal(validateComprasRequest('declararRecepcion',x).action,'declararRecepcion');
  assert.throws(()=>validateComprasRequest('declararRecepcion',{...x,cantidadConforme:3}),/INVALID_REQUEST/);
});

test('cancelación de remanente y excepción DG exigen motivos',()=>{
  assert.throws(()=>validateComprasRequest('cancelarRemanente',{idSolicitud:'SOL-000001',motivo:'NO'}),/INVALID_REQUEST/);
  assert.throws(()=>validateComprasRequest('autorizarExcepcionCotizacion',{idSolicitud:'SOL-000001',motivo:'No alcanza'}),/INVALID_REQUEST/);
});

test('no hay endpoint de pagos ni ejecución de compras para solicitantes',()=>{
  for(const prohibida of ['registrarPago','ejecutarCompra','registrarAsiento','emitirOC','editarHT10']){
    assert.equal(Object.hasOwn(COMPRAS_OPERATIONS,prohibida),false);
  }
});
