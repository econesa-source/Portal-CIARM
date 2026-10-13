/**
 * Diagnóstico temporal DM03/DM05 ejecutado DENTRO del Portal:
 * Las llamadas same-origin llevan la misma cookie HttpOnly que usa el router.
 * No muestra credenciales, token de Google ni cookies.
 */
export async function render(container) {
  const article = document.createElement('section');
  article.style.cssText = 'max-width:740px;margin:20px auto;padding:24px;background:white;border:1px solid #e2e8f0;border-radius:12px;color:#262626';
  const title = document.createElement('h2');
  title.textContent = 'Comprobación de permisos DM03–DM05';
  article.append(title);
  const description = document.createElement('p');
  description.textContent = 'Verificación desde la sesión del propio Portal. No activa ni modifica permisos.';
  article.append(description);
  const status = document.createElement('pre');
  status.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:16px;border-radius:8px;font:13px/1.6 monospace';
  status.setAttribute('role', 'status');
  status.textContent = 'Comprobando sesión y lectura de DM05...';
  article.append(status);
  const rerun = document.createElement('button');
  rerun.type = 'button';
  rerun.textContent = 'Repetir comprobación';
  rerun.style.cssText = 'padding:9px 16px;margin-top:12px;background:#26487f;color:white;border:0;border-radius:6px;cursor:pointer';
  article.append(rerun);
  container.replaceChildren(article);

  async function check() {
    rerun.disabled = true;
    status.textContent = 'Comprobando...';
    try {
      const opts = { method:'GET',credentials:'same-origin',cache:'no-store',headers:{ Accept:'application/json' }};
      const sessionResponse = await fetch('/auth-session.php',opts);
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || session?.ok !== true) {
        status.textContent = 'Sesión PHP: NO VERIFICADA (HTTP ' + sessionResponse.status + ')\n' +
          'Dominio: ' + window.location.hostname + '\n' +
          'El Portal no tiene una sesión PHP activa en este dominio.';
        return;
      }
      const permissionsResponse = await fetch('/portal-permissions.php?preflight=1', opts);
      const payload = await permissionsResponse.json();
      if (!permissionsResponse.ok || payload?.ok !== true) {
        status.textContent = 'Sesión PHP: VERIFICADA\n' +
          'DM03–DM05: ERROR (HTTP ' + permissionsResponse.status + ')\n' +
          'Código: ' + String(payload?.code || 'UNKNOWN') + '\n' +
          'Dominio: ' + window.location.hostname;
        return;
      }
      status.textContent = 'Sesión PHP: VERIFICADA\n' +
        'Lectura de roles y permisos: ' + (payload?.data?.verified === true ? 'VERIFICADA' : 'NO VERIFICADA') + '\n' +
        'Política DM05 activa: ' + (payload?.data?.enforced === true ? 'SÍ' : 'NO (modo seguro)') + '\n' +
        'Funciones efectivas reconocidas: ' + (Array.isArray(payload?.data?.codes) ? payload.data.codes.length : 'SIN DATOS') + '\n' +
        'Dominio: ' + window.location.hostname;
    } catch (error) {
      status.textContent = 'No se pudo completar la prueba desde el Portal: ' +
        (error instanceof TypeError ? 'problema de conexión' : 'respuesta inesperada');
    } finally {
      rerun.disabled = false;
    }
  }
  rerun.addEventListener('click', check);
  await check();
}
