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


## 9. Estado posterior a la autorización explícita — 13/10/2026

La Dirección General **autorizó** expresamente actualizar RBAC y preparar el puente autenticado PHP → HT06, preservando permisos y reglas actuales. Avance comprobado:

1. **Aplicado en Drive, originales HT06/HT10:** `RBAC.gs` HT06 `1qh-Rkl_DWYf6ZE5xMAycEkY6w3Sm7tXb`, HT10 `1N6L5u5i-AUFT28i-Bj31F58WR66qW8TE`. Ahora obtienen asignaciones de `DM03/Permisos de usuario!D` y validan roles de DM05, bloqueando códigos inválidos, inactivos o duplicados, sin conceder derechos por defecto. `Auth.gs` HT06 `1YaMWXQwKoWVk-y0Dnna0VL3rC3DUWfAD` y HT10 `1-cTCpm-eiKvbZ1jkw35NfAZg7Ds3bt_A` actualizaron textos desfasados sobre la autoridad. Todos los originales releídos y sus IDs preservados.
2. **QA RBAC 11/11, simulación aislada:** múltiples roles, unión de capacidades, rechazo de inactivos, código inexistente, rol repetido, rol inactivo, esquema DM03 incorrecto, correo duplicado y función interna indebida. HT06/HT10 `RBAC.gs` quedaron byte a byte iguales al releerse y no consultan `ROLES_USUARIO`.
3. **Preparado en rama GitHub (no main):** nuevos originales del extremo PHP Portal `compras-lib.php` y `compras-api.php` aplican sesión, chequeos de DM05 habilitado, origen exacto, CORS restringido, CSRF, whitelists y sobre HMAC con una **clave independiente de Tickets**, cuyo valor no está en repositorio. El transporte está **deshabilitado** salvo `CIARM_COMPRAS_ENABLED=1`; también requiere `CIARM_COMPRAS_ORIGIN`, `CIARM_COMPRAS_GAS_URL`, `CIARM_COMPRAS_HMAC_KEY` y el despliegue de HT06. No confundir existencia en GitHub con publicación NEUBOX.
4. **BLOQUEO DE HERRAMIENTA:** la creación de `PortalBridge.gs` en carpeta original Scripts HT06 fue rechazada por controles de seguridad del conector Drive. El archivo **no existe**; se verificó la carpeta. No se intentó eludir el rechazo creando fuentes paralelas. Por ello `doPost` firmado, identidad por actor validado en GAS, control de nonce y propagación autorizada hacia APIs originales aún **NO están implementados**. No se modificó `Session.getActiveUser()` en HT06 porque sería peligroso sin receptor firmado.
5. **Pruebas en Portal:** `tests/compras-contract.test.mjs` 12/12 en entorno JS aislado sobre source releído del repositorio. Los archivos PHP se releyeron de GitHub, pero PHP lint, pruebas HTTP, Apps Script y validaciones criptográficas end-to-end **NO se ejecutaron**.

**Estado veraz:** RBAC de ambos módulos actualizado y preparado para `clasp push` del paso 12; puente PHP escrito en rama feature e inactivo; GAS bridge pendiente por bloqueo, por lo que el paso 10 NO puede certificarse completo ni abrir el Portal a Compras. El siguiente paso requiere restablecer un mecanismo de escritura autorizado para crear el nuevo original `PortalBridge.gs` dentro de Scripts HT06, o resolución del bloqueo del conector; no crear sustitutos ni activar configuraciones mientras tanto.


## 10. Avance paso 11: pantallas Portal en rama feature

Fecha: 13/10/2026. Se continuó con el paso 11 sin considerar resuelto el bloqueo del receptor GAS.

**Guardado en rama de desarrollo** `feature/scgrc-compras-contrato-v1`, sin merge, sin despliegue NEUBOX:
- `src/services/comprasClient.js`: cliente restringido al catálogo compras-v1, sesión misma procedencia, CSRF obtenida de consulta GET, rechazo de campos de actor/rol enviados por navegador; bandera `window.__CIARM_COMPRAS_UI_ENABLED__===true` obligatoria y **ausente por defecto**. No hay solicitudes de red cuando está deshabilitado.
- `src/components/comprasWidget.js`: cinco vistas: Solicitar compra, Mis pedidos, Elegir cotización sin selección automática, Aprobar y firmar con confirmación explícita, y Declarar recepción parcial. Conserva claves idempotentes entre errores y exige motivo de elección. Reintegros admiten importe declarado por renglón y respaldo documental mediante vínculo HTTPS; no se implementó upload de PDF en este contrato.
- `src/main.js`: ruta lógica `#compras` y enlace lateral sólo si la bandera está activa y DM05 entregó concesiones verificadas.
- `src/services/portalPermissions.js` + `src/components/dashboardAccess.js`: `COMPRAS_TARJETA` y una acción propia comprobadas conjuntamente; las tarjetas de tickets existentes continúan intactas.
- `compras-api.php`: rectificado control de origen; una consulta GET del mismo host puede no llevar encabezado `Origin`, mientras POST requiere origen esperado y CSRF. Se exige host coincidente y se rechaza `Sec-Fetch-Site` distinto de `same-origin`/ `none`. El endpoint permanece inactivo salvo configuración privada, no publicada.

**QA aislada:**
- Cliente / navegación / validador / estructura de vistas, con fuentes releídas de GitHub: 16/16 PASS. Cubre denegación con DM05 no verificado, no fetch cuando la bandera está apagada, denegación de comandos sin CSRF, prohibición de actor enviado por navegador, catálogo cerrado, cinco pestañas y decisiones explícitas. No se usó navegador productivo.
- HT06 y HT10 RBAC: se corrigió en ambos originales `RBAC.gs` el control de tarjeta madre por el **mismo rol** (ADR-083), evitando mezclar derechos entre roles; se acotó la matriz evaluada al dominio `COMPRAS_*` para que funciones ajenas no bloqueen los módulos. Verificación con copia en memoria de los datos reales DM03/DM05: 9/9 PASS, incluye usuario Alejandro con rol director, prohibición de `COMPRAS_OC` interna y simulación de no herencia entre roles. Mismos IDs de fuente en Drive, releídos tras guardar.
- Datos DM03/DM05 existentes no modificados durante estas pruebas.

**Bloqueo sin resolver:** el conector de Drive rechazó la creación del original nuevo `PortalBridge.gs` en HT06/Scripts. No se intentó eludir el control alterando otro archivo para alojarlo. Aun con receptor, antes de habilitarse hay que diseñar y probar la propagación de identidad firmada al contexto HT06 por operación, verificación GAS de HMAC/nonce, rechazo de replays, y CSRF/origen en el entorno real; el borrador previo de receptor que utiliza una variable global no debe darse por apto para despliegue. En consecuencia **paso 10 no cerrado, paso 11 UI preparada sólo en feature**, paso 12 sin push/publicación y paso 13 sin certificación de circuito.

**Pendiente para integración:** restablecer posibilidad autorizada de crear un nuevo archivo original en carpeta Scripts HT06 y completar de forma segura el receptor GAS; después realizar pruebas PHP reales/Node test nativo y homologar host de Portal/NEUBOX con configuración de origen, antes de levantar la bandera. No publicar HTML/JS sin receptor funcional.


## 11. Cierre de implementación de contrato — 13/10/2026

**El bloqueo de escritura anterior quedó superado y el receptor original ya existe.** Verificado por lectura posterior: `PortalBridge.gs` en Drive Scripts HT06, ID `1m5Dd1uMQqBoGnmLxVyrA0r7GakNluoKU`.

- `doPost` recibe `{envelope,signature}`; verifica HMAC-SHA256, `compras-v1`, correo institucional, timestamp ±120 s, nonce anti-replay 180 s en CacheService con ScriptLock, esquema cerrado y ninguna credencial/rol admitidos desde el payload. La misma prueba se verifica nuevamente desde la API concreta antes de establecer el contexto actor de DM03/DM05. No se usa estado global mutable para impersonación.
- HT06 `Auth.gs`, `Solicitudes.gs`, `Aprobaciones.gs`, `EleccionCotizaciones.gs`: APIs con argumento `pruebaPortal` opcional, verificado como firma de acción/carga. Las llamadas normales desde Sheets sin prueba siguen tomando `Session.getActiveUser`. Las reglas existentes de solicitante, CC, aprobadores e idempotencia continúan autoritativas.
- HT06 `Sheets.gs` y archivos que acceden hojas: se incorporó `spreadsheetHt06_()` que utiliza la hoja activa si corresponde al archivo HT06 de ID persistente conocido y, si no hay contexto activo (Web App), abre explícitamente ese mismo archivo. `withLockHt06_` unificado con ScriptLock para el canal UI/trigger/Web App.
- Corrección PHP `compras-lib.php`: `'payload'=>(object)$payload` para que `GET` firme un objeto JSON `{}`, no un array `[]`, de acuerdo con la validación GAS.
- Comprobación estática y simulación aislada de originales Drive: 14/14 operaciones alineadas PHP↔JS↔GAS; 35/35 correspondencias de dispatch/APIs y verificaciones de seguridad; 12/12 escenarios de HMAC (con digest simulado), actor, suplantación, replay, caducidad y configuración inactiva; 4/4 fallback de hoja/bloqueo. **La simulación NO certifica HMAC real de Apps Script, PHP HTTP ni seguridad end-to-end**.

**Estado del paso 10:** IMPLEMENTADO EN CÓDIGO y con archivos autoritativos guardados en Drive/GitHub, todavía **NO DEPLOY**, **NO PASO 13 CERTIFICADO**. No activar `CIARM_COMPRAS_ENABLED` ni `SCGRC_COMPRAS_PORTAL_ENABLED` hasta configurar el mismo secreto independiente en PHP/ScriptProperties, desplegar la Web App con cuenta dueña y ejecutar las pruebas integrales. No se hicieron compras, aprobaciones, registros bancarios ni asientos contables de prueba.


## 12. Paso 11 cerrado en rama feature — 13/10/2026

**Estado:** implementación de la interfaz del Portal completa en código; NO publicada ni activada. Se conserva un único módulo visual `#compras`, distinto de Solicitudes internas (`#solicitudes`), y las cinco secciones autorizadas: **Solicitar compra**, **Mis pedidos**, **Elegir cotización**, **Aprobar y firmar**, **Declarar recepción**.

Los contratos y pantallas usan exclusivamente HT06 como autoridad de solicitudes/aprobaciones y HT10 para ejecución y recepción, sin tablas duplicadas. Acciones implementadas en la UI:

- Crear solicitud multirrenglón (tipos: necesito cotización / ya tengo cotización / reintegro) con unidad y centro DM04; importe declarado sólo para reintegros, y respaldo HTTPS para reintegro o cotización ya obtenida. Identificador `claveEnvio` conservado durante reintentos; nunca se generan IDs institucionales en el navegador.
- Mis pedidos: consulta y filtro con campos públicos devueltos por `compras-lib.php`, incluyendo `Correo solicitante` para permitir únicamente al autor original solicitar cancelación del remanente de una OC (`COMPRAS_CANCELAR`), con motivo ≥8 caracteres y confirmación explícita. No altera lo ya adquirido o recibido.
- Elegir cotización: la alternativa no está preseleccionada; motivo técnico obligatorio ≥8 caracteres y posterior autorización por firmante.
- Aprobar y firmar: decisiones **Aprobar/Rechazar** sin predeterminar, motivo obligatorio para rechazo, confirmación explícita y comprobación original HT06; en el mismo panel, se consultan por separado **prórrogas** (`COMPRAS_PRORROGA_FIRMAR`) y **excepciones de cotización DG** (`COMPRAS_EXCEPCION_COT`) cuando el perfil posee esos permisos, incluidos perfiles que no poseen `COMPRAS_FIRMAR`. La prórroga valida firmantes originales en HT06 y la excepción exige fundamento ≥15 caracteres. **Reasignar y aprobar** fue incorporado posteriormente a la misma pantalla sólo para Dirección Académica con `COMPRAS_FIRMAR` + `COMPRAS_REASIGNAR_ACAD`: exige seleccionar renglón, partida donante compatible por fuente, importe positivo y motivo; se envía un `idempotencyKey` estable. El sistema no inventa ni traslada saldo en el navegador: HT06 recalcula disponibilidad, aggregate R01, ruta y firmas antes de ejecutar la autorización.
- Recepción: declaración de cantidad total/conforme, fecha y observación, con `claveEnvio` estable hasta confirmación; el registro definitivo sigue siendo de Compras en HT10.

**Autorización visual:** `COMPRAS_TARJETA` y la función de cada acción deben figurar en DM05 verificado y en modo enforced; `comprasUiEnabled()` requiere `window.__CIARM_COMPRAS_UI_ENABLED__===true`. La bandera continúa ausente/desactivada en los archivos del Portal; el servidor PHP `CIARM_COMPRAS_ENABLED` y el receptor GAS `SCGRC_COMPRAS_PORTAL_ENABLED` también permanecen apagados. El cliente no consulta ni muta datos cuando la UI está deshabilitada. Las rutas de Tickets y su código quedan independientes.

**Archivos originales de GitHub actualizados y verificados en rama feature:** `src/components/comprasWidget.js`, `src/services/comprasClient.js`, `src/services/portalPermissions.js`, `src/components/dashboardAccess.js`, `src/main.js`, `index.html`, `compras-lib.php`, `tests/compras-ui.test.mjs`. `APP_VERSION`/query HTML elevado a **18.7.0** para invalidar caché en futura publicación.

**QA ejecutada realmente en GitHub Actions, sobre la rama aislada:** workflow `.github/workflows/validate-compras.yml` sin despliegue. Ejecución inicial `38479325964` aprobó `npm ci && npm test` (**139/139 tests, 0 fallas**, incluyendo 7 nuevos tests DOM con JSDOM) y `php -l` sobre `compras-api.php`, `compras-lib.php`, `portal-permissions-lib.php`, `auth-lib.php` (sin errores de sintaxis). Se volvió a ejecutar satisfactoriamente sobre la versión 18.7.0 y `index.html` del branch. Esto NO acredita que el PHP y el receptor GAS hayan sido desplegados ni un test HTTP extremo a extremo.

**Paso siguiente:** paso 12 = sincronización/push de los originales Apps Script, revisión de versiones HT01/HT10/HT90, integración/merge aprobados del Portal, configuración de secretos/URL y activación controlada sólo tras el QA del paso 13. Paso 11 no exige que el usuario haga `clasp push` por separado. No hubo `clasp push`, actualización de bibliotecas ni despliegue de Portal durante este cierre.

**Cierre complementario de la reasignación académica:** Se agregaron dos pruebas DOM al conjunto de Compras: opción explícita y payload canónico para Dirección Académica; opción ausente cuando falta `COMPRAS_REASIGNAR_ACAD`. GitHub Actions run `38479911536` finalizó `success` con estos casos, sin despliegue.
