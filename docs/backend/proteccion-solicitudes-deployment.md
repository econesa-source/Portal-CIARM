# Protección de solicitudes — despliegue coordinado 18.4.0

Estado: código en rama pendiente; producción no migrada. No integrar el frontend antes de comprobar el backend mediante sesión real.

## Preparación y prueba independiente

Respaldar Code.gs, versión vigente, PHP y datos. Crear una copia de Apps Script, libro y carpeta Drive, y hosting de staging; configurar exclusivamente la copia. No cambiar CONFIG de producción para probar. Conservar secretos fuera del repositorio.

Probar cuenta normal, ambos administradores, baja y revocación entre operaciones; cero y cinco adjuntos de diez MiB, PDF/DOC/DOCX e imágenes reales; respuesta perdida y reintento; más de 300 filas, huecos, fórmulas y asignación posterior. Inspeccionar fila, bitácora y Drive, además de respuestas. Validar memoria y escritorio/móvil/teclado. Las pruebas locales no acreditan aceptación real ni inspección visual.

## Cambio compatible

1. En el proyecto que publica la URL inferior, establecer Script Property `TICKETS_ALLOW_LEGACY` exactamente `true` **antes** de actualizar la versión. Esto mantiene temporalmente el formulario publicado. Conservar `TICKETS_ADMIN_SECRET` existente.
2. Reemplazar Code.gs con `apps-script/tickets-backend.gs`. Guardar. Administrar implementaciones → editar la implementación vigente → nueva versión → implementar, conservando su URL.
3. Publicar PHP compatible: `auth-lib.php`, `tickets-lib.php`, `tickets-api.php` y `tickets-portal-lib.php`. Permisos 0644; las claves privadas mantienen 0600 fuera del directorio público. Requiere fileinfo, ZipArchive, upload_max_filesize ≥10M, post_max_size ≥16M, memory_limit ≥128M o ilimitado.
4. Con sesión institucional, consultar `/tickets-api.php?action=selfContext`: debe responder ok=true, canCreate=true y canUpload=true para habilitar adjuntos. No copiar ni compartir csrfToken. Esta respuesta prueba capacidad del protocolo firmado, pero no reemplaza la matriz de aceptación.
5. Probar creación, recuperación y listado propios mediante staging antes de integrar el frontend 18.4.0. No publicar si capability o pruebas fallan.
6. Tras publicar frontend y revisar todos los consumidores históricos, eliminar `TICKETS_ALLOW_LEGACY` o dejar `false`. Comprobar GET público y POST sin firma: FORBIDDEN y ninguna lectura/escritura. No declarar protección efectiva ni cerrar issue #7 mientras siga habilitado.

URL vigente a verificar:
https://script.google.com/macros/s/AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA/exec

## Recuperación

Conservar IDs de operación, reservas y bitácora. Reintentar la misma operación; no borrar evidencia ni volver a crear ante timeout. Restaurar versiones compatibles si el cambio falla; no reactivar acceso público automáticamente. Documentar cada consumidor que todavía requiera compatibilidad.

Issues #6, #7 y #8 siguen abiertos hasta aportar evidencia real correspondiente. El dashboard y la asignación administrativos conservan su interfaz.

Las verificaciones públicas del workflow sólo terminarán correctamente cuando se haya retirado la compatibilidad histórica. La primera sincronización de frontend puede ocurrir antes de esa retirada; después del corte, volver a ejecutar la validación y acreditar FORBIDDEN. No confundir archivos sincronizados con aceptación completa.

La capacidad de la bitácora se comprueba antes de aceptar una operación, incluyendo reserva y referencias estimadas de adjuntos. PAYLOAD_SIZE exige reducir metadatos mediante un nuevo borrador explícito; nunca se trunca texto ni se confirma una operación fallida.
