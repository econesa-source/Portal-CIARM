# ADMIN-SOL-003 — Creación y consulta propias autenticadas

Fecha: 2026-10-12. Estado: decisión aprobada, implementación pendiente de aceptación y publicación.

Contexto: administración usa sesión y firma; alta y lectura históricas siguen accesibles directamente y el folio depende de un rango fijo. Se requiere identidad oficial y recuperación sin duplicados.

Decisión: conservar TICKETS como fuente única y DM03 como identidad activa. PHP obtiene actor de sesión y firma operaciones; Apps Script revalida identidad/permiso, serializa escrituras y reserva folios sobre todo el rango. CREAR comparte BITACORA TICKETS con ASIGNAR, distinguiendo ACCIÓN; los adjuntos se suben individualmente a Drive. El borrador local sólo guarda metadatos y hashes. Confirmar éxito únicamente tras lectura de fila completa. El frontend conserva dashboard, modal y estilo institucional.

Consecuencias: transición coordinada PHP/Apps Script/frontend; compatibilidad pública sólo mediante propiedad explícita y temporal. No declarar protección ni cerrar #7 hasta retirarla y verificar la denegación. Requiere capacidades de hosting y pruebas reales de recuperación, archivos máximos y fórmulas. No modifica autenticación general ni reglas de ejecución/cierre.
