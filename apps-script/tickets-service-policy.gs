/** Source-local business clock. Pure functions; no ticket mutations or inferred identity. */
function serviceDefaultPolicy(){return {version:1,timeZone:'America/Cancun',startHour:8,endHour:16,days:[1,2,3,4,5],holidays:[],assignmentHours:8,validationHours:16,levels:{CRITICA:{assign:1,start:1,contain:4,resolve:null},URGENTE:{assign:4,start:4,resolve:8},ALTA:{assign:8,start:8,resolve:16},MEDIA:{assign:8,start:16,resolve:40},BAJA:{assign:8,start:24,resolve:80}}};}
function serviceValidatePolicy(value){
 if(!value||value.timeZone!=='America/Cancun'||!Number.isInteger(value.version)||value.version<1||!Number.isInteger(value.startHour)||!Number.isInteger(value.endHour)||value.startHour<0||value.endHour>24||value.startHour>=value.endHour)throw Error('SERVICE_POLICY');
 if(!Array.isArray(value.days)||!value.days.length||new Set(value.days).size!==value.days.length||value.days.some(function(day){return !Number.isInteger(day)||day<0||day>6;}))throw Error('SERVICE_POLICY');
 if(!Array.isArray(value.holidays)||value.holidays.some(function(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return true;var d=new Date(date+'T00:00:00Z');return isNaN(d.getTime())||d.toISOString().slice(0,10)!==date;}))throw Error('SERVICE_POLICY');
 ['assignmentHours','validationHours'].forEach(function(k){if(!Number.isFinite(value[k])||value[k]<=0)throw Error('SERVICE_POLICY');});
 ['CRITICA','URGENTE','ALTA','MEDIA','BAJA'].forEach(function(level){var r=value.levels&&value.levels[level];if(!r)throw Error('SERVICE_POLICY');['assign','start'].concat(level==='CRITICA'?['contain']:['resolve']).forEach(function(k){if(!Number.isFinite(r[k])||r[k]<=0)throw Error('SERVICE_POLICY');});if(level==='CRITICA'&&r.resolve!==null)throw Error('SERVICE_POLICY');});
 return JSON.parse(JSON.stringify(value));
}
function serviceWindow(date,policy){
 // Cancun is fixed UTC-05:00. The policy rejects other zones rather than reinterpreting dates.
 var local=new Date(date.getTime()-5*3600000),day=local.toISOString().slice(0,10),base=Date.parse(day+'T00:00:00Z')+5*3600000;
 return {start:base+policy.startHour*3600000,end:base+policy.endHour*3600000,next:base+86400000,working:policy.days.indexOf(local.getUTCDay())>=0&&policy.holidays.indexOf(day)<0};
}
function serviceDeadline(received,hours,input){
 var policy=serviceValidatePolicy(input),cursor=new Date(received).getTime(),remaining=hours*3600000;
 if(!Number.isFinite(cursor)||!Number.isFinite(remaining)||remaining<0||hours>87600)throw Error('SERVICE_DATE');
 if(remaining===0)return new Date(cursor);
 for(var i=0;i<36600;i++){var w=serviceWindow(new Date(cursor),policy);cursor=Math.max(cursor,w.start);if(w.working&&cursor<w.end){var available=w.end-cursor;if(remaining<=available)return new Date(cursor+remaining);remaining-=available;}cursor=w.next;}
 throw Error('SERVICE_DATE');
}
function serviceElapsedHours(from,to,input){
 var policy=serviceValidatePolicy(input),cursor=new Date(from).getTime(),end=new Date(to).getTime(),total=0;
 if(!Number.isFinite(cursor)||!Number.isFinite(end)||end<cursor||end-cursor>36600*86400000)throw Error('SERVICE_DATE');
 while(cursor<end){var w=serviceWindow(new Date(cursor),policy);if(w.working)total+=Math.max(0,Math.min(end,w.end)-Math.max(cursor,w.start));cursor=w.next;}
 return total/3600000;
}
