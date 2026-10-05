# Auditoría técnica — LiftEngine v5.4.1

Esta versión prioriza integridad de datos y regresiones detectadas sobre nuevas funciones.

## Corregido en v5.4.1

- `sanitizeMeasurements`: se corrige la reasignación a `const` que podía vaciar medidas, romper backups y fallar al aplicar datos de Firebase.
- Recuperación de medidas: si `gymRecoveryBackup` conserva el contenido afectado, Ajustes muestra una opción de recuperación.
- Estado de series: `done:false` se conserva. Los datos históricos sin `done` migran automáticamente según reps válidas.
- Series planificadas: peso sin reps ya no cuenta como serie realizada, día, sesión, volumen ni PR.
- Modo entrenamiento: finalizar conserva solo series completadas; los borradores permanecen locales y la nube recibe solo series completadas.
- Sesión libre: puede arrancar sin ejercicios y permite añadir el primero desde la pantalla de entrenamiento.
- Descanso real: se añade “Empezar” para cerrar el descanso al comenzar la siguiente serie, evitando sumar el tiempo de ejecución.
- Entrenamientos abandonados: los borradores de más de 12 h se limpian; si había series completadas, se conserva solo lo realizado.
- Botones ±: ya no escriben a Firestore en cada toque; actualizan el borrador local.
- PR: peso/e1RM/reps ignoran calentamientos, series no completadas y series sin reps.
- Rendimiento de PR: `findPRs()` pasa de recorridos repetidos del historial a una sola pasada y el dashboard evita calcularlo dos veces.
- CSV: normaliza nombres/alias, omite series de pesas sin reps, guarda backup previo y conserva fechas con solo medidas corporales.
- Rutinas: al renombrar una rutina también se migran sus etiquetas históricas en `categories`.
- Service Worker: red primero con timeout de 2.2 s y fallback a caché en mala señal.
- UI: se añade el símbolo `upload` que faltaba.
- Tendencias: “30 días” solo se muestra cuando existe una ventana cercana a 30 días; de lo contrario se indica la fecha de referencia real.

## Pendiente

- Firestore sigue guardando el historial en un único documento. Debe migrarse antes de acercarse al límite de 1 MiB.
- La sincronización simultánea desde dos dispositivos sigue siendo `last write wins`; falta resolución de conflictos por entidad.
- El “PR de repeticiones” sigue siendo máximo absoluto de reps sin considerar la carga. Requiere una decisión de producto.
- `routineTargetFor()` puede elegir el objetivo de la primera rutina encontrada si un ejercicio aparece en varias rutinas con parámetros distintos.
- El versionado se redujo en el Service Worker, pero todavía hay referencias manuales de versión en el cargador/HTML.
- Siguen existiendo `alert()`/`confirm()` nativos y etiquetas sin asociación `for`/`id`; es trabajo de UX/accesibilidad.
- Tema claro: no es un bug; queda como opción de producto.
- Descanso automático después de calentamientos: se mantiene deliberadamente por ahora.

## Validación realizada

- `node --check` en todos los JavaScript runtime.
- Prueba aislada de `sanitizeMeasurements` con medidas reales.
- Prueba de migración de sets históricos (`done` ausente -> `true/false` explícito).
- Prueba de que una serie con solo peso no cuenta como realizada.
- Prueba de que `compactDataForCloud()` excluye series pendientes y conserva las completadas.
- Prueba de PR: una serie pendiente con 100 kg no genera PR; una completada con 55 kg sí.
- Prueba de recuperación de medidas desde `gymRecoveryBackup`.
- Benchmark sintético de `findPRs()` con 1,040 días / 5 años aprox.: ~45 ms en el entorno de prueba.
