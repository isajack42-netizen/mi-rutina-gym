# LiftEngine — cierre de Personal Edition

Base: v6.11.0. Etapa actual: v6.12.0 Friction Audit implementada; siguiente etapa: LiftEngine 1.0 Personal Edition — Final Audit.

## v6.11 — Reliability & Recovery

Implementado: guardado verificable, transacción local conjunta, deshacer con comprobación de cambios posteriores, recuperación local y exportable, protección al importar, sesiones antiguas conservadas, conflictos cancelables, pendientes durables y escritor único entre pestañas compatibles.

Puerta automatizada: sintaxis, validación estática, regresiones previas y 26 escenarios de fiabilidad. Consultar CHANGELOG-v6.11.0.md para alcance y límites.

Verificación real pendiente: dos dispositivos con la misma cuenta, cambios del mismo día sin conexión, reconexión, suspensión de iPhone, reanudación tras varias horas y comportamiento visual/táctil del aviso de recuperación. Esta evidencia se conserva como requisito del cierre 1.0.

## v6.12 — Friction Audit

Implementado tras recorrer el flujo entrar → elegir rutina → registrar → marcar → descansar → corregir → sustituir → terminar → retomar.

- El plan de hoy puede iniciarse en un toque desde el CTA principal, manteniendo acceso inmediato a Otra rutina.
- La rutina asignada aparece primero cuando se abre el selector.
- Peso, reps y RIR usan teclado móvil apropiado, selección al enfocar y avance con Enter/Next; Enter sobre RIR marca la serie.
- Al completar el último set de un ejercicio se avanza al siguiente ejercicio incompleto, sin saltar trabajo pendiente.
- Durante el descanso, Empezar aparece únicamente en la siguiente serie relevante, no en todas las series pendientes.
- La navegación mantiene visible el ejercicio/serie actual y Anterior queda deshabilitado cuando no puede hacer nada.
- Acciones poco frecuentes del ejercicio se agrupan en Más opciones; Añadir serie y Añadir ejercicio permanecen directas.
- Los chips táctiles del entrenamiento cumplen un objetivo mínimo de 44 px.
- No cambia el modelo de datos, Firestore, recuperación, backups ni compatibilidad de sesiones de v6.11.

Puerta automatizada: validación estática, regresión funcional, 26 escenarios de fiabilidad y pruebas específicas de fricción/guardrails de interacción.

Verificación física pendiente para 1.0: iPhone/Safari instalado y navegador, Android/Chrome si se usa, escritorio, teclado móvil real, rotación, reanudación tras bloqueo y recorrido completo con una sesión real.

## LiftEngine 1.0 Personal Edition — Final Audit

Congelar funciones. No añadir funcionalidades nuevas durante esta fase.

Auditar código, contratos y datos históricos, rendimiento, experiencia móvil/escritorio, accesibilidad, sincronización real, backups, recuperación, estados extremos y consistencia visual. Corregir únicamente defectos, regresiones o fricción demostrable y repetir los recorridos afectados.

Salida: cero fallos críticos o graves conocidos; puertas automáticas verdes; pruebas físicas esenciales documentadas; límites y problemas menores explícitos. Una puntuación subjetiva no sustituye esta evidencia.

No ampliar a un producto multiusuario ni iniciar nuevas funciones hasta cerrar esta auditoría.
