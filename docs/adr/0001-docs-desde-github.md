# 0001. Publicar la documentación de los repos leyéndola de GitHub

- **Estado:** Aceptado
- **Fecha:** 2026-11-04
- **PR:** #30, #31

## Contexto

Se quería una sección `/docs` que documente los repositorios propios como lo hacen los frameworks. El
contenido tiene que vivir en cada repo (`README.md` y `docs/**/*.md`), no duplicado en el blog.

## Decisión

El blog pide el contenido a la API de GitHub en cada request, sin pipeline de Markdown propio:

- `Accept: application/vnd.github.html` devuelve el HTML ya renderizado y sanitizado por GitHub.
- `git/trees/HEAD?recursive=1` lista todo el árbol en una sola llamada.
- La API de commits da la fecha de última modificación.
- Solo se sirven los repos de la lista `DOC_REPOS` (`src/features/docs/repos.ts`), para que el sitio no sea
  un proxy abierto.
- La CDN de Vercel cachea con `s-maxage=600, stale-while-revalidate=86400`. `GITHUB_TOKEN` es opcional y
  sube el límite de la API.

Se descartó Mintlify como servicio: implica otro sitio y otra herramienta; se construyó a mano.

## Consecuencias

- Un cambio en el repo aparece en el blog en unos 10 minutos, sin desplegar.
- Si GitHub falla, la página responde 502; el resto del blog sigue funcionando.
- Sin `GITHUB_TOKEN`, el límite es de 60 pedidos por hora por IP.
- Los archivos o carpetas que empiezan con `_` o `.` no se publican.
