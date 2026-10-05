# LiftEngine v6.3.2 — Progress Alignment

Fecha: 2026-10-05

## Alineación superior

- La navegación interna de Progreso deja de arrancar desplazada hacia abajo.
- Rendimiento / Inteligencia / Analítica / Cuerpo, el Explorador y el panel principal comparten la misma línea superior.
- El comportamiento sticky se conserva, pero sin introducir un offset visual inicial.
- Se fuerza `align-self:start` para evitar diferencias de colocación entre columnas del grid.

## Compatibilidad

- Sin cambios de datos, Firestore o IndexedDB.
- Sin cambios en métricas, PR o Training Intelligence.
- Sin cambios funcionales en móvil.
