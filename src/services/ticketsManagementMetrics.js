// Source dates are local to Cancun; never parse them in the viewer's timezone.
export function sourceTime(value,hour='') {
 let text=String(value||'').trim();
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(text)){const [d,m,y]=text.split('/');text=`${y}-${m}-${d}`;}
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))text+=' '+(hour||'00:00:00');
 if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text))return NaN;
 return Date.parse(text.replace(' ','T')+'-05:00');
}
const terminal=t=>['CERRADO','CANCELADO'].includes(t.estado);
export const needsAssignment=t=>!terminal(t)&&t.estado!=='RESUELTO'&&(t.estado==='NUEVO'||!t.responsable||t.responsable==='SIN ASIGNAR');
const endField={start:'startedAt',contain:'containedAt',resolve:'resolvedAt'};
const sample=()=>({total:0,good:0,rows:[]});
export function managementSummary(data,filters={},now=new Date()) {
 const end=now.getTime(),local=new Date(end-5*3600000),midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+5*3600000;
 const begin=filters.days?midnight-(Number(filters.days)-1)*86400000:-Infinity;
 const during=v=>{const x=sourceTime(v);return Number.isFinite(x)&&x>=begin&&x<=end;};
 const scope=data.filter(({ticket:t})=>['area','tipo','prioridad'].every(k=>!filters[k]||t[k]===filters[k]));
 const stages=Object.fromEntries(['assign','start','contain','resolve','validate'].map(k=>[k,sample()])),people=new Map(),first=sample();
 const person=name=>{name=name||'Sin responsable registrado';if(!people.has(name))people.set(name,{name,pending:[],late:[],returns:0,returnRows:[],stages:Object.fromEntries(Object.keys(stages).map(k=>[k,sample()]))});return people.get(name);};
 const events=[],returns=[];
 const add=(row,owner,key,late,date)=>{if(!during(date)||filters.responsable&&filters.responsable!==owner)return;const a=stages[key],b=person(owner).stages[key];for(const s of [a,b]){s.total++;if(!late)s.good++;s.rows.push(row);}events.push({row,key,owner,date,late});};
 for(const row of scope){const {ticket:t,service:s}=row;if(!s)continue;
  if(s.assignmentDeadline&&(s.firstAssignedAt||s.assignmentOverdue))add(row,s.assignedBy||s.assignmentOwner,'assign',s.assignmentOverdue,s.firstAssignedAt||s.assignmentDeadline);
  for(const [k,deadline] of Object.entries(s.effectiveDeadlines||{})){const done=s[endField[k]],late=(s.overdue||[]).includes(k);if(done||late)add(row,s.stageOwners?.[k]||s.email||t.responsable,k,late,done||deadline);}
  for(const c of s.cycles||[]){for(const [k,deadline] of Object.entries(c.deadlines||{})){if(c[endField[k]]||(c.outcomes||[]).includes(k))add(row,c.stageOwners?.[k]||c.executor,k,(c.outcomes||[]).includes(k),c[endField[k]]||deadline);}add(row,c.validationOwner||t.correo,'validate',c.validationLate,c.verdict?.date);if(during(c.verdict?.date)&&(!filters.responsable||filters.responsable===c.executor)){person(c.executor).returns++;person(c.executor).returnRows.push(row);returns.push(row);}}
  if(s.validationDeadline&&(s.closedAt||s.validationOverdue))add(row,t.correo,'validate',s.validationOverdue,s.closedAt||s.validationDeadline);
  const cycle=s.cycles?.[0],verdict=cycle?.verdict||s.verdict,owner=cycle?.executor||s.stageOwners?.resolve||s.email;
  if(verdict&&during(verdict.date)&&(!filters.responsable||filters.responsable===owner)){first.total++;if(!cycle&&verdict.conforme)first.good++;first.rows.push(row);}
 }
 const rows=scope.filter(({ticket:t,service:s})=>!filters.responsable||(needsAssignment(t)?s?.assignmentOwner:s?.email||t.responsable)===filters.responsable);
 const open=rows.filter(({ticket:t})=>!terminal(t));
 const outstanding=row=>{const {ticket:t,service:s}=row;if(!s||terminal(t))return false;return needsAssignment(t)&&s.assignmentOverdue||t.estado==='RESUELTO'&&s.validationOverdue||(s.overdue||[]).some(k=>!s[endField[k]])||s.waitFollowOverdue;};
 const late=open.filter(outstanding),unassigned=open.filter(r=>needsAssignment(r.ticket)),validation=open.filter(r=>r.ticket.estado==='RESUELTO');
 for(const r of open){const name=needsAssignment(r.ticket)?r.service?.assignmentOwner||'Asignación sin responsable registrado':r.service?.email||r.ticket.responsable||'Sin responsable registrado';const p=person(name);p.pending.push(r);if(outstanding(r))p.late.push(r);}
 const intervention=open.filter(r=>outstanding(r)||r.service?.priority==='CRITICA'&&!r.service.containedAt||(r.service?.cycles?.length||0)>=2);
 const weeks=Array.from({length:4},(_,i)=>{const from=midnight-(27-i*7)*86400000,to=from+7*86400000;return {label:new Date(from).toLocaleDateString('es-MX',{timeZone:'America/Cancun',day:'2-digit',month:'short'}),received:0,resolved:0,from,to};});
 let unknownDates=0;
 for(const {ticket:t,service:s} of rows){const received=s&&!s.historical?sourceTime(s.createdAt):sourceTime(t.fecha,t.hora);if(!Number.isFinite(received))unknownDates++;for(const w of weeks){if(received>=w.from&&received<w.to)w.received++;for(const date of [s?.resolvedAt,...(s?.cycles||[]).map(c=>c.resolvedAt)]){const time=sourceTime(date);if(time>=w.from&&time<w.to)w.resolved++;}}}
 return {rows,open,late,unassigned,validation,stages,first,people:[...people.values()],intervention,weeks,untracked:rows.filter(r=>!r.service).length,unknownDates,events,returns,begin,end};
}
