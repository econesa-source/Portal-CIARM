import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('IB client explicitly selects IB permissions at backend',()=>{
 const client=readFileSync('src/components/ibWidget.js','utf8');
 const backend=readFileSync('voiceflow.php','utf8');
 assert.match(client,/module: 'ib'/);
 assert.match(backend,/\$module === 'ib' \? \['IB_TARJETA', 'IB_ACCEDER'\]/);
 assert.match(backend,/foreach \(\$requiredCodes as \$code\)/);
});
