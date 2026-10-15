import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';

test('read-only roles and catalogs do not request formulas, preserving ticket versions',()=>{
 const s=portalFixture();
 const initial=s.metrics.formulaReads;
 const catalogs=s.call('catalogs',{},'e.conesa@ciarm.edu.mx');
 assert.equal(catalogs.ok,true);
 assert.equal(s.metrics.formulaReads,initial,'catalog and permission reads need values only');
 const listed=s.call('list',{},'e.conesa@ciarm.edu.mx');
 assert.equal(listed.ok,true);
 assert.ok(listed.data[0]?.version,'ticket version must be preserved');
 assert.ok(s.metrics.formulaReads>initial,'ticket snapshots must still include formulas');
});

test('service case lookup caches per request and invalidates after updates',()=>{
 const s=portalFixture();
 const book=s.book,sh=book.insertSheet('SEGUIMIENTO SERVICIO');
 sh.appendRow(['FOLIO','SEGUIMIENTO']);
 sh.appendRow(['TKT-2026-00001',JSON.stringify({email:'first@ciarm.edu.mx',waits:[],deadlines:{}})]);
 s.context.SERVICE_TABLE_CACHE={};
 assert.equal(s.context.serviceCase(book,'TKT-2026-00001').email,'first@ciarm.edu.mx');
 sh.rows[1][1]=JSON.stringify({email:'second@ciarm.edu.mx',waits:[],deadlines:{}});
 assert.equal(s.context.serviceCase(book,'TKT-2026-00001').email,'first@ciarm.edu.mx');
 s.context.serviceInvalidate('SEGUIMIENTO SERVICIO');
 assert.equal(s.context.serviceCase(book,'TKT-2026-00001').email,'second@ciarm.edu.mx');
 sh.appendRow(['TKT-2026-00001',JSON.stringify({email:'duplicate@ciarm.edu.mx'})]);
 s.context.serviceInvalidate('SEGUIMIENTO SERVICIO');
 assert.throws(()=>s.context.serviceCase(book,'TKT-2026-00001'),/DUPLICATE_ID/);
});

test('service listing resolves each case at most once',()=>{
 const s=portalFixture();
 let calls=0;const original=s.context.serviceCase;
 s.context.serviceCase=function(...args){calls++;return original(...args);};
 const x=s.call('serviceList',{kind:'all'},'e.conesa@ciarm.edu.mx');
 assert.equal(x.ok,true);
 assert.equal(calls,x.data.length);
});
