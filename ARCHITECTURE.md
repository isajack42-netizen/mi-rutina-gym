# Arquitectura de LiftEngine

LiftEngine es una PWA estática alojada en GitHub Pages. Usa Firebase Authentication + Firestore para sincronización y IndexedDB como persistencia local principal.

Actualizada en v6.11.0. Desde v6, la arquitectura conserva scripts clásicos por compatibilidad, pero separa contratos de settings, métricas derivadas y orquestación de UI.

## Orden de carga

1. `app.js` — cargador estable.
2. `js/version.js` — única fuente runtime del número de versión.
3. `js/config.js` — Firebase y versiones de esquemas.
4. `js/storage.js` — adaptador IndexedDB.
5. `js/core.js` — estado base, sanitización, persistencia, nube, auth, conflictos y diálogos.
6. `js/settings.js` — contrato único de preferencias y objetivos.
7. `js/logbook.js` — registro manual, sesiones, e1RM y targets de rutina.
8. `js/metrics.js` — métricas derivadas compartidas.
9. `js/dashboard.js` — Resumen, PR, calendario y composición corporal.
10. `js/analytics.js` — UI de analítica sobre `metrics.js`.
11. `js/intelligence.js` — recomendaciones deterministas para la próxima sesión.
12. `js/tools.js` — calculadora, temporizador, CSV, ajustes, catálogos y backups.
13. `js/routines.js` — creación y gestión de rutinas.
14. `js/notifications.js` — avisos de descanso y comportamiento móvil.
15. `js/training.js` — modo entrenamiento.
16. `js/recovery.js` — diario local, deshacer, persistencia verificable y bloqueo de escritor.
17. `js/bootstrap.js` — inicialización, listeners globales y `refreshAll()`.

El orden ejecutable completo, incluyendo History, Planning, Schedule y Review, está definido en `app.js` y comprobado contra `sw.js`.

## Principios de v6

- No reescribir todo a un framework.
- Una sola definición por métrica.
- Un solo contrato de settings para local, nube y backups.
- Dashboard = síntesis; Progreso/Analytics = detalle.
- Training Intelligence debe ser explicable y consistente en todas las pantallas.
- Los cambios de composición corporal son neutrales salvo que exista un objetivo explícito.
- `main` debe pasar el quality gate de GitHub antes de publicar.

## Persistencia local

IndexedDB es la fuente local principal.

Stores:
- `days`: un registro por fecha.
- `settings`: configuración.
- `meta`: metadata de migración.

`localStorage` se usa para metadata pequeña y compatibilidad:
- UID;
- cursores;
- dirty days/settings;
- estado del entrenamiento;
- tema/unidad;
- fallback legacy;
- backups de recuperación puntuales.

Si IndexedDB no está disponible en un dispositivo que aún no lo utilizaba, LiftEngine usa un snapshot atómico en `localStorage`. Si ya era el almacén principal, un fallo al abrirlo detiene el arranque para evitar cargar datos antiguos.

Desde v6.11 `LiftLocalDB.commit` escribe días, ajustes y metadata de fiabilidad/recuperación en una transacción. La metadata contiene sesión activa y cambios de nube pendientes, incluidos borrados. Los checkpoints locales se limitan a 10 operaciones; un fallo de checkpoint impide el cambio destructivo. Deshacer exige coincidencia del estado afectado. Web Locks impide escritores simultáneos dentro del mismo origen en navegadores compatibles.

## Settings v6

El contrato se centraliza en `js/settings.js`.

Incluye:
- `exerciseNotes`
- `customRoutines`
- `customAliases`
- `customMuscles`
- `currentUnit`
- `currentTheme`
- `weeklySessionTarget`
- `bodyGoal`

`bodyGoal`:
- `mode`: neutral / recomp / cut / gain / maintain
- `targetWeightKg`: opcional
- `targetWaistCm`: opcional

Los backups anteriores siguen siendo válidos. Si un campo nuevo no existe, se aplica un default conservador.

## Firestore — Nube v2

### Documento raíz

`userData/{uid}` contiene configuración y metadata:

- `cloudSchemaVersion`
- `revision`
- `serverUpdatedAt`
- settings del contrato actual.

### Documentos por día

`userData/{uid}/days/{YYYY-MM-DD}` contiene:

- entrenamientos completados;
- categoría/rutina;
- nota;
- peso corporal;
- medidas;
- `revision`;
- `updatedAt`;
- `serverUpdatedAt`.

Los borrados usan `deleted:true`.

## Conflictos

Cada día tiene su propia revisión.

Una escritura solo continúa si la revisión remota coincide con la última revisión conocida por el dispositivo. Ante un conflicto del mismo día, el usuario elige explícitamente entre versión local, nube y cancelar. Cancelar pausa la sincronización hasta un reintento manual. Usar nube guarda primero un checkpoint local. El código comprueba también cambios realizados mientras el diálogo estaba abierto.

Los settings tienen revisión independiente en el documento raíz.

## Dirty days y pull incremental

Las mutaciones marcan únicamente las fechas afectadas.

La sincronización normal escribe solo:
- dirty days;
- settings dirty.

Los pulls usan `serverUpdatedAt` como cursor. Periódicamente se fuerza un pull completo como red de seguridad.

## Métricas v6

`js/metrics.js` define las reglas compartidas para:

- fechas de entrenamiento;
- snapshots semanales;
- cobertura de periodos;
- adherencia;
- tendencias de e1RM;
- series/frecuencia por músculo;
- deltas de composición corporal.

Dashboard y Analytics consumen estas definiciones para evitar discrepancias.

## Training Intelligence

`js/intelligence.js` combina:

- historial del ejercicio;
- carga;
- repeticiones;
- RIR;
- volumen objetivo;
- target de rutina;
- tendencia de e1RM.

Produce acciones como:
- subir carga;
- sumar reps;
- mantener;
- bajar carga;
- aumentar dificultad;
- usar referencia.

Las señales de fatiga son contextuales. LiftEngine no diagnostica fatiga ni prescribe un deload automático.

## Orquestación de UI

`refreshAll()` pertenece a `bootstrap.js`.

Los módulos de dominio renderizan su propia área, pero no deben asumir responsabilidad sobre el refresco completo de la aplicación.

`updateChart()` también refresca el panel de Intelligence; por eso `refreshAll()` no debe volver a llamarlo por separado.

## Quality Gate

`.github/workflows/validate.yml` ejecuta:

- `node --check` para JavaScript runtime;
- `scripts/validate.mjs` para:
  - archivos runtime requeridos;
  - IDs HTML duplicados;
  - handlers sin target;
  - consistencia loader ↔ Service Worker;
  - balance básico de CSS.

## Mantenimiento

Responsabilidad principal por archivo:

- `storage.js`: IndexedDB.
- `core.js`: estado base, nube y persistencia.
- `settings.js`: preferencias/objetivos.
- `logbook.js`: registro y sesiones.
- `metrics.js`: métricas compartidas.
- `dashboard.js`: resumen/calendario/composición.
- `analytics.js`: visualización analítica.
- `intelligence.js`: decisiones de entrenamiento.
- `tools.js`: utilidades/import-export/ajustes.
- `routines.js`: rutinas.
- `training.js`: sesión guiada.
- `bootstrap.js`: arranque y orquestación.
- `version.js`: versión runtime.

## Pruebas y cierre personal

`npm ci --ignore-scripts` instala únicamente la dependencia de pruebas fake-indexeddb fijada en el lockfile. `npm test` ejecuta validación estática, regresión y 26 escenarios de fiabilidad del código real con almacenamiento y nube controlados. GitHub Actions ejecuta estas puertas y la sintaxis de todos los scripts.

Las pruebas de transporte controlado no equivalen a integración con Firestore real ni a Safari/iPhone. El cierre pendiente y los criterios de v6.12/1.0 están en `ROADMAP-PERSONAL-EDITION.md`.
