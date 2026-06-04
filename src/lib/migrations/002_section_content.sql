-- Add markdown content column to course_sections
-- Run: turso db shell blog-prod-miguelanay < src/lib/migrations/002_section_content.sql

ALTER TABLE course_sections ADD COLUMN content TEXT;

-- Update sample data with content
UPDATE course_sections SET content = '## ¿Qué es Astro?

Astro es un framework moderno para construir sitios web rápidos. Su característica principal es el **Island Architecture** — solo hidrata los componentes que realmente necesitan JavaScript.

### ¿Por qué usarlo?

- Soporte nativo para React, Vue, Svelte y más
- Build estático por defecto, SSR cuando lo necesitás
- Performance excepcional sin configuración extra

```bash
npm create astro@latest
```

> **Nota**: Necesitás Node.js 18 o superior.'
WHERE id = 1;

UPDATE course_sections SET content = '## Componentes en Astro

Los componentes Astro tienen una sintaxis única: un bloque frontmatter (entre `---`) para la lógica del servidor, y HTML/JSX debajo para el template.

```astro
---
const mensaje = "Hola mundo";
---

<h1>{mensaje}</h1>
```

### Layouts

Los layouts son componentes especiales que envuelven páginas enteras. Usá `<slot />` para definir dónde va el contenido hijo.'
WHERE id = 2;
