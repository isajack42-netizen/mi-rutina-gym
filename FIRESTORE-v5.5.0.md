# Activar Nube v2 en Firebase

LiftEngine v5.5.0 puede seguir funcionando temporalmente con la nube heredada. Para resolver de forma efectiva el límite del documento único y los conflictos multidispositivo, hay que publicar `firestore.rules` de esta versión.

## Pasos

1. Abre Firebase Console.
2. Entra al proyecto de LiftEngine.
3. Ve a **Firestore Database -> Rules**.
4. Sustituye las reglas actuales por el contenido de `firestore.rules` incluido en este proyecto.
5. Pulsa **Publish**.
6. Abre LiftEngine v5.5.0.
7. En **Ajustes**, pulsa **Reintentar sincronización** o **Activar nube v2**.
8. Comprueba que el indicador de Ajustes diga **Nube v2 · datos por día**.

## Qué ocurre durante la migración

- LiftEngine conserva primero una copia local en `gymBackupBeforeCloudV2`.
- Escribe cada fecha en `userData/{uid}/days/{fecha}`.
- Solo cuando esos documentos se han escrito, sustituye el documento raíz por la configuración pequeña de Nube v2.
- Si algo falla antes de terminar, el documento heredado permanece como fuente principal y la migración puede reintentarse.

## Compatibilidad

No es necesario borrar datos del navegador ni volver a iniciar sesión. Tampoco hace falta importar un JSON para migrar.
