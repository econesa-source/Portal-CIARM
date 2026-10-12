import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';
test('active collaborator reads only own tickets with signed identity',()=>{
 const s=portalFixture();const own=s.call('mine',{},'persona@ciarm.edu.mx');assert.equal(own.ok,true);assert.equal(own.data.length,1);
 assert.equal(s.call('mine',{email:'persona@ciarm.edu.mx'},'otra@ciarm.edu.mx').data.length,0);
 assert.equal(s.call('list',{},'persona@ciarm.edu.mx').code,'FORBIDDEN');
});
test('capabilities require unique active canonical identity',()=>{
 const s=portalFixture();assert.equal(s.call('capabilities',{},'persona@ciarm.edu.mx').data?.protocol,'tickets-portal-v1');
 const rows=s.sheets.get('Catálogo de colaboradores').rows;rows.push([...rows[4]]);
 assert.equal(s.call('mine',{},'persona@ciarm.edu.mx').code,'FORBIDDEN');rows.pop();rows[4][4]='Baja';
 assert.equal(s.call('mine',{},'persona@ciarm.edu.mx').code,'FORBIDDEN');
 assert.equal(s.call('mine',{},'econesa@ciarm.edu.mx').code,'FORBIDDEN');
});
test('self-service verifies signature, time and nonce and enforces metadata limit',()=>{
 const s=portalFixture();assert.equal(typeof s.context.handleTicketEnvelope,'function');
 assert.equal(s.context.handleTicketEnvelope('{}','bad').code,'INVALID_SIGNATURE');
 assert.equal(s.call('mine',{},'persona@ciarm.edu.mx',{issuedAt:1}).code,'EXPIRED');
 const nonce='fixed-nonce-12345678';assert.equal(s.call('mine',{},'persona@ciarm.edu.mx',{nonce}).ok,true);
 assert.equal(s.call('mine',{},'persona@ciarm.edu.mx',{nonce}).code,'REPLAY');
 assert.equal(s.call('mine',{padding:'x'.repeat(50001)},'persona@ciarm.edu.mx').code,'PAYLOAD_SIZE');
});
test('busy script never allows a self-service operation',()=>{const s=portalFixture();s.denyLock();assert.equal(s.call('mine',{},'persona@ciarm.edu.mx').code,'BUSY');});
