# LiftEngine — Auditoría integral previa a v6.0.0

Fecha: 2026-10-05  
Base auditada: `main` · LiftEngine v5.9.0

## Resultado ejecutivo

LiftEngine está en un punto suficientemente estable para iniciar v6.0.0. No se detectó en esta auditoría estática un fallo crítico de integridad de datos comparable a los corregidos en v5.4–v5.6.

La prioridad de v6 no debe ser añadir muchas funciones aisladas, sino consolidar arquitectura, métricas, objetivos y dashboard sobre la base ya estable.

## Validaciones realizadas

- Todos los JavaScript de runtime pasan validación sintáctica.
- `index.html` no contiene IDs duplicados.
- Se localizaron 121 handlers inline/dinámicos; los targets de aplicación encontrados están definidos. Los únicos falsos positivos corresponden a métodos DOM como `preventDefault`, `closest`, `getElementById` y `stopPropagation`.
- `main` está en v5.9.0.
- Nube v2, IndexedDB, dirty days, borradores y conflictos por día permanecen presentes.
- No hay cambios requeridos en reglas de Firestore para comenzar v6.

## Fortalezas actuales

1. Persistencia por día alineada entre IndexedDB y Firestore.
2. Tombstones para evitar resurrección silenciosa de días eliminados.
3. Borradores de entrenamiento protegidos durante pulls.
4. Sincronización incremental con pull completo periódico.
5. Sanitización explícita para registros, medidas, rutinas, aliases y músculos.
6. Motor de Training Intelligence separado de la UI.
7. Analytics aislado de fallos secundarios.
8. Versión runtime centralizada en `js/version.js`.
9. Service Worker versionado y limitado a caches `liftengine-*`.
10. Flujo GitHub con ramas y PR ya operativo.

## Hallazgos de arquitectura

### A1 · `core.js` concentra demasiadas responsabilidades — prioridad alta

`js/core.js` tiene aproximadamente 1,185 líneas, 65 KB y más de 100 funciones declaradas.

Actualmente contiene:
- estado global;
- autenticación;
- sanitización;
- migraciones;
- IndexedDB orchestration;
- localStorage metadata;
- Firestore legacy;
- Firestore v2;
- conflictos;
- unidades;
- tema;
- diálogos.

No está roto, pero es el principal riesgo de mantenimiento. v6 debe separarlo gradualmente, sin reescritura total.

### A2 · Renderizado global acoplado — prioridad alta

`refreshAll()` vive actualmente en `js/routines.js`, aunque refresca toda la aplicación.

Además ejecuta:

`updateChart(); renderProgressionPanel();`

pero `updateChart()` ya invoca `renderProgressionPanel()`. Esto duplica trabajo y hace más difícil razonar sobre el ciclo de render.

v6 debe mover la orquestación de UI a un módulo neutral y evitar renders duplicados.

### A3 · Esquema de settings repetido en varios lugares — prioridad alta

La misma configuración se serializa/sanitiza en:
- `buildSettingsContent()`;
- aplicación de nube;
- migración legacy;
- backup JSON;
- importación JSON;
- backups de migración.

Esto aumenta el riesgo de olvidar un campo al añadir nuevas preferencias. v6 debe tener una única definición de settings y funciones de serialize/deserialize.

### A4 · Semántica de métricas mejorable — prioridad media/alta

Actualmente:
- menos volumen/series puede mostrarse como negativo;
- más volumen puede mostrarse como positivo;
- bajar peso/cintura se pinta como positivo y subir como negativo mediante `trendClass()`.

Sin un objetivo explícito del usuario, esas direcciones no son universalmente buenas o malas. v6 debe separar:
- cambio;
- progreso;
- cumplimiento del objetivo.

Por defecto, composición corporal debe ser neutral hasta que exista un objetivo.

### A5 · Dashboard y Analytics duplican interpretación — prioridad media

Resumen, rendimiento, Analytics e Intelligence calculan distintas vistas sobre los mismos datos.

v6 debe crear una capa común de métricas derivadas para que:
- Dashboard muestre síntesis;
- Progreso muestre detalle;
- Intelligence decida acción;
- no existan reglas paralelas incompatibles.

### A6 · Dependencia fuerte del entorno global — prioridad media

El proyecto usa scripts clásicos y variables globales. Funciona y ha demostrado compatibilidad con la PWA, por lo que v6 NO debe hacer una migración masiva a ES modules.

Sí conviene reducir acoplamiento mediante namespaces/servicios internos y contratos explícitos entre módulos.

### A7 · Falta validación automática en GitHub — prioridad alta

Hasta v5.9 la validación depende de auditorías manuales.

v6 debe añadir CI mínimo para:
- sintaxis JS;
- IDs HTML duplicados;
- handlers sin target;
- consistencia del loader y Service Worker;
- archivos runtime esperados.

### A8 · Código histórico y documentación acumulada — prioridad baja

El root contiene numerosos `AUDIT-*` y `CHANGELOG-*`. Son útiles como historial, pero ya generan ruido.

En v6 conviene mover documentación histórica a `docs/history/` sin eliminarla.

### A9 · CSS histórico acumulativo — prioridad media/baja

`styles.css` ronda 49 KB / 695 líneas y conserva bloques de versiones anteriores. No es un problema de rendimiento grave, pero sí de mantenimiento.

Se detectó además un literal histórico `\\n\\n` antes de un comentario de diálogos. Debe limpiarse.

No recomiendo dividir CSS en muchos archivos en la primera fase de v6; primero conviene limpiar y agrupar.

## Alcance recomendado para v6

v6.0.0 debe ser una versión de consolidación, no una reescritura.

Prioridad:
1. CI y contratos internos.
2. Separación progresiva del núcleo.
3. Modelo unificado de settings/objetivos.
4. Métricas derivadas comunes.
5. Dashboard definitivo.
6. Semántica neutral/dirigida por objetivos.
7. Regresión de backups, nube, entrenamiento e Intelligence.
8. Limpieza de documentación y código heredado.

## Fuera de alcance inicial

- Backend propio.
- Web Push garantizado.
- Migración completa a framework.
- Reescritura total a ES modules.
- Eliminación inmediata de compatibilidad legacy.
- Cambios destructivos de Firestore.
