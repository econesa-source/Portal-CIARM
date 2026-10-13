# Integración Portal ↔ DM05 (en desarrollo)

Fecha: 2026-10-13. Rama: feature/dm05-portal-catalogo. **No desplegado**.

## Inventario comprobado

El dashboard productivo está implementado en `src/components/dashboardWidget.js`: panel Asistente CIARM, Solicitudes internas (Crear, Mis solicitudes y Administrar condicionado por el backend de tickets), Libros y Papers, Normas y herramientas, Comunicados, Administración (SCGRC) e IB. Los botones de estas cinco últimas tarjetas son placeholders deshabilitados. El menú lateral queda fuera del alcance por decisión de Dirección.

## Códigos funcionales

Consultar `src/services/portalPermissions.js` para el contrato completo; DM05 debe incorporar los faltantes antes de activar el filtrado. No confundir `SCGRC_TARJETA` con `ADMIN_TARJETA`. Compras tiene sus propios códigos internos.

## Seguridad y rendimiento

La UI muestra tarjetas exclusivamente cuando está autorizado su código TARJETA; dentro de una tarjeta cada botón exige además su código de FUNCIÓN. Ocultar una acción no sustituye la autorización del backend. Se hará una consulta de permisos por sesión, con caché compartida del catálogo/matriz, invalidación ante revocaciones y sin consultas por componente. No almacenar una copia paralela persistente del catálogo.

## Bloqueo de activación

La sesión PHP (`auth-session.php`, `auth-lib.php`) devuelve nombre/correo/área/puesto/sección, pero no los roles efectivos de DM05. Está prohibido inferir roles por nombres de puesto o área. Debe existir un contrato autoritativo de asignación de roles antes de aplicar filtrado real. El código de visibilidad no deberá activarse con permisos ausentes o fabricados.

## Plan de validación

1. Conciliar todos los códigos con CAT_FUNCIONES y MATRIZ_ACCESOS.
2. Definir y verificar el origen autoritativo de las asignaciones persona↔rol.
3. Implementar resolución backend y caché con límites de seguridad.
4. Aplicar filtrado del dashboard y protecciones de rutas.
5. Probar cuentas con roles distintos, revocaciones, errores de lectura, tiempos de carga y operaciones directas.
6. Activar exclusivamente después de aceptación técnica y funcional.
