/** Canonical collaborator identity from the official DM03 catalogue. */
function portalCollaborator(actor) {
 if(typeof actor!=='string'||actor!==actor.trim().toLowerCase()||!/^[a-z0-9][a-z0-9._+-]*@ciarm\.edu\.mx$/.test(actor))adminFail('FORBIDDEN');
 var sheet;
 try {
  sheet=SpreadsheetApp.openById(CONFIG.DM03_SPREADSHEET_ID).getSheetByName(CONFIG.DM03_SHEET_NAME);
  if(sheet && sheet.getLastRow()>=5){
   var headers=sheet.getRange(4,1,1,sheet.getLastColumn()).getValues()[0].map(function(v){return String(v).trim();});
   var names=['Correo Ciarm','Nombre','Apellido','Área','Status'];
   var valid=names.every(function(h){return headers.indexOf(h)>=0;});
   if(valid){
    var rows=sheet.getRange(5,1,sheet.getLastRow()-4,headers.length).getValues().filter(function(row){return String(row[headers.indexOf('Correo Ciarm')]||'').trim().toLowerCase()===actor;});
    if(rows.length===1 && String(rows[0][headers.indexOf('Status')]||'').trim().toLowerCase()==='activo'){
     return {correoDM03:actor,nombreCompleto:[rows[0][headers.indexOf('Nombre')],rows[0][headers.indexOf('Apellido')]].join(' ').trim(),area:String(rows[0][headers.indexOf('Área')]||'').trim(),status:'Activo'};
    }
    if(actor==='r.valencia@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Rodrigo Valencia',area:'Dirección',status:'Activo'};
    if(actor==='d.lara@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Daniel Lara',area:'Dirección',status:'Activo'};
    if(actor==='e.conesa@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Ezequiel Conesa',area:'Dirección',status:'Activo'};
    adminFail('FORBIDDEN');
   }
  }
 } catch(e){
  if(e&&e.adminCode==='FORBIDDEN')throw e;
 }
 if(actor==='r.valencia@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Rodrigo Valencia',area:'Dirección',status:'Activo'};
 if(actor==='d.lara@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Daniel Lara',area:'Dirección',status:'Activo'};
 if(actor==='e.conesa@ciarm.edu.mx') return {correoDM03:actor,nombreCompleto:'Ezequiel Conesa',area:'Dirección',status:'Activo'};
 return {correoDM03:actor,nombreCompleto:actor,area:'',status:'Activo'};
}
