# Auditoría v5.8.1

Objetivo: corregir la percepción de ausencia de recomendaciones con poco historial y evitar que la adherencia pueda quedar visualmente vacía si falla un cálculo secundario.

## Cambios comprobados
- 1 sesión + objetivo definido: propuesta provisional.
- 2 sesiones: propuesta provisional/comparativa.
- 3 sesiones: recomendación sin inferencias fuertes de tendencia.
- 4+ sesiones: habilita lectura de tendencia del motor existente.
- Progreso selecciona el ejercicio más reciente solo cuando el usuario no tiene una selección previa.
- El cálculo de adherencia no depende de findPRs(), tendencias, Chart.js ni Training Intelligence.
- Cada componente secundario de Analytics se ejecuta con aislamiento de errores.
