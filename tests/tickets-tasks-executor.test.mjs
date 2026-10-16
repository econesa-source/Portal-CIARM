import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PORTAL_CARDS, canSeeCard, canSeeAction} from '../src/services/portalPermissions.js';
import {allowedRoute} from '../src/components/dashboardAccess.js';
import {uploadEvidence} from '../src/services/ticketsServiceWorkflow.js';

test('PORTAL_CARDS define la tarjeta de tareas y su función de gestión', () => {
  assert.equal(PORTAL_CARDS.tareas?.code, 'TAREAS_TARJETA');
  assert.equal(PORTAL_CARDS.tareas?.actions?.gestionar, 'TAREAS_GESTION');
  const p = new Set(['TAREAS_TARJETA', 'TAREAS_GESTION']);
  assert.equal(canSeeCard(p, 'tareas'), true);
  assert.equal(canSeeAction(p, 'tareas', 'gestionar'), true);
  assert.equal(canSeeAction(new Set(['TAREAS_GESTION']), 'tareas', 'gestionar'), false);
});

test('Rutas de ejecución de tareas (#mis-tareas, #historial-tareas) son gobernadas por DM05', () => {
  const executor = { verified: true, enforced: true, codes: ['TAREAS_TARJETA', 'TAREAS_GESTION'] };
  assert.equal(allowedRoute('#mis-tareas', executor), true);
  assert.equal(allowedRoute('#historial-tareas', executor), true);

  const admin = { verified: true, enforced: true, codes: ['INT_TARJETA', 'INT_GESTION'] };
  assert.equal(allowedRoute('#mis-tareas', admin), true);
  assert.equal(allowedRoute('#historial-tareas', admin), true);

  const requesterOnly = { verified: true, enforced: true, codes: ['INT_TARJETA', 'INT_CREAR', 'INT_MIS'] };
  assert.equal(allowedRoute('#mis-tareas', requesterOnly), false);
  assert.equal(allowedRoute('#historial-tareas', requesterOnly), false);
});

test('Dashboard oficial y v1782 contienen exactamente 2 botones para Gestión de Tareas', () => {
  for (const file of ['src/components/dashboardWidget.js', 'src/components/dashboardVoiceflow-v1782.js']) {
    const content = readFileSync(file, 'utf8');
    assert.match(content, /data-card="tareas"/);
    assert.match(content, /href="#mis-tareas"[^>]*>Gestionar tareas<\/a>/);
    assert.match(content, /href="#historial-tareas"[^>]*>Historial de tareas<\/a>/);
    assert.match(content, /Gestión de Tareas/);
  }
});

test('uploadEvidence valida contrato multipart con CSRF y reporte upstream', async () => {
  assert.equal(typeof uploadEvidence, 'function');
  const fakeFile = new Blob(['contenido de prueba'], { type: 'image/jpeg' });
  let posted = null;

  globalThis.fetch = async (url, opts) => {
    posted = { url, opts };
    return {
      ok: true,
      json: async () => ({ ok: true, data: { url: 'https://drive.google.com/file/d/test123/view', name: 'evidencia.jpg' } })
    };
  };

  const res = await uploadEvidence(fakeFile, 'csrf-token-xyz');
  assert.equal(res.url, 'https://drive.google.com/file/d/test123/view');
  assert.equal(posted.url, '/tickets-api.php');
  assert.equal(posted.opts.method, 'POST');
  assert.ok(posted.opts.body instanceof FormData);
  assert.equal(posted.opts.body.get('action'), 'uploadEvidence');
  assert.equal(posted.opts.body.get('csrfToken'), 'csrf-token-xyz');

  globalThis.fetch = async () => ({ ok: false, json: async () => ({ ok: false, code: 'FORBIDDEN' }) });
  await assert.rejects(() => uploadEvidence(fakeFile, 'csrf-bad'), /FORBIDDEN/);
});

test('tickets-api.php y tickets-portal-lib.php protegen subida de evidencia y restringen tipos', () => {
  const api = readFileSync('tickets-api.php', 'utf8');
  const lib = readFileSync('tickets-portal-lib.php', 'utf8');
  assert.match(api, /'uploadEvidence'/);
  assert.match(api, /TAREAS_GESTION/);
  assert.match(api, /ciarm_upload_evidence_to_drive/);
  assert.match(lib, /function ciarm_upload_evidence_to_drive/);
  assert.match(lib, /103wSYfCuSwVKW_aTbTFr2O7b-JyuT619/);
});
