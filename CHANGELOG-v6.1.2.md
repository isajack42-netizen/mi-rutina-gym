# LiftEngine v6.1.2 — Training Safety

Fecha: 2026-10-05

## Series pendientes (pérdida silenciosa de datos)

- Al terminar el entrenamiento, las series con repeticiones escritas pero **sin marcar como hechas** ya no se descartan en silencio.
- El resumen final muestra un aviso con el número de series pendientes y permite **Guardar y terminar**, **Descartar** o **Seguir**.
- Antes de calcular el resumen se guarda como borrador lo que el usuario dejó escrito en la pantalla visible, aunque no haya salido del campo.
- Tras terminar, un mensaje indica cuántas series pendientes se incluyeron o se descartaron.
- Las series completamente vacías siguen descartándose.

## Descanso sin pulsar «Empezar»

- Ya no se bloquea marcar una serie mientras corre el descanso. Antes la serie quedaba sin registrar y solo aparecía un aviso breve.
- Si el usuario pulsa **Empezar**, el descanso se mide con precisión como hasta ahora.
- Si marca la serie directamente, el descanso se guarda como **estimado** y se muestra con «≈». Una sola vez por sesión se explica cómo medirlo con precisión.
- Desmarcar una serie elimina también su descanso estimado.
- El indicador de estimado se conserva al sincronizar, hacer backup, restaurar o editar desde Registro.

## Calidad

- Los cálculos de cierre y descanso se extrajeron a funciones puras (`trainPendingSets`, `trainApplyEnd`, `trainRestResult`) para poder probarlas.
- Nuevas regresiones: pendientes detectadas, descartar, guardar, sin decisión explícita no se guarda, descansos medidos/estimados y descansos menores de 5 s.
- Nuevos guardarraíles estáticos contra el bloqueo del descanso, contra cerrar sin decidir sobre las pendientes y contra perder el indicador «≈».

## Compatibilidad

- Sin cambios en reglas de Firestore ni en Cloud Schema v2.
- `restEstimated` es un campo opcional; los clientes anteriores lo ignoran.
- Sin cambios físicos en IndexedDB.
