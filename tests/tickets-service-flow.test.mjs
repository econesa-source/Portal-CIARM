import {test} from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {portalFixture} from './helpers/tickets-portal-fixture.mjs';
function fixture(){const s=portalFixture();return s;}
function policy(s){const p=s.context.serviceDefaultPolicy();p.responsibles=[{name:'Daniel Lara',email:'d.lara@ciarm.edu.mx'},{name:'PRUEBA — Ezequiel Conesa',email:'e.conesa@ciarm.edu.mx',test:true}];return p;}
function activate(s){const r=s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:0,policy:policy(s)});assert.equal(r.ok,true,JSON.stringify(r));return r;}
function transition(s,action,actor='d.lara@ciarm.edu.mx',extra={}){const d=s.call('serviceDetail',{id:s.row[0]});return s.call('serviceTransition',{operationId:crypto.randomUUID(),ticketId:s.row[0],expectedVersion:d.data.ticket.version,event:action,comment:'Prueba con evidencia',...extra},actor);}
function assign(s){const r=s.call('assign',s.payload());assert.equal(r.ok,true,JSON.stringify(r));return r;}
test('service settings require administrator, unique active mapping and published version',()=>{const s=fixture();assert.equal(s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:0,policy:policy(s)},'persona@ciarm.edu.mx').code,'FORBIDDEN');activate(s);assert.equal(s.call('serviceSettings').data.policy.version,1);const p=policy(s);p.responsibles[0].email='unknown@ciarm.edu.mx';assert.equal(s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:1,policy:p}).code,'FORBIDDEN');});
test('only assigned executor starts and only requester can close or return',()=>{const s=fixture();activate(s);assign(s);assert.equal(transition(s,'START','otra@ciarm.edu.mx').code,'FORBIDDEN');assert.equal(transition(s,'START').ok,true);assert.equal(transition(s,'RESOLVE').ok,true);assert.equal(transition(s,'ACCEPT').code,'FORBIDDEN');assert.equal(transition(s,'REJECT','persona@ciarm.edu.mx',{comment:''}).code,'VALIDATION');assert.equal(transition(s,'REJECT','persona@ciarm.edu.mx').data.ticket.estado,'ASIGNADO');assert.equal(transition(s,'START').ok,true);assert.equal(transition(s,'RESOLVE').ok,true);assert.equal(transition(s,'ACCEPT','persona@ciarm.edu.mx').data.ticket.estado,'CERRADO');});
test('waiting does not pause until administrator approval and keeps evidence',()=>{const s=fixture();activate(s);assign(s);transition(s,'START');assert.equal(transition(s,'WAIT_REQUEST','d.lara@ciarm.edu.mx',{dependency:'Proveedor',followAt:'2026-10-08 10:00:00'}).data.ticket.estado,'EN PROCESO');assert.equal(transition(s,'WAIT_APPROVE','persona@ciarm.edu.mx').code,'FORBIDDEN');assert.equal(transition(s,'WAIT_APPROVE').data.ticket.estado,'EN ESPERA');assert.equal(transition(s,'RESUME','persona@ciarm.edu.mx').code,'FORBIDDEN');assert.equal(transition(s,'RESUME').data.ticket.estado,'EN PROCESO');});
test('executor can request wait or resolve directly from assigned state',()=>{const s=fixture();activate(s);assign(s);assert.equal(transition(s,'RESOLVE').ok,true);const d=s.call('serviceDetail',{id:s.row[0]}).data;assert.equal(d.ticket.estado,'RESUELTO');assert.ok(d.service.startedAt);assert.ok(d.service.resolvedAt);});
test('flow retry recovers a row written before journal confirmation',()=>{const s=fixture();activate(s);assign(s);const detail=s.call('serviceDetail',{id:s.row[0]}).data;const p={operationId:crypto.randomUUID(),ticketId:s.row[0],expectedVersion:detail.ticket.version,event:'START',comment:''};s.failOnce('beforeConfirmation');assert.equal(s.call('serviceTransition',p).ok,false);assert.equal(s.call('serviceTransition',p).ok,true);assert.equal(s.call('serviceTransition',p).ok,true);});
test('new creation retains rule version after configuration changes',()=>{const s=fixture();activate(s);const r={operationId:crypto.randomUUID(),tipo:'Limpieza',descripcion:'Prueba nueva',prioridadSolicitada:'🔴 Urgente',fechaProgramada:'',files:[]};assert.equal(s.call('beginCreate',r,'persona@ciarm.edu.mx').ok,true);const next=policy(s);next.assignmentHours=16;assert.equal(s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:1,policy:next}).ok,true);const done=s.call('finalizeCreate',{operationId:r.operationId},'persona@ciarm.edu.mx');assert.equal(done.ok,true,JSON.stringify(done));const d=s.call('serviceDetail',{id:done.data.ticket.id},'persona@ciarm.edu.mx').data;assert.equal(d.service.policy.version,1);assert.equal(d.service.historical,false);assert.ok(d.service.assignmentDeadline);});
test('critical assignment separates containment from definitive commitment',()=>{const s=fixture();activate(s);s.sheets.get('CATALOGOS').rows.push(['','CRITICA']);const p=s.payload();p.changes.prioridad='CRITICA';assert.equal(s.call('assign',p).ok,true);const d=s.call('serviceDetail',{id:s.row[0]}).data;assert.ok(d.service.effectiveDeadlines.contain);assert.equal(d.service.effectiveDeadlines.resolve,'2026-10-08 16:00:00');});
test('priority escalation adds critical containment while retaining original deadlines',()=>{const s=fixture();activate(s);assign(s);s.sheets.get('CATALOGOS').rows.push(['','CRITICA']);const p=s.payload();p.operationId=crypto.randomUUID();p.changes.prioridad='CRITICA';assert.equal(s.call('assign',p).ok,true);const d=s.call('serviceDetail',{id:s.row[0]}).data;assert.equal(d.service.priority,'CRITICA');assert.ok(d.service.effectiveDeadlines.contain);assert.ok(d.service.originalDeadlines);});
test('historical in-progress and waiting adoption is rejected before writes',()=>{for(const state of ['EN PROCESO','EN ESPERA']){const s=fixture();s.rows[1][12]=state;activate(s);const p=s.payload();assert.equal(s.call('assign',p).code,'SERVICE_MIGRATION_REQUIRED');assert.equal(s.context.serviceCase(s.book,s.row[0]),null);assert.equal(s.rows[1][9],'SIN ASIGNAR');}});
test('visible journal distinguishes lifecycle events through validation',()=>{const s=fixture();activate(s);assign(s);transition(s,'START');transition(s,'RESOLVE');transition(s,'ACCEPT','persona@ciarm.edu.mx');const d=s.call('serviceDetail',{id:s.row[0]}).data;assert.deepEqual(d.history.filter(h=>h.action!=='ASIGNAR').map(h=>h.action),['START','RESOLVE','ACCEPT']);});
test('critical resolution requires separate containment evidence',()=>{const s=fixture();activate(s);s.sheets.get('CATALOGOS').rows.push(['','CRITICA']);const p=s.payload();p.changes.prioridad='CRITICA';s.call('assign',p);transition(s,'START');assert.equal(transition(s,'RESOLVE').code,'VALIDATION');assert.equal(transition(s,'CONTAIN').ok,true);assert.equal(transition(s,'RESOLVE').ok,true);});
test('flow detail restores pending operation only to its original actor',()=>{const s=fixture();activate(s);assign(s);const d=s.call('serviceDetail',{id:s.row[0]}).data,p={operationId:crypto.randomUUID(),ticketId:s.row[0],expectedVersion:d.ticket.version,event:'START',comment:''};s.failOnce('beforeConfirmation');assert.equal(s.call('serviceTransition',p).ok,false);assert.equal(s.call('serviceDetail',{id:s.row[0]}).data.pendingOperation?.operationId,p.operationId);assert.equal(s.call('serviceDetail',{id:s.row[0]},'persona@ciarm.edu.mx').data.pendingOperation,undefined);});
test('service listing reads tracking once rather than once per ticket',()=>{const rows=Array.from({length:100},(_,i)=>{const r=Array(24).fill('');r[0]=`TKT-2026-${i+1}`;r[5]='persona@ciarm.edu.mx';r[12]='NUEVO';return r;});const s=portalFixture({rows}),table=s.book.insertSheet('SEGUIMIENTO SERVICIO');table.appendRow(['FOLIO','SEGUIMIENTO']);const p=s.context.serviceDefaultPolicy();for(const row of rows)table.appendRow([row[0],JSON.stringify({policy:p,createdAt:'2026-10-07 10:00:00',cycles:[],waits:[],email:'d.lara@ciarm.edu.mx'})]);let reads=0;const get=table.getDataRange;table.getDataRange=()=>{reads++;return get();};assert.equal(s.call('serviceList',{kind:'all'}).data.length,100);assert.ok(reads<=2,`tracking reads ${reads}`);});
test('executor name fallback grants roles.executor when meta.email is missing and auto-heals on start',()=>{
 const s=fixture();activate(s);
 // Set ticket responsable to 'Rodrigo Valencia' in TICKETS sheet and create meta without email
 s.rows[1][9]='Rodrigo Valencia';
 s.rows[1][12]='ASIGNADO';
 const table=s.book.insertSheet('SEGUIMIENTO SERVICIO');
 table.appendRow(['FOLIO','SEGUIMIENTO']);
 const p=policy(s);
 p.responsibles.push({name:'PRUEBA — Rodrigo Valencia',email:'r.valencia@ciarm.edu.mx',test:true});
 s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:1,policy:p});
 table.appendRow([s.row[0],JSON.stringify({policy:p,createdAt:'2026-10-07 10:00:00',cycles:[],waits:[],deadlines:{start:'2026-10-08 10:00:00',resolve:'2026-10-09 10:00:00'}})])
 // Detail for Rodrigo recognizes him as executor
 const d=s.call('serviceDetail',{id:s.row[0]},'r.valencia@ciarm.edu.mx').data;
 assert.equal(d.roles.executor,true);
 // Unrelated user is forbidden from detail
 assert.equal(s.call('serviceDetail',{id:s.row[0]},'otra@ciarm.edu.mx').code,'FORBIDDEN');
 // Rodrigo can perform START and it auto-heals meta.email
 const started=s.call('serviceTransition',{operationId:crypto.randomUUID(),ticketId:s.row[0],expectedVersion:d.ticket.version,event:'START',comment:''},'r.valencia@ciarm.edu.mx');
 assert.equal(started.ok,true);
 assert.equal(started.data.ticket.estado,'EN PROCESO');
 const healedMeta=s.context.serviceCase(s.book,s.row[0]);
 assert.equal(healedMeta.email,'r.valencia@ciarm.edu.mx');
});
test('service assignment matches catalog name to policy with prefix without throwing RESPONSIBLE_ACCOUNT',()=>{
 const s=fixture();activate(s);
 const p=policy(s);
 p.responsibles.push({name:'PRUEBA — Rodrigo Valencia',email:'r.valencia@ciarm.edu.mx',test:true});
 s.call('saveServicePolicy',{operationId:crypto.randomUUID(),expectedVersion:1,policy:p});
 s.sheets.get('CATALOGOS').rows.push(['','ALTA']);
 s.sheets.get('RESPONSABLES').rows.push(['','Rodrigo Valencia']);
 const pay=s.payload();
 pay.changes.responsable='Rodrigo Valencia';
 const res=s.call('assign',pay);
 assert.equal(res.ok,true);
 const meta=s.context.serviceCase(s.book,s.row[0]);
 assert.equal(meta.email,'r.valencia@ciarm.edu.mx');
});
