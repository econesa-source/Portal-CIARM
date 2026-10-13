# Implementación del circuito y SLA configurable
Reglas autorizadas: docs/adr/ADMIN-SOL-004.md. Código preparado, suite110/110 y revisión independiente corregida; despliegue/activación reales pendientes.

1. Configuración versionada: catálogo de servicio validado y publicación exclusiva administración, calendario, horario, plazos y mapeo RESPONSABLES/correo. Pruebas de datos inválidos, inactividad, duplicidad y conservación de versiones.
2. Reloj hábil: zona Cancún, límites exactos, fin de semana, no laborables, pausas autorizadas y ocho horas por día. Pruebas viernes 15:00 +8h, recepción fuera de horario y vencimiento sin pausa autorizada.
3. Transiciones: asignado→iniciado; espera solicitada/autorizada/reanudada; contención crítica; resolución; conforme→cierre; disconforme→retrabajo. Identidad explícita solicitante/ejecutor; journal idempotente, lock, conflicto de versión y recuperación ante escritura parcial. Evitar mezclar CREAR/ASIGNAR con acciones nuevas en recuperación.
4. SLA: snapshot por solicitud nueva, deadlines inmutables de etapa, métrica separada por responsable y ciclo. Históricos no evaluados; prioridad provisional urgente antes del triage; excepciones auditadas sin borrar incumplimiento.
5. PHP: acciones whitelist, sesión activa, permisos server-side, HMAC, CSRF para mutaciones y tamaños de metadata. Protocolo de capacidades específico; no habilitar rutas nuevas sobre backend anterior.
6. Interfaz: Mis tareas asignadas, acciones según rol y estado, validación en Mis solicitudes, seguimiento ejecutivo y Configuración del servicio sólo administradores. Fechas fuente-locales, semáforos textuales accesibles y comentarios seguros. Dashboard conserva grupos/listados y modal compacto.
7. Revisión y publicación: suite completa, revisión independiente, bundle integral y manual de configuración. Preparar PR sin publicar frontend antes de backend probado y responsable/correo configurado. Mantener pendientes pruebas reales de revocación, concurrencia y recursos.

Identidades de prueba comprobadas en DM03: Rodrigo Valencia/r.valencia@ciarm.edu.mx y Ezequiel Conesa/e.conesa@ciarm.edu.mx. Dany mantiene d.lara@ciarm.edu.mx. No se asignan correos a Daniel Diaz/Juan Jose Perez ni se reemplazan sus registros. Configuración de sus cuentas reales sigue pendiente.
