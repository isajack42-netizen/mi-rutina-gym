# LiftEngine v6.3.1 — Workspace Stability

Fecha: 2026-10-05

## Progreso en escritorio

- Rendimiento, Inteligencia, Analítica y Cuerpo comparten ahora una altura mínima visual estable.
- El panel activo ya no se encoge o expande bruscamente al cambiar de subpestaña.
- El Explorador de ejercicios usa la misma altura de workspace que el panel principal.
- En pantallas de poca altura se conserva la misma proporción usando el marco reducido del escritorio.
- El contenido puede seguir creciendo cuando realmente lo necesita; no se fuerza una altura fija que corte información.

## Versión visible

- El rótulo de versión del dashboard deja de estar escrito a mano.
- Ahora se alimenta directamente de `LIFTENGINE_VERSION`, evitando que futuras versiones muestren un número atrasado.

## Compatibilidad

- Sin cambios de datos, Firestore o IndexedDB.
- Sin cambios en cálculos, PR o Training Intelligence.
- Sin cambios funcionales en móvil.
