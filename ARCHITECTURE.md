# Arquitectura de LiftEngine

Desde v5.4.0 el JavaScript está separado por dominio. Desde v5.5.0, `app.js` es el cargador estable: obtiene la versión desde `js/version.js` y carga después los módulos con esa versión como cache-buster.

## Orden de carga

1. `app.js` — cargador estable.
2. `js/version.js` — única fuente runtime del número de versión.
3. `js/config.js` — Firebase y versiones de esquemas.
4. `js/core.js` — estado, sanitización, almacenamiento local, Nube v2, conflictos, unidades, tema y diálogos.
5. `js/logbook.js` — registro manual, sesiones, e1RM y progresión.
6. `js/dashboard.js` — resumen, PR, calendario y composición corporal.
7. `js/tools.js` — calculadora, temporizador, CSV, ajustes, catálogos y backups.
8. `js/routines.js` — creación y gestión de rutinas.
9. `js/notifications.js` — avisos de descanso y teclado móvil.
10. `js/training.js` — modo entrenamiento.
11. `js/bootstrap.js` — inicialización y listeners globales.

Los módulos siguen siendo scripts clásicos y comparten el entorno global. Esto mantiene compatibilidad con el proyecto existente sin una reescritura completa a ES modules.

## Persistencia local

LocalStorage continúa siendo la fuente inmediata de trabajo y permite usar LiftEngine con mala señal o sin conexión. La nube se sincroniza después.

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

### Documentos por día

`userData/{uid}/days/{YYYY-MM-DD}` contiene:

- entrenamientos completados de ese día;
- categoría/rutina;
- nota de sesión;
- peso corporal;
- medidas corporales;
- `revision`;
- `updatedAt`.

Los borrados se representan con `deleted:true`. Así un dispositivo desconectado no puede resucitar silenciosamente una fecha borrada.

### Conflictos

Cada día tiene su propia revisión. Una escritura usa transacción y solo continúa si la revisión de Firestore coincide con la última que vio el dispositivo. Si otro dispositivo modificó la misma fecha, LiftEngine solicita una elección explícita. Cambios en fechas diferentes pueden sincronizarse independientemente.

## Regla de mantenimiento

- Estado, persistencia, nube y diálogos: `core.js`.
- Registro y progresión: `logbook.js`.
- Métricas y PR: `dashboard.js`.
- Archivos, ajustes y utilidades: `tools.js`.
- Rutinas: `routines.js`.
- Entrenamiento: `training.js`.
- Arranque: `bootstrap.js`.
- Versión: únicamente `js/version.js`.
