# LiftEngine — cierre de Personal Edition

Estado actual: **LiftEngine 1.0.0-rc.1 Personal Edition**. Funciones congeladas. La auditoría técnica automatizable está cerrada; falta únicamente aceptación física en dispositivos reales antes de promover a 1.0.0.

## Cerrado

### v6.11 — Reliability & Recovery

Guardado verificable, transacción local conjunta, undo protegido, recuperación local/exportable, importaciones protegidas, sesiones recuperables, conflictos cancelables, pendientes durables, bloqueo de escritor y 26 escenarios controlados.

### v6.12 — Friction Audit

Recorrido de entrenamiento simplificado sin cambiar contratos de datos: inicio directo del plan, teclado móvil, autoavance seguro, acciones secundarias agrupadas, mejor navegación, targets táctiles y guardrails específicos.

### 1.0 Final Audit — automatizable

Auditoría de código, persistencia, sincronización, backups, estados extremos, accesibilidad, PWA y presupuesto de runtime.

Hallazgos corregidos:

- escrituras Firestore sin timeouts locales abandonables;
- guardia de tamaño antes del límite de documento;
- avisos de omisiones parciales al restaurar backups;
- escape de grupos musculares dinámicos;
- focus trap y nombres accesibles en diálogos;
- aislamiento de foco/fondo en Modo Entrenamiento.

Evidencia CI actual:

- 22 archivos runtime;
- 144 IDs;
- 176 handlers;
- regresiones existentes;
- 26 escenarios Reliability & Recovery;
- Friction Audit;
- Final Audit;
- 380 KiB JS runtime y 114 KiB CSS;
- cero dependencias npm de runtime.

Ver FINAL-AUDIT-1.0.md y CHANGELOG-1.0.0-rc.1.md.

## Puerta restante para 1.0.0

No añadir funciones. Ejecutar únicamente aceptación física:

1. iPhone/Safari en navegador y como PWA instalada: sesión completa, teclado, safe areas, descanso, bloqueo y reanudación.
2. Dos dispositivos con la misma cuenta: conflicto del mismo día probando Conservar dispositivo, Usar nube y Cancelar.
3. Cambio offline seguido de reconexión real.
4. Exportar un backup y restaurarlo en un navegador/perfil secundario.
5. Chrome y Brave de escritorio: menús, modales, resize y Modo Entrenamiento.

Si no aparece ningún fallo crítico o grave, promover el mismo candidato a **LiftEngine 1.0.0 Personal Edition**. Si aparece un defecto, corregir únicamente ese defecto, repetir sus pruebas afectadas y volver a pasar todas las puertas.

No iniciar v1.1 ni convertirla en producto multiusuario hasta cerrar 1.0.0.
