import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Diagnóstico se ejecuta como ruta SPA sin salir de la sesión', () => {
  const main = readFileSync('src/main.js','utf8');
  assert.match(main, /hash === '#diagnostico-permisos'/);
  assert.match(main, /portalDiagnosticsWidget\.js/);
  assert.match(main, /hash !== '#diagnostico-permisos'/);
  const widget = readFileSync('src/components/portalDiagnosticsWidget.js','utf8');
  assert.match(widget, /fetch\('\/auth-session\.php'/);
  assert.match(widget, /fetch\('\/portal-permissions\.php\?preflight=1'/);
  assert.match(widget, /credentials:'same-origin'/);
  assert.doesNotMatch(widget, /document\.cookie/);
});

test('El diagnóstico no activa ni cambia políticas RBAC', () => {
  const endpoint = readFileSync('portal-permissions.php','utf8');
  const lib = readFileSync('portal-permissions-lib.php','utf8');
  assert.match(endpoint,/ciarm_session_user\(\)/);
  assert.match(endpoint,/ciarm_rbac_effective\(\$user, \$preflight\)/);
  assert.match(lib,/getenv\('CIARM_DM05_ENFORCE'\) !== '0'/);
});
