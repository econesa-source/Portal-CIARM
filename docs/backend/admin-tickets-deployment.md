# Administración de solicitudes internas: publicación coordinada

Fecha: 2026-10-07. Actualizado al 2026-10-12: backend y permisos configurados por el usuario; context/catalogs/list confirmadas. Frontend administrativo publicado en Portal 18.3.3; asignación y verificación integral real pendientes (#6). Estado vigente: docs/estado-proyecto.md.

## Primera entrega publicada

Ruta `#admin-solicitudes`, visible sólo con permiso fresco de servidor. Bandeja con fecha, solicitante, tipo, urgencia solicitada, prioridad asignada, responsable, compromiso y estado. Detalle con originales y enlaces validados. Asignación de responsable/prioridad/compromiso/observaciones, transición inicial NUEVO→ASIGNADO, sin funciones nuevas de cierre o notificación.

PHP obtiene el actor de la sesión HttpOnly y consulta la columna Sistema de tickets en DM03 en cada operación. Apps Script exige firma HMAC sobre el JSON exacto y revalida el mismo permiso. Las únicas cuentas elegibles son d.lara@ciarm.edu.mx y e.conesa@ciarm.edu.mx, ambas activas y con permiso Administrador.

## Procedimiento de publicación coordinada (referencia histórica)

1. Abrir el proyecto Apps Script autorizado y revisar todos sus archivos. Confirmar que no existe otra bitácora equivalente ni funciones adicionales ausentes del adjunto. Respaldar la versión actual completa y sus propiedades sin incluir secretos en GitHub.
2. En Administrar implementaciones, verificar que el ID del despliegue coincida exactamente con `AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA`. El scriptId por sí solo no acredita esta relación.
3. Probar en una copia independiente del libro y del Apps Script. Usar una clave de pruebas y servidor de pruebas; no cambiar CONFIG de producción para probar ni guardar una clave en el repositorio. Confirmar que fechas/formato/validaciones existentes aceptan escrituras y que toda fórmula derivada permanece intacta.
4. Una vez conciliada la fuente, incorporar el módulo administrativo y el dispatcher del archivo generado `apps-script/tickets-backend.gs`. Evitar duplicar doPost/doGet: el bundle ya incluye la fuente adjunta. Si el proyecto real tiene funciones adicionales, integrar sin eliminarlas.
5. Crear una clave aleatoria de al menos 32 bytes mediante un canal privado. Guardar el mismo valor en Script Properties `TICKETS_ADMIN_SECRET` y en `portal-ciarm-private/tickets-admin.key` fuera de la raíz pública, junto a service-account.json; restringir lectura al proceso PHP. No imprimir la clave en logs ni compartirla por chat.
6. Respaldar y cargar sólo las dos celdas de Sistema de tickets de DM03 como Administrador. No alterar el rol Portal. Verificar cuenta de servicio readonly y permisos del ejecutor de Apps Script sobre el libro y DM03. El usuario realizó esa configuración el 2026-10-12; no fue una edición automática del libro por el agente.
7. Crear una nueva versión en el despliegue existente; conservar su URL. Publicar conjuntamente archivos PHP y frontend de esta rama. La rama main dispara FTP: no fusionar mientras falten los pasos anteriores.
8. Verificar con Dany y Ezequiel, una cuenta sin permiso y una revocación: bandeja, asignación, conflicto concurrente, reintento, bitácora y lectura de Mis solicitudes. Sin correos ni modificaciones de tickets operativos para la prueba.

## Historial y recuperación

BITACORA TICKETS se crea sólo al asignar la primera operación válida. Esquema: OPERACION, ESTADO, ACTOR, PAYLOAD HASH, TICKET, ANTES, DESPUES, FECHA, PAYLOAD. Las instantáneas usan valores canónicos y fuentes de fórmulas para que el recálculo no genere conflictos falsos. PENDIENTE se registra antes de escribir las siete celdas autorizadas; CONFIRMADO sólo después de lectura de confirmación. No se promete una transacción atómica entre celdas y bitácora.

Reintentar el mismo operationId/actor/payload recupera una escritura completa o parcial si cada celda aún coincide con antes o después. Un cambio externo incompatible produce conflicto y requiere revisión. Una operación diferente no puede modificar el mismo ticket mientras exista un evento PENDIENTE. El cliente conserva el ID y los datos ante resultados desconocidos o posteriores al registro. Si se recarga/cierra la página, el detalle recupera del journal el payload original pendiente del mismo actor, conservando su operationId y expectedVersion. Otro administrador no recibe ese payload. No borrar eventos ni editar directamente el journal para ocultar un conflicto.

CacheService rechaza nonces repetidos mientras permanezcan en la caché; no ofrece almacenamiento duradero de nonces. La escritura idempotente se asegura además por el operationId persistido en el journal. No usar este protocolo para acciones adicionales sin reexaminar esta limitación.

## Compatibilidad y límites

El dispatcher conserva el contrato original del formulario y de Mis solicitudes. No corrige en esta entrega la autenticación histórica del GET de lectura ni del alta pública. La fuente adjunta conserva un bypass histórico `admin@ciarm.edu.mx` en lectura, el conteo limitado a A1:A300 para folios y el uso de adjuntos ANYONE_WITH_LINK. No se debe atribuir la protección del módulo nuevo a esas entradas históricas. La administración nueva no usa esas entradas y no añade cambios de estado sin firma.

No se cambió el archivo XLSX adjunto ni el libro original. No se envían correos nuevos. No se implementaron reglas de SLA, asignaciones automáticas ni compras.

## Validación y rollback

`npm ci && npm test` ejecuta pruebas de autorización de GAS, recuperación, coerción de Sheets, fórmulas, dispatcher, transporte y DOM de la bandeja. `php tests/tickets-auth.php`, `php -l tickets-lib.php` y `php -l tickets-api.php` validan el puente. La lectura administrativa PHP→Apps Script fue confirmada por el usuario. El despliegue productivo fue validado por el workflow. Siguen pendientes la escritura y bitácora reales, revocación, concurrencia e inspección visual en móvil/escritorio (#6).

Rollback: retirar el permiso de tickets en las dos celdas respaldadas, volver el despliegue Apps Script a la versión anterior y restaurar PHP/frontend coordinadamente. Conservar TICKETS y BITACORA TICKETS; las asignaciones confirmadas no se revierten automáticamente ni se borra su evidencia.

## Migración de protección preparada — 2026-10-12

La rama pendiente incorpora creación y lectura propia mediante sesión, recuperación y folios sin rango fijo. El bundle actual de esa rama deniega entradas sin firma salvo compatibilidad explícita. No sustituirlo en producción siguiendo solamente las instrucciones históricas: usar `docs/backend/proteccion-solicitudes-deployment.md`, que conserva temporalmente el frontend vigente y exige aceptación antes de integrar 18.4.0. La migración todavía no está publicada.
