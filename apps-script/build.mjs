import fs from 'node:fs';
const original=fs.readFileSync(new URL('./tickets-original.gs',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('./tickets-admin.gs',import.meta.url),'utf8');
const portal=['tickets-protocol.gs','tickets-portal.gs','tickets-folios.gs','tickets-creation.gs','tickets-service-policy.gs','tickets-service-flow.gs'].map(name=>fs.readFileSync(new URL('./'+name,import.meta.url),'utf8')).join('\n');
const dispatcher=`
// Entradas originales preservadas; las operaciones administrativas requieren firma.
function doPost(e) {
  try {
    var raw=(e&&e.parameter&&e.parameter.postData)||(e&&e.postData&&e.postData.contents)||'';
    var data=JSON.parse(raw);
    if (data && (Object.prototype.hasOwnProperty.call(data,'envelope') || Object.prototype.hasOwnProperty.call(data,'signature'))) {
      return ContentService.createTextOutput(JSON.stringify(handleTicketEnvelope(data.envelope,data.signature))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,code:'VALIDATION'})).setMimeType(ContentService.MimeType.JSON);
  }
  if(PropertiesService.getScriptProperties().getProperty('TICKETS_ALLOW_LEGACY')==='true')return legacyTicketPost(e);
  return ContentService.createTextOutput(JSON.stringify({ok:false,code:'FORBIDDEN'})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
 if(PropertiesService.getScriptProperties().getProperty('TICKETS_ALLOW_LEGACY')==='true')return legacyTicketGet(e);
 return ContentService.createTextOutput(JSON.stringify({ok:false,code:'FORBIDDEN'})).setMimeType(ContentService.MimeType.JSON);
}
`;
const bundle=(original.replace('function doPost(e)', 'function legacyTicketPost(e)').replace('function doGet(e)', 'function legacyTicketGet(e)')+'\n'+admin+'\n'+portal+'\n'+dispatcher).replace(/\r\n/g,'\n');
fs.writeFileSync(new URL('./tickets-backend.gs',import.meta.url),bundle,'utf8');


