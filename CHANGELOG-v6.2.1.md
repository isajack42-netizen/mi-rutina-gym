# LiftEngine v6.2.1 — Desktop Polish

Fecha: 2026-10-05

## Armonía visual del workspace

- La acción **Entrenar** deja de aparecer como botón aislado encima del contenido principal en escritorio.
- Se mueve a la parte inferior de la sidebar como una acción secundaria, más coherente con el enfoque analítico de la versión web.
- Cuando hay una sesión activa, la misma zona cambia a **Continuar** y muestra la rutina en curso.

## Marco de escritorio

- Sidebar y área principal comparten ahora el mismo alto visible.
- El escritorio conserva un margen superior e inferior simétrico.
- La columna principal usa scroll interno, evitando que las tarjetas visualmente “choquen” contra el borde inferior de la ventana.
- En pantallas de poca altura se reduce el margen de forma proporcional para conservar espacio útil.

## Compatibilidad

- Sin cambios de datos, Firestore, IndexedDB, métricas ni Training Intelligence.
- Sin cambios en la experiencia móvil.
- Compatible con v6.2.0.
