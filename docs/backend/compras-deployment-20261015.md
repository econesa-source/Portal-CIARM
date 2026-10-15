# Compras — integración 15/10/2026

Se aplica el contrato compras-v1 existente sobre main 1575caea4999c30b1086c16ef3ea330d7ec8b8d6. Se conservan Tickets, IB, diagnósticos, autenticación y las bibliotecas compartidas de main. HT06/HT10 siguen siendo las autoridades transaccionales.

## Configuración privada

NEUBOX utiliza el directorio privado ya existente `/home/ciarmedu/portal-ciarm-private`, fuera de la raíz pública. `compras.json` admite `enabled`, `writes_enabled`, `gas_url`, `hmac_key`, `origin`; las variables CIARM_COMPRAS_* prevalecen si existen. Valores de habilitación son cadenas `"1"` o `"0"`. No almacenar este archivo privado en Git ni en documentación. La clave debe ser la misma clave independiente de Compras de HT06, nunca la de Tickets. La interfaz recibe únicamente dos booleanos de disponibilidad y sigue exigiendo DM05.

La primera verificación usa enabled=1, writes_enabled=0 y el origen exacto https://portal2.ciarm.edu.mx. Sin configuración completa Compras permanece cerrada. Todas las operaciones POST permanecen bloqueadas en PHP y en el cliente mientras writes_enabled no sea 1. Las lecturas conservan sesión, origen, permisos, firma HMAC, nonce y autorización HT06.

## Evidencia y estado

- Código original HT06 PortalBridge.gs revisado en Drive.
- Configuración activa HT06 inspeccionada: clave independiente presente (longitud válida), bandera SCGRC_COMPRAS_PORTAL_ENABLED ausente. Causa inicial comprobada de SERVICE_UNAVAILABLE; no se cambió la clave ni la bandera durante esa inspección.
- Base main: 137/137 pruebas Node aprobadas.
- Integración: 161/161 pruebas Node aprobadas; incluye tarjeta/ruta, conservación de Tickets/IB y bloqueo de escrituras.
- PHP debe validarse en CI antes de fusionar: sintaxis, configuración y solicitudes HTTP negativas reales con configuración ficticia aislada. No son integración con GAS.
- Producción, consulta autenticada positiva y circuito de compra: pendientes al momento de preparar este commit. No se crearon solicitudes, OCs, firmas, obligaciones, asientos ni pagos.

## Prueba financiera

No ejecutar Compra/Recepción en las hojas institucionales con datos ficticios. Primero confirmar el entorno seguro y contratos HT01/SCGRC_LIB_HT90. Una marca PRUEBA por sí sola no impide devengo ni reserva presupuestaria. La firma corresponde al usuario institucional autorizado.
