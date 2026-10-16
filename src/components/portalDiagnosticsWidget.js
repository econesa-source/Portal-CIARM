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
  description.textContent = 'Verificación desde la sesión del Portal. El listado y los catálogos consultan Sheets directamente; Apps Script permanece para escrituras y como respaldo.';
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

  const measure = document.createElement('button');
  measure.type = 'button';
  measure.textContent = 'Medir velocidad de tickets';
  measure.style.cssText = 'padding:9px 16px;margin:12px 0 0 10px;background:#2eb1a0;color:#152b43;border:0;border-radius:6px;cursor:pointer';
  measure.disabled = true;
  article.append(measure);

  const verifyDirect=document.createElement('button');
  verifyDirect.type='button';
  verifyDirect.textContent='Comparar datos (opcional)';
  verifyDirect.style.cssText='padding:9px 16px;margin:12px 0 0 10px;border-radius:6px;background:#26487f;color:white;border:0;cursor:pointer';
  verifyDirect.disabled=true;
  article.append(verifyDirect);
  const directStatus=document.createElement('p');
  directStatus.setAttribute('role','status');
  directStatus.textContent='Lectura directa automática activa para listados y catálogos. No hace falta pulsar ningún botón.';
  article.append(directStatus);
  verifyDirect.addEventListener('click',async()=>{
    let sessionExpired=false;
    verifyDirect.disabled=true;
    directStatus.textContent='Comparando datos de Sheets y Apps Script. Puede demorar aproximadamente 20 segundos…';
    try{
      const response=await fetch('/tickets-api.php?action=validateDirectReads',{
        method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}
      });
      const body=await response.json();
      if(response.status===401){
        // The page may still show the result of an earlier session check.
        // Never keep displaying it as a current authenticated state.
        sessionExpired=true;
        measure.disabled=true;
        status.textContent='Sesión PHP: NO VERIFICADA. La sesión institucional venció o dejó de estar disponible.';
        directStatus.textContent='La sesión venció. Volvé a iniciar sesión para continuar.';
        const login=document.createElement('button');
        login.type='button';
        login.textContent='Volver a iniciar sesión';
        login.style.cssText='margin-left:8px;padding:7px 12px;background:#26487f;color:white;border:0;border-radius:5px;cursor:pointer';
        login.addEventListener('click',()=>window.location.reload());
        directStatus.append(login);
        return;
      }
      if(!response.ok||body?.ok!==true)throw Error('HTTP '+response.status+' ('+String(body?.code||'UNKNOWN')+')');
      if(body?.data?.enabled===true){
        directStatus.textContent='Coinciden: listado y catálogos consultan Sheets directamente, sin activación manual.';
      }else{
        const checks=body?.data?.checks||{};
        const rows=['list','catalogs'].map(key=>{
          const check=checks[key];
          if(!check)return null;
          const name=key==='list'?'Listado':'Catálogos';
          if(check.same===true)return name+': coincide';
          const parts=[];
          if(Number.isInteger(check.legacyCount)&&Number.isInteger(check.directCount))
            parts.push('filas: Apps Script '+check.legacyCount+' / Sheets '+check.directCount);
          if(Array.isArray(check.fields)&&check.fields.length)
            parts.push('campos diferentes: '+check.fields.join(', '));
          return name+': DIFERENTE'+(parts.length?' ('+parts.join('; ')+')':'');
        }).filter(Boolean);
        directStatus.textContent='La comparación detectó diferencias; esta sesión usa Apps Script hasta corregirlas. '+rows.join(' | ');
      }
    }catch(error){
      directStatus.textContent='La comparación no pudo completarse ('+String(error.message||'error')+'). La lectura normal conserva respaldo de Apps Script.';
    }finally{verifyDirect.disabled=sessionExpired;}
  });
  const timings = document.createElement('pre');
  timings.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:16px;border-radius:8px;font:13px/1.6 monospace';
  timings.setAttribute('role', 'status');
  timings.textContent = 'Sin mediciones todavía.';
  article.append(timings);
  container.replaceChildren(article);

  function parseServerTiming(header) {
    const result = {};
    for (const part of String(header || '').split(',')) {
      const match = part.trim().match(/^([a-z_]+);dur=([0-9.]+)$/);
      if (match) result[match[1]] = Number(match[2]);
    }
    return result;
  }
  async function measured(label, query) {
    const started = performance.now();
    try {
      const response = await fetch('/tickets-api.php?' + query + '&perf=1', {
        method:'GET',credentials:'same-origin',cache:'no-store',
        headers:{ Accept:'application/json' }
      });
      const payload = await response.json();
      const elapsed = performance.now() - started;
      const backend = parseServerTiming(response.headers?.get('Server-Timing'));
      const fmt = name => Number.isFinite(backend[name]) ? backend[name].toFixed(0) : '—';
      const source=response.headers?.get('X-CIARM-Tickets-Read-Source')||'';
      const backendTime=Number.isFinite(backend.sheets_direct)
        ? fmt('sheets_direct') : fmt('apps_script');
      const sourceLabel=source==='sheets-direct'?'   Sheets API':
        source==='apps-script-fallback'?'   Apps Script respaldo':'';
      const line = label.padEnd(23) + ' ' + String(Math.round(elapsed)).padStart(7) +
        '   ' + String(fmt('identity')).padStart(7) + '   ' +
        String(fmt('rbac')).padStart(7) + '   ' +
        String(backendTime).padStart(7) + '   ' +
        String(fmt('total')).padStart(7) + sourceLabel +
        (response.ok && payload?.ok === true ? '' : '   HTTP ' + response.status);
      const gas = backend.gas_total;
      const stages = ['identity','authorize','lock','nonce','open','work'];
      const interior = Number.isFinite(gas)
        ? '    ↳ Apps Script (ms): ' + stages.map(name => name + '=' +
            (Number.isFinite(backend['gas_'+name]) ? Math.round(backend['gas_'+name]) : '—')).join('  ') +
          '  ejecución=' + Math.round(gas) +
          '  transporte/inicio≈' + Math.max(0,Math.round((backend.apps_script ?? elapsed) - gas))
        : null;
      return {line, interior, data:response.ok && payload?.ok === true ? payload.data : null, ok:response.ok && payload?.ok === true};
    } catch(error) {
      return {line:label.padEnd(23) + ' ERROR de conexión',data:null,ok:false};
    }
  }
  async function runMeasurement() {
    measure.disabled = true;
    rerun.disabled = true;
    const output=[
      'Tiempos en milisegundos (ms). No se muestran datos personales.',
      'Operación                Navegador  Identidad   Permisos   Lectura     PHP total',
      '--------------------------------------------------------------------------'
    ];
    const print = () => {timings.textContent=output.join('\n')};
    print();
    const checks=[
      ['Permisos tickets','action=context'],
      ['Listado de tickets','action=list'],
      ['Catálogos','action=catalogs'],
      ['Contexto del servicio','action=serviceContext'],
      ['Seguimiento general','action=serviceListRaw&kind=all']
    ];
    try {
      let firstTicket = null;
      for (const [label,query] of checks) {
        output.push(label + '…');
        print();
        const result=await measured(label,query);
        output[output.length-1]=result.line;
        if(result.interior) output.push(result.interior);
        if(label==='Listado de tickets' && Array.isArray(result.data)) {
          const id=result.data.find(t => /^TKT-\d{4}-\d+$/.test(String(t?.id || '')))?.id;
          if(id) firstTicket=id;
        }
        print();
        if(!result.ok && label==='Permisos tickets') {
          output.push('Se interrumpió: el servidor denegó el acceso de administración.');
          print();
          return;
        }
      }
      if (firstTicket) {
        output.push('Detalle de ticket…');
        print();
        const detail=await measured('Detalle de ticket','action=detail&id='+encodeURIComponent(firstTicket));
        output[output.length-1]=detail.line;
        if(detail.interior) output.push(detail.interior);
      }
      output.push('');
      output.push('Navegador: solicitud completa. Puente GAS: PHP → Apps Script y su respuesta.');
      output.push('Apps Script ejecución: no incluye inicio de instancia ni transporte. Trabajo incluye Sheets.');
      print();
    } finally {
      measure.disabled = false;
      rerun.disabled = false;
    }
  }
  measure.addEventListener('click', runMeasurement);

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
          'Etapa: ' + String(payload?.stage || 'NO DETERMINADA') + '\n' +
          'Dominio: ' + window.location.hostname;
        return;
      }
      status.textContent = 'Sesión PHP: VERIFICADA\n' +
        'Lectura de roles y permisos: ' + (payload?.data?.verified === true ? 'VERIFICADA' : 'NO VERIFICADA') + '\n' +
        'Política DM05 activa: ' + (payload?.data?.enforced === true ? 'SÍ' : 'NO (modo seguro)') + '\n' +
        'Funciones efectivas reconocidas: ' + (Array.isArray(payload?.data?.codes) ? payload.data.codes.length : 'SIN DATOS') + '\n' +
        'Dominio: ' + window.location.hostname;
      verifyDirect.disabled = payload?.data?.verified !== true ||
        !Array.isArray(payload?.data?.codes) ||
        !payload.data.codes.includes('INT_GESTION');
      measure.disabled = payload?.data?.verified !== true ||
        !Array.isArray(payload?.data?.codes) ||
        !payload.data.codes.includes('INT_GESTION');
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
