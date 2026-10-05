# LiftEngine v5.7.2 — Dialog Reliability Hotfix

- Corrige el diálogo de eliminación de entrenamiento que podía permanecer visible en iOS/Safari.
- Los diálogos ahora se cierran al confirmar, cancelar, tocar fuera, pulsar Escape o cambiar de pestaña.
- El contenido del diálogo se limpia al cerrarse para evitar estados visuales residuales.
- El foco se gestiona con `preventScroll` para evitar saltos de página en Safari móvil.
- El backdrop respeta `100dvh` y las safe areas de iPhone.
- No cambia datos, IndexedDB ni reglas de Firebase.
