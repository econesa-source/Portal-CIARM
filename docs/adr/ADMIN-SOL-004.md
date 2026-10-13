# ADMIN-SOL-004 — Ejecución, validación del solicitante y SLA configurable
Fecha: 2026-10-12 America/Cancun. Estado: reglas aprobadas; código preparado y revisado, pendiente de activación real.

El responsable ejecuta y propone resolución; únicamente el solicitante institucional puede declarar conformidad y cerrar, o disconformidad con comentario obligatorio y devolver al mismo responsable. No hay cierre automático. Administración gestiona asignación y autoriza esperas, sin sustituir la validación del solicitante.

Configuración: fuente oficial en el libro BD - Sistema de Tickets, administrada mediante sección Configuración del servicio del portal para Dany/Ezequiel. Edición de plazos, horario, calendario y vínculo responsable/correo; validar y publicar una versión. No cambiar Code.gs para ajustar reglas. Conservar versiones y autor de publicación. Cada nueva solicitud referencia una versión inmutable; cambios posteriores no recalculan historial ni eliminan incumplimientos.

Horario inicial aprobado: lunes a viernes 08:00–16:00 America/Cancun; excluir días no laborables registrados en calendario de servicio. Un día hábil equivale a ocho horas de servicio; fuera del horario el reloj espera al próximo inicio. No inventar fechas no laborables: deben cargarse desde calendario institucional.

Asignación: ocho horas hábiles para prioridad general; crítica una hora y urgente cuatro horas desde recepción, como máximo. La señal Urgente del solicitante activa el objetivo urgente provisional antes del triage; el administrador confirma prioridad y nunca elimina retroactivamente un vencimiento. Prioridad crítica debe poder registrarse en triage inmediato sin esperar asignación normal.

Inicio/resolución desde asignación (horas hábiles): CRITICA 1/4 para inicio/contención; URGENTE 4/8; ALTA 8/16; MEDIA 16/40; BAJA 24/80. La contención crítica no equivale a resolución: conservar objetivo crítico y fecha de resolución definitiva comprometida, con evidencia y autorización para cualquier excepción. Medir contención como etapa separada.

Validación del solicitante: dieciséis horas hábiles desde resolución. Vencimiento indica validación pendiente, nunca conformidad automática. Comentario conforme opcional; disconforme obligatorio. Reapertura mantiene primer resultado, cuenta retrabajo y activa un nuevo ciclo con objetivos de la misma versión; no reinicia las métricas originales.

Espera: motivo, dependencia y próxima fecha de seguimiento obligatorios. Sólo administración autoriza la pausa; hasta autorización el reloj sigue corriendo. Pausa afecta ejecución/resolución, nunca asignación ni validación. El tiempo total calendario siempre es visible y una espera vencida exige seguimiento; no reanudar automáticamente ni esconder el vencimiento.

Compromiso y SLA se muestran separados. Cambiar compromiso no borra deadline original; excepciones requieren actor, motivo y fecha. Métricas de asignación, inicio, contención crítica, resolución, validación y conformidad en primera entrega, por actor/etapa; si no hay casos elegibles mostrar Sin casos, no 100%.

TICKETS permanece fuente única. Journal recuperable registra acción, actor, antes/después, comentario y operación; permisos derivados de sesión y DM03 activa en cada operación. RESPONSABLES requiere vínculo explícito y único con Correo Ciarm. No otorgar acceso por coincidencia parcial de nombres ni asumir correos.

Históricos sin versión: mostrar No evaluado / reglas anteriores. No aplicar incumplimientos retroactivos ni completar timestamps desconocidos. Migración de históricos sólo mediante operación explícita autorizada y con evidencia preservada.

Publicación: backend compatible preparado primero, prueba de capacidades real, luego frontend. Conservar denegación de acceso público. Validación real y configuración de correos/calendario preceden habilitación; no afirmar funcionamiento por pruebas locales únicamente.

Verificación previa en fuente real: RESPONSABLES contiene Daniel Diaz, Juan Jose Perez y Daniel Lara. DM03 tiene Daniel Lara / d.lara@ciarm.edu.mx activo. Los registros encontrados de Ernesto Daniel Diaz Carrillo y Juan Jose Perez Gonzalez están activos pero su Correo Ciarm está vacío. No se asignaron correos ni se otorgó acceso por nombre. Vinculación de los primeros dos pendiente de confirmación del usuario.

Avance: motor hábil, configuración editable/versionada, transiciones, recuperación, métricas y frontend incorporados a la rama. Suite110/110; revisión independiente con correcciones verificadas. No publicado ni activado todavía; requiere bundle Apps Script y verificación de capacidad antes de frontend18.5.0.

Actualización autorizada: se verificaron activos r.valencia@ciarm.edu.mx (Rodrigo Valencia) y e.conesa@ciarm.edu.mx (Ezequiel Conesa). Se ofrecen mapeos PRUEBA — Rodrigo Valencia y PRUEBA — Ezequiel Conesa, además del mapeo real de Dany. Los dos responsables sin cuenta permanecen en el catálogo, sin acceso de ejecutor por nombre. No se crearon ni reemplazaron usuarios en DM03.
