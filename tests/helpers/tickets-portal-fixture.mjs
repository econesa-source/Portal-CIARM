import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// Keep the test clock aligned with the deliberately dated fixtures.
class FixtureDate extends Date {
 constructor(...args){super(...(args.length?args:['2026-10-07T15:00:00Z']));}
 static now(){return Date.parse('2026-10-07T15:00:00Z');}
 static [Symbol.hasInstance](value){return value instanceof Date;}
}

export const headers = ['ID TICKET','FECHA SOLICITUD','HORA SOLICITUD','ÁREA SOLICITANTE','SOLICITANTE','CORREO SOLICITANTE','TIPO DE SOLICITUD','DESCRIPCIÓN','PRIORIDAD','RESPONSABLE','FECHA ASIGNACIÓN','FECHA COMPROMISO','ESTADO','FECHA INICIO','FECHA TERMINACIÓN','TIEMPO EJECUCIÓN','TIEMPO TOTAL','SLA','PUNTOS','OBSERVACIONES','ÚLTIMA ACTUALIZACIÓN','PRIORIDAD SOLICITADA','PLAZO SOLICITADO','ARCHIVOS ADJUNTOS'];
export function portalFixture(options={}) {
 const row=['TKT-2026-00001','07/10/2026','10:00','Administración','Persona','persona@ciarm.edu.mx','Tipo histórico','Descripción','POR DEFINIR','SIN ASIGNAR','','','NUEVO','inicio previo','','','','','','','07/10/2026 10:00','Normal','',''];
 const sheets = new Map(); const metrics={formulaReads:0,valueReads:0}; let failure='';let coerce=false;let calculate=false;let lockAllowed=true;let failurePoint='';const files=new Map(),folders=new Map();
 function hit(point){if(failurePoint===point){failurePoint='';throw Error('simulated '+point);}}
 const iterator=list=>({hasNext:()=>list.length>0,next:()=>list.shift()});
 function folder(id,name,parent){const f={id,name,parent,getId:()=>id,getUrl:()=>`https://drive.google.com/drive/folders/${id}`,getFoldersByName:n=>iterator([...folders.values()].filter(x=>x.parent===id&&x.name===n)),createFolder:n=>folder('folder-'+folders.size,n,id),getFilesByName:n=>iterator([...files.values()].filter(x=>x.parent===id&&x.name===n)),createFile:blob=>{const bytes=Buffer.from(blob.getBytes()),fileId='file-'+files.size;const file={id:fileId,name:blob.getName(),parent:id,bytes,getId:()=>fileId,getUrl:()=>`https://drive.google.com/file/d/${fileId}/view`,getBlob:()=>({getBytes:()=>Array.from(bytes)}),setSharing(){return this;},setDescription(){return this;}};files.set(fileId,file);hit('afterFileCreate');return file;}};folders.set(id,f);return f;}
 folder('attachments','Root',null);
 function sheet(name,rows) {
  const formulas=rows.map(row=>row.map(()=>''));const s={rows,formulas,getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),
   getDataRange:()=>s.getRange(1,1,rows.length,s.getLastColumn()),
   getRange:(r,c,n=1,m=1)=>({getFormulas:()=>{metrics.formulaReads++;return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>formulas[r+i-1]?.[c+j-1]??''))},getValues:()=>{metrics.valueReads++;return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r+i-1]?.[c+j-1]??''))},getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),setValues:values=>{if(name==='BITACORA TICKETS'&&c===6)hit('beforeSnapshots');if(failure===name){failure='';throw Error('simulated interruption');}values.forEach((v,i)=>{rows[r+i-1]??=[];v.forEach((x,j)=>rows[r+i-1][c+j-1]=x);});},setValue:v=>{if(failure===name){failure='';throw Error('simulated interruption');}if(name==='BITACORA TICKETS'&&c===2&&v==='CONFIRMADO')hit('beforeConfirmation');if(coerce&&typeof v==='string'){if(/^\d{4}-\d{2}-\d{2}$/.test(v))v=new Date(v+'T05:00:00Z');else if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v))v=new Date(v.replace(' ','T')+'-05:00');else if(v.startsWith("'"))v=v.slice(1);}rows[r-1]??=[];rows[r-1][c-1]=v;if(failurePoint==='afterPartialRow'&&name==='TICKETS'&&c===8)hit('afterPartialRow');}}),appendRow:r=>{rows.push([...r]);}};
  sheets.set(name,s);return s;
 }
 sheet('TICKETS',[headers,...(options.rows||[[...row]])]);
 sheet('Catálogo de colaboradores',[[],[],[],['Correo Ciarm','Nombre','Apellido','Área','Status'],...(options.collaborators||[['persona@ciarm.edu.mx','Persona','Prueba','Administración','Activo'],['otra@ciarm.edu.mx','Otra','Persona','Dirección','Activo'],['d.lara@ciarm.edu.mx','Daniel','Lara','Administración','Activo'],['e.conesa@ciarm.edu.mx','Ezequiel','Conesa','Dirección','Activo'],['r.valencia@ciarm.edu.mx','Rodrigo','Valencia','Dirección','Activo']])]);
 sheet('CATALOGOS',[['ÁREAS','PRIORIDADES'],['Administración','ALTA'],['','MEDIA'],['','POR DEFINIR']]);
 sheet('RESPONSABLES',[['TIPOS','RESPONSABLE'],['TODAS','Daniel Lara']]);
 sheet('Permisos de usuario',[['Correo Ciarm','Status','Sistema de tickets'],['d.lara@ciarm.edu.mx','Activo','Administrador'],['e.conesa@ciarm.edu.mx','Activo','Administrador']]);
 const book={getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>sheet(n,[])};
 const props={TICKETS_ADMIN_SECRET:'test-secret-only-for-fixtures'};const cache=new Map();const sentEmails=[];let mailFailure='';
 const context=vm.createContext({CONFIG:{TICKETS_SPREADSHEET_ID:'tickets',DM03_SPREADSHEET_ID:'dm03',DM03_SHEET_NAME:'Catálogo de colaboradores',ATTACHMENTS_FOLDER_ID:'attachments'},Date:FixtureDate,JSON,Math,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},
  SpreadsheetApp:{openById:()=>book,flush:()=>{hit('afterRowWrite');if(calculate&&sheets.get('TICKETS').rows[1][8]==='ALTA')sheets.get('TICKETS').rows[1][17]='CALCULATED SLA';}},
  DriveApp:{getFolderById:id=>{if(!folders.has(id))throw Error('folder missing');return folders.get(id);},Access:{ANYONE_WITH_LINK:'link'},Permission:{VIEW:'view'}},
  MailApp:{sendEmail:msg=>{if(mailFailure){const err=mailFailure;mailFailure='';throw Error(err);}sentEmails.push(msg);},getRemainingDailyQuota:()=>100},
  LockService:{getScriptLock:()=>({tryLock:()=>lockAllowed,releaseLock:()=>{}})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(Array.isArray(s)?Buffer.from(s):s).digest()],computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()],parseDate:(value)=>new Date(value.replace(' ','T')+'-05:00'),formatDate:(value,tz,format)=>{const local=new Date(value.getTime()-5*3600000).toISOString();if(format==='HH:mm:ss')return local.slice(11,19);if(format==='yyyy-MM-dd HH:mm:ss')return local.slice(0,10)+' '+local.slice(11,19);return local.slice(0,10);},getUuid:()=>crypto.randomUUID(),newBlob:(value,mime,name)=>({getBytes:()=>Array.from(typeof value==='string'?Buffer.from(value):Buffer.from(value)),getContentType:()=>mime,getName:()=>name}),base64Decode:value=>Array.from(Buffer.from(value,'base64')),base64Encode:value=>Buffer.from(value).toString('base64')}});
 const source=fs.existsSync('apps-script/tickets-admin.gs')?fs.readFileSync('apps-script/tickets-admin.gs','utf8'):'';
 vm.runInContext(source,context);
 for(const file of ['tickets-protocol.gs','tickets-portal.gs','tickets-folios.gs','tickets-creation.gs','tickets-service-policy.gs','tickets-service-flow.gs']){if(fs.existsSync('apps-script/'+file))vm.runInContext(fs.readFileSync('apps-script/'+file,'utf8'),context);}
 function call(action,payload={},actor='d.lara@ciarm.edu.mx',overrides={}) {
  const envelope=JSON.stringify({action,actor,issuedAt:Math.floor(FixtureDate.now()/1000),nonce:crypto.randomUUID(),payload,...overrides});
  const signature=crypto.createHmac('sha256',props.TICKETS_ADMIN_SECRET).update(envelope).digest('hex');
  return (context.handleTicketEnvelope||context.handleAdminEnvelope)(envelope,signature);
 }
 const payload=()=>({operationId:'operation-00000001',ticketId:row[0],expectedVersion:call('detail',{id:row[0]}).data.version,changes:{responsable:'Daniel Lara',prioridad:'ALTA',fechaCompromiso:'2026-10-08',observacion:'Asignación inicial'}});
 return {context,call,sheets,book,files,metrics,sentEmails,failMailOnce:(msg='Simulated MailApp quota error')=>mailFailure=msg,failOnce:point=>failurePoint=point,rows:sheets.get('TICKETS').rows,denyLock:()=>lockAllowed=false,row,payload,interrupt:n=>failure=n,props,coerce:()=>coerce=true,calculate:()=>{calculate=true;sheets.get('TICKETS').formulas[1][17]='=IF(I2="ALTA","CALCULATED SLA","POR DEFINIR")';}};
}
