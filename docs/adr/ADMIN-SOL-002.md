# ADMIN-SOL-002 — Dashboard ejecutivo de solicitudes internas

Fecha: 2026-10-12. Estado: Aceptado por el usuario.

## Contexto

La administración debe empezar con una vista ejecutiva de la distribución de solicitudes. El administrador necesita abrir cada agrupación y mantener siempre visibles las solicitudes que requieren asignación.

## Decisión

- El acceso sigue siendo el botón Administrar de la tarjeta Solicitudes internas, protegido por el permiso del servidor.
- La pantalla abre con cantidades por estado. Se incluyen los siete estados conocidos y cualquier valor histórico presente en la fuente.
- La distribución puede agruparse por responsable, prioridad asignada, tipo y área solicitante. Cada agrupación abre su subconjunto; los filtros refinan ese subconjunto y Ver todas restablece la vista.
- Debajo del dashboard aparece siempre la bandeja de pendientes, independiente de la agrupación y los filtros. Incluye NUEVO y solicitudes no terminadas cuyo responsable esté vacío o sea SIN ASIGNAR. RESUELTO, CERRADO y CANCELADO no se incorporan por ausencia de responsable.
- Seleccionar una solicitud abre su detalle y el formulario de asignación existente. Una asignación confirmada y una consulta del detalle actualizan los indicadores, la bandeja y el subconjunto.
- El resumen usa las solicitudes de la API existente, derivadas de la hoja oficial del sistema de tickets. No crea otra base de datos, estados ni reglas de ejecución.
- Conserva colores y estilo del Portal. La versión de los entrypoints y del CSS cambia a 18.3.0 para renovar la caché.

## Consecuencias y validación

La consulta inicial contiene el conjunto completo autorizado. Las agrupaciones se calculan sobre ese conjunto, sin escribir en la hoja. Se refresca al entrar de nuevo, consultar un detalle o confirmar una asignación; no incorpora sondeo automático.

Las pruebas cubren cantidades, estados históricos, agrupaciones, escape de contenidos, pendientes independientes de filtros, lista vacía y actualización después de guardar. El flujo de autorización, firma, concurrencia y bitácora existente se conserva.
