# LiftEngine v6.11.0 — Reliability & Recovery

Fecha: 2026-10-05

## Guardado verificable

- Días, ajustes, sesión activa, cambios pendientes y diario de recuperación se guardan en una sola transacción IndexedDB.
- Un fallo local detiene el envío a nube y muestra un aviso persistente con Reintentar y Descargar copia.
- El fallback localStorage escribe un snapshot único. Si un dispositivo ya usaba IndexedDB y no puede abrirlo, se detiene el arranque para no sustituirlo con un snapshot antiguo.
- Los campos del entrenamiento guardan al escribir; se intenta vaciar la cola al ocultar/cerrar la página. No se promete ejecución al matar el proceso del navegador.
- Las sesiones de más de 12 horas se recuperan sin descartar repeticiones pendientes.

## Deshacer y recuperación

- Ajustes → Datos → Historial de recuperación y deshacer.
- Se conservan hasta 10 cambios protegidos por cuenta en este dispositivo.
- Protege registros manuales, borrado de entrenamientos, peso y medidas, guardado/borrado de rutinas, quitar una serie, finalizar sesión e importaciones JSON/CSV.
- Deshacer comprueba que los datos afectados siguen iguales; si cambiaron, no sobrescribe cambios posteriores.
- Las copias anteriores pueden descargarse y restaurarse desde Restaurar copia. Las copias parciales tienen un formato explícito de recuperación, distinto del respaldo completo.
- Si falla el checkpoint previo, el cambio se detiene. Si falla la escritura posterior, se restaura el estado anterior en memoria y se intenta persistirlo.
- Los respaldos JSON nuevos incluyen la sesión activa; los antiguos siguen aceptándose.
- Validar una rutina precede a cualquier renombrado o modificación.

## Sincronización adversa

- Conflictos con tres decisiones: conservar dispositivo, usar nube o cancelar. Cerrar el diálogo equivale a cancelar.
- Cancelar pausa la sincronización hasta Reintentar sincronización; los cambios locales permanecen pendientes.
- Usar nube crea primero una copia recuperable de la versión local. Los borradores descartados explícitamente no reaparecen tras aceptar un borrado remoto.
- Los cambios hechos durante una escritura conservan su marcador pendiente; los reintentos de ajustes utilizan el contenido actualizado.
- Pull y push no se ejecutan simultáneamente. Una transacción de Firestore no se abandona mediante un timeout local que podría permitir un segundo envío mientras la primera sigue viva.
- Web Locks mantiene un único escritor por origen: una segunda ventana espera y carga datos frescos al cerrar la primera. Navegadores sin Web Locks muestran un aviso para usar una sola ventana.
- Service Worker usa coincidencia exacta para recursos versionados y conserva un shell anterior; sin conexión no sustituye scripts por los de otra versión.

## Validación

- Sintaxis de todos los scripts runtime.
- Validador estático: 22 archivos runtime, 143 IDs, 171 handlers.
- Suite de regresión anterior.
- 26 escenarios nuevos: transacciones abortadas, cuota agotada, checkpoint fallido, undo, edición posterior, sesión antigua, recarga, tombstones pendientes, importación/restauración, fallos de red, respuesta tardía, dos dispositivos simulados, cancelación de conflicto, bloqueo entre pestañas y caché versionada.
- `npm ci --ignore-scripts` y `npm test`. fake-indexeddb es exclusivamente una dependencia de pruebas.

## Límites de esta validación

Las pruebas nuevas ejecutan el código real con IndexedDB simulado y transporte de nube controlado. No sustituyen pruebas de Safari/iPhone, suspensión del sistema, expulsión de almacenamiento ni dos dispositivos autenticados contra Firestore real. La revisión visual y esas pruebas reales siguen en el cierre de la edición personal; no se utilizaron registros reales del usuario en las pruebas.

Sin cambios de reglas Firestore, de documentos diarios de nube ni de versión estructural de IndexedDB. El diario es local y no reemplaza un respaldo externo descargado.
