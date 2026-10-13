import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('La raiz del Portal usa el router con permisos DM05', () => {
  const htaccess = readFileSync('.htaccess', 'utf8');
  assert.match(htaccess, /^DirectoryIndex index\.html index-v1782\.html/m);
  const primary = readFileSync('index.html', 'utf8');
  const legacy = readFileSync('index-v1782.html', 'utf8');
  for (const html of [primary, legacy]) {
    assert.match(html, /src="src\/main\.js\?v=18\.7\.0"/);
    assert.doesNotMatch(html, /main-v1782\.js/);
  }
});

test('El router autenticado consulta DM05 antes de construir el dashboard', () => {
  const script = readFileSync('src/main.js', 'utf8');
  assert.match(script, /await getPortalPermissions\(\)/);
  assert.match(script, /applyDashboardAccess\(mainContainer, permissions\)/);
  assert.match(script, /const APP_VERSION = '18\.7\.0'/);
});
