# LiftEngine v5.7.1 — Mobile Layout & Calendar Actions

## Interfaz móvil
- La barra inferior ahora tiene una altura fija y consistente en todas las pestañas.
- La barra respeta el `safe-area` inferior de iPhone y reserva siempre el mismo espacio en el contenido.
- Se normalizó la posición del temporizador flotante y de los avisos respecto a la barra inferior.
- El botón **Iniciar / Continuar modo entrenamiento** ahora tiene separación vertical propia y en móvil ocupa el ancho disponible, evitando que parezca superpuesto a la primera tarjeta.

## Calendario
- Al seleccionar un día con entrenamiento aparece **Eliminar entrenamiento completo** debajo del resumen de la sesión.
- La eliminación requiere confirmación.
- Elimina ejercicios, series, etiqueta de rutina y nota de sesión de esa fecha.
- Conserva el peso corporal y las medidas corporales registrados ese mismo día.
- Si se elimina la fecha del entrenamiento que está actualmente activo, LiftEngine cierra y descarta también ese modo entrenamiento para evitar un borrador huérfano.
- Un día seleccionado sin entrenamiento muestra ahora un estado vacío asociado a esa fecha.

## Compatibilidad
- No cambia el esquema de IndexedDB.
- No cambia Cloud Schema v2.
- No requiere actualizar las reglas de Firestore.
