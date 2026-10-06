# LiftEngine v6.12.0 — Friction Audit

Fecha: 2026-10-05

## Objetivo

Reducir pasos, decisiones visibles y taps innecesarios durante una sesión real sin añadir funciones nuevas ni debilitar Reliability & Recovery de v6.11.

## Cambios en el recorrido principal

- El CTA principal inicia directamente la rutina planeada del día cuando existe. “Otra rutina” mantiene la elección manual a un toque adicional.
- El selector manual coloca primero la rutina planeada/asignada.
- Los campos de peso, repeticiones y RIR declaran el teclado móvil adecuado, seleccionan el valor al enfocar y permiten avanzar con Enter/Next.
- Enter/Done sobre RIR marca la serie; el botón de check sigue disponible.
- Al completar el último set de un ejercicio, LiftEngine avanza al siguiente ejercicio incompleto. No envuelve al inicio ni salta trabajo pendiente.
- La navegación vuelve a mantener visible el ejercicio activo y la serie siguiente.
- “Anterior” queda deshabilitado en el primer ejercicio para eliminar un control que antes no hacía nada.

## Menos ruido durante la sesión

- “Empezar” para medir el descanso con precisión solo aparece en la siguiente serie relevante durante el descanso; antes aparecía repetido en todas las series pendientes.
- Añadir serie y Añadir ejercicio continúan visibles.
- Sustituir ejercicio, quitar la última serie y configurar el descanso automático pasan a “Más opciones”.
- Los chips de ejercicios suben a un mínimo táctil de 44 px.

## Compatibilidad y seguridad

- Sin cambios de esquema de datos, Firestore, IndexedDB, backups, recovery journal ni formato de sesiones.
- Los guardados de borrador, undo, recuperación, bloqueo de escritor y sincronización conflictiva de v6.11 permanecen intactos.
- La navegación automática solo cambia el índice visual de la sesión y se persiste en el estado local de entrenamiento.

## Validación

- Sintaxis de scripts runtime.
- Validador estático y suite de regresión existente.
- 26 escenarios de Reliability & Recovery.
- Nueva puerta `scripts/friction.mjs` para autoavance, visibilidad de Empezar, CTA planeado, teclado móvil, estado de Anterior, agrupación de acciones y targets táctiles.

## Pendiente para LiftEngine 1.0 Personal Edition

La auditoría de fricción automatizada no sustituye una sesión física completa. El cierre 1.0 debe probar el recorrido en iPhone/Safari y escritorio, incluyendo teclado real, bloqueo/reanudación, orientación, mala red y sincronización entre dispositivos.
