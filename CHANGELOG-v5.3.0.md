# LiftEngine v5.3.0 — Modo entrenamiento Pro

## Nuevo
- Tipo de serie: **Calentamiento**, **Normal** y **Al fallo**.
- Las series de calentamiento se guardan en el historial, pero no cuentan para volumen, PR, e1RM ni métricas de series efectivas.
- Stepper de peso en modo entrenamiento: **±2.5 kg** (±5 lb cuando la app está en libras).
- Sustitución de ejercicio durante la sesión sin reescribir el historial previo. El sustituto usa su propio historial y sus propias notas.
- Notas persistentes por ejercicio para recordar asiento, agarre, altura de polea y otros ajustes.
- Calculadora de discos accesible desde cada serie y precargada con el peso de esa serie.
- El temporizador continúa en cuenta ascendente tras 00:00 (`+00:01`, `+00:02`...) y el descanso real incluye ese tiempo extra.
- CSV y respaldo JSON conservan tipo de serie y notas por ejercicio.

## Notificaciones
- El Service Worker incluye un receptor estándar de **Web Push** listo para integrarse con un backend VAPID.
- Los avisos locales existentes siguen funcionando como mejor esfuerzo, pero un aviso garantizado con la pantalla bloqueada requiere un servidor que programe y envíe el Push. GitHub Pages por sí solo no puede hacerlo.

## Compatibilidad
- Los registros anteriores se interpretan automáticamente como series **Normales**.
- Esquema de datos actualizado a v2 sin requerir migración manual.
