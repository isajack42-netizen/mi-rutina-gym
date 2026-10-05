# Auditoría v5.7.0

La capa Analytics es de solo lectura sobre el historial, salvo la preferencia `weeklySessionTarget`. No altera series, PR históricos ni sesiones.

## Definiciones
- Adherencia: sesiones registradas / sesiones objetivo durante el tiempo cubierto.
- Mejora: e1RM de la última sesión al menos 2% por encima de la primera sesión comparable del periodo, sin señal de estancamiento reciente.
- Sin mejora reciente: con al menos 4 sesiones, el mejor e1RM de las 3 últimas no supera en más de 0.5% el mejor previo.
- Rendimiento a la baja: e1RM final al menos 3% por debajo del inicial del periodo.
- Volumen muscular mostrado: series de trabajo, no tonelaje fisiológico ni series secundarias ponderadas.
