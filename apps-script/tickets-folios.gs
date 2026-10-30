/** Called only while holding the shared script lock. Never counts a fixed range. */
function portalReserveTicketSlot(book,journal,now) {
 var table=adminTicketTable(book),idColumn=table.headers.indexOf('ID TICKET'),maximum=0,seen={},reservedRows={};
 function numberOf(value){
  var match=/^TKT-\d{4}-(\d+)$/.exec(value);if(!match)adminFail('SCHEMA');
  var n=Number(match[1]);if(!Number.isSafeInteger(n)||n<1)adminFail('SCHEMA');return n;
 }
 table.rows.slice(1).forEach(function(row){
  var id=String(row[idColumn]||'').trim();if(!id)return;
  if(seen[id])adminFail('DUPLICATE_ID');seen[id]=true;
  if(id.indexOf('TKT-')===0)maximum=Math.max(maximum,numberOf(id));
 });
 if(journal)journal.rows.slice(1).forEach(function(event){
  if(event[4])maximum=Math.max(maximum,numberOf(String(event[4])));
  if(event[1]==='PENDIENTE'&&event[9]==='CREAR'){
   var payload;try{payload=JSON.parse(event[8]);}catch(error){adminFail('SCHEMA');}
   var reserved=payload.reservation;
   if(reserved){if(!Number.isSafeInteger(reserved.rowNumber)||reserved.rowNumber<2)adminFail('SCHEMA');reservedRows[reserved.rowNumber]=true;}
  }
 });
 if(!Number.isSafeInteger(maximum+1))adminFail('SCHEMA');
 var rowNumber=2;
 while(true){
  if(reservedRows[rowNumber]){rowNumber++;continue;}
  var existing=table.rows[rowNumber-1];
  if(existing&&String(existing[idColumn]||'').trim()!==''){rowNumber++;continue;}
  break;
 }
 if(typeof table.sheet.getMaxRows==='function'&&rowNumber>table.sheet.getMaxRows())table.sheet.insertRowsAfter(table.sheet.getMaxRows(),rowNumber-table.sheet.getMaxRows());
 var range=table.sheet.getRange(rowNumber,1,1,table.headers.length),before=range.getValues()[0],formulas=range.getFormulas()[0];
 if(before.some(function(value,i){return value!==''&&value!==null&&!formulas[i];}))adminFail('CONFLICT');
 return {id:'TKT-'+Utilities.formatDate(now,'America/Cancun','yyyy-MM-dd').slice(0,4)+'-'+String(maximum+1).padStart(5,'0'),rowNumber:rowNumber,before:before.map(function(value,i){return adminCellValue(value,table.headers[i]);}),formulas:formulas};
}
