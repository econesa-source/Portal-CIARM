# Estado actualizado — 2026-10-12

La primera entrega de administración y sus ajustes visuales están publicados en main 4ec6cbf, Portal 18.3.3. Las PR #1 a #5 se integraron y los despliegues de NEUBOX y GitHub Pages terminaron correctamente. El CI pasó 53 pruebas Node y sus verificaciones PHP/build.

La evidencia anterior del usuario acredita configuración y lectura administrativa. La escritura real, la bitácora confirmada, la revocación y la concurrencia en producción permanecen pendientes de verificación (#6). Los flujos históricos de alta y lectura propia todavía requieren la migración de seguridad (#7) y la corrección de folios (#8).

Estado y tareas vigentes: docs/estado-proyecto.md. Los apartados siguientes conservan el historial del relevamiento; las frases de bloqueo o publicación pendiente anteriores no describen el estado actual del frontend.

# Verificación aportada el 2026-10-12

El usuario confirmó el ID completo del despliegue activo: `AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA`. Las capturas muestran el proyecto «Portal CIARM Update tickets», con Código.gs, cuya URL difiere del proyecto inicialmente suministrado. El código completo adjuntado nuevamente coincide con tickets-original.gs al normalizar el formato Markdown.

El usuario reemplazó Código.gs, configuró la propiedad TICKETS_ADMIN_SECRET y cargó la misma clave privada en el servidor. Las capturas confirman tickets-admin.key en /home/ciarmedu/portal-ciarm-private con permisos 0600 y los permisos de tickets Administrador para d.lara y e.conesa activos en DM03. No se leyó ni se publicó la clave.

El usuario confirmó que context devolvió ok=true y canAdmin=true desde su sesión; posteriormente aportó la respuesta catalogs con las cinco prioridades y tres responsables correctos y confirmó list con los tickets en data. Esto acredita lectura administrativa mediante el puente PHP y el despliegue suministrado. No acredita aún una asignación real, la bitácora en producción ni pruebas de revocación y concurrencia en vivo.

En ese momento el usuario informó la carga de los dos módulos JS y restaba publicar el frontend; esa publicación se completó luego mediante las PR #1 a #5. El 2026-10-12 autorizó explícitamente publicar el código del adjunto y detalles de permisos en el repositorio público econesa-source/Portal-CIARM, exclusivamente en la rama de implementación indicada. No se interpreta como autorización adicional para fusionar a main en este paso.

# Fuente y despliegue de tickets — verificación 2026-10-06
Estado: conciliación bloqueada por falta de referencia al proyecto Apps Script vigente.

## Comprobado
- Rama base main: 5bb7c07da7864ebf9a8ce6730e1a5a5715869f5c.
- Frontend productivo referenciado: index-v1782.html y src/main-v1782.js.
- La sesión real PHP devuelve nombre, correo, área, puesto, sección y status; no contiene permiso específico de tickets.
- Flujo actual crea con POST mediante formulario oculto y confirma por GET getTickets. No modificar mientras no se concilie backend.
- WebApp referenciada: https://script.google.com/macros/s/AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA/exec .
- Deployment ID observado: AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA. No permite inferir Script ID.
- src/services/backend-gas.js invoca getTickets, updateTicketStatus y submitEvaluation sin definirlos. Contrato createTicket diferente al formulario; esta copia no es fuente completa verificada.
- Workflow deploy-neubox.yml despliega automáticamente main en NEUBOX y valida portal2.ciarm.edu.mx. Por ello cambios de diseño/código en rama aislada no se fusionan para simular que están operativos.

## Fuentes consultadas para localizar código
- Inventario SCGRC_INVENTARIO_APPS_SCRIPT (1-NG1jhSasTIz76-hZYqYH7dP_aMys2sSYiLhCe_gQ70): relevamiento original agosto 2026, actualización septiembre, no identifica WebApp de tickets actual.
- Carpeta SCGRC/Scripts (1HpxGdHO3ZR5nQAwea4CMGcvU-9cXD_wa): listado directo incluye módulos SCGRC; no carpeta de tickets/Portal.
- Carpeta de base tickets (1oIDQN5yyUFJVO9tx2XZNSNVWb6_hI8Go): BD - Sistema de Tickets, base anterior y usuarios y andariveles; no fuente Apps Script listada.
- Búsqueda de proyectos Apps Script y nombres backend-gas.js, Código.js, Code.js: no identificó fuente vigente.

## Falta verificar
Script ID, versión desplegada y fuente completa de la WebApp. Se necesita URL del editor Apps Script o referencia a la carpeta/repositorio oficial del código. No se requiere copiar y pegar scripts.
Esta limitación bloquea integración administrativa y despliegue. No se modificaron permisos, tickets, bitácoras ni código operativo.
# Conciliación del 2026-10-07

El usuario adjuntó `Markdown pegado.md` con las funciones completas de alta y consulta del backend v17.6.0 y una exportación de BD - Sistema de Tickets. Se preserva el código recibido, normalizando exclusivamente escapes y espacios de Markdown, en `apps-script/tickets-original.gs`. No se afirma que sea la versión actualmente desplegada.

El libro del adjunto coincide con CONFIG y los encabezados TICKETS A:X. CATALOGOS y RESPONSABLES coinciden con el inventario anterior. REGISTRO SOLICITUDES registra recepción/notificación y no reemplaza una bitácora de asignaciones.

`apps-script/tickets-admin.gs` incorpora administración firmada; `apps-script/build.mjs` produce `tickets-backend.gs`, con un único doPost que separa las operaciones administrativas del contrato original de alta. No sustituir el proyecto con backend-gas.js parcial de src/services.

El 2026-10-07 se intentó nuevamente el editor suministrado, scriptId `1Yj231qwivY0ZkUpmXP5CRuw1FV0sunhhSGd5Eeb4V-kce6c0H6eHeMos`. Redirigió a «Necesitas acceso» bajo r.valencia@ciarm.edu.mx. El acceso de e.conesa@ciarm.edu.mx no quedó confirmado en esta sesión. Por tanto, no se leyó el panel de implementaciones, no se verificó la asociación scriptId→deploymentId y no se modificó Apps Script ni DM03 en vivo.

Se incorporó main `193b00c03cebf6f6165819fde3f585901ab17d26` a la rama de implementación para preservar navegación responsive y asistente. Entradas de esta entrega: index.html→src/main.js y el alias index-v1782.html→src/main-v1782.js, versión 18.2.0.

## Migración de protección preparada — 2026-10-12

La rama pendiente incorpora creación y lectura propia mediante sesión, recuperación y folios sin rango fijo. El bundle actual de esa rama deniega entradas sin firma salvo compatibilidad explícita. No sustituirlo en producción siguiendo solamente las instrucciones históricas: usar `docs/backend/proteccion-solicitudes-deployment.md`, que conserva temporalmente el frontend vigente y exige aceptación antes de integrar 18.4.0. La migración todavía no está publicada.
