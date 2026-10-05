# LiftEngine v6.5.0 — Training History & Compare

Fecha: 2026-10-05

## Dirección

La versión web añade una vista dedicada a responder una pregunta distinta de Rendimiento y Analítica: **¿qué cambió entre dos bloques equivalentes de entrenamiento?**

## Historial

- Nueva subvista **Historial** dentro de Progreso, visible únicamente en escritorio.
- Filtros por:
  - periodo de 4, 8 o 12 semanas,
  - rutina,
  - ejercicio.
- Los filtros de ejercicio se limitan a ejercicios realmente registrados.
- Cada sesión del periodo actual muestra:
  - fecha,
  - rutina,
  - número de ejercicios,
  - series de trabajo,
  - volumen,
  - RIR promedio,
  - PR registrados.
- Al seleccionar una sesión se abre directamente esa fecha en Registro.

## Comparación de bloques

- El periodo actual se ancla en la sesión más reciente que cumple los filtros.
- Se compara contra un bloque anterior de exactamente la misma duración.
- Se comparan:
  - sesiones,
  - series de trabajo,
  - volumen promedio por sesión,
  - RIR promedio,
  - ejercicios distintos,
  - PR.
- Los cambios porcentuales solo aparecen cuando existe una base previa válida.
- Si no hay periodo anterior comparable, LiftEngine lo indica y evita porcentajes engañosos.

## Arquitectura

- Nuevo módulo `js/history.js`.
- El módulo se incorpora al loader y al Service Worker.
- El cálculo central se mantiene separado de la UI y cuenta con regresiones propias.

## Responsive

- Historial es una herramienta de escritorio (>=1200 px).
- En móvil y tablet no se añade una nueva subpestaña.
- Si se reduce la ventana mientras Historial está abierto, LiftEngine vuelve a Analítica automáticamente.

## Compatibilidad

- Sin cambios en Firestore.
- Sin migración de IndexedDB.
- Sin cambios de esquema.
- Todo se deriva del historial ya existente.
