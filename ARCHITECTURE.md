# Arquitectura de LiftEngine

Desde v5.4.0 el JavaScript deja de vivir en un único archivo monolítico y se separa por dominio, manteniendo el mismo runtime y los mismos datos para minimizar el riesgo de regresiones.

## Orden de carga

1. `js/version.js` — versión única compartida por la app y el Service Worker.
2. `js/config.js` — Firebase y versión del esquema de datos.
3. `js/core.js` — estado, sanitización, persistencia local/nube, unidades y tema.
4. `js/logbook.js` — registro manual, sesiones, e1RM y progresión.
5. `js/dashboard.js` — resumen, PR, calendario y composición corporal.
6. `js/tools.js` — calculadora de discos, temporizador, CSV, ajustes, catálogos y backup.
7. `js/routines.js` — creación y gestión de rutinas.
8. `js/notifications.js` — avisos de descanso y teclado móvil.
9. `js/training.js` — modo entrenamiento.
10. `js/bootstrap.js` — inicialización y listeners globales.

Los archivos son scripts clásicos y comparten el entorno global de la página. Esto es intencional en v5.4.0: permite dividir el monolito sin reescribir de golpe el estado y las dependencias internas. Una migración futura a módulos ES con imports/exports puede hacerse por partes.

`app.js` permanece únicamente como cargador de compatibilidad para una pestaña que aún tenga un `index.html` antiguo en caché. El `index.html` actual ya no lo utiliza.

## Regla de mantenimiento

- Estado/persistencia: `core.js`.
- Registro/progresión: `logbook.js`.
- Métricas/dashboard: `dashboard.js`.
- Utilidades visibles y archivos: `tools.js`.
- Rutinas: `routines.js`.
- Modo entrenamiento: `training.js`.
- Arranque: `bootstrap.js`.

Evitar volver a colocar funcionalidad nueva en `app.js`.
