# LiftEngine v6.4.0 — Exercise Profile Analytics

Fecha: 2026-10-05

## Perfil analítico por ejercicio

La versión web profundiza en su papel de análisis: cada ejercicio puede leerse como una ficha de rendimiento, no solo como una gráfica.

## Comparación 4 vs 4 semanas

- Compara las últimas 4 semanas con las 4 anteriores, ancladas en la sesión más reciente del ejercicio.
- Muestra sesiones, mejor peso, mejor e1RM, volumen medio por sesión, reps promedio y RIR promedio.
- Los cambios porcentuales se calculan solo cuando existe una base comparable.
- Se genera una señal determinista de mejora, estabilidad o rendimiento por revisar.
- Si no existe historial suficiente en el periodo anterior, LiftEngine lo indica en lugar de inventar una tendencia.

## Nuevas métricas de gráfica

Además de peso, volumen y e1RM, Rendimiento permite visualizar:
- reps promedio por serie,
- RIR promedio,
- series de trabajo.

## PR históricos

- Se reconstruyen hitos del ejercicio a partir del historial existente.
- Un hito puede representar nuevo PR de peso, e1RM o reps.
- Se muestran los seis hitos más recientes en escritorio.

## Compatibilidad

- Sin cambios en Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Todo el análisis se deriva del historial ya existente.
- La experiencia móvil conserva su layout.
