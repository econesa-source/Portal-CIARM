# Administración de solicitudes internas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Propuesta: ejecución directa en esta sesión, pendiente de revisión del usuario.

**Goal:** Permitir a Dany y Ezequiel consultar y asignar solicitudes internas con autorización de servidor y evidencia de cambios.
**Architecture:** TICKETS mantiene el estado oficial. PHP usa la sesión existente y consulta permisos actuales de DM03; Apps Script acepta operaciones administrativas firmadas por PHP, valida catálogos y registra una bitácora recuperable.
**Tech Stack:** PHP, JavaScript ES modules, Google Apps Script, Google Sheets; pruebas PHP y node:test sin framework de producto nuevo.
**Spec:** docs/superpowers/specs/2026-10-06-admin-solicitudes-internas-design.md

## Global Constraints
- Administradores: d.lara@ciarm.edu.mx y e.conesa@ciarm.edu.mx; ambos activos y Sistema de tickets=Administrador en DM03.
- No conceder administración global del Portal a Dany.
- Fuente: libro 1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs; permisos: 1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY.
- Primera entrega: bandeja, detalle y asignación. No activar compras, correos nuevos ni reglas de SLA.
- Preservar login, Voiceflow, solicitudes originales, adjuntos y registros de pruebas.
- No desplegar ni sustituir Apps Script con la copia parcial backend-gas.js.
- Trabajar en rama aislada; comprobar main antes de ejecutar.

## Review Focus
- Tipos históricos distintos del catálogo deben verse sin pérdida ni asignación automática.
- Sesión vencida o permiso revocado debe negar inmediatamente la administración.
- Dos administradores editando el mismo ticket deben recibir conflicto y conservar su edición.
- Reintento tras fallo parcial debe recuperar la misma operación, sin duplicar eventos.
- Un enlace de adjunto inválido no debe ejecutar contenido ni romper el detalle.

## Task 1: Conciliar fuente y contrato vigente
**Files:** Create docs/backend/tickets-source.md; actualizar src/services/backend-gas.js sólo con fuente completa comprobada.
**Interfaces:** Produce inventario de scriptId, deploymentId, versión, fuente completa, contrato de creación/lectura y entradas protegidas.
- [ ] Localizar la fuente completa mediante inventario Apps Script y carpetas oficiales; verificar scriptId y deploymentId contra la URL usada por el frontend. Si no hay acceso, registrar exactamente qué falta y solicitar referencia o acceso al proyecto, sin pedir copiar scripts.
- [ ] Leer flujo productivo index-v1782.html→src/main-v1782.js y despliegue NEUBOX; documentar rutas reales.
- [ ] Comparar fuente con getTickets, createTicket, adjuntos y permisos; conservar el contrato vigente.
- [ ] Comprobar si ya existe bitácora; no duplicar un historial equivalente.
- [ ] Commit de inventario comprobado. Este paso bloquea integración y despliegue; código de interfaz puede prepararse con fixtures.

## Task 2: Autorización y puente PHP
**Files:** Create tickets-lib.php, tickets-api.php, tests/tickets-auth.php; reuse auth-lib.php sin alterar login.
**Interfaces:**
- ciarm_ticket_context(array $sessionUser): array → {canAdmin:boolean, csrfToken:string}.
- ciarm_ticket_permission(array $rows,string $email): bool; exige encabezados exactos Correo Ciarm, Status y Sistema de tickets; cero o múltiples coincidencias deniegan.
- GET tickets-api.php?action=context|list|catalogs|detail&id=... .
- POST tickets-api.php → {action:"assign",csrfToken,operationId,ticketId,expectedVersion,changes:{responsable,prioridad,fechaCompromiso,observacion}}.
- Respuesta {ok,data} o {ok:false,code}; 401 sesión, 403 permiso/CSRF, 409 conflicto, 422 validación, 502 upstream.
- [ ] Crear pruebas: correo falsificado no altera actor; d.lara y e.conesa activos con permiso pasan; rol Portal sin permiso no basta; permiso revocado, duplicado o columna ausente deniega.
- [ ] Ejecutar php tests/tickets-auth.php; confirmar fallo previo.
- [ ] Implementar consulta de permisos con cuenta de servicio existente y token readonly; no exponer credenciales. Revalidar permiso en cada operación.
- [ ] Implementar CSRF ligado a sesión y comparación constante; rechazar POST de origen distinto.
- [ ] Firma del puente: HMAC-SHA256 sobre JSON UTF-8 del envelope {action,actor,issuedAt,nonce,payload}; enviar {envelope,signature}. Guardar clave sólo fuera del webroot y en Script Properties. Ventana de firma 120 segundos, nonce único.
- [ ] Ejecutar pruebas y php -l sobre archivos modificados. Commit.

## Task 3: Asignación Apps Script con recuperación
**Files:** Create apps-script/tickets-admin.gs, tests/tickets-admin.test.mjs; integrar dispatcher verificado de Task 1.
**Interfaces:**
- handleAdminEnvelope(envelope,signature) → {ok,data}|{ok:false,code}.
- listAdminTickets() → Ticket[]; getAdminCatalogs() → {prioridades:string[],responsables:string[]}; getAdminTicket(id) → Ticket.
- assignAdminTicket(actor,payload) → {ticket,operationId}.
- Ticket: {id,fecha,hora,solicitante,correo,area,tipo,descripcion,urgencia,prioridad,responsable,fechaCompromiso,estado,observaciones,adjuntos,version}.
- version es hash del snapshot canónico de la fila leído por encabezados.
- [ ] Pruebas de firma inválida, ventana expirada y nonce repetido: ninguna lectura/escritura administrativa.
- [ ] Pruebas de ID inexistente/duplicado, responsable fuera de catálogo, POR DEFINIR, fecha inválida y estado terminal: rechazar sin escribir. Sólo prioridad CRITICA/URGENTE/ALTA/MEDIA/BAJA; fecha YYYY-MM-DD válida y no anterior al día local de asignación.
- [ ] Pruebas: NUEVO→ASIGNADO; reasignación conserva fechas de ejecución; conflicto expectedVersion no sobrescribe; valores de usuario no se interpretan como fórmulas.
- [ ] Ejecutar node --test tests/tickets-admin.test.mjs; confirmar fallos.
- [ ] Implementar validación, encabezados exactos, LockService y journal BITACORA TICKETS propuesto: preparar evento PENDIENTE con antes/después; actualizar fila y readback; marcar CONFIRMADO. Reintento operationId/actor/payload idénticos recupera journal; payload distinto rechaza; divergencia externa deja conflicto para revisión. No prometer transacción atómica entre Sheets.
- [ ] Pruebas de interrupción antes/después de fila y antes de confirmar journal; comprobar un solo evento confirmado por operación.
- [ ] Ejecutar suite. Commit.

## Task 4: Cliente, bandeja y detalle
**Files:** Create src/services/ticketsAdminService.js, src/components/adminSolicitudesWidget.js, tests/tickets-admin-client.test.mjs; Modify src/main-v1782.js, index-v1782.html, ciarm-theme.css según entrypoint comprobado.
**Interfaces:**
- getAdminContext(), listAdminTickets(), getAdminCatalogs(), getAdminTicket(id), assignAdminTicket(payload): Promises por fetch same-origin.
- renderAdminSolicitudesWidget(container,userSession): Promise<void>.
- Ruta #admin-solicitudes; permiso fresco desde context, no inferido por email cliente.
- [ ] Pruebas: HTTP/error JSON no producen éxito; 409 conserva edición; 401 vuelve al acceso institucional; navegación cancela lectura pendiente.
- [ ] Pruebas: tipos históricos se muestran tal cual; adjuntos sólo https de Google Drive/Docs, texto restante sin enlace; texto se escapa; búsqueda sin resultados muestra estado vacío.
- [ ] Ejecutar node --test tests/tickets-admin-client.test.mjs; confirmar fallos.
- [ ] Implementar bandeja y filtros de diseño; detalle con datos originales readonly, urgencia solicitada separada de prioridad asignada.
- [ ] Implementar panel responsable/prioridad/fecha/observación; operaciónId estable durante reintento, nuevo cuando cambia edición. Tras guardado confirmado refrescar fuente.
- [ ] Añadir acceso de menú sujeto a permiso; ruta protegida aun entrando directo. Mantener widget export render compatible con router productivo.
- [ ] Ejecutar suite y comprobar desktop/móvil, teclado y carga/error/vacío/conflicto mediante preview local. Commit.

## Task 5: Configuración y verificación integral
**Files:** Create docs/backend/admin-tickets-deployment.md; actualizar documentación/ADR con código conciliado al catálogo institucional.
- [ ] Respaldar valores específicos de DM03 y esquema del libro. Cargar Administrador únicamente en Sistema de tickets de las dos filas verificadas; readback. No tocar Portal ni Solicitudes de Compra.
- [ ] Crear bitácora sólo si Task 1 confirma que no hay equivalente; preservar REGISTRO SOLICITUDES.
- [ ] Configurar secreto del puente por canal privado y validar PHP↔Apps Script. No incluir secreto en repositorio, respuesta, logs o artefactos.
- [ ] Verificar que las entradas administrativas antiguas no permiten eludir firma; proteger o retirar sólo esas entradas, preservando contratos existentes.
- [ ] Ejecutar php tests/tickets-auth.php y node --test tests/tickets-admin*.test.mjs. Validar integración sobre copia de pruebas, sin correos.
- [ ] Verificar las dos cuentas administradoras, una cuenta sin permiso y revocación; asignación y Mis solicitudes comparten estado; confirmar journal y conflicto concurrente.
- [ ] Revisar diff completo, documentación y rollback. No presentar como operativo sin verificación end-to-end.
- [ ] Presentar resultado probado para publicación; desplegar conforme a autorización vigente y con fuente conciliada. Rollback coordinado: frontend, PHP y Apps Script, conservar historial.

## Condición de entrada a ejecución
Revisión del usuario de este plan y elección de ejecución directa o con agentes, según writing-plans. Recomendación: directa; las interfaces PHP↔Apps Script y la fuente vigente requieren continuidad.
