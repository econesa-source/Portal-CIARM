// Generated read-only SLA projector from Apps Script authoritative source.
// Run: node scripts/build-ticket-service-projector.mjs
// This prevents a second handwritten interpretation of CIARM's SLA rules.
import fs from 'node:fs';
const flow=fs.readFileSync(new URL('../apps-script/tickets-service-flow.gs',import.meta.url),'utf8');
const policy=fs.readFileSync(new URL('../apps-script/tickets-service-policy.gs',import.meta.url),'utf8');
function extract(source,name){
 const start=source.indexOf('function '+name+'(');
 if(start<0)throw Error('Missing canonical GAS function '+name);
 const after=source.indexOf('\nfunction ',start+1);
 return source.slice(start,after<0?undefined:after).trim();
}
const helper=String.raw`// GENERATED FILE — do not edit. Source: apps-script/tickets-service-{policy,flow}.gs
function adminFail(code){throw Object.assign(new Error(code),{code});}
const Utilities={
 formatDate(date,zone,pattern){
  if(zone!=='America/Cancun')throw Error('SERVICE_TIMEZONE');
  const utc=new Date(new Date(date).getTime()-5*3600000).toISOString();
  if(pattern==='yyyy-MM-dd HH:mm:ss')return utc.slice(0,10)+' '+utc.slice(11,19);
  if(pattern==='yyyy-MM-dd')return utc.slice(0,10);
  throw Error('SERVICE_DATE_FORMAT');
 }
};
`;
const pure=['serviceValidatePolicy','serviceWindow','serviceDeadline','serviceElapsedHours']
 .map(n=>extract(policy,n)).join('\n\n');
let serviceDate=extract(flow,'serviceDate');
let serviceView=extract(flow,'serviceView');
serviceView=serviceView.replace('function serviceView(meta,ticket)', 'function serviceView(meta,ticket,at)')
 .replace('now=new Date()', 'now=new Date(at)')
 .replaceAll('serviceNow()', 'serviceNow(at)');
const serviceNow="function serviceNow(at){return Utilities.formatDate(new Date(at),'America/Cancun','yyyy-MM-dd HH:mm:ss');}";
const footer=String.raw`
export function projectService(meta,ticket,serverNow){
 if(meta===null)return null;
 if(!meta||typeof meta!=='object'||typeof serverNow!=='string'||!Number.isFinite(Date.parse(serverNow)))throw Error('SCHEMA');
 return serviceView(meta,ticket,serverNow);
}
`;
fs.mkdirSync(new URL('../src/generated/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../src/generated/tickets-service-projector.js',import.meta.url),
 [helper,pure,serviceDate,serviceNow,serviceView,footer].join('\n\n')+'\n');
