# Administración de solicitudes internas — avance de la primera entrega

Actualizado: 2026-10-12. Sustituye el seguimiento inicial con todas las casillas pendientes. El plan original permanece en el historial Git; esta versión distingue implementación, publicación y aceptación real.

## Implementado y publicado

- [x] Conciliar el Código.gs aportado por el usuario con la fuente de tickets y confirmar el deploymentId usado por el Portal.
- [x] Conservar login, Asistente CIARM, formulario histórico, adjuntos y Mis solicitudes.
- [x] Implementar puente PHP del mismo origen con actor de sesión, permiso específico DM03, CSRF y firma HMAC.
- [x] Implementar validaciones Apps Script, control de versiones, bloqueo, bitácora y recuperación de asignación.
- [x] Mantener a Dany y Ezequiel como administradores específicos de tickets, sin otorgar administración global a Dany.
- [x] Configurar backend y clave privada; permisos y consultas context/catalogs/list confirmados por el usuario.
- [x] Implementar dashboard por estado y distribución, vista inicial de pendientes y agrupación inmediatamente debajo del dashboard.
- [x] Implementar asignación en modal compacto, cierre tras confirmación y conservación de edición ante errores.
- [x] Integrar PR #1 a #5 y publicar versión 18.3.3 con validación del despliegue.
- [x] Ejecutar 53 pruebas Node, pruebas PHP, lint PHP y comprobación del bundle mediante CI.

## Aceptación real pendiente — issue #6

- [ ] Verificar asignación controlada con sesión real y un único evento confirmado en BITACORA TICKETS.
- [ ] Comprobar que administración, TICKETS y Mis solicitudes reflejan los mismos datos guardados.
- [ ] Verificar ambas cuentas administradoras y una cuenta sin permiso.
- [ ] Verificar revocación y conflicto concurrente en producción sin afectar solicitudes operativas.
- [ ] Verificar visualmente el modal compacto en una pantalla real y móvil.
- [ ] Registrar resultados y rollback; no reemplazar evidencia real por resultados con fixtures.

## Siguiente entrega

- [ ] Proteger creación y lectura propia con sesión de servidor y conservar adjuntos (#7).
- [ ] Corregir folios, filas libres y comprobación del bloqueo más allá de A1:A300 (#8).
- [ ] Revisar y aprobar el diseño técnico 2026-10-12-proteccion-solicitudes-design.md antes del plan de integración.
- [ ] Validar backend en copia independiente y coordinar Apps Script/PHP/frontend antes de retirar las entradas históricas.
- [ ] Definir las reglas de ejecución, resolución y cierre antes de implementar esa etapa (#9).

## Referencias

- docs/estado-proyecto.md: estado y prioridades vigentes.
- docs/adr/ADMIN-SOL-001.md: autorización, puente y persistencia.
- docs/adr/ADMIN-SOL-002.md: interfaz vigente del administrador.
- docs/backend/tickets-source.md: evidencia y relevamiento histórico.
- docs/backend/admin-tickets-deployment.md: publicación coordinada y recuperación.
