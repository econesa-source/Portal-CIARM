# SCGRC — Contrato Portal CIARM ↔ Compras V1

**Paso 10/14 · Fecha:** 13/10/2026. **Estado:** especificación técnica y validación de formato preparada, **SIN TRANSPORTE NI AUTORIZACIÓN REMOTA ACTIVADOS**. La interfaz de usuario es el paso 11 y el despliegue/publicación el 12. No hay endpoint público operativo por este documento.

## 1. Alcance y autoridades

Este contrato implementa la intención **ya aprobada** de ADR-046/047/051/052/057/082/083/084; no cambia esas políticas.

- **Portal CIARM:** autenticación de usuario, presentación y solicitudes de operaciones; no es libro transaccional ni fuente de estados, permisos o presupuesto.
- **DM03:** identidad y estado de colaborador. **ADR-084 vigente:** pestaña `Permisos de usuario`, columna D `Roles DM05`, con códigos separados por comas. `ROLES_USUARIO` subsiste sólo como referencia transitoria, no como fuente de nuevas autorizaciones.
- **DM05:** catálogo de roles/funciones y matriz de accesos. Sin herencia entre roles; unión de funciones efectivas por rol, subordinadas a la tarjeta madre del **mismo rol** (rectificación final ADR-083).
- **HT06:** dueño de `SOL`, renglones de solicitud, elección de alternativa, presupuesto, rutas de aprobación, firmas, auditoría, declaración del solicitante y seguimiento visible.
- **HT10:** dueño de cotizaciones/ofertas/alternativas, una OC institucional, múltiples compras y recepciones, incidencias y datos operativos de Compras. Sus APIs operativas no se exponen al navegador del solicitante.
- **HT01 → SCGRC_LIB_HT90 → HT90:** registro contable exclusivo para devengo/reclasificación; ni Portal ni HT06 escriben el Diario directamente.
- **R01:** fuente de control presupuestario; el Portal no reproduce decisiones de presupuesto.

Los lectores de HT06 filtran por identidad y alcance; la consulta `misPedidos` no significa acceso global. Toda mutación conserva rastro y la validación del servidor vigente.

## 2. Frontera de red prevista — requiere autorización de seguridad para implementarse

```
Navegador autenticado en Portal CIARM
    → [sesión PHP, origen, CSRF, colaborador activo, DM05]
    → [endpoint lógico PHP /compras-api.php — PROPUESTO, NO EXISTE]
    → [mensaje de servidor firmado HMAC, expirable y con nonce]
    → [dispatcher GAS HT06 — PROPUESTO, NO EXISTE]
    → [revalidación DM03 / DM05 por actor firmado; alcance CC/firmante y reglas HT06]
    → [funciones de dominio HT06 existentes]
    → [sincronización ya prevista con HT10]
```

**Prohibido:** hacer `doPost` que confíe en `actor` enviado por el navegador, aceptar identidad desde `Session.getActiveUser()` cuando la aplicación GAS se ejecuta como propietario, usar `Session.getEffectiveUser()` como identidad del solicitante, publicar HT06/HT10 como ejecución anónima sin verificación de firma, conceder acceso directo a Sheets/HT10, o reutilizar credenciales de tickets por comodidad.

El diseño propuesto aprovecha **el patrón** ya existente de tickets PHP → Apps Script (firma HMAC, `issuedAt`, `nonce`, protecciones de CSRF/origen/sesión), pero sin suponer que el secreto, deployment o autorizaciones de tickets sirvan para compras. Los secretos deben permanecer privados y la firma, expiración, replay y revocación deben validarse **en GAS antes** de ejecutar cualquier función. La identidad que resuelve permisos en HT06 deberá provenir exclusivamente del sobre firmado y comprobado, por un contexto de servidor separado de los diálogos de Sheets.

**Bloqueos reales a corregir antes de activar el canal:** el RBAC actual de HT06/HT10 sigue leyendo `ROLES_USUARIO`, contrario a ADR-084; `contextoUsuarioHt06_()` aún depende de `Session.getActiveUser().getEmail()`. No cambiar fuentes de autorización ni crear endpoints sin aprobación expresa de la modificación de seguridad. No adoptar una verificación de DM05 sólo del lado PHP: la acción definitiva requiere permiso y restricciones verificados en HT06.

## 3. Transporte lógico versión `compras-v1`

La biblioteca pura `src/services/comprasContract.js` publica `COMPRAS_CONTRACT_VERSION`, `COMPRAS_OPERATIONS` y `validateComprasRequest`. Este módulo comprueba **formato** del cliente; no autentica, no autoriza, no persiste, no transmite datos y no reemplaza validaciones de HT06.

### Consultas (GET; payload vacío)

| Acción lógica | Función HT06 vigente | Visibilidad |
| --- | --- | --- |
| `contextoSolicitud` | `apiDatosNuevaSolicitud()` | Usuario con `COMPRAS_CREAR` |
| `misPedidos` | `apiMisPedidos()` | Alcance `COMPRAS_MIS/AREA/TODOS`, filtro servidor |
| `alternativas` | `apiCotizacionesParaElegirHt06()` | Solicitante original con `COMPRAS_ELEGIR` |
| `pendientesAprobacion` | `apiPendientesAprobacion()` | Firmante habilitado, ruta y centro verificados |
| `recepcionesAsignadas` | `apiRecepcionesParaMiHt06()` | Solicitante o destinatario, `COMPRAS_RECIBIR_ASIGNADA` |
| `prorrogasPendientes` | `apiProrrogasPendientesFirmarHt06()` | Firmantes originales |
| `excepcionesPendientes` | `apiPendientesExcepcionCotizacionesHt06()` | Sólo DG |

### Comandos (POST con payload; sujeto a permisos y validación de negocio HT06)

| Acción lógica | Función HT06 vigente | Datos de entrada canónicos |
| --- | --- | --- |
| `crearSolicitud` | `apiCrearSolicitud(datos)` | `tipoSolicitud`, `centroCostos`, `fechaGeneral`, `responsableRecepcion`, `areaContexto`, `renglones[]`, `adjuntosVinculos`, `claveEnvio` |
| `elegirAlternativa` | `apiElegirAlternativaHt06(datos)` | `idSolicitud`, `idAlternativa`, `motivo` |
| `decidirSolicitud` | `apiDecidirSolicitud(idSolicitud,decision,motivo,reasignacion)` | `idSolicitud`, `decision` = Aprobar/Rechazar/Reasignar y aprobar, `motivo`, `reasignacion` si corresponde |
| `declararRecepcion` | `apiDeclararRecepcionHt06(datos)` | `idSolicitud`, `idRenglon`, `cantidadRecibida`, `cantidadConforme`, `fechaRecepcion`, `observacion`, `claveEnvio` |
| `cancelarRemanente` | `apiCancelarRemanenteOcHt06(datos)` | `idSolicitud`, `motivo` |
| `autorizarExcepcionCotizacion` | `apiAutorizarExcepcionCotizacionHt06(datos)` | `idSolicitud`, `motivo` |
| `firmarProrroga` | `apiFirmarProrrogaOcHt06(datos)` | `idOC`, `clave` |

**No hay acciones de Portal** `ejecutarCompra`, `emitirOC`, `registrarPago`, `registrarAsiento` ni manipulación de HT10. La emisión de OC continúa consecuencia exclusiva de las aprobaciones y sincronización HT06→HT10.

Los datos de entrada del navegador **nunca incluyen** correo del actor, roles, funciones, permisos, tokens, claves privadas, identidades de firmante, `IdTX`, `ID Asiento` ni importes/cuentas de contabilización. El servidor obtiene identidad de sesión validada y reconsulta las autoridades pertinentes.

`crearSolicitud` acepta de 1 a 20 renglones; en V1 los adjuntos no se transmiten como binarios desde esta API: se admiten **vínculos HTTPS** ya respaldados por el circuito institucional. Para operaciones `Compra - ya tengo cotización` o `Reintegro de gasto`, HT06 seguirá exigiendo el respaldo documental vigente. Subida de PDF desde Portal requerirá un contrato de carga separado: no inferir que el formulario Apps Script puede recibir automáticamente el `File` del navegador del Portal. Ninguna URI privada/credencial se devuelve al cliente.

## 4. Identidad, matriz y segregación

1. Iniciar sesión por OAuth/Workspace y establecer sesión de Portal; comprobar colaborador único y activo en DM03.
2. Leer roles por `Permisos de usuario!D` (ADR-084) y funciones de DM05. **No** usar `ROLES_USUARIO` como autoridad, ni roles heredados, ni columna histórica E como permiso financiero.
3. Las tarjetas/acciones pueden ocultarse en el Portal por comodidad, pero el servidor **debe** rechazar cada consulta o mutación no permitida. El permiso de tarjeta madre es condición necesaria, nunca autorización financiera suficiente.
4. HT06 revalida en cada operación sensible: actor autenticado, función vigente, centro de costo, dueño de SOL, firmante original o designado, rutas DG/Académica/Director, exclusión de autoaprobación salvo DG, CAPEX y R01. El PHP jamás suministra un contexto de rol `confiable` que HT06 acepte sin validar.
5. Una identidad del Portal no puede cambiar solicitante, elegir por otro, firmar por otro, comprar o ejecutar pagos. Reintegros siguen sin OC retroactiva.
6. Eventos con consecuencias económicas mantienen actor/rol/fecha/evidencia/idempotencia en historial HT06/HT10, bajo los contratos originales; jamás fabricar un registro paralelo en PHP.

## 5. Respuesta API que deberá implementar el bridge (aún no existe)

**Éxito:** `{"ok":true,"version":"compras-v1","requestId":"...","data":{...}}`. `data` es el resultado **serializado y filtrado del servidor**, no la fila completa de Sheets. El servidor asigna `requestId` sólo como identificador técnico de solicitud; no es SOL, OC ni IdTX.

**Error:** `{"ok":false,"version":"compras-v1","requestId":"...","code":"..."}`, sin datos internos de roles/cuentas, ni mensajes de error GAS, tokens o respuestas de Google. Catálogo a normalizar en el dispatcher: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `INVALID_REQUEST` (422), `CONFLICT` o `PENDING_OPERATION` (409), `SERVICE_UNAVAILABLE` (503) y `UPSTREAM_ERROR` (502). Estos códigos son **propuesta de protocolo**, no evidencia de endpoints implementados.

**Idempotencia:** el navegador genera y conserva `claveEnvio` en el ciclo de reintento de creación/recepción; el backend mantiene sus claves para elección, firma, prórroga y auditoría. Timeout/reintento nunca debe generar una SOL, OC, factura o recepción adicional. Con error parcial no se puede regenerar la clave ni repetir con datos modificados; consultar/reconciliar primero. `requestId` de red no reemplaza idempotencia económica.

**Límites y formatos:** máximo 32 KiB de JSON de operación en la validación local V1, fechas calendario `YYYY-MM-DD`, IDs estables existentes `SOL-...`, `REN-...`, `OC-...`, importes en MXN según contrato vigente, sin archivos base64. No introducir cambio de moneda ni política fiscal en Portal.

## 6. Compromisos de compatibilidad

- La implementación debe envolver, no copiar, la lógica `api*Ht06` y mantener sincronización/locks e idempotencia.
- El Portal lee el seguimiento visible desde HT06, alimentado por HT10; **no consulta directamente HT10** para simular estados.
- No modificar modelos de datos, IDs, políticas presupuestarias, permisos, `.clasp.json` ni versiones de biblioteca en este paso.
- No dar por realizada publicación con un commit GitHub. Los archivos originales de GAS viven en Drive, se sincronizan mediante `clasp` por el usuario en el paso 12.
- La interfaz del Portal (paso 11) debe depender sólo de operaciones lógicas anteriores; nunca escribir valores directamente en Sheets.
- El puente PHP de tickets existente es **referencia técnica, no una autorización reutilizable** para Compras.

## 7. Pruebas de aceptación antes de permitir el despliegue

1. Roles múltiples de la misma persona; función denegada por ausencia de su tarjeta madre, sin herencia.
2. Usuario sin permiso, desactivado o inexistente → denegación segura, sin fuga de datos.
3. Suplantación por `actor`, `email` o `roles` en body/query/headers → rechazo.
4. Falta/falsificación de firma, alteración de body, expiración, reenvío de nonce → rechazo **en GAS**.
5. CSRF/origen/sesión inválidos → rechazo **en PHP**, sin reenviar a GAS.
6. Solicitante sólo ve sus pedidos, salvo alcance `COMPRAS_AREA/TODOS` vigente.
7. Una SOL con N renglones, alternativa multicomponente y PDF respaldado; no escoger oferta por defecto.
8. Firma restringida al aprobador de esa SOL y CC, rutas CAPEX/DG, no autoaprobación.
9. Compra y recepción parciales; múltiples proveedores; seguimiento sin duplicación.
10. Timeout antes/después de escritura, reintentos con misma clave, conflicto de payload, transacción parcialmente procesada.
11. Modo consulta sin acceso directo del usuario a GAS/Sheets; CORS no reemplaza autorización.
12. Prueba de identidad y permisos de Portal contra GAS y regresión de Tickets sin afectar su backend.

## 8. Entrega y pendientes por paso

**Paso 10 — realizado:** inventario de APIs y fronteras, contrato lógico versionado, validador de formato y pruebas puras en rama GitHub `feature/scgrc-compras-contrato-v1`. Sin tocar Portal `main`, producción ni archivos Apps Script.

**Por resolver con autorización expresa antes de abrir el canal:** mecanismo de autenticación de servicios e identidad firmada, reemplazo del RBAC legado de HT06/HT10 por ADR-084, configuración privada del secreto del puente y publicación del dispatcher GAS. Es una modificación de seguridad e integración con identidades; documentarla no equivale a aprobarla.

**Paso 11:** interfaz funcional Portal basada en el contrato, sin redirección a Sheets.

**Paso 12:** publicación de bibliotecas/deployments, configuración segura y `clasp push` en los originales.

**Paso 13:** pruebas reales y negativas del circuito completo. **Paso 14:** piloto y operación.
