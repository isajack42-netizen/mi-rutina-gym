# LiftEngine v6.9.0 — Weekly & Monthly Review

Fecha: 2026-10-05

## Dirección

LiftEngine empieza la fase de cierre como producto personal: menos funciones nuevas y más capacidad para convertir datos existentes en conclusiones útiles.

## Revisión periódica

- Nueva subvista **Revisión** dentro de Progreso, exclusiva de escritorio.
- Dos horizontes comparables:
  - últimos 7 días vs. 7 anteriores,
  - últimos 28 días vs. 28 anteriores.
- El periodo actual y el anterior siempre tienen la misma duración.

## Qué resume

La revisión sintetiza:
- sesiones completadas,
- adherencia equivalente a la meta semanal,
- series de trabajo,
- volumen medio por sesión,
- PR registrados,
- cambio reciente de peso corporal cuando existe una medición perteneciente al periodo,
- cumplimiento exacto del plan semanal actual,
- ejercicios en mejora,
- ejercicios con señales para revisar.

## Conclusiones

- LiftEngine genera una lectura determinista de hasta cuatro puntos clave.
- Las conclusiones distinguen entre:
  - progreso,
  - contexto,
  - señales para revisar.
- No se inventan comparaciones cuando el periodo anterior no tiene una base válida.
- El peso corporal no se presenta como dato del periodo si la medición más reciente quedó fuera de la ventana seleccionada.
- RIR ausente no se transforma en 0 al calcular promedios.

## Siguiente enfoque

La cabecera de Revisión responde a “¿qué haría después?” con reglas simples y explicables:
- recuperar primero consistencia si el plan tiene sesiones pendientes,
- revisar un ejercicio si aparece una caída clara,
- priorizar frecuencia si la adherencia está baja,
- mantener la estructura cuando existen señales de progreso,
- seguir acumulando historial si todavía no hay una señal fuerte.

## Rendimiento

- Se muestran los ejercicios con mejor señal de e1RM y los ejercicios que conviene revisar.
- Desde cada ejercicio se puede saltar directamente a Rendimiento para inspeccionar su historial completo.

## Arquitectura

- Nuevo módulo `js/review.js`.
- Helpers de comparación y síntesis separados de la UI.
- Integrado en loader y Service Worker.
- Regresiones específicas para ventanas 7/28 días, agregados, comparaciones e interpretación.

## Responsive

- Revisión es una herramienta de escritorio.
- En móvil/tablet no se añade una nueva subpestaña.
- Si se reduce la ventana mientras Revisión está abierta, LiftEngine vuelve a Analítica.

## Compatibilidad

- Sin cambios de Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Sin cambios en datos históricos.
