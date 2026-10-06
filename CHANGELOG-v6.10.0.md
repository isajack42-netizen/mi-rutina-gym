# LiftEngine v6.10.0 — Training Intelligence 2.0

Fecha: 2026-10-05

## Dirección

Training Intelligence deja de depender únicamente de la última sesión y la tendencia inmediata. Ahora incorpora una capa de memoria personal de hasta 8 sesiones comparables por ejercicio.

## Patrones personales

LiftEngine puede reconocer, cuando existe evidencia suficiente:

- **Progresión por reps**: la misma carga tiende a mejorar primero mediante repeticiones.
- **Carga bien tolerada**: aumentos recientes de peso sostienen el e1RM.
- **Caída entre series**: pérdida repetida de reps entre primera y última serie con la carga principal.
- **Esfuerzo en aumento**: el RIR medio reciente baja de forma clara frente al bloque anterior.
- **Más margen reciente**: el RIR aumenta sin necesidad de interpretar causalidad.
- **Efecto de posición**: rendimiento menor cuando el ejercicio aparece tarde, solo si ha cambiado varias veces entre posiciones tempranas y tardías.

## Reglas conservadoras

- Los patrones describen historial; no prueban causa.
- El efecto de posición exige al menos dos cambios reales de orden para reducir falsos positivos por progresión temporal.
- Los ejercicios asistidos no usan automáticamente el número de carga para inferir un estilo de progresión.
- La capa personal no anula las reglas de objetivo/RIR ya existentes.
- Subir carga sigue requiriendo completar el rango y respetar el esfuerzo previsto cuando existe objetivo de rutina.

## Personalización de la recomendación

- Sin un objetivo único de rutina, un patrón repetido de progresión por reps puede convertir una referencia genérica en una propuesta concreta de mantener carga y sumar reps.
- Al recomendar reps, carga, mantener o bajar, LiftEngine puede añadir una razón basada en el patrón personal cuando corresponda.
- El patrón nunca se usa si todavía está “en formación”.

## Interfaz

- Nueva sección **Tu patrón reciente** dentro de Intelligence en escritorio.
- Muestra hasta tres señales personales y cuántas sesiones se analizaron.
- La vista móvil mantiene la tarjeta compacta para no entorpecer el entrenamiento.
- El diálogo **¿Por qué?** incluye todos los patrones disponibles y explica sus límites.
- Analítica muestra el patrón principal junto a las próximas decisiones cuando existe.

## Historial derivado

- Las sesiones por ejercicio ahora conservan, de forma derivada:
  - rutina,
  - posición del ejercicio,
  - cantidad de ejercicios de la sesión.
- No se modifica ningún dato histórico almacenado; el contexto se reconstruye al leer el historial.

## QA

- Regresiones para:
  - progresión por reps,
  - aumentos de carga sostenidos,
  - caída entre series,
  - deriva de RIR,
  - efecto de posición,
  - protección contra inferir posición con un solo cambio de orden.

## Compatibilidad

- Sin cambios de Firestore.
- Sin cambios de IndexedDB.
- Sin migraciones.
- Sin cambios de esquema.
- Sin pérdida o reescritura de entrenamientos.
