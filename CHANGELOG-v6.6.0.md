# LiftEngine v6.6.0 — Planning Workspace

Fecha: 2026-10-05

## Dirección

La versión web incorpora planificación: además de analizar qué ocurrió, ahora permite explorar cómo quedaría la semana antes de modificar el programa.

## Planificador semanal

- Nuevo panel lateral en **Rutinas**, exclusivo de escritorio.
- La frecuencia inicial reparte la meta semanal entre las rutinas existentes.
- El escenario puede ajustarse en pasos de 0.5 sesiones por semana.
- El escenario es temporal: no modifica rutinas, Firestore ni preferencias.
- Se muestran:
  - sesiones planificadas por semana,
  - series directas totales,
  - grupos musculares cubiertos,
  - promedio de series por grupo.

## Distribución muscular

- Las series se asignan al grupo muscular principal configurado para cada ejercicio.
- Se calcula:
  - series directas por semana,
  - frecuencia semanal del grupo,
  - número de ejercicios que contribuyen.
- La lectura de “alto/bajo” es relativa a la mediana del propio plan; no pretende imponer un volumen universal.
- Si existen ejercicios en “Otros”, LiftEngine lo señala para que puedan clasificarse desde Ajustes.

## Vista previa antes de guardar

- En escritorio, Crear/Editar Rutina abre un editor ancho con vista previa lateral.
- Mientras se modifican ejercicios o series se recalculan:
  - ejercicios del borrador,
  - series por sesión,
  - frecuencia del escenario,
  - series por semana,
  - impacto muscular directo,
  - distribución resultante del plan.
- Nada del borrador se considera guardado hasta pulsar **Guardar**.

## Meta semanal

- Si cambia la meta semanal de sesiones, el escenario se restablece para volver a distribuirse desde esa meta.

## Arquitectura

- Nuevo módulo `js/planning.js`.
- Integrado en loader y Service Worker.
- Cálculo puro separado de la UI y protegido por regresiones.

## Compatibilidad

- Sin cambios en Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Sin cambios funcionales en móvil.
