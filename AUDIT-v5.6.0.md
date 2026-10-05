# Auditoría técnica — LiftEngine v5.6.0

## Objetivos cerrados del roadmap v5.6

### 1. IndexedDB

**Estado: implementado.**

El historial deja de reserializarse completo en `localStorage` en cada edición. La memoria de trabajo sigue siendo el estado JavaScript global para mantener compatibilidad con el resto de la aplicación, mientras IndexedDB es la persistencia local principal.

Stores:

- `days`: un registro por fecha.
- `settings`: configuración local.
- `meta`: estado de migración.

La primera ejecución migra el snapshot v5.5.x. El snapshot heredado se conserva sin seguir creciendo para facilitar una reversión de emergencia.

### 2. dirtyDays

**Estado: implementado.**

Las escrituras normales de Nube v2 recorren `cloudDirtyDays`, no `allLocalDates()`. El barrido por hashes solo se mantiene como ruta de compatibilidad si existe `gymPendingSync` de una versión anterior pero no existen marcadores dirtyDays.

Las mutaciones principales pasan ámbitos explícitos a `saveToFirebase({days:[...]})` o `saveToFirebase({settings:true})`.

### 3. Sincronización incremental

**Estado: implementado.**

Los documentos modificados por v5.6 incorporan `serverUpdatedAt`. Los pulls incrementales consultan:

`serverUpdatedAt >= último cursor`

El cursor usa el Timestamp completo (segundos + nanosegundos), no el reloj del dispositivo. Esto evita depender de diferencias horarias entre PC y teléfono.

Un pull completo se conserva cada 24 h para:

- validar el estado completo;
- recoger escrituras hechas por versiones v5.5.x que no incluyen `serverUpdatedAt`;
- funcionar como mecanismo de autorreparación.

## Pruebas ejecutadas

- `node --check` sobre todos los archivos JavaScript runtime.
- Prueba aislada del almacenamiento IndexedDB con operaciones `put`, `delete`, `replace`, `settings`, `meta` y `clear`.
- Prueba de migración: `localStorage` v5.5.x -> IndexedDB y posterior recarga usando IndexedDB como fuente principal aunque el snapshot legado sea diferente.
- Prueba dirtyDays: con dos fechas en memoria, modificar una sola fecha provoca escritura únicamente de esa fecha.
- Prueba del cursor incremental: una respuesta Firestore con Timestamp más nuevo actualiza correctamente segundos/nanosegundos y utiliza consulta `>=`.
- Prueba de sincronización manual: **Reintentar sincronización** fuerza un pull completo aunque exista un cursor incremental válido.
- Prueba de merge incremental: una fecha remota modificada se actualiza sin reconstruir ni alterar fechas locales no modificadas.
- Prueba de preservación de borradores durante un pull completo.
- Auditoría estática de handlers y referencias de scripts.

## Limitaciones que permanecen deliberadamente

- LiftEngine todavía carga el historial local completo en memoria al arrancar. IndexedDB elimina el cuello de botella de serialización/escritura, pero no se ha implementado carga perezosa por rangos.
- El mapa `cloudMeta.days` sigue guardando una revisión/hash pequeña por fecha en `localStorage`; su crecimiento es mucho menor que el historial completo.
- Durante una transición en la que otro dispositivo siga en v5.5.x, sus cambios diarios pueden tardar hasta el siguiente pull completo periódico en aparecer si no se fuerza una sincronización manual. Actualizar ambos dispositivos a v5.6.0 elimina esta ventana.
- Firestore sigue siendo Nube v2 (documentos por día). No se requiere una nueva migración de datos.
