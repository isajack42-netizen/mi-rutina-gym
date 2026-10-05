# Auditoría de fiabilidad — estado tras LiftEngine v5.5.1

## Corregido en esta versión

1. Borradores/series pendientes podían desaparecer al resincronizar Nube v2.
2. Arranque offline podía fallar por `version.js?ts=...` no presente exactamente en cache.
3. Una segunda colisión de revisión podía devolver `false` y terminar marcada como sincronizada.
4. “Copiar última sesión” y “Cargar rutina” se tratan explícitamente como borradores locales.
5. Un dispositivo abierto podía quedarse visualmente desactualizado hasta una recarga manual; ahora se refresca al volver a primer plano tras 45 s.
6. Editar una medición y moverla de fecha duplicaba la fecha anterior.
7. Rutinas/alias/músculos vacíos reaparecían con defaults al recargar o restaurar un backup.
8. CSV omitía fechas con solo nota de sesión.
9. CSV sustituía comas en nombres de ejercicios aunque el formato ya soportaba campos escapados.
10. El Service Worker podía borrar caches de otras aplicaciones del mismo origen.
11. El descanso activo se perdía al recargar/cerrar la PWA.
12. Parsing inconsistente de `1:30`, `2-3`, minutos y segundos.
13. Alias no migraban inmediatamente todas las referencias, especialmente `customMuscles`; el editor de rutinas tampoco normalizaba siempre el nombre.
14. Dos entradas del mismo ejercicio el mismo día podían aparecer como dos sesiones en Progreso.
15. Cálculos de composición corporal con cobertura insuficiente o medidas faltantes en primera/última fila.
16. Validación de fechas ahora rechaza fechas imposibles aunque cumplan el patrón `YYYY-MM-DD`.

## Pendiente / roadmap técnico

### v5.6 — rendimiento de datos

- Sincronización incremental: Nube v2 todavía descarga todos los documentos diarios al hacer un pull completo.
- `dirtyDays`: guardar todavía compara hashes de todas las fechas conocidas aunque solo escriba las modificadas.
- Migración progresiva de historial local desde `localStorage` a IndexedDB para evitar serializaciones síncronas y límites futuros.

### Mejoras opcionales de producto/seguridad

- Objetivo de composición corporal (definición, mantenimiento, recomposición, volumen) para interpretar peso sin asumir que bajar siempre es positivo.
- Restringir el proyecto Firebase a una cuenta/UID concreto si LiftEngine va a seguir siendo estrictamente personal.
- Tema claro, si se desea.
- Push de servidor con pantalla bloqueada continúa descartado por decisión del proyecto.
