# LiftEngine v6.0.0 — Consolidation

## Enfoque

v6.0.0 consolida la base construida durante v5. La prioridad no es añadir una gran cantidad de funciones aisladas, sino unificar cómo LiftEngine interpreta objetivos, métricas y próximas decisiones.

## Dashboard v6

El Resumen ahora prioriza el estado actual:

- adherencia de las últimas 8 semanas;
- sesiones de la semana frente a la meta;
- PR recientes;
- ejercicios en mejora / para revisar;
- objetivo corporal;
- una próxima decisión de Training Intelligence con acceso directo a Progreso.

Los contadores históricos acumulados dejan de ser la información principal del inicio.

## Objetivos

Ajustes incorpora una sección de Objetivos:

- meta semanal de sesiones;
- modo corporal: neutral, recomposición, pérdida de grasa, ganancia de masa o mantenimiento;
- peso objetivo opcional;
- cintura objetivo opcional.

Si no existe un objetivo explícito, LiftEngine trata los cambios de peso y cintura como neutrales.

Cuando existe un objetivo numérico, la dirección del cambio se evalúa según si acerca o aleja al usuario de esa referencia.

## Settings unificados

Nuevo módulo `js/settings.js`.

La configuración usa un único contrato para IndexedDB, Firestore, nube legacy, backups JSON, restauración y objetivos. Los backups v5 sin `bodyGoal` siguen siendo compatibles y se interpretan de forma neutral.

## Metrics Engine

Nuevo módulo `js/metrics.js`.

Centraliza definiciones para fechas de entrenamiento, snapshots semanales, cobertura de periodos, adherencia, tendencias por ejercicio, frecuencia/series por músculo y deltas corporales.

Dashboard y Analytics consumen estas métricas compartidas.

## Arquitectura

- `refreshAll()` se mueve desde `routines.js` a `bootstrap.js`.
- Se elimina un render duplicado de Training Intelligence durante refresh global.
- Se actualiza `ARCHITECTURE.md`.
- Se limpia un artefacto histórico de CSS.
- `DATA_SCHEMA_VERSION` pasa a 5; no cambia la estructura física de stores de IndexedDB ni requiere migración manual.
- Firestore continúa en Cloud Schema v2; no requiere cambios de reglas.

## Quality Gate

Se añade GitHub Actions con validación automática de sintaxis JS, archivos runtime, IDs HTML duplicados, handlers sin target, consistencia loader ↔ Service Worker, balance básico de CSS y regresiones deterministas.

## Regresión automatizada

`scripts/regression.mjs` cubre casos sintéticos de settings/objetivos, métricas y Training Intelligence, incluyendo subir carga, sumar reps, bajar carga, volumen incompleto, RIR ausente, peso corporal y ejercicios asistidos.

## Compatibilidad

- Sin cambios en la colección de días de Firestore.
- Sin cambios en reglas de Firestore.
- Sin cambio físico del DB version de IndexedDB.
- Se conservan Nube v2, dirty days, tombstones y conflictos por día.
- Los datos v5 permanecen compatibles.

## Validación pendiente tras publicación

La CI no sustituye una prueba real en Safari/iPhone ni en el navegador de escritorio. Tras el merge conviene hacer un smoke test de inicio de sesión/sincronización, registro manual, modo entrenamiento y descanso, objetivos, dashboard, calendario, Analytics/Intelligence y backup/restore.

Esto no requiere modificar Firebase.
