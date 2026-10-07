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
