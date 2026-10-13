# Revisión del servicio — 2026-10-12

Código preparado; no activado ni publicado. Revisión independiente gpt-6-astra sobre d994763..c01596e. Cuatro hallazgos importantes corregidos y dos limitaciones reclasificadas/corregidas: escalada de prioridad, incorporación histórica insegura, atribución de primera entrega y devoluciones, identificación de acción del journal, edición de configuración rechazada y contención crítica explícita. Regresiones observadas fallar y después pasar. Sin segunda revisión; suite final110/110, suites PHP y cuatro lint checks correctos.

Decisiones: solicitudes nuevas capturan versión al comenzar creación; la asignación fija objetivos de ejecución. Escaladas conservan objetivos previos y añaden los hitos nuevos sin borrar retrasos. Etapas completadas y devoluciones se atribuyen al ejecutor que las realizó, no al siguiente. Horas de espera sólo afectan hitos de ejecución/contención todavía abiertos; no borran retrasos de inicio. Validación exclusivamente solicitante; disconformidad obligatoria, sin cierre automático. Una resolución crítica exige contención explícita previa.

Históricos sin seguimiento en EN PROCESO/EN ESPERA se rechazan antes de escribir. Su migración explícita permanece pendiente porque no hay evidencia fiable para inventar inicios o pausas pasadas. Para ensayar, usar solicitudes nuevas. Riesgo de esta decisión: esas tareas históricas no podrán usar el circuito nuevo hasta una migración controlada; se conservan intactas.

Cuentas de prueba verificadas activas en DM03 mediante lectura real: r.valencia@ciarm.edu.mx y e.conesa@ciarm.edu.mx. No se modificaron personas ni permisos. No se adivinaron cuentas de responsables actuales que carecen de correo.

Recuperación: metadata, fila y confirmación son etapas del mismo journal; cada celda sólo puede coincidir con antes o después. Detalle recupera el payload pendiente únicamente para su actor original, incluso sin sessionStorage. Lecturas de configuración/seguimiento se cachean sólo dentro de la petición y se invalidan tras escritura; permisos no se cachean entre peticiones.

Pendientes: verificación real de ciclo, revocación, concurrencia, memoria/límites, layout móvil y migración histórica. No confundir pruebas locales con aceptación productiva. La publicación frontend espera capacidad real del backend y configuración.
