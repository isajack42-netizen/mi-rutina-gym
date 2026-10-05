# LiftEngine v5.8.2 — Progress Intelligence Hotfix

- Corrige un error en `renderExerciseDetail()` que intentaba acceder a `x.e` aunque `allWeightEntries()` solo devuelve fechas. Ese error detenía `updateChart()` después de dibujar la gráfica y evitaba renderizar la Inteligencia de entrenamiento.
- La selección automática del ejercicio ahora también se ejecuta dentro de `updateChart()`, por lo que sobrevive a `refreshAll()` y sincronizaciones.
- El resumen del ejercicio y la Inteligencia de entrenamiento se renderizan de forma aislada: un fallo en uno ya no bloquea al otro.
- Mejora la jerarquía visual de los encabezados de Inteligencia y Analítica; elimina márgenes negativos que hacían que título y subtítulo parecieran encimados.
- Mejora el estado vacío del panel de inteligencia.
