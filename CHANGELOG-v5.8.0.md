# LiftEngine v5.8.0 — Training Intelligence

## Objetivo
Convertir el historial que LiftEngine ya registra en decisiones prudentes y explicables para la siguiente sesión, sin introducir una “caja negra” ni recomendaciones automáticas de deload.

## Novedades

- Nuevo módulo `js/intelligence.js`.
- Motor determinista por ejercicio que combina:
  - objetivo de rutina (series, rango de reps, RIR y descanso);
  - carga y repeticiones de sesiones previas;
  - RIR reciente;
  - tendencia de e1RM;
  - series completadas frente al volumen prescrito;
  - meseta reciente y caídas repetidas de rendimiento.
- Acciones posibles:
  - subir carga;
  - mantener carga y sumar reps;
  - consolidar/mantener;
  - reducir ligeramente la carga;
  - aumentar dificultad en ejercicios sin carga externa;
  - usar una referencia cuando faltan datos o el objetivo es ambiguo.
- Cada recomendación incluye nivel de confianza (bajo/medio/alto) y una explicación “¿Por qué?”.
- Las señales de caída de rendimiento y esfuerzo alto pueden sugerir revisar recuperación, pero LiftEngine no diagnostica fatiga ni prescribe un deload automáticamente.

## Progreso

- La antigua tarjeta **Progresión recomendada** evoluciona a **Inteligencia de entrenamiento**.
- Se conserva el historial, PR y tabla de sesiones.
- Se añade un plan explícito de próxima sesión y señales de tendencia.

## Modo entrenamiento

- Cada ejercicio muestra una tarjeta compacta de **Próxima decisión**.
- Las sugerencias de peso y reps de cada serie se generan con el mismo motor utilizado en Progreso.
- En doble progresión, LiftEngine propone una sola repetición adicional total cuando corresponde, en lugar de inflar todas las series de golpe.
- Al subir carga, vuelve al extremo inferior del rango de repeticiones.
- Los valores sugeridos siguen apareciendo como placeholders y pueden modificarse antes de marcar la serie.
- Botón **¿Por qué?** con explicación detallada del razonamiento y sus limitaciones.
- Mejor lectura de ejercicios sin carga externa: se muestran reps en vez de “0 kg” y, al completar el techo, se recomienda ajustar dificultad “si aplica” en lugar de asumir que subir peso siempre es correcto.
- Protección para ejercicios con nombres de asistencia/contrapeso: LiftEngine no aumenta automáticamente el número de peso porque en esas máquinas más asistencia puede significar menos dificultad.

## Analytics

- Nueva sección **Próximas decisiones** dentro de Analítica de entrenamiento.
- Resume hasta seis ejercicios con su acción sugerida actual y prioriza señales que requieren revisión.

## Robustez y UX

- Si existe un objetivo de RIR pero la última sesión no tiene RIR registrado, LiftEngine no recomienda automáticamente aumentar carga solo por llegar al techo de reps; pide confirmar el esfuerzo.
- Para recomendar subir carga se exige completar el número de series objetivo, no solo una serie en el máximo del rango.
- Se corrigió el fondo del diálogo personalizado para usar `var(--card)` en todos los temas.
- `intelligence.js` se añadió al app shell del Service Worker para funcionamiento offline.

## Datos / Firebase

- No cambia `DATA_SCHEMA_VERSION`.
- No cambia `CLOUD_SCHEMA_VERSION`.
- No se requieren reglas nuevas de Firestore.
