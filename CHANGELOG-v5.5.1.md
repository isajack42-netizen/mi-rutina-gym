# LiftEngine v5.5.1 — Reliability

Versión enfocada en resiliencia, borradores, modo offline y consistencia de datos.

## Sincronización y borradores

- Los borradores locales (rutina cargada, sesión copiada y series pendientes del modo entrenamiento) se conservan al resincronizar Nube v2.
- Los borradores no cuentan para estadísticas ni se escriben como entrenamiento completado en Firestore.
- Los conflictos que no logran confirmar una escritura ya no pueden terminar mostrando falsamente “Sincronizado”.
- Al volver a primer plano después de 45 s se consulta la nube para recoger cambios realizados en otro dispositivo.
- Los alias recibidos desde otro dispositivo migran inmediatamente historial, rutinas, notas y asignaciones musculares.

## Offline / Service Worker

- `version.js` tiene fallback offline y el Service Worker puede recuperar la versión ignorando query strings.
- El cache de versión ya no acumula una entrada distinta por cada `?ts=...`.
- LiftEngine solo elimina caches cuyo nombre empieza por `liftengine-`; no toca caches de otras PWAs del mismo dominio.

## Modo entrenamiento

- El descanso activo se persiste dentro de `gymTrainState`: inicio real, fin objetivo y estado de alarma.
- Al recargar o reabrir la PWA, el contador se recupera y continúa, incluido el tiempo extra después de cero.

## Descansos

Un único parser interpreta y normaliza correctamente formatos como:

- `90`, `90 s`
- `1:30`
- `1.5 min`
- `2 min`
- `2-3 min`
- `120-180 s`

La representación visible sigue homogeneizada en segundos.

## Composición corporal

- Editar una medición y cambiar su fecha ya no deja duplicado el registro original.
- “Cambio 30 días” solo se calcula cuando existe cobertura temporal suficiente.
- El cambio de cada medida (cintura, pecho, brazo, muslo, cadera) usa la primera y última observación que realmente contengan esa medida.

## Rutinas, alias y músculos

- Una configuración vacía elegida por el usuario ya no hace reaparecer automáticamente Push/Pull/Legs, alias o músculos predeterminados al recargar.
- Los backups/restauraciones respetan también configuraciones intencionalmente vacías.
- Los ejercicios guardados desde el editor de rutinas pasan por `normalizeName()`.
- Añadir un alias aplica la migración inmediatamente, incluyendo `customMuscles`.

## CSV

- Se exportan fechas que solo contienen una nota de sesión.
- Los nombres de ejercicios con comas se conservan mediante el escapado CSV correcto.

## Progreso

- Varias entradas del mismo ejercicio en una misma fecha se agrupan como una sola sesión lógica.
- La gráfica tampoco duplica la misma fecha por tener varias entradas del ejercicio.
