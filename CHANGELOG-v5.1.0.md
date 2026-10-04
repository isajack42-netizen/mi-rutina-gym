# LiftEngine v5.1.0 — Fase 2: Progresión y récords

## Cambios principales

### Sistema de PR
- PR de peso máximo.
- PR de repeticiones máximas.
- PR de e1RM máximo (Epley).
- Los PR se calculan dinámicamente a partir del historial, sin cambiar el formato de los datos guardados.
- El dashboard y el resumen de entrenamiento muestran el tipo de récord conseguido.

### Progresión inteligente
- Considera el rango de repeticiones de la rutina.
- Considera el RIR registrado cuando existe.
- Sugiere subir carga cuando se alcanza el extremo superior del rango con esfuerzo compatible con el objetivo.
- Sugiere mantener la carga cuando el esfuerzo fue demasiado alto.
- Sugiere sumar repeticiones cuando todavía hay margen dentro del rango.
- Puede sugerir una reducción aproximada del 5% cuando se queda por debajo del rango con RIR bajo.
- Calcula incrementos pequeños según la carga utilizada.

### Modo entrenamiento
- Las sugerencias de la sesión utilizan ahora el motor de progresión inteligente.
- Al finalizar un entrenamiento, los PR detectados se muestran por tipo.

### Corrección adicional
- El e1RM de una sesión ahora toma el máximo e1RM real de sus series, en lugar de derivarlo de la serie con mayor volumen.

## Compatibilidad
- No se cambia la estructura de los registros existentes.
- La unidad interna continúa almacenándose en kg.
- Service Worker actualizado a v5.1.0.
