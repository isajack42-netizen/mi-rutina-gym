# LiftEngine v1.1 — Exercise Library Blueprint

Estado: **Foundation / rama de desarrollo**  
Base: **LiftEngine 1.0.0-rc.1**  
Rama: `v1.1-exercise-library`

## Objetivo

Convertir LiftEngine de tracker de entrenamiento a tracker + biblioteca técnica de ejercicios, sin comprometer la fiabilidad lograda en 1.0.

La biblioteca debe poder responder, dentro o fuera de una sesión:

- qué ejercicio es;
- qué músculos trabaja;
- para qué sirve;
- cómo colocarse;
- cómo ejecutarlo paso a paso;
- cómo respirar;
- cuáles son los cues importantes;
- cuáles son los errores frecuentes;
- qué variantes y sustituciones existen;
- qué ejercicios están relacionados.

## Regla arquitectónica

La Exercise Library es una capa **aditiva**. En v1.1 no cambia el contrato de:

- días registrados;
- sesiones activas;
- settings;
- recuperación;
- IndexedDB;
- Firestore;
- conflictos;
- backups.

Hasta que la integración de UI esté validada, los datos de la biblioteca permanecen desacoplados del runtime estable.

## Superficies previstas

### 1. Modo Entrenamiento
Cada ejercicio reconocido puede mostrar **Ver técnica**. Abrir la ficha no debe perder foco lógico, set actual, descanso, inputs ni sesión activa.

### 2. Rutinas
Icono/botón de información junto al ejercicio. La ficha se abre sin editar la rutina.

### 3. Biblioteca de ejercicios
Sección dedicada con:

- búsqueda;
- filtros por músculo;
- filtros por equipo;
- patrón de movimiento;
- dificultad;
- objetivo.

### 4. Ejercicios personalizados
Nunca se bloquean. Si no existe ficha canónica, LiftEngine conserva el ejercicio normal y puede mostrar un estado “Sin ficha técnica todavía”.

## Modelo canónico

Cada ejercicio usa un ID estable en kebab-case, por ejemplo:

`bench-press-barbell`

El nombre visible puede cambiar sin romper referencias. Los aliases permiten reconocer nombres alternativos.

Campos obligatorios de una ficha madura:

- identidad y aliases;
- taxonomía;
- resumen;
- beneficios;
- setup;
- ejecución paso a paso;
- respiración;
- cues;
- errores comunes;
- seguridad;
- variantes;
- sustituciones;
- relacionados;
- media visual.

El contrato formal está en `exercise-library/schema.json`.

## Resolución de nombres y aliases

La biblioteca no debe depender de coincidencias frágiles de texto.

Ejemplo:

- Press banca
- Press plano
- Press de banca
- Bench press
- Barbell bench press

pueden resolver a:

`bench-press-barbell`

La resolución futura debe:

1. normalizar mayúsculas/minúsculas;
2. recortar espacios;
3. normalizar diacríticos solo para comparación;
4. probar nombre canónico;
5. probar aliases;
6. no hacer fuzzy matching agresivo automáticamente;
7. dejar ejercicios ambiguos sin vincular antes que vincularlos mal.

## Lenguaje visual

Todas las ilustraciones serán propias y compartirán el estándar de `exercise-library/VISUAL-STANDARD.md`.

Principios:

- mismo modelo anatómico base;
- estilo técnico semirrealista consistente;
- equipo físicamente plausible;
- fondos neutros;
- músculos destacados con jerarquía cromática fija;
- sin texto incrustado en las imágenes;
- encuadres repetibles;
- técnica correcta antes que estética;
- errores comunes representados claramente sin exageraciones irreales.

## Lote inicial

El primer pack contiene 15 movimientos:

1. Press banca con barra
2. Press inclinado con mancuernas
3. Aperturas en polea
4. Press militar con barra
5. Elevaciones laterales con mancuernas
6. Jalón al pecho
7. Remo sentado en polea
8. Remo unilateral con mancuerna
9. Curl de bíceps con barra
10. Curl inclinado con mancuernas
11. Extensión de tríceps en polea
12. Fondos en paralelas
13. Sentadilla con barra
14. Prensa de pierna
15. Curl femoral tumbado

El inventario formal está en `exercise-library/planned-exercises.json`.

## Ejercicio piloto

`bench-press-barbell` es la ficha de referencia.

Antes de producir el resto del catálogo debe validar:

- densidad de contenido;
- taxonomía;
- aliases;
- relaciones;
- cantidad de pasos;
- errores comunes;
- nomenclatura de assets;
- comportamiento responsive futuro.

## Plan de entrega

### Fase 1 — Foundation
- blueprint;
- esquema de datos;
- taxonomía;
- inventario inicial;
- estándar visual;
- auditor automático del catálogo;
- ficha piloto estructurada.

### Fase 2 — Pilot UI
- componente de ficha;
- tabs: Visión general, Técnica, Músculos, Variantes, Errores;
- responsive móvil/escritorio;
- navegación y accesibilidad;
- assets finales del Press banca.

### Fase 3 — Training Integration
- Ver técnica desde entrenamiento;
- retorno exacto a la sesión;
- ningún cambio al modelo de sesión;
- pruebas de teclado, foco y rest timer.

### Fase 4 — Library
- sección Ejercicios;
- búsqueda;
- filtros;
- aliases;
- empty states.

### Fase 5 — First Pack
- completar 15 fichas;
- assets consistentes;
- revisión de contenido;
- prueba de peso/PWA/cache.

### Fase 6 — Expansion
- 30 → 60 → 100+ ejercicios;
- solo después de demostrar que la arquitectura y el lenguaje visual escalan.

## Criterios de calidad

Una ficha no pasa a `ready` si:

- falta técnica paso a paso;
- tiene menos de dos errores comunes;
- usa términos fuera de taxonomía sin registrar;
- tiene aliases colisionando con otra ficha;
- sus imágenes rompen el estándar;
- contiene texto clínico/lesiones presentado como diagnóstico;
- sus relaciones apuntan a IDs no previstos;
- el contenido no cabe correctamente en móvil.

## No objetivos de v1.1

Por ahora no se incluyen:

- videos alojados externamente;
- IA que diagnostique técnica por cámara;
- análisis biomecánico en tiempo real;
- recomendaciones médicas;
- catálogo comercial multiusuario;
- edición colaborativa de fichas.

## Principio de cierre

v1.1 debe sentirse como una extensión nativa de LiftEngine, no como un micrositio pegado a la app.

La prioridad es: **claridad técnica + consistencia visual + acceso rápido + cero regresiones al motor estable**.
