# Servicio y SLA — preparación 18.5.0

Estado: preparado en rama; no activado ni publicado. No actualizar frontend antes de capacidad tickets-service-v1.

1. Respaldar código/versiones y libro. Probar primero una copia independiente de Apps Script, TICKETS y carpeta, con hosting de pruebas y cuentas de prueba. No cambiar CONFIG de producción para probar.
2. Reemplazar Code.gs con el bundle completo generado. Publicar una nueva versión de la implementación existente, conservando URL y secretos. Conservar TICKETS_ALLOW_LEGACY desactivado.
3. Publicar PHP compatible (tickets-api.php, tickets-portal-lib.php; auth-lib.php/tickets-lib.php sin cambio). Consultar selfContext con sesión: serviceAvailable=true. No compartir csrfToken.
4. Publicar frontend18.5.0 después de comprobación. Administración → Configuración del servicio permite editar horario, días, no laborables, plazos por prioridad y mapeos nombre/correo. Publicar crea otra versión en CONFIG SERVICIO; no editar versiones ni SEGUIMIENTO SERVICIO directamente.
5. Confirmar los mapeos iniciales: Daniel Lara/d.lara@ciarm.edu.mx; PRUEBA — Rodrigo Valencia/r.valencia@ciarm.edu.mx; PRUEBA — Ezequiel Conesa/e.conesa@ciarm.edu.mx. Los dos últimos son pruebas autorizadas y comprobadas activas en DM03. No adivinar cuentas de Daniel Diaz o Juan Jose Perez; sin mapeo explícito no podrán recibir tareas con seguimiento activo.
6. Activar reglas. Crear solicitud de prueba; asignar a Rodrigo o Ezequiel. Desde esa cuenta abrir Mis tareas, iniciar y resolver con comentario/evidencia. Solicitante valida conforme o disconforme. Administración autoriza espera, revisa cumplimiento por etapa y excepciones. Comprobar fila y journal, recuperación de respuesta perdida y revocación.

Reglas nuevas se capturan por versión al comenzar la creación. La recepción fuera de horario cuenta desde la próxima apertura; ocho horas de servicio iniciales equivalen a un día hábil. Históricos NUEVO/ASIGNADO incorporados por una nueva asignación quedan marcados como anteriores para la etapa de recepción/asignación: no se fabrican incumplimientos pasados. Desde esa asignación comienzan los objetivos de ejecución.

Crítica: contención dentro de cuatro horas hábiles desde asignación; resolución definitiva según fecha de compromiso. Contención y solución definitiva son evidencias separadas. Pausas autorizadas extienden contención/resolución; jamás borran retraso de inicio, asignación o validación. Rechazo devuelve ASIGNADO y mantiene ciclos anteriores, comentarios en journal y primera conformidad.

Configuración se modifica únicamente desde la interfaz administrativa: permisos de Dany/Ezequiel revalidados en PHP y Apps Script. Calendario institucional debe cargarse; no se ha supuesto ninguna fecha festiva. Cambiar horario/plazos sólo afecta nuevas solicitudes; cambio de responsable/compromiso requiere operación auditada. No borrar journal, CONFIG SERVICIO ni SEGUIMIENTO SERVICIO para corregir métricas.

Pendiente de aceptación real: cuentas separadas, esperas tardías, rechazo/conformidad, recuperación, concurrencia, revocación, pausa y máximo volumen en Sheets, memoria y layout móvil. La suite local no acredita esas comprobaciones.

Los históricos EN PROCESO/EN ESPERA sin seguimiento se rechazan antes de escribir, con SERVICE_MIGRATION_REQUIRED. Su incorporación exige una operación de migración explícita todavía pendiente; no se inventan pausas o inicios pasados. Para la prueba usar solicitudes nuevas.

Revisión independiente: se corrigieron escaladas de prioridad (conservan objetivos anteriores e incorporan contención crítica), atribución de devoluciones y primera entrega, etiquetas de acciones de historial, edición tras rechazo de configuración y contención crítica explícita. Se agregó recuperación del journal si se pierde el borrador local y cache de lectura por petición, sin cachear permisos entre peticiones.
