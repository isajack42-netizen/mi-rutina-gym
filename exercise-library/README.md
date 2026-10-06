# Exercise Library

Esta carpeta contiene la base editorial y de datos de **LiftEngine v1.1 — Exercise Library**.

## Estructura

- `schema.json`: contrato de una ficha.
- `taxonomy.json`: vocabulario canónico.
- `planned-exercises.json`: primer lote.
- `exercises/`: fichas canónicas.
- `VISUAL-STANDARD.md`: lenguaje visual de ilustraciones.

La biblioteca todavía no forma parte del runtime de 1.0. El objetivo de la rama es construirla y validarla de forma aislada antes de integrarla.

## Estado actual

- Foundation: en implementación.
- Ejercicio piloto: `bench-press-barbell`.
- Assets del piloto: paquete vectorial propio listo e integrado para evaluación.

## Validación

Ejecutar:

`node scripts/exercise-library-audit.mjs`

El gate comprueba IDs, aliases, taxonomía, relaciones, pasos, errores y rutas de media.
