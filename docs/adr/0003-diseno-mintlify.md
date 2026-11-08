# 0003. Lenguaje visual de Mintlify con tokens CSS

- **Estado:** Aceptado
- **Fecha:** 2026-11-04
- **PR:** #34

## Contexto

El sitio no se veía profesional: tipografía grande, varios temas y decoraciones (intro matrix, cursor
magnético) que competían con el contenido.

## Decisión

- Se adopta el estilo de Mintlify de [awesome-design-md](https://github.com/VoltAgent/awesome-design-md):
  Inter y Geist Mono, texto de 14 a 16 px, fondo blanco, acento menta `#00d4a4`, botones pill y tarjetas de
  12 px.
- Todo sale de tokens en `src/styles/global.css`. Se mantienen los nombres de variable anteriores para que los
  componentes los tomen sin reescribirse.
- Modo claro por defecto; el oscuro se activa con `html[data-mode="dark"]` y se recuerda en `localStorage`
  bajo `site-mode`.
- De las decoraciones solo se conserva el hero 3D de la portada.

## Consecuencias

- Un cambio de color o tamaño se hace en un solo archivo.
- No se deben animar con transición CSS propiedades que GSAP también anima (por ejemplo `opacity`): GSAP
  termina en un valor incorrecto.
- En grillas para celular usar `minmax(0, 1fr)`, no `1fr`, para que el contenido no desborde.
