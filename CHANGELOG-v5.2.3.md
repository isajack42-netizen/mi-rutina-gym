# LiftEngine v5.2.3 — Hotfix de recuperación y sincronización

- Corrige la falsa alerta de “datos locales dañados” introducida por la normalización de datos de v5.2.2.
- Diferencia una migración compatible (por ejemplo, descansos de minutos a segundos) de una corrupción real.
- Persiste una sola vez las normalizaciones compatibles para que no se repitan en cada recarga.
- Aumenta el margen de carga inicial de Firebase en redes móviles y reutiliza una instancia existente si ya está inicializada.
- Añade reintento automático de sincronización y espera explícita a que Firebase restaure la sesión de Google.
- Mantiene Firebase/Chart.js versionados en caché para mejorar la fiabilidad en iPhone, mientras los archivos propios de LiftEngine siguen usando red primero.
- “Pendiente de sincronizar” deja de mostrarse como error rojo cuando Firebase todavía está iniciando.
- Conserva el guardado local si la nube no está disponible y permite reintentar desde Ajustes.
