# Portal CIARM — estado y siguientes entregas

Actualizado: 2026-10-12, America/Cancun. Código productivo comprobado: main 4ec6cbf, versión 18.3.3. Este archivo sustituye las afirmaciones antiguas de «no implementado» o «publicación pendiente» para la primera entrega administrativa.

## Publicado y verificado

- Acceso institucional Google, sesión PHP y consulta de identidad en DM03.
- Asistente CIARM nativo con motor Voiceflow del servidor.
- Creación de solicitudes y consulta de Mis solicitudes mediante el contrato histórico de Apps Script.
- Administración de Dany y Ezequiel protegida mediante sesión, permiso específico de tickets, CSRF y firma del puente PHP → Apps Script.
- Asignación de responsable, prioridad y compromiso; controles de versión y recuperación con BITACORA TICKETS.
- Dashboard por estados y distribución; entrada inicial de pendientes, sustitución por agrupación seleccionada y asignación en ventana modal compacta con cierre tras confirmación.
- PR #1 a #5 integradas. Últimas ejecuciones de pruebas y despliegues en NEUBOX y GitHub Pages completadas correctamente. Suite: 53 pruebas Node; el CI también valida PHP y consistencia del bundle de Apps Script.

Las pruebas con fixtures y el despliegue acreditan código y publicación. No acreditan por sí solos una asignación real, bitácora confirmada, revocación o concurrencia en producción.

## Próximo trabajo, en orden

| Trabajo | Registro | Resultado esperado |
| --- | --- | --- |
| Validación integral con sesión real | [#6](https://github.com/econesa-source/Portal-CIARM/issues/6) | Solicitud controlada, asignación, bitácora y lectura del solicitante comprobadas |
| Identidad de sesión para creación y lectura propia | [#7](https://github.com/econesa-source/Portal-CIARM/issues/7) | Ningún correo enviado por el cliente concede identidad; entradas antiguas retiradas tras migración |
| Folios y filas de nuevas solicitudes | [#8](https://github.com/econesa-source/Portal-CIARM/issues/8) | Más de 300 filas y huecos no producen reutilización de folios ni sobrescritura |
| Ejecución, resolución y cierre | [#9](https://github.com/econesa-source/Portal-CIARM/issues/9) | Reglas aprobadas de permisos, transiciones y evidencia antes de desarrollar |

## Límites comprobados

- La lectura histórica de Apps Script admite correo libre, ausencia de filtro y un atajo de administración; no tiene la protección del módulo administrativo nuevo.
- El alta histórica recibe un correo del navegador; consultar DM03 con ese correo no prueba quién realiza la petición.
- El registro histórico calcula folio y fila contando A1:A300; el bloqueo histórico no comprueba el resultado de tryLock.
- El puente administrativo limita las peticiones a aproximadamente 50 KB. El formulario admite cinco archivos de 10 MiB: no se puede trasladar su payload completo a ese puente sin rediseñar el transporte.
- El formulario vigente confirma por lectura el registro y los adjuntos. El fallback no-cors de apiClient.js no es la función usada por el formulario actual y no se debe atribuir al flujo productivo.
- Seguimiento, cierre, historial visible y reglas de SLA permanecen pendientes. Mi perfil, Mis obligaciones y demás integraciones deben retomarse después del circuito de solicitudes.

## Evidencia de aceptación pendiente

- Cuenta administradora, cuenta sin permiso y revocación en vivo.
- Guardado controlado: mismo folio y valores en TICKETS, administración y Mis solicitudes; un único evento confirmado.
- Conflicto entre administradores y recuperación de una respuesta desconocida.
- Inspección visual del formulario compacto en una pantalla real. El entorno de comprobación local impidió iniciar el navegador; no hay una medición acreditada de altura sin desplazamiento.

No borrar solicitudes de prueba ni modificar tickets operativos para crear evidencia. No registrar correos nuevos ni habilitar acciones de ejecución dentro de esta etapa.

## Protección: implementación en rama, aceptación pendiente

El usuario aprobó el diseño de protección el 2026-10-12. El plan técnico está en docs/superpowers/plans/2026-10-12-proteccion-solicitudes.md, con contratos, pruebas, límites de adjuntos y cambio coordinado. La ejecución fue autorizada. La rama implementation/proteccion-solicitudes incorpora backend firmado, creación recuperable, folios de rango completo, PHP con archivos individuales y frontend 18.4.0. Pruebas locales: 84 Node y ambas suites PHP. Revisión independiente terminada y correcciones verificadas. Registro: docs/backend/proteccion-solicitudes-review.md. No se ha retirado aún el acceso histórico ni publicado la migración; staging, verificación visual y aceptación real siguen pendientes. Procedimiento: docs/backend/proteccion-solicitudes-deployment.md.

## Aceptación reportada — 2026-10-12

El usuario confirmó que TKT-2026-00023 se registró y cambió de estado correctamente al asignarse. Esto acredita creación y movimiento observados por el usuario; no acredita por sí solo adjuntos, bitácora, revocación ni concurrencia. Frontend 18.4.0 y PHP publicados; el usuario confirmó capabilities y el workflow acreditó rechazo de lectura histórica pública.

Ajuste 18.4.1 preparado: distinguir fecha de solicitud y fecha de asignación, mostrar hora de solicitud y devolver fecha/hora de asignación ya existente en la fuente. No modifica datos ni reglas de asignación. Requiere actualizar el bundle Apps Script antes de publicar frontend.

## Ajuste de experiencia 18.4.2

El usuario confirmó que la entrega de fechas funciona. Se unifican fecha arriba/hora debajo en ambos listados, se compacta el dashboard y cada clic en estado o agrupación enfoca el título y desplaza suavemente al subconjunto (respeta movimiento reducido). Toda solicitud pendiente muestra Asignar en cualquier subconjunto; abre el mismo modal existente. La tarea corresponde a asignación, sin introducir ejecución/resolución/cierre. No requiere cambio Apps Script.
