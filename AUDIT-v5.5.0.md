# Estado de auditoría — LiftEngine v5.5.0

## Corregido en v5.4.1

- `sanitizeMeasurements` reasignando un `const`.
- Riesgo de vaciar medidas por ese error.
- Pérdida de `done:false` al sanitizar.
- Series con peso y sin reps contadas como realizadas.
- PR de peso a partir de sets incompletos.
- `trainEnd()` conservando series incompletas.
- Descanso real incluyendo la ejecución de la siguiente serie.
- Sesión libre vacía.
- Borradores de rutina contaminando estadísticas.
- Escrituras de nube en cada toque de +/-.
- Limpieza de entrenamientos abandonados.
- `findPRs()` cuadrático y duplicado en dashboard.
- Alias al importar CSV.
- Días de CSV con solo medidas.
- Backup previo a CSV.
- Renombrado histórico de rutinas.
- Timeout del Service Worker en mala señal.
- Icono de importación CSV.
- Ventanas de 30 días con texto engañoso.

## Corregido en v5.5.0

- PR de repeticiones comparado contra cualquier peso -> ahora se compara por carga.
- Ejercicio presente en varias rutinas -> objetivo contextual por rutina/fecha.
- Documento único de Firestore acercándose a 1 MiB -> historial dividido por fecha.
- Conflictos entre PC/móvil -> revisiones y transacciones por fecha + resolución explícita.
- Versión repetida manualmente -> fuente runtime única en `js/version.js`.
- `alert()` / `confirm()` nativos -> diálogos propios.
- Etiquetas de formulario sin asociación -> asociación estática + automática para contenido dinámico.

## Decisiones deliberadas, no bugs

- Los calentamientos siguen pudiendo iniciar descanso automático: también puede existir descanso entre series de calentamiento.
- No se añadió tema claro; es una opción de diseño, no un error funcional.
- Las notificaciones Push garantizadas con pantalla bloqueada siguen fuera de alcance por decisión del proyecto.

## Requisito externo para activar Nube v2

El código es compatible con nube heredada y nube v2. La migración v2 solo se activa cuando las reglas de Firestore incluidas en esta versión se han publicado en Firebase. Esto evita migraciones parciales y mantiene el historial seguro si el repositorio de GitHub se actualiza antes que Firebase.
