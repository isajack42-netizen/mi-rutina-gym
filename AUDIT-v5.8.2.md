# Auditoría puntual v5.8.2

## Causa raíz confirmada
`allWeightEntries(name)` devuelve objetos `{date}`, pero `renderExerciseDetail(name)` trataba cada elemento como `{date,e}` y ejecutaba `x.e.sets`. Con un ejercicio seleccionado y datos válidos, la gráfica se dibujaba primero y después se lanzaba `TypeError`, dejando sin actualizar `exerciseDetail` y `progressionPanel`. Esto reproduce exactamente el síntoma visual: gráfica con datos + textos `Selecciona un ejercicio` debajo.

## Correcciones
- Agregación del detalle directamente desde `data[date]`.
- Auto-selección defensiva dentro de `updateChart()`.
- Aislamiento de errores entre detalle e inteligencia.
- Pulido de encabezados CSS.
