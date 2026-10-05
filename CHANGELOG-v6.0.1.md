# LiftEngine v6.0.1 — Stability & Hardening

Fecha: 2026-10-05

## Objetivo

v6.0.1 endurece la base de v6.0.0 sin añadir funciones nuevas ni cambiar el modelo de datos físico.

## Correcciones

- Corrige `Cargar anterior` y la carga automática del último rendimiento: ya no se asume que `allWeightEntries()` devuelve una entrada completa.
- Añade un contrato explícito `latestExerciseEntry()` para recuperar la sesión anterior.
- Endurece IDs importados para impedir que valores arbitrarios terminen dentro de handlers HTML.
- Normaliza nombres de rutina antes de validar claves reservadas como `__proto__`, `prototype` o `constructor`.
- Limita tamaños razonables de rutinas, series, nombres, notas y valores importados para evitar bloqueos por backups manipulados.
- La restauración JSON rechaza esquemas futuros, reemplaza IndexedDB explícitamente y genera tombstones para fechas que desaparecen del respaldo.
- Si una escritura Firebase termina después de un timeout y el contenido remoto coincide con el local, LiftEngine reconcilia la revisión sin mostrar un falso conflicto.
- El Service Worker solo activa una nueva versión si todo el app shell esencial quedó precacheado; si falla, elimina el cache incompleto y conserva la versión anterior.
- La adherencia usa la ventana completa cuando ya existía historial antes del periodo; el prorrateo queda reservado al onboarding real.
- Las tasas por músculo ya no extrapolan agresivamente una fracción de semana como si fuera una semana completa.
- Cambiar la meta semanal desde Analítica refresca también el Dashboard.
- Mover medidas corporales a una fecha ocupada pide confirmación antes de reemplazar.
- CSV valida fechas reales, sanea los datos importados antes de mezclarlos y protege celdas potencialmente interpretables como fórmulas por Excel.

## Quality gate

- Añade regresión para una pausa prolongada con historial anterior.
- Añade comprobaciones estáticas para el bug de `Cargar anterior`, sanitización de IDs, restauración local y precache atómico.

## Fuera de alcance de 6.0.1

Se dejan para una versión posterior los cambios semánticos más amplios: modelado completo de ejercicios asistidos/peso corporal en PR y Analytics, sesiones múltiples por día y una suite E2E real de navegador/Safari.
