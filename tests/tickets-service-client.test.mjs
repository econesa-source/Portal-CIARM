import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {performServiceAction,pendingServiceAction} from '../src/services/ticketsServiceWorkflow.js';
test('unknown workflow response retains operation ID across retries, without client actor',async()=>{const dom=new JSDOM('',{url:'https://portal2.ciarm.edu.mx'});globalThis.sessionStorage=dom.window.sessionStorage;let fail=true;const bodies=[];globalThis.fetch=async(_,o)=>{bodies.push(JSON.parse(o.body));if(fail)throw Error('timeout');return {ok:true,json:async()=>({ok:true,data:{ticket:{id:'TKT-1'}}})};};const payload={event:'START',expectedVersion:'v',comment:''};await assert.rejects(performServiceAction('e.conesa@ciarm.edu.mx','TKT-1',payload,'token'));const id=pendingServiceAction('e.conesa@ciarm.edu.mx','TKT-1').operationId;fail=false;await performServiceAction('e.conesa@ciarm.edu.mx','TKT-1',payload,'token');assert.equal(bodies[1].operationId,id);assert.equal(bodies[1].actor,undefined);assert.equal(pendingServiceAction('e.conesa@ciarm.edu.mx','TKT-1'),null);dom.window.close();});

test('service context uses one authenticated request including CSRF',async()=>{
 const {serviceContext}=await import('../src/services/ticketsServiceWorkflow.js');
 const calls=[];
 globalThis.fetch=async(url,options)=>{
   calls.push({url,options});
   return {ok:true,status:200,json:async()=>({ok:true,data:{enabled:true,canAdmin:true,csrfToken:'csrf-from-server'}})};
 };
 const context=await serviceContext();
 assert.equal(context.csrfToken,'csrf-from-server');
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/action=serviceContext/);
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.method,'GET');
});
test('service context fails closed if CSRF is absent',async()=>{
 const {serviceContext}=await import('../src/services/ticketsServiceWorkflow.js');
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,data:{canAdmin:true}})});
 await assert.rejects(serviceContext(),error=>error.code==='CONFIGURATION');
});
