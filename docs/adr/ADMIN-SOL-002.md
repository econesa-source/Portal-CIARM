# ADMIN-SOL-002 — Dashboard ejecutivo de solicitudes internas

Fecha: 2026-10-12. Estado: Aceptado por el usuario.

## Contexto

La administración debe empezar con una vista ejecutiva de la distribución de solicitudes. El administrador necesita abrir cada agrupación y mantener siempre visibles las solicitudes que requieren asignación.

## Decisión

- El acceso sigue siendo el botón Administrar de la tarjeta Solicitudes internas, protegido por el permiso del servidor.
- La pantalla abre con cantidades por estado. Se incluyen los siete estados conocidos y cualquier valor histórico presente en la fuente.
- La distribución puede agruparse por responsable, prioridad asignada, tipo y área solicitante. Cada agrupación abre su subconjunto; los filtros refinan ese subconjunto y Cerrar agrupación vuelve a la vista inicial. La entrada inicial muestra únicamente el dashboard y los pendientes: no carga una tabla expandida de todas las solicitudes.
- Decisión actualizada por el usuario el 2026-10-12: al entrar aparece la bandeja de pendientes debajo del dashboard. Al pulsar una tarjeta de estado o agrupación, su listado ocupa ese mismo lugar y oculta la bandeja general de pendientes. Cerrar agrupación restablece la bandeja inicial. Esta decisión sustituye la visibilidad permanente aprobada anteriormente. Incluye NUEVO y solicitudes no terminadas cuyo responsable esté vacío o sea SIN ASIGNAR. RESUELTO, CERRADO y CANCELADO no se incorporan por ausencia de responsable.
- Actualización aprobada del 2026-10-12: seleccionar una solicitud abre su detalle y asignación en una ventana modal sobre el dashboard, en lugar de un bloque debajo de la lista. La ventana usa dos columnas (resumen y formulario) en escritorio, metadatos compactos, prioridad y fecha en una fila y observaciones de dos líneas, suprimiendo el padding anidado y los márgenes extensos. En pantallas estrechas las columnas se apilan; se conserva la posibilidad de desplazamiento ante contenido excepcionalmente largo para no ocultarlo. La ventana se cierra sólo al confirmar el guardado; errores y conflictos conservan los datos para corregir o reintentar. Durante el guardado se bloquean el cierre y Escape. Al cerrar se restituye el foco a la lista o al dashboard. Una asignación confirmada y una consulta del detalle actualizan los indicadores, la bandeja y el subconjunto.
- El resumen usa las solicitudes de la API existente, derivadas de la hoja oficial del sistema de tickets. No crea otra base de datos, estados ni reglas de ejecución.
- Conserva colores y estilo del Portal. La versión de los entrypoints y del CSS cambia a 18.3.3 para renovar la caché.

## Consecuencias y validación

La consulta inicial contiene el conjunto completo autorizado. Las agrupaciones se calculan sobre ese conjunto, sin escribir en la hoja. Se refresca al entrar de nuevo, consultar un detalle o confirmar una asignación; no incorpora sondeo automático.

Las pruebas cubren cantidades, estados históricos, agrupaciones, escape de contenidos, vista inicial de pendientes y sustitución por la agrupación seleccionada, lista vacía y actualización después de guardar. El flujo de autorización, firma, concurrencia y bitácora existente se conserva.
