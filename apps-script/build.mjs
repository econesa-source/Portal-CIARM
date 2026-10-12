import fs from 'node:fs';
const original=fs.readFileSync(new URL('./tickets-original.gs',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('./tickets-admin.gs',import.meta.url),'utf8');
const dispatcher=`
// Entradas originales preservadas; las operaciones administrativas requieren firma.
function doPost(e) {
  try {
    var raw=(e&&e.parameter&&e.parameter.postData)||(e&&e.postData&&e.postData.contents)||'';
    var data=JSON.parse(raw);
    if (data && (Object.prototype.hasOwnProperty.call(data,'envelope') || Object.prototype.hasOwnProperty.call(data,'signature'))) {
      return ContentService.createTextOutput(JSON.stringify(handleAdminEnvelope(data.envelope,data.signature))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,code:'VALIDATION'})).setMimeType(ContentService.MimeType.JSON);
  }
  return legacyTicketPost(e);
}
`;
const bundle=original.replace('function doPost(e)', 'function legacyTicketPost(e)')+'\n'+admin+'\n'+dispatcher;
fs.writeFileSync(new URL('./tickets-backend.gs',import.meta.url),bundle);
