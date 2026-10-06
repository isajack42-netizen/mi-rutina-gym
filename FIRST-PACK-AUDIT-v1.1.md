# LiftEngine v1.1 — First Pack Audit

Fecha: 2026-10-06  
Rama: `v1.1-exercise-library`  
Versión de desarrollo: `1.1.0-alpha.1`

## Alcance

Auditoría del primer pack de 15 ejercicios de Exercise Library, incluyendo datos, taxonomía, aliases, relaciones, assets, navegación, accesibilidad, integración con entrenamiento, PWA/offline, cache versioning y capacidad de expansión.

## Hallazgos corregidos

1. **Navegación de escritorio** — la rejilla base seguía en cinco columnas después de añadir la sexta pestaña.
2. **Estado editorial** — Press banca mantenía etiquetas de piloto pese a que su pack ya estaba listo.
3. **Taxonomía** — Cable fly se clasificaba como horizontal push aunque su gesto principal es aducción horizontal del hombro.
4. **Músculos estabilizadores** — se añadió trapecio superior donde mejora la representación del trabajo escapular.
5. **Modal sobre entrenamiento** — el entrenamiento queda `inert` mientras la ficha técnica está abierta y recupera interacción al cerrar.
6. **Escalabilidad de CI** — el gate exigía exactamente 15 archivos, lo que habría roto automáticamente una futura expansión.
7. **Fiabilidad PWA** — 185 recursos de biblioteca estaban dentro del app shell crítico. Ahora el núcleo instala de forma independiente y la biblioteca se descarga en un warmup no crítico.
8. **Aislamiento de versión** — v1.1 usa `1.1.0-alpha.1` para no compartir cachés con `main` 1.0.0-rc.1.
9. **Relaciones editoriales** — se eliminaron repeticiones del mismo ejercicio entre variantes, sustituciones y relacionados.

## Guardrails añadidos

El auditor exige que el First Pack base:

- conserve sus 15 IDs originales aunque el catálogo crezca;
- mantenga media `ready`;
- tenga contenido `reviewed` o `ready`;
- tenga estado de planificación `ready`;
- mantenga índice y ficha canónica sincronizados;
- no repita relaciones entre categorías;
- incluya contenido mínimo útil (resumen, beneficios, setup, cues y seguridad);
- mantenga assets válidos y existentes;
- mantenga los recursos educativos fuera del app shell crítico;
- mantenga consistente la versión de desarrollo.

## Límites de esta auditoría

La automatización no sustituye una inspección visual en dispositivos físicos ni una revisión biomecánica especializada de cada ilustración. Antes de promover v1.1 se mantiene una fase de aceptación real en móvil/escritorio y una revisión de la fidelidad visual del sistema gráfico.
