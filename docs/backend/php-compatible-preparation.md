# Preparación PHP compatible — 2026-10-12

Esta entrega publica únicamente el puente PHP preparado para el protocolo nuevo, conserva el frontend 18.3.3 y no actualiza Apps Script ni modifica datos o claves privadas.

Cambios: tickets-api.php conserva las acciones administrativas y añade rutas propias autenticadas; tickets-portal-lib.php verifica identidad activa de DM03 y prepara el transporte individual; auth-lib.php conserva timeout 25 segundos por defecto y permite un timeout opcional para subidas/finalización. Añade suite PHP y su ejecución CI.

Compatibilidad: la administración continúa firmando con el mismo secreto y su protocolo original. El formulario y Mis solicitudes publicados aún usan el backend vigente. selfContext y acciones nuevas sólo estarán disponibles al actualizar Apps Script; su fallo previo a esa actualización no acredita un problema de administración.

Validación previa: 53 pruebas Node del frontend/backend vigente, ambas suites PHP, lint de cuatro PHP y build sin cambios del bundle anterior. La migración completa y frontend 18.4.0 permanecen en PR #12, sin integrar.

Próximo paso: en el proyecto que publica el deploymentId AKfycbxy9ezQII2g5l4GIEviuQgquS2YJVzGQSJsqvOgYCBPh98Z2DDeL5sshjg2NnWUnDA, respaldar código/versiones y establecer TICKETS_ALLOW_LEGACY exactamente true antes de publicar el bundle nuevo. Mantener TICKETS_ADMIN_SECRET existente. Después comprobar selfContext con sesión real; se requiere aceptación real/staging antes de integrar frontend. No declarar protección efectiva hasta retirar el acceso histórico.
