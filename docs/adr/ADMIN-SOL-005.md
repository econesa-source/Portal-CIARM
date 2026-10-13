# ADMIN-SOL-005 — Visión gerencial de solicitudes internas
Fecha: 2026-10-13. Estado: aprobado por Ezequiel Conesa; implementación 18.6.0.

## Proceso y responsables
Dirección necesita identificar carga, incumplimientos y calidad del servicio. Dany administra asignaciones; cada ejecutor responde por sus etapas; el solicitante valida la solución. Acceso únicamente con autorización administrativa vigente, validada por PHP y Apps Script.

## Decisión
Administrar → Visión gerencial (#vision-gerencial). Vista independiente del dashboard operativo, que sigue mostrando nuevas solicitudes por asignar. Consume serviceList(all) y serviceDetail sobre la fuente oficial TICKETS/SEGUIMIENTO SERVICIO, sin hojas paralelas ni modificaciones de datos. Reutiliza la asignación existente al seleccionar Asignar; el folio se transfiere localmente y se vuelve a comprobar contra el listado autorizado.

## Indicadores
Carga actual: abiertas (incluye resueltas por validar), pendientes sin asignar, vencidas con objetivo pendiente vencido, resueltas por validar. Un retraso de inicio ya completado no convierte por sí solo el caso en pendiente vencido.
Períodos 7/30/90 días locales incluyendo hoy, o todo historial. Los porcentajes incluyen hitos completados cuya fecha está en el período y objetivos abiertos cuyo vencimiento está en el período; excluyen abiertos todavía en plazo. Se muestran numerador/denominador por etapa, sin promedio de porcentajes. Responsabilidad del actor original de asignación y propietario de etapa/entrega; validación atribuida al solicitante. Ciclos devueltos conservan su ejecutor. Primera conformidad cuenta el primer veredicto, no pendientes. Devoluciones son eventos, no casos únicos.
Filtros área/tipo/prioridad según clasificación actual. Responsable filtra carga por propietario actual de ejecución/asignación y métricas por responsable original de etapa. Gráfico fijo últimas 4 semanas: recibidas y entregas de resolución (incluye retrabajo), no cierres ni pendiente histórico reconstruido. Casos sin seguimiento no aportan SLA; fechas no interpretables declaradas.

## Interacción y consecuencias
Tarjetas, etapas y responsables abren popup con subconjunto deduplicado. Historial con identidad/fecha/comentarios/evidencia; Asignar en todos los casos sin asignación. Escape/cerrar restaura foco; consultas abortadas al cambiar ruta y detalle protegido contra respuestas tardías. Calendario y SLA se editan en Configuración del servicio; este dashboard sólo consulta. No requiere actualización de Apps Script.
