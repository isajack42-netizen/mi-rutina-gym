# LiftEngine v5.4.0 — Fase 4: Arquitectura

## Cambios

- Se dividió el antiguo `app.js` de más de 2,000 líneas en archivos por dominio bajo `/js`.
- Se creó `js/version.js` como fuente de versión compartida entre la aplicación y el Service Worker.
- Se separaron configuración, núcleo/persistencia, registro/progresión, dashboard, herramientas, rutinas, avisos, modo entrenamiento y bootstrap.
- `app.js` queda como cargador de compatibilidad para HTML antiguo almacenado en caché.
- Se añadió `ARCHITECTURE.md` con el mapa de responsabilidades y orden de carga.
- Se actualizó la caché PWA a v5.4.0.

## Compatibilidad

No cambia el esquema de datos (`DATA_SCHEMA_VERSION = 2`) ni las claves de `localStorage`, Firestore, CSV o JSON. La actualización está diseñada para ser transparente para los datos existentes.
