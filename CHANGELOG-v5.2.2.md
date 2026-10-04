# LiftEngine v5.2.2

## Correcciones
- Corrige la actualización de la PWA para evitar que el navegador siga sirviendo una versión antigua desde caché.
- Los recursos principales usan cache-busting y el Service Worker usa red primero con caché como respaldo offline.
- Firebase y sus módulos dejan de ser interceptados por el Service Worker.
- Añade “Reintentar sincronización” en Ajustes.
- Corrige la importación CSV: al terminar actualiza la interfaz correctamente.
- Mantiene visible “Importar datos desde Excel (CSV)” en Ajustes.

## Descansos
- Los descansos objetivo se almacenan y muestran en segundos (por ejemplo 120 s o 120–180 s).
- Las rutinas antiguas con minutos se normalizan automáticamente al cargarse.
- Las rutinas nuevas guardan el descanso normalizado.
- El descanso real cronometrado se muestra como mm:ss, sin añadir incorrectamente “min”.

## Versión
- App y caché: 5.2.2.
