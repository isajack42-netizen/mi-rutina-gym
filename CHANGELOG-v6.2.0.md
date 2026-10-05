# LiftEngine v6.2.0 — Desktop Experience

Fecha: 2026-10-05

## Objetivo

Dar a LiftEngine una experiencia de escritorio propia sin crear una segunda aplicación ni cambiar el modelo de datos. Móvil conserva su flujo actual; el nuevo workspace se activa a partir de 1200 px.

## Shell de escritorio

- Navegación principal convertida en sidebar fija.
- Marca, sincronización, unidad, calculadora y ajustes permanecen accesibles en el rail lateral.
- El contenido principal aprovecha hasta 1600 px sin estirar artificialmente las tarjetas.
- Ajustes específicos para pantallas de poca altura y monitores amplios.

## Resumen

- El detalle de métricas se abre automáticamente en escritorio.
- Dashboard, semana, entrenamientos, rendimiento, distribución muscular y PR aprovechan el ancho disponible.

## Registro

- Diseño de dos columnas.
- Captura/edición a la izquierda.
- Registros del día a la derecha, visibles de forma sticky mientras se trabaja.

## Calendario

- Calendario e inspector del día se muestran simultáneamente.
- Las celdas son más altas en escritorio.
- Cada entrenamiento puede mostrar rutina, número de ejercicios y series directamente en la celda.
- El detalle del día permanece visible como panel lateral.

## Progreso

- Rendimiento, Inteligencia, Analítica y Cuerpo pasan a navegación contextual vertical.
- Se amplían gráficas y paneles para análisis en pantalla grande.

## Rutinas

- Nueva acción directa **Entrenar** en escritorio.
- Si ya existe una sesión activa, LiftEngine continúa esa sesión en lugar de reemplazarla silenciosamente.
- Tablas y controles aprovechan mejor el ancho disponible.

## Modo Entrenamiento

- Workspace de escritorio con rail lateral de ejercicios.
- Los chips muestran nombre completo del ejercicio en desktop.
- Área central dedicada a series.
- Durante el descanso aparece un panel contextual separado.
- Controles de navegación/fin permanecen visibles en la parte inferior.

## Compatibilidad

- Sin cambios de Firestore.
- Sin migración de IndexedDB.
- Sin cambios en métricas, PR o Training Intelligence.
- Mobile/tablet mantienen el layout existente.
