# LiftEngine 1.0.0-rc.1 — Personal Edition Final Audit

Fecha: 2026-10-05

## Alcance

Release candidate de la Personal Edition. No añade funciones. Congela el producto y corrige hallazgos de código, datos, sincronización extrema y accesibilidad detectados durante la auditoría final.

## Correcciones

- Elimina timeouts locales de operaciones mutables de Firestore para impedir escrituras tardías/zombi.
- Añade guardia de 900 KiB antes de escribir documentos de día o configuración.
- La restauración JSON avisa también registros y series estructuralmente inválidos que serían omitidos.
- Escapa grupos musculares dinámicos al renderizar el catálogo.
- Atrapa Tab en diálogos de confirmación.
- Los modales dinámicos reciben nombre accesible desde su encabezado.
- El foco ya no intenta volver a controles ocultos.
- Modo Entrenamiento se expone como diálogo modal, contiene el foco y vuelve inert la aplicación de fondo.

## Puertas de validación

- Sintaxis runtime.
- Validación estática.
- Regresiones.
- 26 escenarios Reliability & Recovery.
- Friction Audit.
- Final Audit permanente con presupuestos de tamaño, guardrails de sincronización, backups, accesibilidad, PWA y reglas Firestore.

## Estado

Candidato técnicamente listo para validación física. No se declara 1.0.0 final hasta completar las pruebas reales de iPhone/PWA, dos dispositivos, offline/reconexión, restauración de backup y escritorio Chrome/Brave.
