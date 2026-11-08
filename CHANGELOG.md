# Changelog

Cambios notables del blog. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Las decisiones detrás de cada cambio están en [`docs/adr/`](docs/adr/README.md).

## [Sin publicar]

### Agregado

- Sección `/docs`, que publica la documentación de repos de GitHub (#30). Documenta duck-kit (#31).
  Ver [ADR 0001](docs/adr/0001-docs-desde-github.md).
- Cadena documental en `docs/`: PRD, Design, Technical Design, ADRs, Seguridad y Deploy, más `BACKLOG.md`
  y este changelog. Índice en [`docs/README.md`](docs/README.md).

### Cambiado (documentación)

- `CLAUDE.md`, `README.md` y la guía de despliegue describen el stack actual (Astro SSR, Turso, Vercel).
  Los documentos del stack anterior pasaron a `docs/archive/`.

### Cambiado

- Rediseño completo con el lenguaje visual de Mintlify: tipografía más chica, modo claro por defecto (#34).
  Ver [ADR 0003](docs/adr/0003-diseno-mintlify.md).

### Eliminado

- Login, magic links y las dependencias `better-auth` y `resend`. Los exámenes usan un invitado anónimo
  (#32). Ver [ADR 0002](docs/adr/0002-sin-login.md).
- Selector de temas, intro matrix y cursor magnético (#34).
