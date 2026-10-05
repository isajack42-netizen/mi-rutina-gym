# LiftEngine v6.1.0 — UI / UX Refinement

Fecha: 2026-10-05

## Objetivo
Reducir ruido visual y hacer que cada pantalla responda antes a una sola pregunta: qué hacer ahora, cómo registrar la sesión y dónde revisar el progreso.

## Cambios
- Resumen prioriza la próxima decisión y compacta los KPI.
- Esta semana y últimos entrenamientos quedan visibles; rendimiento, músculos y PR pasan a “Más métricas”.
- Progreso se divide en Rendimiento, Inteligencia, Analítica y Cuerpo.
- Calendario usa indicadores visuales y celdas accesibles como botones.
- Modo Entrenamiento compacta historial e inteligencia en bloques desplegables.
- Cabecera móvil oculta utilidades secundarias y la unidad queda disponible en Ajustes.
- Se elevan tamaños mínimos de microtipografía en componentes críticos.

## Apariencia
- Tema Claro.
- Modo Automático con `prefers-color-scheme` y cambio en tiempo real.
- Se conservan Oscuro, Océano, Bosque y Café.
- La barra del navegador/PWA adopta el fondo del tema resuelto.

## Compatibilidad
- Sin cambios al modelo de datos.
- `currentTheme` sigue sincronizándose.
- Temas existentes continúan válidos.
- Usuarios nuevos usan Automático; usuarios existentes conservan su preferencia.

## Quality gate
- Nuevos guardrails estáticos para subnavegación y temas.
- Sintaxis, validación y regresiones deben seguir en verde.
