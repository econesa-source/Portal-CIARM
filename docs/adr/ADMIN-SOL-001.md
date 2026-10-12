# ADMIN-SOL-001: administración de solicitudes internas

Fecha: 2026-10-07. Estado: implementación en rama; publicación pendiente. Código provisional pendiente de conciliación con catálogo institucional de ADR.

## Contexto

Daniel Lara y Ezequiel necesitan asignar solicitudes internas desde Portal CIARM. TICKETS es la fuente oficial; DM03 define permisos y los catálogos existentes definen los valores elegibles. El frontend actual usa sesión PHP institucional y la copia histórica de Apps Script no incluye autorización administrativa verificable.

## Decisión

Usar un endpoint PHP del mismo origen que deriva el actor de la sesión, revalida DM03 y firma un envelope para Apps Script. Exigir en ambos servidores cuenta activa y Sistema de tickets=Administrador para d.lara y e.conesa. Conservar TICKETS y escribir sólo campos de asignación por encabezados. Incorporar BITACORA TICKETS con preparación, confirmación y recuperación por operationId. Comparar instantáneas canónicas de los valores y fuentes de fórmulas para preservar integridad ante recálculo.

## Consecuencias

La publicación requiere Apps Script, clave privada, configuración de permisos y PHP coordinados. Sheets no garantiza atomicidad entre celdas y journal; la recuperación detecta divergencias y bloquea nuevas operaciones si hay una asignación pendiente. No se concede a Dany el rol global de administrador del Portal. Las entradas históricas del backend permanecen fuera de la protección del módulo nuevo y requieren una revisión posterior explícita.
