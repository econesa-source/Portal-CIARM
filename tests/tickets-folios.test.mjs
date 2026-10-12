import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalFixture} from './helpers/tickets-portal-fixture.mjs';
function reserve(s){assert.equal(typeof s.context.portalReserveTicketSlot,'function');return s.context.portalReserveTicketSlot(s.book,null,new Date('2027-01-01T06:00:00Z'));}
test('allocator scans beyond 300 rows and preserves gaps and occupied rows',()=>{
 const rows=Array.from({length:350},(_,i)=>{const r=Array(24).fill('');r[0]=i===1?'':`TKT-2026-${String(i+1).padStart(5,'0')}`;return r;});
 const s=portalFixture({rows});const before=JSON.stringify(s.rows);const next=reserve(s);
 assert.equal(next.id,'TKT-2027-00351');assert.equal(next.rowNumber,352);assert.equal(JSON.stringify(s.rows),before);
});
test('allocator chooses maximum number rather than count and skips reservations',()=>{
 const s=portalFixture();s.rows[1][0]='TKT-2025-00900';
 assert.equal(reserve(s).id,'TKT-2027-00901');
 const log={rows:[[],['op','PENDIENTE','actor','hash','TKT-2026-00950','','','',JSON.stringify({reservation:{rowNumber:99}}),'CREAR']]};
 const next=s.context.portalReserveTicketSlot(s.book,log,new Date('2027-01-01T06:00:00Z'));
 assert.equal(next.id,'TKT-2027-00951');assert.equal(next.rowNumber,100);
});
test('duplicated or malformed existing folios block allocation without mutation',()=>{
 const s=portalFixture();s.rows.push([...s.rows[1]]);assert.throws(()=>reserve(s),e=>e.adminCode==='DUPLICATE_ID');
 s.rows.pop();s.rows[1][0]='TKT-2026-invalid';assert.throws(()=>reserve(s),e=>e.adminCode==='SCHEMA');
});
