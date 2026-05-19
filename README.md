# Blog Miguel Anay

Blog personal en Astro conectado a Strapi como CMS, desplegado en AWS S3 + CloudFront.

**URL:** https://blog.miguel-anay.nom.pe

## Stack

- **Frontend:** Astro v5 (static output) + React + Tailwind CSS
- **CMS:** Strapi v5 (backend separado en `/y`)
- **Hosting:** AWS S3 + CloudFront CDN
- **CI/CD:** GitHub Actions

## Comandos

```bash
npm run dev          # Dev server en localhost:4321
npm run build        # Build estático → ./dist/
npm run preview      # Preview del build local
npm run deploy:prod  # Build + deploy a S3 + CloudFront
npm run check        # Astro checks + TypeScript
```

## Estructura del proyecto

```
src/
├── components/         # Compartidos (Header, Footer, BaseHead)
│   ├── layout/
│   └── seo/
├── features/
│   └── blog/
│       └── components/ # Solo usados en blog (FormattedDate)
├── pages/
│   ├── blog/
│   │   ├── [...slug].astro
│   │   ├── index.astro
│   │   └── components/ # BlogCard, RichTextRenderer
│   ├── index.astro
│   └── rss.xml.js
├── lib/
│   └── strapi.ts       # Cliente API de Strapi
├── layouts/
│   └── BlogPost.astro
└── content/
    └── blog/           # Loader dinámico desde Strapi
```

## Variables de entorno

Copia `.env.example` a `.env` y configura:

```bash
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=tu-token-aqui
```

El token se genera en el panel de Strapi: **Settings > API Tokens**.

> El contenido se consume de Strapi **solo en build time** — el sitio final es HTML estático.

## Deploy

El deploy es automático vía GitHub Actions en cada push a `main`:

```
push a main → npm run build → S3 sync → CloudFront invalidation
```

Para deploy manual:

```bash
cp .env.example .env   # Configurar AWS credentials y CloudFront ID
npm run deploy:prod
```

Secrets requeridos en GitHub: `STRAPI_URL`, `STRAPI_API_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`.

## Documentación

| Archivo | Contenido |
|---|---|
| `doc/DEPLOY.md` | Setup completo S3 + CloudFront + SSL + dominio |
| `doc/CI-CD.md` | Pipelines de GitHub Actions |
| `doc/STRAPI-SETUP.md` | Content types, API, integración |
| `doc/TROUBLESHOOTING.md` | Errores comunes y soluciones |
| `doc/PROJECT-SPECS.md` | Especificaciones y user stories |
| `doc/USER-STORIES.md` | US-006 y US-007 completadas |
