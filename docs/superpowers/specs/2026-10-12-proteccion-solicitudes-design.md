# Protección de creación y consulta de solicitudes internas

Fecha: 2026-10-12. Estado: diseño aprobado por el usuario el 2026-10-12; plan de implementación preparado para revisión. Código de esta migración todavía no implementado ni publicado.

## Propósito y alcance

Conservar el formulario, sus adjuntos y Mis solicitudes, haciendo que la identidad provenga de la sesión institucional del servidor. Cada colaborador activo crea para sí y consulta sólo sus registros; Dany y Ezequiel conservan su permiso administrativo independiente. TICKETS es la fuente oficial y DM03 define identidad, área, actividad y permisos.

Corregir también la generación de folios para impedir reutilización o sobrescritura al superar 300 filas o existir huecos. No desarrollar ejecución, cierre, SLA ni nuevas notificaciones en esta entrega.

## Hallazgos y enfoque

El alta y la lectura actuales acceden directamente a Apps Script. El puente PHP ya protege administración, pero sus límites de 50 KB no admiten los cinco adjuntos de 10 MiB del formulario. La migración cambia contratos entre frontend, PHP y Apps Script; debe desplegarse coordinadamente.

Se recomienda ampliar el puente existente con operaciones propias del colaborador y transferir cada adjunto en una petición individual. Una única petición base64 con todos los archivos obliga a aumentar memoria y tamaño de mensajes en todos los componentes; no es el enfoque elegido. Mantener el correo libre o una confirmación opaca no satisface la protección.

## Identidad, autorización y lectura

- PHP obtiene actor desde la sesión HttpOnly. Ignora correo, nombre, área o rol enviados por navegador como prueba de identidad.
- Cada operación revalida un colaborador único y activo en DM03; ausencia o duplicidad deniega. No se exige el permiso Administrador para crear o ver solicitudes propias.
- Apps Script verifica firma, vigencia y nonce antes de acceder a la fuente y vuelve a validar el actor institucional. Las operaciones administrativas mantienen sus comprobaciones actuales.
- Añadir lectura `mine` y contexto del colaborador a tickets-api.php, conservando context/list/detail/catalogs/assign administrativos.
- `mine` filtra en servidor por CORREO SOLICITANTE del actor firmado y devuelve los datos que consume Mis solicitudes. Una solicitud de otro correo no modifica ese filtro.
- Los POST requieren origen del Portal y CSRF ligado a sesión. La sesión vencida produce 401; una revocación produce denegación y no un resultado vacío que simule ausencia de tickets.

## Creación y adjuntos

El transporte conserva un máximo de cinco archivos, diez MiB por archivo y los tipos permitidos en el formulario. PHP debe comprobar límites de upload_max_filesize, post_max_size y memoria del hosting antes de habilitar el flujo.

1. El navegador genera un operationId estable y entrega datos de solicitud y descriptores de archivos. PHP deriva la identidad y firma una operación de inicio con metadatos, sin incluir todos los archivos.
2. Apps Script valida metadatos y registra una intención de creación recuperable. Se amplía la bitácora existente con un campo ACCIÓN para distinguir CREAR de ASIGNAR; los eventos históricos sin ese campo se interpretan como ASIGNAR. No se crea otra base de tickets ni se reescriben eventos antiguos.
3. Cada archivo se transmite individualmente a PHP, que valida tamaño y contenido y lo envía firmado a Apps Script. El límite mayor se aplica exclusivamente a esta operación autenticada, conservando el límite reducido de administración. Nombre, índice, operación y digest identifican el archivo; el servidor comprueba el digest de los bytes recibidos. Un reintento devuelve el archivo ya registrado, sin duplicarlo.
4. Los archivos se preparan en la carpeta oficial de adjuntos, vinculados a la operación y actor. Una operación ajena no puede utilizarlos. Se conservan los permisos de Drive actuales en esta migración; revisar enlaces compartidos requiere una decisión independiente.
5. Finalizar comprueba que llegaron todos los archivos esperados. Sólo entonces registra la fila oficial, incorpora enlaces y confirma la operación mediante lectura de retorno. Una intención incompleta no aparece como NUEVO en el dashboard.
6. Un reintento con el mismo actor, operationId y contenido recupera el mismo resultado. Contenido distinto con el mismo operationId se rechaza. El cliente muestra éxito exclusivamente después de la confirmación del registro y los adjuntos.

El journal de creación guarda metadatos y referencias, nunca base64 ni credenciales. Su payload se separa del formato de asignación y la recuperación administrativa excluye intenciones de creación. La implementación debe probar interrupciones en subida, escritura de fila y confirmación para que ninguna fila se duplique.

## Folios y filas

- Obtener y comprobar el bloqueo del script antes de calcular folio o escribir. Si no se obtiene, devolver BUSY y no escribir.
- Leer la columna de folios de todo el rango utilizado. El siguiente número es superior al máximo numérico de los folios existentes, manteniendo su formato y el año local del servidor. No renumerar ni reutilizar históricos o huecos.
- Elegir una fila libre comprobada que no sobrescriba datos existentes. Conservar fórmulas derivadas y filas de plantilla; no deducir la fila del número de tickets.
- Si se detecta un folio duplicado o una estructura ambigua, denegar la creación e identificar el problema para revisión, sin modificar registros antiguos.
- Asociar la escritura con la intención de creación antes de marcar la operación confirmada. La recuperación usa la identidad de operación y la lectura de la fuente.

## Despliegue y compatibilidad

Preparar backend, PHP y ambos frontends en una rama aislada. Respaldar el Apps Script productivo y verificar el deploymentId vigente. Validar sobre una copia de prueba antes del cambio real.

La retirada del GET y POST públicos sólo ocurre después de comprobar que todos los consumidores del flujo histórico fueron migrados. Una ventana temporal de compatibilidad, si es necesaria para la publicación coordinada, debe estar controlada por configuración explícita y tener una comprobación de retirada. No declarar el flujo protegido mientras esa entrada permanezca habilitada.

La integración en main se realiza cuando el backend real acepte y confirme las nuevas operaciones. Un commit del bundle no despliega Apps Script. El rollback es coordinado; conserva tickets, archivos y journal, y no vuelve a activar accesos públicos de forma silenciosa.

## Verificación de aceptación

- Sin sesión o con cuenta inactiva/duplicada no se leen ni crean tickets.
- Cambiar correo o rol en el navegador no permite suplantar identidad ni leer solicitudes ajenas.
- Firma inválida, expirada o repetida se rechaza sin escritura.
- Creación sin archivos y con cinco archivos del tamaño máximo; límites y tipos inválidos se rechazan sin éxito falso.
- Interrupciones y reintentos conservan un único ticket y un único archivo por índice.
- Más de 300 filas, huecos y numeración no consecutiva no producen sobrescrituras.
- Administración, asignación, bitácora y Mis solicitudes siguen reflejando la misma fuente.
- Prueba controlada con sesión real conforme al issue #6; no inferir aprobación de una escritura operativa.

## Resultado de esta revisión

El alcance funcional de protección fue autorizado por el usuario. Esta especificación concreta el contrato, la conservación de adjuntos y el despliegue; fue aprobada por el usuario. El plan técnico está en docs/superpowers/plans/2026-10-12-proteccion-solicitudes.md y requiere su revisión antes de implementar. Los issues #7 y #8 siguen abiertos hasta implementación y verificación real.
