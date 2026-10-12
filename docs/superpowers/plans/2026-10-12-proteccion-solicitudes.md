# Protección de solicitudes internas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the recommended native execution, or superpowers:subagent-driven-development if the user chooses that method. Steps use checkbox (`- [ ]`) syntax for tracking. Do not start implementation before user review of this plan.

**Goal:** Proteger creación y lectura propia mediante identidad de sesión, conservar adjuntos y recuperar reintentos sin duplicar tickets ni sobrescribir filas.

**Architecture:** Reutilizar el puente PHP firmado y la fuente TICKETS. Separar operaciones del colaborador de los permisos administrativos, transferir cada archivo individualmente y registrar la creación como una operación recuperable en la bitácora existente. Migrar frontend, PHP y Apps Script antes de retirar el acceso histórico sin firma.

**Tech Stack:** PHP existente, JavaScript ES modules, Google Apps Script/Sheets/Drive, node:test y jsdom; sin framework de producto ni nuevas dependencias de runtime.

**Spec:** docs/superpowers/specs/2026-10-12-proteccion-solicitudes-design.md, aprobada por el usuario el 2026-10-12.

## Global Constraints

- TICKETS sigue siendo la fuente oficial; identidad, área, actividad y permisos provienen de DM03.
- El colaborador activo no necesita Administrador para crear o consultar lo propio. Administración sigue limitada a las dos cuentas y su permiso específico actual.
- No aceptar correo, nombre, área o rol del navegador como prueba de identidad. Revalidar ausencia, duplicidad, baja y revocación.
- Conservar hasta cinco archivos, diez MiB por archivo y los formatos que admite el formulario. No guardar base64 ni secretos en bitácora, logs, storage del navegador o GitHub.
- Metadatos y administración: máximo 50000 bytes UTF-8 por envelope. Upload firmado: máximo 15 MiB por envelope y un archivo por petición; rechazar el límite mayor en otras acciones.
- Mantener firma HMAC, vigencia de 120 segundos, nonce e idempotencia duradera por operationId.
- No cambiar login, permisos actuales de Drive, notificaciones, tipos institucionales, ejecución, cierre o SLA. No borrar registros de prueba ni renumerar folios existentes.
- Código nuevo en rama aislada. No fusionar integración productiva antes de verificar el backend real; publicar código no despliega Apps Script.

## Review Focus

- Baja o revocación entre inicio y upload/finalización: denegar cada operación y no publicar un ticket incompleto (Tasks 1, 3, 4).
- Timeout después de crear archivo o escribir fila: el reintento debe recuperar el resultado sin duplicarlo (Task 3).
- Recarga con archivos parcialmente subidos: conservar la operación y solicitar sólo archivos faltantes con el mismo digest (Task 5).
- Fórmulas, filas de plantilla, huecos y folios anómalos: no sobrescribir ni atribuir éxito a una estructura ambigua (Tasks 2, 3).
- Cliente viejo durante migración: mantener una transición explícita y acreditar retirada del acceso público antes de cerrar #7 (Tasks 6, 7).

## Contratos comunes

`CreationRequest = {operationId, tipo, descripcion, prioridadSolicitada, fechaProgramada, files:[{index,name,mime,size,sha256}]}`. Índices consecutivos de 0 a N-1, N entre 0 y 5; size en bytes, sha256 hexadecimal de 64 caracteres. Tipo y urgencia conservan los valores del formulario actual. Ningún dato de identidad pertenece a este contrato.

`CreationState = {operationId, state:'PENDIENTE'|'CONFIRMADO', uploadedIndexes:number[], ticket?:Ticket}`. `Ticket` conserva el contrato actual de ticketsAdminService.js y añade aliases de lectura necesarios para Mis solicitudes sin omitir responsable, compromiso o adjuntos.

Acciones de tickets-api.php: GET `selfContext`, `mine`, `creationStatus&operationId=...`; POST JSON `beginCreate`, `finalizeCreate`; POST multipart `uploadAttachment` con operationId, index, csrfToken y file. Se conservan context/list/detail/catalogs/assign administrativos. `selfContext` devuelve `{canCreate,csrfToken,canUpload}` y nunca concede administración.

Todas las acciones de datos viajan en envelope firmado. PHP deriva actor de sesión. `mine` no recibe un email. Código de error: 401 sesión, 403 permiso/origen/CSRF, 409 conflicto/operación reutilizada, 413 tamaño, 415 contenido, 422 validación, 503 ocupado/configuración no apta y 502 upstream. Un error nunca equivale a lista vacía o éxito.

## Task 1: Protocolo firmado y autorización del colaborador

**Files:** Create apps-script/tickets-protocol.gs, apps-script/tickets-portal.gs, tests/helpers/tickets-portal-fixture.mjs, tests/tickets-portal-auth.test.mjs. Modify apps-script/tickets-admin.gs y apps-script/build.mjs para incluir módulos, manteniendo todavía el dispatcher productivo.

**Interfaces:** `verifyTicketRequest(envelope,signature) -> Request`; `portalCollaborator(actor) -> {correoDM03,nombreCompleto,area,status}`; `handleTicketEnvelope(envelope,signature) -> {ok,data}|{ok:false,code}`. Añadir `portalCapabilities(actor) -> {protocol:"tickets-portal-v1",maxFiles:5,maxFileBytes:10485760}` como acción firmada `capabilities`; PHP la consulta desde selfContext para comprobar el backend, sin mostrar detalles de implementación en el producto. Mantener `handleAdminEnvelope` como entrada compatible al protocolo, sin consumir nonce dos veces. Fixture: `portalFixture({rows,collaborators,legacyAllowed}) -> {call(action,payload,actor), book, rows, journal, files, failOnce(point), denyLock()}`; cada call firma con nonce nuevo y operationId estable.

- [ ] Escribir pruebas de firma inválida/expirada/replay, actor ausente/duplicado/inactivo y colaborador normal autorizado sólo para lo propio. Incluir límites diferenciados y revocación después de una primera llamada.
  ```js
  const s=portalFixture();
  assert.equal(s.call('mine',{},'persona@ciarm.edu.mx').ok,true);
  assert.equal(s.call('list',{},'persona@ciarm.edu.mx').code,'FORBIDDEN');
  ```
- [ ] Ejecutar `node --test tests/tickets-portal-auth.test.mjs`; observar fallo por el comportamiento ausente.
- [ ] Implementar protocolo común y lectura `mine` por CORREO SOLICITANTE firmado. DM03 usa encabezados exactos de fila 4 y coincidencia única; no conservar alias demo como identidad autorizada. Reutilizar las validaciones administrativas al despachar sus acciones.
- [ ] Ejecutar `npm test`; ninguna regresión en las 53 pruebas existentes. Commit del componente probado, sin habilitar aún las nuevas rutas públicas.

## Task 2: Asignación segura de folio y fila

**Files:** Create apps-script/tickets-folios.gs, tests/tickets-folios.test.mjs. Modify build.mjs para incluirlo; conservar tickets-original.gs como referencia histórica.

**Interfaces:** `portalReserveTicketSlot(book,journal,now) -> {id,rowNumber,before,formulas}`; consume ADMIN_TICKET_HEADERS y las reservas CREAR de Task 3. Produce una reserva bajo el bloqueo ya obtenido por handleTicketEnvelope; no escribe el ticket ni renumera históricos.

- [ ] Escribir pruebas con 350 filas, huecos, números no consecutivos, cambio de año, folio duplicado, fila con contenido ajeno y bloqueo denegado. El próximo número supera el máximo existente y reservado; el año se obtiene en America/Cancun.
  ```js
  const s=portalFixture({rows:rowsWith350TicketsAndGaps});
  const reserved=portalReserveTicketSlot(s.book,s.journal,new Date('2026-10-12T17:00:00Z'));
  assert.equal(reserved.id,'TKT-2026-00351');
  assert.ok(reserved.rowNumber>350);
  ```
- [ ] Ejecutar `node --test tests/tickets-folios.test.mjs`; confirmar fallo antes de implementar. Definir rowsWith350TicketsAndGaps en el propio test con 350 filas físicas más cabecera, máximo numérico 350 y algunas filas intermedias vacías, sin compactar el arreglo.
- [ ] Implementar lectura de todo el rango utilizado, unicidad y reservas. Elegir un destino posterior a datos existentes y reservas pendientes; ampliar la hoja sólo si hace falta. Capturar antes/fórmulas y rechazar cualquier destino ocupado o ambiguo; no deducir fila de conteo de tickets.
- [ ] Ejecutar `npm test` y confirmar que los registros originales permanecen iguales. Commit.

## Task 3: Creación recuperable y archivos individuales en Apps Script

**Files:** Create apps-script/tickets-creation.gs, tests/tickets-creation.test.mjs. Modify tickets-portal.gs, tickets-admin.gs, build.mjs; reutilizar la carpeta oficial CONFIG.ATTACHMENTS_FOLDER_ID.

**Interfaces:** `portalBeginCreate(book,actor,request) -> CreationState`; `portalUploadAttachment(book,actor,{operationId,index,name,mime,size,sha256,base64}) -> CreationState`; `portalFinalizeCreate(book,actor,{operationId}) -> CreationState`; `portalCreationStatus(book,actor,operationId) -> CreationState`.

- [ ] Escribir pruebas de cero y cinco archivos de diez MiB, contenido/digest/índice inválido, operación ajena, payload cambiado y operaciones CREAR que no se recuperan como ASIGNAR. Probar interrupción tras archivo, tras reserva, tras escritura parcial y antes de confirmar journal.
  ```js
  const s=portalFixture();s.call('beginCreate',request,actor);
  s.failOnce('afterRowWrite');s.call('finalizeCreate',{operationId:request.operationId},actor);
  const retry=s.call('finalizeCreate',{operationId:request.operationId},actor);
  assert.equal(retry.data.state,'CONFIRMADO');assert.equal(s.rows.filter(isCreatedTicket).length,1);
  ```
- [ ] Ejecutar `node --test tests/tickets-creation.test.mjs`; helpers request, actor e isCreatedTicket pertenecen al fixture/test y no a código de producto.
- [ ] Extender BITACORA TICKETS con ACCIÓN al final, manteniendo sus nueve columnas y eventos originales. Vacío significa ASIGNAR; CREAR usa payload `{request,receipts,reservation}`. Hash estable de CreationRequest; receipts contienen índice, digest, fileId y URL, nunca base64. Restringir la recuperación de adminAssign/adminPendingOperation a ASIGNAR y rechazar reutilización cruzada de IDs.
- [ ] Implementar los cuatro handlers. Preparar archivos en una subcarpeta determinista de operación; etiquetar operación/índice/digest y recuperar el archivo ante fallo previo al receipt. Si hay varios candidatos incompatibles, producir conflicto sin borrar evidencia. Comprobar digest real y formatos, conservando archivos como enlaces Drive, sin incrustar contenido ejecutable.
- [ ] Finalizar únicamente con receipts completos. Registrar reserva/antes/después en journal antes de escribir; recuperar celdas que coincidan con antes o después, mantener fórmulas y rechazar divergencias. NUEVO sólo aparece tras fila completa y lectura confirmada. Usar nombre/área de DM03 y la urgencia solicitada en su columna separada.
- [ ] Ejecutar `npm test` con coerción de fechas, fórmulas y fallo parcial reales simulados, más prueba de revocación entre handlers. Commit.

## Task 4: Endpoint PHP y transporte acotado de adjuntos

**Files:** Create tickets-portal-lib.php, tests/tickets-portal-auth.php. Modify tickets-api.php y tickets-lib.php. Extender auth-lib.php únicamente con timeout opcional de ciarm_http_json, conservando por defecto los 25 segundos actuales.

**Interfaces:** `ciarm_portal_collaborator(array $rows,string $email): ?array`; `ciarm_portal_context(array $user): array`; `ciarm_portal_upload(array $files,array $input): array`; `ciarm_portal_bridge(array $user,string $action,array $payload): array`. Reutilizar sesión, acceso readonly DM03 y ciarm_ticket_envelope; nunca recibir actor del cliente.

- [ ] Escribir pruebas PHP de identidad falsificada, duplicidad/baja, GET ajeno, origen/CSRF, archivo extra, límite de diez MiB, upload incompleto, MIME real y límite mayor sólo para uploadAttachment. Crear archivos de prueba temporales dentro del test y eliminarlos al terminar.
- [ ] Ejecutar `php tests/tickets-portal-auth.php`; observar fallo previo.
- [ ] Implementar rutas del contrato común y multipart de un archivo. Validar $_FILES, error de subida, tamaño y contenido real; reconstruir payload firmado en servidor. Liberar lock de sesión durante upstream; dar timeout de 60 segundos sólo a upload/finalize sin convertir timeout en confirmación.
- [ ] Implementar preflight de límites: upload_max_filesize al menos 10 MiB, post_max_size al menos 16 MiB y memory_limit al menos 128 MiB o ilimitado. Si el hosting no cumple, canUpload=false y rechazo explícito antes de una subida; no reducir silenciosamente los cinco adjuntos. Probar memoria máxima en staging.
- [ ] Ejecutar `php tests/tickets-auth.php`, `php tests/tickets-portal-auth.php` y lint de los cuatro PHP involucrados. Commit.

## Task 5: Formulario y Mis solicitudes usan la sesión del servidor

**Files:** Create src/services/ticketsPortalService.js, tests/tickets-portal-client.test.mjs, tests/tickets-creation-ui.test.mjs. Modify solicitudesWidget.js y misSolicitudesWidget.js. Mantener ticketsAdminService.js y el dashboard administrativo.

**Interfaces:** `getSelfContext(signal)`, `listMyTickets(signal)`, `beginCreate(request,csrfToken,signal)`, `uploadAttachment(operationId,index,file,csrfToken,signal)`, `finalizeCreate(operationId,csrfToken,signal)`, `getCreationStatus(operationId,signal)`; retornan Promises con el contrato de servidor. `creationDraft` en sessionStorage contiene sólo correo de sesión para aislar borradores, operationId, metadata y digests; nunca bytes ni permisos.

- [ ] Escribir pruebas DOM/transporte: sin email en mine, identidad readonly escapada, errores que no muestran éxito, subida secuencial, progreso, archivo faltante tras recarga y mismo operationId durante reintento. Incluir dos usuarios y no compartir su borrador.
  ```js
  await submitWithOneLostResponse();await retrySameDraft();
  assert.equal(beginRequests[0].operationId,beginRequests[1].operationId);
  assert.equal(successShownBeforeConfirmation,false);
  ```
- [ ] Ejecutar los dos tests nuevos y confirmar sus fallos. Sus helpers reproducen las respuestas del endpoint real; no introducen hooks en código productivo.
- [ ] Implementar el cliente sin formulario oculto, GET por correo ni fallback no-cors. Calcular los hashes SHA-256 de los File secuencialmente con Web Crypto; enviar multipart individual y metadatos por JSON. Tras reabrir, consultar creationStatus y pedir sólo archivos faltantes cuyo digest coincida; no reenviar los ya confirmados.
- [ ] Adaptar widgets conservando tipos, urgencia, fecha programada y límites. Deshabilitar edición del draft mientras el resultado sea desconocido; ofrecer reintento o nuevo borrador explícito sin borrar journal. Mostrar éxito y redirigir sólo con state=CONFIRMADO y ticket completo. Mis solicitudes muestra errores reales, datos y adjuntos de mine con escape y enlaces seguros.
- [ ] Ejecutar `npm test`; comprobar teclado y UI en escritorio/móvil, incluyendo cinco archivos máximos. Commit.

## Task 6: Dispatcher, compatibilidad explícita y CI

**Files:** Modify apps-script/build.mjs, apps-script/tickets-backend.gs, tests/tickets-admin-dispatch.test.mjs, .github/workflows/test-tickets-admin.yml, .github/workflows/deploy-neubox.yml, index.html, index-v1782.html, main.js y main-v1782.js. Create docs/backend/proteccion-solicitudes-deployment.md.

**Interfaces:** `doPost` requiere wrapper firmado y despacha handleTicketEnvelope; `doGet` rechaza lectura pública. Única excepción temporal: Script Property `TICKETS_ALLOW_LEGACY` exactamente `true`; ausencia, vacío o cualquier otro valor deniega. Nuevos endpoints `creationStatus` y `mine` sólo vía puente.

- [ ] Escribir pruebas de unsigned GET/POST denegados sin flag, firma inválida sin caída al alta histórica, compatibilidad sólo con true explícito y todas las acciones nuevas/administrativas. Actualizar el test histórico para declarar esa transición, no para exigir un bypass permanente.
- [ ] Ejecutar `node --test tests/tickets-admin-dispatch.test.mjs`; confirmar fallos antes de alterar el dispatcher.
- [ ] Implementar build determinista con módulos nuevos y dispatcher. Mantener tickets-original.gs como respaldo de fuente, sin atribuir seguridad a sus funciones históricas; ninguna queda públicamente accesible al desactivar compatibilidad.
- [ ] Añadir la nueva suite PHP al CI, mantener build-check y actualizar versiones a 18.4.0 en ambas entradas/router/validación sólo dentro de la rama pendiente. Preparar comprobación de capability firmada desde selfContext antes de la publicación frontend; no desplegar frontend si el backend no soporta el protocolo.
- [ ] Ejecutar `npm test`, ambas suites PHP, lint PHP y `node apps-script/build.mjs`; verificar bundle sin diferencias inesperadas. Commit y PR draft, sin merge de integración.

## Task 7: Validación, cambio coordinado y retirada efectiva del acceso histórico

**Files:** Update docs/estado-proyecto.md, tickets-source.md, admin-tickets-deployment.md y el procedimiento nuevo. Issues #6, #7 y #8 permanecen abiertos hasta su evidencia correspondiente.

- [ ] Revisar toda la rama y corregir hallazgos; no inferir validación visual a partir de jsdom.
- [ ] Preparar copia independiente de Apps Script/libro/carpeta y servidor staging, sin cambiar CONFIG de producción para probar. Respaldar fuente y versión actuales; conservar claves fuera de GitHub. Verificar todos los consumidores históricos antes del corte.
- [ ] Ejecutar matriz de sesión, dos administradores, cuenta normal, baja/revocación, firma, cero/cinco adjuntos máximos, timeout y reintento, más de 300 filas, huecos y formulas. Documentar resultados de fuente, journal y memoria, no sólo respuestas HTTP.
- [ ] Comprobar preflight NEUBOX y contrato contra el deploymentId vigente. El usuario publica el bundle Apps Script o el agente usa una conexión autorizada suficiente; si esa conexión falta, entregar el bundle y pasos exactos sin afirmar despliegue.
- [ ] Si hay consumidores históricos durante el cambio, establecer TICKETS_ALLOW_LEGACY=true explícitamente antes de publicar el bundle nuevo. Publicar PHP compatible y Apps Script preparado, verificar capabilities y nuevos endpoints mediante sesión; después integrar/publicar frontend 18.4.0. Conservar operación original al reintentar y verificar igualdad de datos entre administración y Mis solicitudes.
- [ ] Desactivar/eliminar TICKETS_ALLOW_LEGACY y comprobar que un GET sin actor y un POST sin firma se deniegan antes de cualquier lectura/escritura. No cerrar #7 mientras permanezca habilitado. El rollback conserva evidencia y no reactiva entradas públicas automáticamente.
- [ ] Registrar la prueba controlada real del issue #6 y los resultados de #8. Cambiar cada issue sólo cuando su criterio esté acreditado; conservar pendientes de revocación/concurrencia si no se pudieron ejecutar.

## Revisión del plan y ejecución

Autorrevisión: contratos mine/beginCreate/uploadAttachment/finalizeCreate/creationStatus consistentes entre Tasks 1–6; adjuntos y límites cubiertos en Tasks 3–5; bloqueo/reservas/formulas en Tasks 2–3; revocación en Tasks 1, 3, 4 y 7; compatibilidad y retirada en Tasks 6–7. La bitácora guarda únicamente metadata y referencias. Toda publicación real exige evidencia del backend, no sólo el commit.

Método recomendado: ejecución directa en esta sesión mediante superpowers:executing-plans, con revisión independiente de la rama antes de integración. Los contratos de creación, journal y transporte dependen entre sí; dividir implementadores por cada tarea aporta más traspasos. Alternativa: ejecución por agentes, si el usuario la elige.

Estado: plan preparado para revisión del usuario. Diseño aprobado; implementación y publicación de la migración todavía pendientes.
