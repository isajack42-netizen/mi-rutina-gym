# LiftEngine v6.1.3 — UX Polish

Fecha: 2026-10-05

## Navegación y accesibilidad

- Las pestañas principales y las vistas internas de Progreso ahora usan relaciones `aria-controls` / `aria-labelledby` completas.
- Se añadió navegación por teclado con Flecha izquierda/derecha, Home y End.
- Al cambiar de sección desde la navegación principal, la vista vuelve al inicio para evitar aterrizar a mitad de una pantalla distinta.
- Los modales genéricos enfocan automáticamente el primer control útil, atrapan el foco mientras están abiertos y devuelven el foco al elemento que los abrió al cerrar.

## Modo Entrenamiento

- La siguiente serie pendiente se destaca visualmente con el estado **SIGUE**.
- Si se pulsa **Empezar**, la serie activa se distingue como **EN CURSO**.
- Los chips superiores ahora exponen el nombre real del ejercicio y su estado a tecnologías de asistencia y tooltip.

## Feedback y estados vacíos

- Los mensajes toast ajustan su duración según la longitud del texto; avisos largos ya no desaparecen demasiado rápido.
- “Últimos entrenamientos” usa botones reales accesibles en lugar de contenedores clicables.
- El estado vacío de Resumen ofrece iniciar un entrenamiento.
- El estado vacío de Rutinas ofrece crear la primera rutina.
- Registro explica con mayor claridad cómo añadir contenido cuando el día está vacío.

## Compatibilidad

- Sin cambios en datos, Firestore, IndexedDB, métricas o Training Intelligence.
- Sin migraciones.
- Compatible con v6.1.2.
