# LiftEngine v5.5.0 — Cloud & Quality

Esta versión cierra los puntos pendientes de la auditoría técnica posterior a v5.4.1.

## Sincronización y almacenamiento

- Nueva **Nube v2**: el historial deja de guardarse completo en `userData/{uid}`.
- Cada fecha se guarda en `userData/{uid}/days/{YYYY-MM-DD}`.
- El documento raíz conserva únicamente configuración pequeña (rutinas, alias, músculos, notas por ejercicio, unidad y tema).
- Migración automática desde el formato antiguo cuando las reglas de Firestore v5.5.0 están publicadas.
- Se crea `gymBackupBeforeCloudV2` antes de migrar.
- Si las reglas nuevas aún no están publicadas, LiftEngine sigue usando la nube heredada sin borrar datos.
- Tombstones para borrados por fecha, evitando que un registro eliminado reaparezca en otro dispositivo.
- Revisión independiente por día y transacciones de Firestore para detectar conflictos.
- Si dos dispositivos modifican la misma fecha, LiftEngine pregunta cuál conservar en vez de sobrescribir silenciosamente.
- Cambios en fechas diferentes ya no compiten por un único documento completo.

## PR de repeticiones

- El PR de repeticiones ahora se compara **a la misma carga**.
- Una serie ligera de 20 reps ya no supera automáticamente una serie pesada solo por tener más repeticiones.
- En progreso se muestra `Último PR de reps @ carga`.
- Los PR de reps del resumen de entrenamiento muestran también el peso asociado.

## Objetivos de rutina

- `routineTargetFor()` ahora respeta la rutina activa o la categoría de la sesión.
- Si un ejercicio aparece en varias rutinas con rangos distintos, LiftEngine deja de tomar simplemente la primera coincidencia.
- Sin contexto suficiente se muestra que el objetivo es variable, en vez de inventar uno único.

## Versionado

- La versión runtime vive únicamente en `js/version.js`.
- `app.js` carga `version.js` sin caché y después carga todos los módulos usando esa versión.
- `index.html`, `config.js`, `bootstrap.js` y `sw.js` ya no necesitan repetir manualmente el número de versión.

## UX y accesibilidad

- Eliminados los `alert()` y `confirm()` nativos del flujo normal.
- Nuevo sistema de diálogos consistente con la interfaz de LiftEngine.
- Los campos estáticos principales tienen `label for="..."`.
- Los formularios dinámicos reciben asociación accesible de etiqueta/campo automáticamente.

## Service Worker

- `app.js` forma parte del shell offline.
- El Service Worker toma su versión de `js/version.js`.
