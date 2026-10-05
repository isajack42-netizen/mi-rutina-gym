# LiftEngine v6.3.0 — Desktop Analytics Workspace

Fecha: 2026-10-05

## Dirección

La versión web empieza a diferenciarse por función: móvil sigue priorizando ejecutar el entrenamiento; escritorio empieza a priorizar analizar, revisar y decidir.

## Explorador de ejercicios

- En pantallas amplias (>=1320 px), Rendimiento e Inteligencia muestran una biblioteca lateral de ejercicios.
- La lista se ordena por uso reciente.
- Cada ejercicio muestra número de sesiones y última fecha registrada.
- Incluye búsqueda instantánea.
- La selección del explorador permanece sincronizada con el selector clásico y con Training Intelligence.
- El selector clásico se conserva en anchos donde el explorador no cabe cómodamente.

## Ficha del ejercicio

- Rendimiento muestra una cabecera contextual con:
  - sesiones registradas,
  - última sesión,
  - rutina asociada,
  - PR de peso,
  - PR de e1RM,
  - mejor peso de la última sesión.
- Intelligence muestra claramente qué ejercicio está analizando.

## Historial reciente

- Se muestran hasta ocho sesiones recientes del ejercicio seleccionado.
- Cada fila incluye fecha, número de series, mejor peso, e1RM y volumen.
- Al seleccionar una sesión se abre su fecha en Registro para inspeccionarla o editarla.

## Responsive

- El nuevo workspace aparece solo cuando existe ancho suficiente.
- Entre 1200 y 1319 px se conserva la experiencia desktop v6.2 con selector.
- Móvil y tablet permanecen sin cambios funcionales.

## Compatibilidad

- Sin cambios en Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Sin cambios en la lógica de PR, métricas o Training Intelligence.
- Compatible con v6.2.2.
