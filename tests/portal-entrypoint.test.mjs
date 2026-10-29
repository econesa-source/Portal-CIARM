import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('La raiz del Portal usa el router con permisos DM05', () => {
  const htaccess = readFileSync('.htaccess', 'utf8');
  assert.match(htaccess, /^DirectoryIndex index\.html index-v1782\.html/m);
  const primary = readFileSync('index.html', 'utf8');
  const legacy = readFileSync('index-v1782.html', 'utf8');
  for (const html of [primary, legacy]) {
    assert.match(html, /src="src\/main\.js\?v=18\.7\.16"/);
    assert.doesNotMatch(html, /main-v1782\.js/);
  }
});

test('El router autenticado consulta DM05 antes de construir el dashboard', () => {
  const script = readFileSync('src/main.js', 'utf8');
  assert.match(script, /await getPortalPermissions\(\)/);
  assert.match(script, /applyDashboardAccess\(mainContainer, permissions\)/);
  assert.match(script, /const APP_VERSION = '18\.7\.16'/);
  assert.match(script, /'#mis-obligaciones':\s*\(\)\s*=>\s*import\(`\.\/components\/misObligacionesWidget\.js\?v=\$\{APP_VERSION\}`\)/);
});

test('La opción Mis obligaciones de la barra lateral navega a #mis-obligaciones con formato exacto y Volver al inicio', async () => {
  const primary = readFileSync('index.html', 'utf8');
  const legacy = readFileSync('index-v1782.html', 'utf8');
  for (const html of [primary, legacy]) {
    assert.match(html, /<a href="#mis-obligaciones" class="nav-link"><span class="nav-icon">✓<\/span><span class="nav-label">Mis obligaciones<\/span><\/a>/);
  }
  const { renderMisObligacionesWidget } = await import('../src/components/misObligacionesWidget.js');
  const container = { innerHTML: '' };
  renderMisObligacionesWidget(container);
  assert.match(container.innerHTML, /<section class="inner-page">/);
  assert.match(container.innerHTML, /<a href="#inicio" class="back">← Volver al inicio<\/a>/);
  assert.match(container.innerHTML, /<span>PORTAL CIARM<\/span>/);
  assert.match(container.innerHTML, /<h1>Mis obligaciones<\/h1>/);
  assert.match(container.innerHTML, /Acá vas a consultar obligaciones, constancias, capacitaciones y documentación asignadas a tu perfil\./);
  assert.match(container.innerHTML, /<h2>Próxima etapa funcional<\/h2>/);
  assert.match(container.innerHTML, /La interfaz ya está preparada para conectar esta sección con su fuente oficial\./);
});

