# Arquitectura de LiftEngine

Desde v5.4.0 el JavaScript está separado por dominio. Desde v5.5.0, `app.js` es el cargador estable: obtiene la versión desde `js/version.js` y carga después los módulos con esa versión como cache-buster.

## Orden de carga

1. `app.js` — cargador estable.
2. `js/version.js` — única fuente runtime del número de versión.
3. `js/config.js` — Firebase y versiones de esquemas.
4. `js/storage.js` — IndexedDB: días, configuración y metadata local.
5. `js/core.js` — estado, sanitización, almacenamiento local, Nube v2, conflictos, unidades, tema y diálogos.
6. `js/logbook.js` — registro manual, sesiones, e1RM y utilidades de progresión.
7. `js/dashboard.js` — resumen, PR, calendario y composición corporal.
8. `js/analytics.js` — ventanas 4/8/12 semanas, adherencia, frecuencia y tendencias.
9. `js/intelligence.js` — motor explicable de recomendación para la siguiente sesión.
10. `js/tools.js` — calculadora, temporizador, CSV, ajustes, catálogos y backups.
11. `js/routines.js` — creación y gestión de rutinas.
12. `js/notifications.js` — avisos de descanso y teclado móvil.
13. `js/training.js` — modo entrenamiento e integración de sugerencias.
14. `js/bootstrap.js` — inicialización y listeners globales.

Los módulos siguen siendo scripts clásicos y comparten el entorno global. Esto mantiene compatibilidad con el proyecto existente sin una reescritura completa a ES modules.

## Persistencia local

Desde v5.6.0, **IndexedDB es la persistencia local principal del historial**. Se guarda un registro por fecha, alineado con la estructura de Nube v2, y la configuración se guarda por separado.

El estado JavaScript continúa en memoria mientras la aplicación está abierta. `localStorage` queda reservado para metadata pequeña (UID, unidad/tema, cursores, dirtyDays, estado del entrenamiento y compatibilidad). El snapshot histórico v5.5.x se conserva sin reescribirse como red de seguridad.

Si IndexedDB no está disponible, LiftEngine cae automáticamente al modo heredado de `localStorage`.

## Firestore — Nube v2

### Documento raíz

`userData/{uid}` contiene solamente configuración:

- `cloudSchemaVersion`
- `revision`
- `exerciseNotes`
- `customRoutines`
- `customAliases`
- `customMuscles`
- `currentUnit`
- `currentTheme`
- `weeklySessionTarget`

### Documentos por día

`userData/{uid}/days/{YYYY-MM-DD}` contiene:

- entrenamientos completados de ese día;
- categoría/rutina;
- nota de sesión;
- peso corporal;
- medidas corporales;
- `revision`;
- `updatedAt`;
- `serverUpdatedAt` (desde v5.6, Timestamp de servidor para pulls incrementales).

Los borrados se representan con `deleted:true`. Así un dispositivo desconectado no puede resucitar silenciosamente una fecha borrada.

### Conflictos

Cada día tiene su propia revisión. Una escritura usa transacción y solo continúa si la revisión de Firestore coincide con la última que vio el dispositivo. Si otro dispositivo modificó la misma fecha, LiftEngine solicita una elección explícita. Cambios en fechas diferentes pueden sincronizarse independientemente.

## Regla de mantenimiento

- Adaptador IndexedDB: `storage.js`.
- Estado, persistencia, nube y diálogos: `core.js`.
- Registro y progresión: `logbook.js`.
- Métricas y PR: `dashboard.js`.
- Archivos, ajustes y utilidades: `tools.js`.
- Rutinas: `routines.js`.
- Entrenamiento: `training.js`.
- Arranque: `bootstrap.js`.
- Versión: únicamente `js/version.js`.


## Fiabilidad v5.5.1

- Los borradores viven localmente dentro de `data` con `trainingDraft:true`/`done:false`, pero `buildDayContent()` solo publica trabajo completado. Durante un pull se preservan y vuelven a mezclar después de aplicar la nube.
- El estado de descanso (`__restCtx`, `__timerEndAt`, `__timerAlarmed`) se persiste junto con `gymTrainState` y se restaura al reabrir la PWA.
- Al volver al primer plano, si han pasado más de 45 segundos desde el último pull, LiftEngine refresca Nube v2.
- El Service Worker solo administra caches con prefijo `liftengine-` y dispone de fallback de `version.js` ignorando query strings.

## Rendimiento v5.6.0

### dirtyDays

Las mutaciones marcan fechas concretas. Una escritura normal a Nube v2 procesa únicamente esas fechas y limpia el marcador después de una confirmación exitosa. Los marcadores se conservan entre recargas si el dispositivo queda offline.

### Pull incremental

Después de un pull completo inicial, Firestore se consulta por `serverUpdatedAt >= cursor`. El cursor conserva el Timestamp completo. Cada 24 horas se hace un pull completo como red de seguridad y compatibilidad con clientes anteriores. El botón **Reintentar sincronización** también fuerza un pull completo.

### Pendiente de arquitectura

La siguiente optimización posible, solo cuando el historial lo justifique, sería carga perezosa por rangos desde IndexedDB para no mantener años completos de datos en memoria. No es necesaria para el uso actual.

## v5.7 Analytics

`js/analytics.js` es una capa de lectura sobre el historial. Calcula ventanas de 4/8/12 semanas, adherencia a una meta semanal configurable, frecuencia y series de trabajo por músculo, PR del periodo y señales conservadoras de mejora/estancamiento mediante e1RM. La única escritura de este módulo es `weeklySessionTarget`, que forma parte de la configuración local/nube y del backup JSON.

## v5.8 Training Intelligence

`js/intelligence.js` es una capa exclusivamente derivada: no introduce tablas ni documentos nuevos. Consume `getExerciseSessions()`, el objetivo resuelto por `routineTargetFor()`, RIR y e1RM para construir una recomendación determinista.

El módulo produce un objeto común usado por:

- **Progreso:** plan de próxima sesión y explicación.
- **Analytics:** resumen de próximas decisiones.
- **Modo entrenamiento:** placeholders de peso/reps y tarjeta compacta de objetivo.

Las señales de meseta y caída de rendimiento son contextuales y no se convierten automáticamente en diagnósticos ni deloads. El motor exige volumen objetivo suficiente antes de subir carga y trata la ausencia de RIR de forma conservadora.
