import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../apps-script/build.mjs';

function setup(){const context=vm.createContext({ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}});vm.runInContext(fs.readFileSync('apps-script/tickets-backend.gs','utf8'),context);let legacy=0;context.legacyTicketPost=()=>{legacy++;return 'legacy';};context.handleAdminEnvelope=(envelope,signature)=>({ok:typeof envelope==='string'&&signature==='signed',data:envelope});return {context,legacy:()=>legacy};}
test('original form contract still reaches legacy registration',()=>{const s=setup();assert.equal(s.context.doPost({parameter:{postData:JSON.stringify({tipo:'Mantenimiento',correo:'persona@ciarm.edu.mx',descripcion:'Solicitud'})}}),'legacy');assert.equal(s.legacy(),1);});
test('signed administration does not enter legacy ticket creation',()=>{const s=setup();const result=s.context.doPost({postData:{contents:JSON.stringify({envelope:'payload',signature:'signed'})}});assert.equal(JSON.parse(result.text).ok,true);assert.equal(s.legacy(),0);});
test('malformed signature wrapper cannot create a ticket',()=>{const s=setup();const result=s.context.doPost({postData:{contents:JSON.stringify({signature:'bad'})}});assert.equal(JSON.parse(result.text).ok,false);assert.equal(s.legacy(),0);});
