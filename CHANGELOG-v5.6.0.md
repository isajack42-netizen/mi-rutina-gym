# LiftEngine v5.6.0 — Data Performance

Versión centrada en rendimiento, almacenamiento local y escalabilidad de Nube v2. No cambia el flujo principal de uso ni requiere nuevas reglas de Firestore.

## IndexedDB como almacenamiento local principal

- El historial local se migra automáticamente desde `localStorage` a IndexedDB la primera vez que se abre v5.6.0.
- Los datos se guardan por día en el object store `days`; la configuración vive separada en `settings`.
- El snapshot histórico de `localStorage` se conserva como red de seguridad de compatibilidad, pero deja de reescribirse en el funcionamiento normal.
- Si IndexedDB no está disponible, LiftEngine vuelve automáticamente al almacenamiento heredado en `localStorage`.
- Ajustes muestra el motor local activo.

## dirtyDays

- Cada modificación marca únicamente las fechas afectadas.
- Una serie, peso, medida, nota o categoría ya no obliga a revisar todos los días del historial antes de escribir en Firestore.
- Los cambios de configuración usan un marcador independiente.
- Los marcadores pendientes se conservan entre recargas para que un cambio offline no se pierda.
- Existe un fallback por hashes para cambios pendientes creados por v5.5.x.

## Sincronización incremental de Nube v2

- Los documentos diarios escritos por v5.6.0 incluyen `serverUpdatedAt` mediante `serverTimestamp()` de Firestore.
- Después del primer pull completo, LiftEngine consulta solo documentos modificados desde el cursor de sincronización.
- El cursor conserva segundos y nanosegundos del Timestamp de Firestore y usa una consulta inclusiva (`>=`) para evitar perder documentos con el mismo timestamp.
- Se mantiene un pull completo periódico cada 24 horas como red de seguridad y para detectar cambios de clientes antiguos v5.5.x que todavía no escriben `serverUpdatedAt`.
- El documento raíz de configuración continúa consultándose en cada sincronización, ya que es pequeño.

## Escrituras locales agrupadas

- Borradores del modo entrenamiento y notas usan escrituras IndexedDB brevemente agrupadas para evitar una transacción por cada toque o pulsación de tecla.
- Una sincronización explícita sigue forzando la persistencia local antes de escribir en la nube.

## Compatibilidad

- `cloudSchemaVersion` sigue siendo 2.
- No es necesario publicar reglas nuevas de Firestore al actualizar desde v5.5.1.
- Los backups JSON mantienen el mismo formato de datos.

- La sincronización manual fuerza un pull completo para comprobar toda la nube y mantener compatibilidad con clientes v5.5.x que no escribían `serverUpdatedAt`.
