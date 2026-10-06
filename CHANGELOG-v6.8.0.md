# LiftEngine v6.8.0 — Desktop Design System & Dashboard Refinement

Fecha: 2026-10-05

## Objetivo

Esta versión no añade funciones nuevas. Su objetivo es hacer que la experiencia web se sienta como un producto de escritorio coherente y terminado, reduciendo ruido visual sin alterar la lógica de entrenamiento.

## Sistema visual desktop

- Nueva capa de tokens visuales específicos para escritorio:
  - bordes de menor contraste,
  - superficies más ligeras,
  - radios consistentes,
  - espaciado común.
- La estructura y los datos existentes se conservan.
- Los cambios se aplican únicamente a partir de 1200 px.

## Sidebar

- Estado activo menos dominante.
- Se reemplaza el bloque claro por una superficie sutil con una línea lateral de acento.
- Hover, sincronización y acción Entrenar comparten el mismo lenguaje visual.
- La navegación conserva foco visible y accesibilidad.

## Resumen

- El Plan semanal pasa a actuar visualmente como el hero del dashboard.
- La Inteligencia / Próxima decisión queda en una segunda jerarquía.
- Los KPI abandonan la apariencia de tabla cerrada y usan divisores más ligeros.
- La tarjeta de “Esta semana” deja de estirarse para igualar artificialmente la altura de “Últimos entrenamientos”.
- Los entrenamientos recientes se muestran como filas editoriales, no como tarjetas dentro de tarjetas.
- Estados vacíos ocupan solo el espacio necesario.

## Progreso

- La navegación interna adopta el mismo patrón visual que la sidebar.
- El elemento activo usa una superficie tenue y línea lateral, evitando el bloque claro de alto contraste.
- El explorador de ejercicios conserva selección visible pero más discreta.

## Calendario

- Celdas y selección usan menos contraste.
- El día seleccionado deja de convertirse en una caja clara dominante.
- Planeado, realizado y selección mantienen sus estados sin competir entre sí.

## Rutinas, Registro y Modales

- Bordes secundarios más suaves.
- Menos sensación de “rectángulo dentro de rectángulo”.
- Hover de rutinas y foco de inputs más consistentes.
- Modales adoptan la misma profundidad y radio que el workspace.

## Responsive

- La experiencia móvil no se rediseña en esta versión.
- Toda la capa principal de v6.8 está protegida por `@media(min-width:1200px)`.

## Compatibilidad

- Sin cambios de Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Sin cambios de lógica de entrenamiento, planificación o métricas.
