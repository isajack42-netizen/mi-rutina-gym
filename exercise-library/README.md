# Exercise Library

Esta carpeta contiene la base editorial y de datos de **LiftEngine v1.1 — Exercise Library** (`1.1.0-alpha.1` en la rama de desarrollo).

## Estructura

- `schema.json`: contrato de una ficha.
- `taxonomy.json`: vocabulario canónico.
- `planned-exercises.json`: primer lote.
- `exercises/`: fichas canónicas.
- `VISUAL-STANDARD.md`: lenguaje visual de ilustraciones.

La biblioteca todavía no forma parte del runtime de 1.0. El objetivo de la rama es construirla y validarla de forma aislada antes de integrarla.

## Estado actual

- Foundation: completa.
- Pilot UI: completa.
- Biblioteca navegable: completa.
- First Pack: **15/15 ejercicios ready**.
- Assets: paquetes vectoriales propios integrados y disponibles offline.
- Referencia maestra: `bench-press-barbell`.

## Validación

Ejecutar:

`node scripts/exercise-library-audit.mjs`

El gate comprueba IDs, aliases, taxonomía, relaciones, pasos, errores y rutas de media.
