# Auditoría de v5.8.0 — Training Intelligence

## Alcance

Se revisó la integración del nuevo motor con `logbook.js`, `analytics.js`, `training.js`, `app.js`, `sw.js`, HTML y CSS. El motor no escribe datos propios: deriva decisiones a partir del historial, las rutinas y el RIR existente.

## Principios aplicados

1. **Explicable:** cada acción tiene razones visibles.
2. **Conservador:** una señal de estancamiento o caída no equivale a diagnóstico de fatiga.
3. **Mismo motor en todas las pantallas:** Progreso, Analytics y Modo entrenamiento no deben dar consejos distintos para el mismo historial/contexto.
4. **Objetivo contextual:** si el ejercicio aparece en varias rutinas, se usa la rutina activa/categorizada. Si no existe contexto único, no se inventa una prescripción.
5. **Volumen prescrito:** una sola serie al máximo no basta para recomendar subir carga cuando la rutina exige más series.
6. **RIR:** si el objetivo exige RIR y falta en la última sesión, la recomendación de aumento se vuelve conservadora.

## Casos automatizados comprobados

### Doble progresión — subir carga
Historial culminando en 3×12 @ RIR 2 con objetivo 3×8–12 @ RIR 1–2:

- acción: `increase`;
- siguiente carga base: + incremento práctico;
- reps sugeridas: 8/8/8.

### Doble progresión — sumar reps
Última sesión 12/11/10 dentro del rango:

- acción: `reps`;
- carga mantenida;
- objetivo de la siguiente sesión: 12/11/11 (una repetición total adicional).

### Carga excesiva
Última sesión por debajo del mínimo con RIR 0:

- acción: `decrease`;
- reducción aproximada del 5%;
- regreso al extremo inferior del rango.

### Meseta
Varias sesiones con el mismo e1RM:

- la repetición del mismo máximo no cuenta como un “nuevo máximo”;
- se activa señal de meseta tras 3 sesiones sin mejora significativa (>0.5%).

### Volumen incompleto
Una sola serie de 12 cuando la rutina prescribe 3 series:

- no se recomienda subir carga;
- primero se pide completar el volumen objetivo.

### Objetivo ambiguo
Mismo ejercicio con rangos distintos entre rutinas sin contexto:

- no se crea una recomendación única;
- se pide definir el contexto de rutina.

### Ejercicio sin carga externa
3×12 con peso 0:

- las series sí cuentan para la decisión de reps/RIR;
- no se calcula e1RM artificial;
- se propone aumentar dificultad “si aplica”.

### Ejercicio asistido / contrapeso
Si el nombre indica asistencia (por ejemplo, dominadas asistidas), llegar al techo del rango no genera una subida automática del número de peso. La app mantiene el valor y pide ajustar manualmente la asistencia en la dirección adecuada.

## Comprobaciones técnicas

- `node --check` sobre `app.js`, `sw.js` y todos los módulos JS.
- 78 handlers inline detectados; todos tienen función correspondiente.
- `intelligence.js` incluido en el cargador y en el app shell offline.
- IDs estáticos de `index.html` sin duplicados.
- Renderizado de texto del motor escapa contenido de nombres/razones antes de insertarlo en HTML.

## Limitaciones deliberadas

- e1RM sigue siendo una estimación (Epley), no una medición directa de fuerza máxima.
- LiftEngine no conoce técnica, dolor, sueño, nutrición, estrés ni recuperación salvo lo que el usuario registre indirectamente.
- No existe deload automático.
- No intenta inferir si “más peso” en una máquina asistida significa más o menos dificultad.
- La disponibilidad real de discos/mancuernas/máquinas puede requerir redondear manualmente la carga sugerida.
- La recomendación se calcula antes de la sesión; todavía no modifica dinámicamente el plan en mitad de una serie basándose en velocidad o técnica, porque esos datos no existen.

## Estado

No se detectaron cambios de esquema ni necesidades nuevas de migración. La versión se puede instalar sobre v5.7.2 conservando IndexedDB y Nube v2.
