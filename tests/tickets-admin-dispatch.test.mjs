import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../apps-script/build.mjs';

function setup(flag){const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=>flag})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}});vm.runInContext(fs.readFileSync('apps-script/tickets-backend.gs','utf8'),context);let legacy=0;context.legacyTicketPost=()=>{legacy++;return 'legacy';};context.handleTicketEnvelope=(envelope,signature)=>({ok:typeof envelope==='string'&&signature==='signed',data:envelope});return {context,legacy:()=>legacy};}
test('original form contract still reaches legacy registration',()=>{const s=setup('true');assert.equal(s.context.doPost({parameter:{postData:JSON.stringify({tipo:'Mantenimiento',correo:'persona@ciarm.edu.mx',descripcion:'Solicitud'})}}),'legacy');assert.equal(s.legacy(),1);});
test('signed administration does not enter legacy ticket creation',()=>{const s=setup();const result=s.context.doPost({postData:{contents:JSON.stringify({envelope:'payload',signature:'signed'})}});assert.equal(JSON.parse(result.text).ok,true);assert.equal(s.legacy(),0);});
test('malformed signature wrapper cannot create a ticket',()=>{const s=setup();const result=s.context.doPost({postData:{contents:JSON.stringify({signature:'bad'})}});assert.equal(JSON.parse(result.text).ok,false);assert.equal(s.legacy(),0);});

test('unsigned entry points deny by default and require exact legacy flag',()=>{for(const flag of [undefined,'','false','TRUE']){const s=setup(flag);assert.equal(JSON.parse(s.context.doPost({postData:{contents:'{}'}}).text).code,'FORBIDDEN');assert.equal(JSON.parse(s.context.doGet({}).text).code,'FORBIDDEN');assert.equal(s.legacy(),0);}});
