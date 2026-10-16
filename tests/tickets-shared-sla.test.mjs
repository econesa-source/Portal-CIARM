import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectService} from '../src/generated/tickets-service-projector.js';
import {serviceList} from '../src/services/ticketsServiceWorkflow.js';

const flow=fs.readFileSync(new URL('../apps-script/tickets-service-flow.gs',import.meta.url),'utf8');
const policyCode=fs.readFileSync(new URL('../apps-script/tickets-service-policy.gs',import.meta.url),'utf8');
function get(source,name){
 const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0,'canonical source '+name);
 return source.slice(start,end<0?undefined:end).trim();
}
const policy={
 version:1,timeZone:'America/Cancun',startHour:8,endHour:16,
 days:[1,2,3,4,5],holidays:[],assignmentHours:8,validationHours:16,
 levels:{CRITICA:{assign:1,start:1,contain:4,resolve:null},URGENTE:{assign:4,start:4,resolve:8},
 ALTA:{assign:8,start:8,resolve:16},MEDIA:{assign:8,start:16,resolve:40},BAJA:{assign:8,start:24,resolve:80}}
};
const clock='2026-10-16T15:00:00.000Z';
const ticket={id:'TKT-2026-00001',estado:'EN PROCESO',responsable:'Dany',correo:'solicitante@ciarm.edu.mx'};
const common={
 policy,createdAt:'2026-10-13 08:00:00',assignedAt:'2026-10-13 09:00:00',
 firstAssignedAt:'2026-10-13 09:00:00',assignmentDeadline:'2026-10-13 12:00:00',
 deadlines:{start:'2026-10-14 09:00:00',resolve:'2026-10-16 09:00:00'},
 priority:'ALTA',waits:[],cycles:[],email:'d.lara@ciarm.edu.mx'
};
function reference(meta){
 const fixed=Date.parse(clock);
 class DateAt extends Date{
  constructor(...args){super(...(args.length?args:[fixed]));}
  static now(){return fixed;}
 }
 const context={
  Date:DateAt,
  Utilities:{formatDate(d,zone,pattern){
   assert.equal(zone,'America/Cancun');
   const date=new Date(new Date(d).getTime()-5*3600000).toISOString();
   return pattern==='yyyy-MM-dd HH:mm:ss'?date.slice(0,10)+' '+date.slice(11,19):date.slice(0,10);
  }},
  adminFail(code){throw Error(code);}
 };
 const funcs=['serviceValidatePolicy','serviceWindow','serviceDeadline','serviceElapsedHours']
  .map(name=>get(policyCode,name)).join('\n');
 const serviceFns=['serviceDate','serviceNow','serviceView'].map(name=>get(flow,name)).join('\n');
 vm.runInNewContext(funcs+'\n'+serviceFns+'\nthis.execute=serviceView;',context);
 // Round-trip via JSON removes VM prototype differences, preserving values.
 return JSON.parse(JSON.stringify(context.execute(JSON.parse(JSON.stringify(meta)),ticket)));
}
for(const [label,overrides] of [
 ['active',{}],
 ['paused',{waits:[{from:'2026-10-15 10:00:00',to:'2026-10-15 13:00:00',request:{followAt:'2026-10-16 12:00:00'}}]}],
 ['open wait',{waits:[{from:'2026-10-16 08:00:00',request:{followAt:'2026-10-16 12:00:00'}}]}],
 ['closed',{resolvedAt:'2026-10-15 12:00:00',closedAt:'2026-10-16 09:00:00'}]
]){
 test('read-only SLA projector matches canonical GAS: '+label,()=>{
  const meta={...structuredClone(common),...overrides};
  assert.deepEqual(projectService(meta,ticket,clock),reference(meta));
 });
}
test('read-only projector rejects malformed input',()=>{
 assert.equal(projectService(null,ticket,clock),null);
 assert.throws(()=>projectService({},ticket,'not-a-date'));
});
test('service list resolves Sheets payload and keeps null write version',async()=>{
 const urls=[];
 const meta=structuredClone(common);
 globalThis.fetch=async url=>{
  urls.push(url);
  return {ok:true,status:200,json:async()=>({ok:true,data:{
   items:[{ticket:{...ticket,version:null},meta}],serverNow:clock
  }})};
 };
 const rows=await serviceList('all');
 assert.equal(urls.length,1);
 assert.match(urls[0],/action=serviceListRaw/);
 assert.equal(rows[0].ticket.version,null);
 assert.deepEqual(rows[0].service,reference(meta));
});
test('backend fallback retains canonical GAS array, no separate client calculation',async()=>{
 const urls=[];
 globalThis.fetch=async url=>{
  urls.push(url);
  const raw=new URL(url,'https://portal2.ciarm.edu.mx').searchParams.get('action')==='serviceListRaw';
  return {ok:true,status:200,json:async()=>({ok:true,data:raw?
   {computed:true,items:[{ticket,service:{cached:true}}]}:
   [{ticket,service:{legacy:true}}]})};
 };
 const result=await serviceList('all');
 assert.equal(result[0].service.cached,true);
 assert.equal(urls.length,1);
});
test('no fallback on forbidden or malformed actor permissions',async()=>{
 const urls=[];
 globalThis.fetch=async url=>{
  urls.push(url);
  return {ok:false,status:403,json:async()=>({ok:false,code:'FORBIDDEN'})};
 };
 await assert.rejects(serviceList('all'),e=>e.code==='FORBIDDEN');
 assert.equal(urls.length,1);
});
