# LiftEngine Exercise Library — Visual Standard v1

## Objetivo

Crear una biblioteca visual reconocible como parte de LiftEngine aun cuando se vea una ilustración fuera de contexto.

## 1. Dirección de arte

- Estilo: ilustración técnica semirrealista.
- Sensación: limpia, moderna, profesional y educativa.
- Anatomía: realista y proporcionada, sin hiperdefinición innecesaria.
- Equipamiento: reconocible y físicamente correcto.
- Fondo: neutro y de bajo contraste.
- Iluminación: uniforme, sin dramatismo cinematográfico.
- Perspectiva: elegida para explicar el movimiento, no para lucir espectacular.

## 2. Modelo anatómico base

- Mantener proporciones corporales consistentes entre ejercicios.
- Complexión atlética neutra.
- El rostro no es protagonista.
- Cabello, ropa y rasgos deben permanecer discretos.
- La ropa no debe ocultar articulaciones o líneas corporales relevantes.
- No cambiar de estilo de cuerpo entre imágenes de la misma secuencia.

## 3. Jerarquía muscular

La capa anatómica usa tres niveles visuales:

1. **Principal:** coral/rojo de mayor intensidad.
2. **Secundario:** naranja.
3. **Estabilizador:** amarillo suave.

El resto del cuerpo se mantiene en escala neutra.

Los colores deben ser consistentes en todo el catálogo. La UI aporta nombres y leyendas; la imagen no debe contener texto horneado.

## 4. Assets por ejercicio

Una ficha completa puede incluir:

- `thumbnail.webp` — 1:1
- `hero.webp` — 4:3
- `muscle-map-front.webp` o `muscle-map-back.webp` — 3:4
- `step-01-*.webp`, `step-02-*.webp`, etc. — 4:3
- `mistake-*.webp` — 4:3
- `correct-form.webp` — 4:3 cuando aporte valor

No todos los ejercicios necesitan el mismo número de vistas, pero sí deben seguir la misma nomenclatura.

## 5. Técnica

Cada secuencia debe:

- mostrar inicio y final cuando el movimiento lo requiera;
- conservar cámara, modelo y equipo siempre que sea posible;
- reflejar rango de movimiento realista;
- evitar articulaciones en posiciones imposibles;
- mantener agarres y apoyos consistentes;
- mostrar claramente el recorrido sin depender de flechas incrustadas.

Las flechas, números y captions se renderizarán en la UI cuando sea posible.

## 6. Errores comunes

Un asset de error debe representar **una sola desviación**.

Ejemplo para Press banca:

- codos excesivamente abiertos;
- barra demasiado alta;
- pérdida de apoyo de los pies.

No mezclar tres errores en una sola ilustración.

## 7. Encuadres

Preferencias:

- empujes/tirones horizontales: vista 3/4 lateral;
- ejercicios unilaterales: ángulo que haga visible el lado activo;
- máquinas: encuadre que muestre asiento, apoyos y trayectoria;
- muscle maps: frontal o posterior anatómico limpio.

Si otro ángulo explica mejor el gesto, prevalece la claridad técnica.

## 8. Accesibilidad y producto

- No comunicar información crítica solo por color.
- Cada imagen tendrá texto alternativo generado desde metadata.
- Evitar detalles demasiado pequeños para móvil.
- Ningún asset contendrá texto indispensable.
- El diseño debe seguir siendo comprensible con la imagen oculta.

## 9. Exportación

Preferencia final: WebP optimizado.

Objetivos iniciales:

- thumbnail: 512×512;
- hero/steps/errors: 1200×900;
- muscle map: 900×1200.

Se conservará un master de mayor resolución fuera del runtime cuando sea necesario para regenerar derivados.

## 10. Regla de consistencia

Una imagen técnicamente correcta pero visualmente incompatible con la biblioteca no se acepta como final. Del mismo modo, una imagen bonita con técnica dudosa tampoco se acepta.

**Primero precisión. Después consistencia. Después estética.**
