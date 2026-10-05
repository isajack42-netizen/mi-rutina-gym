# LiftEngine v5.4.1 — Integrity & Stability

## Esquema
- `DATA_SCHEMA_VERSION` pasa de 2 a 3 por el estado explícito `done` de las series. La migración desde datos anteriores es automática.

## Corregido
- Error crítico de `sanitizeMeasurements` que podía vaciar medidas corporales y romper backups/sincronización.
- Si `gymRecoveryBackup` conserva medidas afectadas, Ajustes ofrece ahora **Recuperar medidas desde copia local**.
- Persistencia explícita de `done:false` y migración segura de series históricas.
- Series con solo peso ya no cuentan como realizadas, ni alimentan volumen/PR/estadísticas.
- El modo entrenamiento conserva borradores localmente y solo sincroniza series completadas.
- Finalizar entrenamiento descarta series no completadas.
- Sesión libre puede iniciarse vacía y añadir el primer ejercicio desde el modo entrenamiento.
- Botón **Empezar** cierra el descanso al comenzar la siguiente serie para medir descanso real correctamente.
- Limpieza de entrenamientos abandonados después de 12 h.
- `findPRs()` reescrito en una sola pasada y el dashboard evita recalcularlo dos veces.
- PR/peso/e1RM ignoran series no completadas y calentamientos.
- Importación CSV normaliza nombres/alias, exige reps válidas y crea backup local previo.
- Exportación CSV conserva días que solo tienen medidas corporales.
- Renombrar una rutina migra las etiquetas históricas del calendario.
- Service Worker usa timeout de red de 2.2 s antes de recurrir a caché.
- Añadido el icono de importación CSV.
- Tendencias de 30 días ya no afirman “30 d” si no existe historial suficiente.
- Los botones ± del modo entrenamiento ya no escriben a Firestore en cada toque; guardan el borrador local.

## Pendiente / deliberadamente fuera de esta hotfix
- Migrar Firestore desde un único documento a documentos/subcolecciones para evitar el límite de 1 MiB y mejorar concurrencia multidispositivo.
- Resolver conflictos por entidad entre dos dispositivos que editan al mismo tiempo.
- Redefinir el “PR de repeticiones” para que considere la carga o usar otra métrica más útil.
- Resolver ejercicios que aparecen en varias rutinas con objetivos diferentes.
- Eliminar completamente las repeticiones manuales de versión en `index.html`/cargador; se redujeron en el Service Worker pero no se cambió el pipeline de carga.
- Sustituir `alert()`/`confirm()` nativos por modales internos y mejorar asociaciones `label/for` y accesibilidad.
- Tema claro, si se decide añadir como preferencia de producto.
