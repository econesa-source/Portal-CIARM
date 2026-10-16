import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Módulo IB and Portal navigation use sober institutional glyphs and zero emojis', () => {
  const root = path.resolve('.');
  const filesToCheck = [
    path.join(root, 'index.html'),
    path.join(root, 'index-v1782.html'),
    path.join(root, 'src/components/ibWidget.js')
  ];

  // Emojis pictográficos casuales (SMP emoji blocks)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}]/u;
  const bannedCasualIcons = ['🎓', '🤖', '📂', '💡', '💬', '👋', '📚', '🔍', '📑', '🌐', '🇪🇸', '🇬🇧', '🏷️', '✨', '📋', '📄', '🚫', '⚠️'];

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(emojiRegex);
    assert.equal(
      match,
      null,
      `File ${path.basename(filePath)} should not contain casual emojis (found: ${match ? match[0] : ''})`
    );

    for (const icon of bannedCasualIcons) {
      assert.ok(
        !content.includes(icon),
        `File ${path.basename(filePath)} must not include casual icon: ${icon}`
      );
    }
  }

  // Verificar que el sidebar contiene el glifo sobrio ◈ para Módulo IB
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
  assert.ok(
    indexHtml.includes('<a href="#ib" class="nav-link"><span class="nav-icon">◈</span><span class="nav-label">Módulo IB</span></a>'),
    'Sidebar navigation in index.html must use institutional ◈ glyph for IB'
  );

  const indexV1782Html = fs.readFileSync(path.join(root, 'index-v1782.html'), 'utf-8');
  assert.ok(
    indexV1782Html.includes('<a href="#ib" class="nav-link"><span class="nav-icon">◈</span><span class="nav-label">Módulo IB</span></a>'),
    'Sidebar navigation in index-v1782.html must use institutional ◈ glyph for IB'
  );

  // Verificar que el widget IB usa encabezados y acciones sobrias
  const ibWidget = fs.readFileSync(path.join(root, 'src/components/ibWidget.js'), 'utf-8');
  assert.ok(ibWidget.includes('Módulo IB — Bachillerato Internacional'), 'Heading must be present without emoji');
  assert.ok(!ibWidget.includes('🎓'), 'No graduation cap emoji');
  assert.ok(!ibWidget.includes('🤖'), 'No robot emoji');
  assert.ok(ibWidget.includes('Asistente Pedagógico IB (Google Cloud AI)'), 'Assistant heading must be clean');
  assert.ok(ibWidget.includes('Ver en Drive ↗'), 'Drive button must use clean arrow');
});
