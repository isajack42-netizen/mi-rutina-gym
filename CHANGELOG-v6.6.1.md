# LiftEngine v6.6.1 — Routine Preview Scope

Fecha: 2026-10-05

## Corrección conceptual del editor

- La vista previa al editar una rutina deja de mostrar alertas globales de otros músculos.
- Editar Push ya no puede mostrar avisos de Piernas o Core dentro de la columna de borrador.
- Las alertas globales permanecen únicamente en el Planificador principal de Rutinas.

## Comparación borrador vs. rutina guardada

- El editor compara la rutina guardada con el borrador actual.
- Para cada grupo muscular realmente afectado muestra:
  - series por sesión antes,
  - series por sesión después,
  - cambio semanal según la frecuencia del escenario.
- Si el volumen muscular no cambió, se muestra explícitamente “Sin cambios”.
- Para una rutina nueva se muestra su aporte directo al escenario.

## Resumen semanal

- La vista previa conserva sesiones del escenario y series directas totales del plan.
- El total semanal se presenta como antes → después con su delta.
- La columna derecha queda enfocada exclusivamente en la rutina editada.

## Compatibilidad

- Sin cambios de Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Sin cambios funcionales en móvil.
