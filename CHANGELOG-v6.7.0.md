# LiftEngine v6.7.0 — Weekly Schedule & Planned vs Actual

Fecha: 2026-10-05

## Dirección

LiftEngine conecta por primera vez planificación y ejecución: además de definir cuánto entrenar, ahora puede indicar qué rutina estaba prevista para cada día y comparar el plan con lo realizado.

## Plan semanal

- Nueva plantilla semanal de lunes a domingo dentro del Planning Workspace.
- Cada día puede quedar:
  - sin plan,
  - en descanso,
  - asignado a cualquiera de las rutinas existentes.
- **Usar escenario** convierte las frecuencias de v6.6 en una propuesta semanal.
- Con Push/Pull/Legs 2× se propone Push, Pull, Legs, Push, Pull, Legs y descanso.
- El escenario sigue siendo independiente; el plan solo se modifica cuando el usuario lo aplica.

## Reprogramación por fecha

- El calendario permite crear excepciones para días concretos sin alterar la plantilla futura.
- Una fecha puede:
  - cambiar de rutina,
  - convertirse en descanso,
  - quedar sin entrenamiento,
  - restaurarse a la plantilla.
- **Mover sesión** convierte el día original en descanso y asigna la rutina a la nueva fecha.
- Si el destino ya tenía una rutina prevista, LiftEngine pide confirmación antes de reemplazarla.

## Planeado vs. realizado

- El calendario muestra entrenamientos futuros aunque todavía no exista registro.
- Los estados distinguen:
  - planeado,
  - cumplido,
  - realizado distinto,
  - pendiente,
  - descanso,
  - sesión extra.
- El inspector del calendario muestra el plan del día junto con el entrenamiento real.
- Eliminar un entrenamiento no elimina el plan semanal.

## Resumen y modo entrenamiento

- Resumen muestra el entrenamiento de hoy o la próxima sesión programada.
- Incluye cumplimiento exacto de las sesiones ya vencidas/completadas de la semana.
- Una sesión prevista para hoy puede iniciarse directamente desde Resumen.
- La acción Entrenar de la sidebar usa la rutina programada del día cuando existe.
- El selector de Modo Entrenamiento preselecciona la rutina planeada.

## Persistencia y sincronización

- Nuevo ajuste sincronizado `weeklyPlan` con:
  - plantilla semanal,
  - excepciones por fecha.
- Compatible con cuentas anteriores: si no existe plan, se crea vacío sin modificar datos históricos.
- También se conserva en localStorage, IndexedDB, backups y nube mediante el contrato existente de Settings.
- Renombrar una rutina actualiza sus referencias en el plan.
- Eliminar una rutina limpia sus referencias del plan.

## Adherencia

- La adherencia histórica por meta semanal se mantiene intacta.
- El nuevo cumplimiento del plan es una métrica separada para no reescribir el significado de datos anteriores.
- La sesión prevista para hoy no se considera fallida antes de que termine el día.

## Compatibilidad

- Cambio de Settings retrocompatible.
- Sin migración destructiva.
- Sin cambios en los documentos diarios de Firestore.
- Sin pérdida de historial.
