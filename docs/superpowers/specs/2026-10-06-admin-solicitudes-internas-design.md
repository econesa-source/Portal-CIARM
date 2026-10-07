# Administración de solicitudes internas
Fecha: 2026-10-06 (America/Cancun)
Estado: diseño propuesto para revisión. No implementado ni desplegado.

## Objetivo y alcance aprobado
Dany (Daniel Lara, d.lara@ciarm.edu.mx) y Ezequiel Conesa (e.conesa@ciarm.edu.mx) administran todas las solicitudes internas. Primera entrega: bandeja, detalle y asignación de responsable, prioridad y fecha compromiso. El solicitante mantiene acceso a sus propias solicitudes. Seguimiento y cierre se incorporan después, con reglas explícitas.

## Fuentes verificadas
- GitHub main, commit 5bb7c07da7864ebf9a8ce6730e1a5a5715869f5c.
- BD - Sistema de Tickets: 1o33Gw6xWsH64SXmaxaN7EDlSsW0fUExDjPE4cGpnPbs.
- TICKETS conserva estado actual; CATALOGOS conserva prioridades y estados; RESPONSABLES relaciona tipo y nombre.
- REGISTRO SOLICITUDES contiene recepción y notificación; no es historial de modificaciones.
- DM03: 1h14cqmHseHSN3FzrEtK_AwVimzDGkz9qx8LcGBCQuDY, hoja Permisos de usuario. Ambos usuarios activos. Columna Sistema de tickets vacía para ambos.
- Ezequiel tiene Portal=Administrador. Daniel Lara no tiene rol Portal cargado. El permiso de tickets debe ser independiente del rol global.
- Estados existentes: NUEVO, ASIGNADO, EN PROCESO, EN ESPERA, RESUELTO, CERRADO, CANCELADO.
- Prioridades: CRITICA, URGENTE, ALTA, MEDIA, BAJA, POR DEFINIR.
- Responsables existentes: Limpieza→Daniel Diaz; Mantenimiento→Juan Jose Perez; TODAS→Daniel Lara.

## Diseño propuesto
### Permisos
Usar columna Sistema de tickets de DM03 con valor Administrador para las dos cuentas confirmadas. No conceder administración global a Dany. Validar activo y permiso en servidor en cada operación. No aceptar el correo o rol enviado por navegador como prueba de identidad.
La interfaz oculta el acceso si no corresponde, pero el backend debe negar igualmente solicitudes directas no autorizadas.

### Interfaz
Acceso Administración de solicitudes internas. Bandeja con folio, fecha, solicitante, tipo, urgencia solicitada, prioridad asignada, responsable, fecha compromiso y estado.
Filtros por estado, tipo, responsable y urgencia; búsqueda por folio, solicitante y descripción.
Detalle con datos originales y adjuntos. Panel de asignación con responsable, prioridad, fecha compromiso y observación opcional. Datos originales de recepción no editables en esta entrega.
Responsables salen del catálogo existente; no inferir asignaciones automáticas. Permitir selección manual del catálogo mientras se concilian tipos.
Guardar sólo después de validación; mostrar éxito únicamente con respuesta confirmada del servidor. Mostrar errores sin perder la edición.

### Persistencia
Actualizar TICKETS por ID TICKET único, nunca por número de fila entregado por el cliente. Escritura por nombres de encabezado.
Campos: PRIORIDAD, RESPONSABLE, FECHA ASIGNACIÓN, FECHA COMPROMISO, ESTADO, OBSERVACIONES, ÚLTIMA ACTUALIZACIÓN.
Asignación inicial: NUEVO→ASIGNADO; establecer fecha asignación de servidor. Reasignación conserva fechas de ejecución y exige dejar evidencia del cambio.
No permitir modificar solicitudes RESUELTO/CERRADO/CANCELADO desde este panel de primera entrega.
Propuesta de bitácora nueva BITACORA TICKETS en el mismo libro, con ID OPERACIÓN, FECHA, ID TICKET, ACTOR, ACCIÓN, ANTES JSON, DESPUÉS JSON y RESULTADO. No reutilizar REGISTRO SOLICITUDES.
Operaciones idempotentes, bloqueo de escritura y comprobación de versión para evitar duplicados y sobrescrituras entre administradores. Resolver fallos parciales sin afirmar éxito antes de confirmar ticket y evidencia.

### Integración
Navegador→endpoint PHP del Portal con sesión HttpOnly→Apps Script con solicitud autenticada de servidor.
No exponer credenciales en JavaScript ni crear un endpoint público que confíe en email.
Conservar la identidad/sesión existente. Incorporar puente del servidor para permisos y tickets, sin rediseñar el login.
Centralizar cliente de administración; no utilizar fallback no-cors que devuelva éxito sin confirmación.
No enviar nuevos correos como parte de esta primera entrega.

## Hallazgos que condicionan implementación
1. backend-gas.js de GitHub no contiene getTickets, updateTicketStatus ni submitEvaluation aunque las invoca; no representa por sí solo el backend completo.
2. El formulario usa un contrato distinto al createTicket de ese archivo; hay tickets de pruebas recientes que documentan correcciones del contrato. No sustituir el script desplegado con esta copia parcial.
3. CATALOGOS incluye Compras; el antecedente del Portal la excluye de solicitudes internas. No habilitar Compras desde la nueva pantalla.
4. Tipos actuales del formulario (Soporte Tecnológico / TI, Mantenimiento de Instalaciones, Intendencia, RRHH / Admin) difieren del catálogo. Mostrar los originales y conciliar reglas antes de automatizar asignación.
5. Hay registros identificados explícitamente como pruebas técnicas; preservarlos y permitir identificarlos, sin eliminarlos ni contarlos como solicitudes operativas mediante una inferencia general.
6. No se encontró copia completa y verificable del script de tickets en la búsqueda de Drive realizada. Falta comprobar fuente y despliegue vigente. No atribuir el código GitHub a producción.

## Verificación de aceptación
- Dany y Ezequiel ven la bandeja y pueden asignar; otro colaborador recibe denegación desde backend.
- Alterar email/rol en navegador no concede acceso.
- Nueva asignación persiste responsable, prioridad, compromiso, estado y actor.
- Mis solicitudes refleja la misma fuente luego del cambio.
- Cambios concurrentes producen conflicto visible, no pérdida de datos.
- Reintentar una operación no genera dos eventos.
- Error del backend no muestra éxito.
- Adjuntos y datos originales se conservan.
- Pruebas sin nuevos correos ni modificaciones de tickets operativos.
- Fuente Apps Script completa reconciliada antes de desplegar.

## ADR propuesto ADMIN-SOL-001
Contexto: administración de solicitudes con dos administradores y datos oficiales en Sheets.
Decisión propuesta: conservar TICKETS como fuente, permisos específicos en DM03, autorización mediante sesión servidor y bitácora separada de recepción.
Consecuencias: requiere puente PHP↔Apps Script y despliegue coordinado; evita duplicar base y permite atribuir cambios. Código/fecha final del ADR se concilian con el catálogo institucional antes de incorporarlo.

## Próximo paso
Revisar este diseño y confirmar la fuente completa del Apps Script desplegado. Después elaborar el plan de implementación con archivos, secuencia, pruebas y despliegue.
