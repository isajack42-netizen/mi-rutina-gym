# LiftEngine v5.6.1 — Training Controls

## Cambios

- Los botones de peso del Modo entrenamiento ahora ajustan **±1 kg** cuando la unidad activa es KG.
- Si cambias la unidad a LB, los mismos controles ajustan **±1 lb** por toque.
- Las repeticiones ahora tienen sus propios botones **− / +** y cambian de **1 repetición en 1**.
- Los botones de repeticiones usan la sugerencia de la serie como punto de partida cuando el campo todavía está vacío.
- Peso y repeticiones nunca bajan de cero.
- Editar con los steppers una serie ya completada vuelve a sincronizar esa modificación con Nube v2; los borradores siguen guardándose solo localmente hasta completar la serie.
- Se ajustó la cuadrícula del Modo entrenamiento para que ambos steppers sigan siendo cómodos en móvil.

## Compatibilidad

- Sin cambios de esquema de datos.
- Sin cambios en reglas de Firestore.
- Compatible con IndexedDB y Nube v2 de v5.6.0.
