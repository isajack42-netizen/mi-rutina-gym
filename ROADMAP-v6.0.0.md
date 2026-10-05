# LiftEngine v6.0.0 — Plan de consolidación

## Objetivo

Convertir la base v5.9.0 en una versión 6 coherente, mantenible y orientada a decisiones, conservando compatibilidad con los datos actuales.

## Fase 1 — Foundation & Quality Gate

- Crear validación automática en GitHub Actions.
- Mover `refreshAll()` a una capa neutral de orquestación.
- Eliminar renders duplicados.
- Limpiar artefactos CSS históricos.
- Documentar contratos de módulos.
- Mantener v5.9.0 intacta en `main` hasta finalizar el PR.

Criterio de salida:
- CI verde.
- Sin cambios de esquema.
- Sin cambios funcionales visibles salvo correcciones neutras.

## Fase 2 — Settings & Goals

Crear un modelo único de preferencias.

Campos iniciales:
- unidad;
- tema;
- meta semanal;
- objetivo corporal opcional;
- objetivos numéricos opcionales.

El objetivo corporal debe poder quedar en modo neutral. La app no debe asumir que subir o bajar peso/cintura es positivo si el usuario no lo indicó.

Criterio de salida:
- settings se serializan desde una sola fuente.
- nube, IndexedDB y backup JSON usan el mismo contrato.
- backups v5 continúan importándose.

## Fase 3 — Metrics Engine

Crear una capa común de métricas derivadas para:
- sesiones;
- series efectivas;
- volumen;
- PR;
- e1RM;
- adherencia;
- frecuencia;
- tendencias;
- composición corporal.

Analytics y Dashboard deben consumir esta capa en lugar de recalcular reglas similares.

Criterio de salida:
- una definición por métrica;
- tests de casos sintéticos;
- sin discrepancias entre Dashboard y Progreso.

## Fase 4 — Dashboard v6

El Resumen debe responder, en este orden:

1. ¿Qué debo saber hoy?
2. ¿Estoy cumpliendo mi frecuencia?
3. ¿Qué está progresando?
4. ¿Qué debo hacer en la próxima sesión?
5. ¿Cómo cambia mi composición corporal respecto a mi objetivo?

Evitar duplicar toda la pantalla de Analytics.

Criterio de salida:
- lectura rápida;
- enlaces al detalle;
- no más de una interpretación principal por métrica.

## Fase 5 — Intelligence Integration

- Mantener el motor determinista y explicable.
- Usar métricas comunes.
- Mejorar confianza/madurez de recomendaciones.
- No diagnosticar fatiga.
- No prescribir deload automático sin contexto suficiente.

Criterio de salida:
- misma recomendación en Progreso, Analytics y Modo entrenamiento.
- pruebas desde 1 sesión hasta historial suficiente.

## Fase 6 — Regression & Release

Regresión mínima:
- login/logout;
- offline;
- registro manual;
- modo entrenamiento;
- descanso;
- PR;
- calendario;
- medidas/peso;
- CSV;
- backup/restore;
- nube móvil ↔ PC;
- conflicto de mismo día;
- borrado con tombstone;
- Analytics;
- Intelligence.

Al terminar:
- bump a v6.0.0;
- actualizar `ARCHITECTURE.md`;
- changelog final;
- merge a `main`.


## Estado de implementación

- ✅ Fase 1 — Foundation & Quality Gate
- ✅ Fase 2 — Settings & Goals
- ✅ Fase 3 — Metrics Engine
- ✅ Fase 4 — Dashboard v6
- ✅ Fase 5 — Intelligence Integration preservando el motor determinista existente
- 🟡 Fase 6 — Regresión automatizada completada; smoke test real pendiente después del despliegue en GitHub Pages

La regresión automatizada corre en GitHub Actions. Las pruebas visuales y de integración real con Safari/iPhone y sesión Firebase se validan tras publicar.
