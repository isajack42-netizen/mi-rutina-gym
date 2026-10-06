# LiftEngine 1.0 Personal Edition — Final Audit

Estado: **Release Candidate 1 (1.0.0-rc.1)**  
Base auditada: v6.12.0  
Fecha: 2026-10-05

## Regla de esta fase

La Personal Edition permanece congelada. Esta auditoría no añade funciones: solo corrige defectos, endurece contratos existentes y añade evidencia automática para evitar regresiones.

## Áreas auditadas

- Código runtime y orden de carga.
- Persistencia IndexedDB/localStorage y recuperación.
- Sincronización Firestore, conflictos, migración y estados de red adversos.
- Backups JSON, recovery files e importación parcialmente inválida.
- Modo Entrenamiento y continuidad de v6.12.
- Accesibilidad de diálogos, foco y aislamiento del workspace de entrenamiento.
- PWA/service worker y separación de assets por release.
- Reglas Firestore y aislamiento por UID.
- Estados extremos de tamaño de documento.
- Presupuesto estático de JS/CSS/HTML.
- Consistencia de contratos entre app.js, service worker y suites de pruebas.

## Hallazgos corregidos

### 1. Escrituras de nube que podían quedar vivas tras un timeout local

La migración v2, el probe de permisos y la escritura heredada todavía envolvían operaciones mutables de Firestore en timeouts locales. Una respuesta tardía podía hacer que el cliente considerara fallida una escritura que seguía viva.

Corrección: los timeouts se conservan únicamente para conexión/lecturas. Las escrituras se esperan hasta que Firestore confirme éxito o error.

### 2. Límite de documento de Firestore

Un respaldo artificialmente grande podía producir un día o settings cercanos/superiores al límite de documento y depender del rechazo remoto.

Corrección: antes de escribir se calcula el tamaño UTF-8 y se detiene la sincronización a 900 KiB, conservando los datos locales y un margen para metadata de Firestore.

### 3. Restauraciones con omisiones parciales poco visibles

La importación avisaba si se perdían días completos, pero no cuantificaba registros o series inválidas dentro de días válidos.

Corrección: el diálogo de restauración informa días, registros y series que el sanitizador tendría que omitir antes de pedir confirmación.

### 4. HTML dinámico del catálogo muscular

Nombres de grupos musculares provenientes de un respaldo podían llegar a un option sin escape HTML.

Corrección: valor y texto se escapan antes de renderizarse.

### 5. Accesibilidad y foco

El diálogo de confirmación no contenía Tab; los modales dinámicos no tenían siempre un nombre accesible; el Modo Entrenamiento visualmente cubría la app, pero el fondo seguía disponible para navegación asistiva/teclado.

Corrección: focus trap en diálogos, etiquetado automático por encabezado, retorno de foco solo a controles visibles, Modo Entrenamiento con semántica modal, foco contenido e interfaz de fondo inert mientras está abierto.

## Evidencia automática

La rama de auditoría pasa:

- JavaScript syntax.
- Static application validation: 22 archivos runtime, 144 IDs y 176 handlers.
- Suite de regresión.
- Reliability & Recovery: 26 escenarios con IndexedDB simulado y transporte de nube controlado.
- Friction Audit v6.12.
- Personal Edition Final Audit.

Presupuesto actual registrado por CI:

- Runtime JS: 380 KiB.
- CSS: 114 KiB.
- Sin dependencias npm de runtime.
- Límite CI: 450 KiB JS, 140 KiB CSS, 45 KiB HTML.

## Lo que la automatización no puede certificar

El RC no se promociona todavía a 1.0.0 definitivo porque faltan pruebas físicas que requieren tu entorno real:

1. iPhone/Safari y PWA instalada: teclado, safe areas, bloqueo/reanudación y una sesión completa.
2. Dos dispositivos autenticados con la misma cuenta: conflicto del mismo día, Conservar dispositivo, Usar nube y Cancelar.
3. Edición offline → reconexión real con Firestore.
4. Exportar respaldo y restaurarlo en un navegador/perfil secundario.
5. Escritorio Chrome y Brave: menús, modales, Modo Entrenamiento y resize.

Si esas pruebas no revelan fallos críticos o graves, el RC puede promoverse a **LiftEngine 1.0.0 Personal Edition** sin añadir funcionalidad.
