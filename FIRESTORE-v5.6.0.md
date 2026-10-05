# Firestore en LiftEngine v5.6.0

No es necesario cambiar las reglas publicadas para v5.5.0/v5.5.1.

## Cambio interno

Los documentos `userData/{uid}/days/{fecha}` escritos por v5.6.0 añaden:

- `serverUpdatedAt`: `serverTimestamp()` de Firestore.

Se utiliza exclusivamente para la sincronización incremental. Los documentos anteriores sin ese campo siguen siendo válidos.

## Compatibilidad

El primer pull de v5.6.0 es completo. A partir de entonces los pulls normales consultan los días con `serverUpdatedAt` posterior o igual al cursor local. Cada 24 horas se realiza de nuevo un pull completo para compatibilidad y verificación.

Las reglas actuales que permiten al usuario autenticado leer/escribir su propia subcolección `days` ya cubren este campo y esta consulta.

## Comprobación manual

El botón **Reintentar sincronización** fuerza un pull completo. Esto permite comprobar toda la colección y recoger inmediatamente cambios hechos por un cliente v5.5.x que todavía no incluya `serverUpdatedAt`.
