import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const s=vm.createContext({Date,Set});vm.runInContext(fs.readFileSync('apps-script/tickets-service-policy.gs','utf8'),s);
test('one working day from Friday 15:00 expires Monday 15:00 Cancun',()=>{assert.equal(s.serviceDeadline('2026-10-16T20:00:00Z',8,s.serviceDefaultPolicy()).toISOString(),'2026-10-19T20:00:00.000Z');});
test('out of hours and institutional holiday wait for next opening',()=>{const p=s.serviceDefaultPolicy();p.holidays=['2026-10-19'];assert.equal(s.serviceDeadline('2026-10-16T22:00:00Z',1,p).toISOString(),'2026-10-20T14:00:00.000Z');});
test('elapsed time excludes nights, weekends and holidays',()=>{assert.equal(s.serviceElapsedHours('2026-10-16T20:00:00Z','2026-10-19T14:00:00Z',s.serviceDefaultPolicy()),2);});
test('policy snapshots are copies and invalid schedules fail closed',()=>{const p=s.serviceDefaultPolicy(),copy=s.serviceValidatePolicy(p);p.levels.MEDIA.resolve=1;assert.equal(copy.levels.MEDIA.resolve,40);p.endHour=7;assert.throws(()=>s.serviceValidatePolicy(p));});
test('critical containment is separate from final resolution',()=>{const p=s.serviceDefaultPolicy();assert.equal(p.levels.CRITICA.contain,4);assert.equal(p.levels.CRITICA.resolve,null);p.levels.CRITICA.resolve=4;assert.throws(()=>s.serviceValidatePolicy(p));});
