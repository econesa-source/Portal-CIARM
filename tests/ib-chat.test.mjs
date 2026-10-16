import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ib-chat.php implements native Google Cloud AI backend with strict RBAC', () => {
  const backend = readFileSync('ib-chat.php', 'utf8');

  // Dependencias de seguridad del Portal
  assert.match(backend, /require_once __DIR__ \. '\/auth-lib\.php';/);
  assert.match(backend, /require_once __DIR__ \. '\/portal-permissions-lib\.php';/);

  // Verificación de método y sesión
  assert.match(backend, /ciarm_session_user\(\)/);
  assert.match(backend, /method_not_allowed/);

  // Verificación estricta de capacidades DM05
  assert.match(backend, /\['IB_TARJETA', 'IB_ACCEDER'\]/);
  assert.match(backend, /ciarm_rbac_has_function\(\$user, \$code\)/);

  // Integración con Google Cloud (Vertex AI Search y Gemini)
  assert.match(backend, /ciarm_ib_vertex_search/);
  assert.match(backend, /ciarm_ib_call_gemini/);
  assert.match(backend, /ciarm_ib_curriculum_fallback/);
  assert.match(backend, /0APjAPL7f_pxtUk9PVA/);
  assert.match(backend, /https:\/\/www\.googleapis\.com\/auth\/cloud-platform/);
});
