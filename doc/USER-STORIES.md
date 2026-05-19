# User Stories — Completadas

## US-006: Blog Loading & Single-Column Layout

### Historia de Usuario

Como usuario, quiero que en esta ruta `/src/content.config.ts` la const blog cargue correctamente y alimente a la pagina `/blog`, también quiero que todos mis artículos en `callous-cluster\src\pages\blog\index.astro` el componente `<BlogCard>` cargue en una sola columna.

### Criterios de Aceptación Cumplidos

#### 1. La página de blog se carga correctamente con los articles

- **Verificado**: La configuración en `src/content.config.ts` está correctamente implementada
- **Loader Strapi**: El loader async obtiene artículos desde Strapi usando `getArticles()`
- **Manejo de errores**: Implementado try-catch que retorna array vacío si Strapi no está disponible
- **Populate**: Los artículos incluyen: author, category, cover, blocks
- **Ordenamiento**: Los artículos se ordenan por `publishedAt:desc`

#### 2. Los `<BlogCard>` están centrados y espaciados

- **Layout**: Cambiado de grid multi-columna a flexbox columna única
- **Centrado**: Implementado con `max-width: 800px` y `margin: auto`
- **Espaciado**: Gap de 2.5rem entre cards (responsive a 2rem en tablet, 1.5rem en móvil)
- **Ancho**: Todos los cards ocupan el 100% del contenedor

### Cambios Implementados

#### `src/pages/blog/index.astro`

Antes:
```css
.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}
```

Después:
```css
.blog-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  margin: 2rem 0;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.blog-grid > * {
  width: 100%;
}
```

#### Mejoras Adicionales

1. **Responsive Design Mejorado**:
   - Desktop (>768px): Gap 2.5rem, max-width 800px
   - Tablet (768px): Gap 2rem, padding 1.5rem
   - Móvil (480px): Gap 1.5rem, padding 1rem

2. **Contenedor Principal**:
   - `max-width: 960px` con `margin: 0 auto`
   - Padding lateral de 2rem (responsive)

3. **Header del Blog**:
   - Centrado correctamente
   - Tamaños de fuente responsive

### Estructura de Archivos (Scope Rule Compliant)

```
src/
├── pages/
│   └── blog/
│       ├── index.astro          ✅ MODIFICADO
│       └── components/
│           └── BlogCard.astro   ✅ LOCAL al blog (correcto)
├── content.config.ts            ✅ VERIFICADO (funciona correctamente)
└── lib/
    └── strapi.ts                ✅ VERIFICADO (funciona correctamente)
```

### Integración con Strapi

**API Endpoints Utilizados:**
- **Articles**: `GET /api/articles?populate=*&sort=publishedAt:desc`
- **Campos poblados**: author, category, cover, blocks

**Mapeo de Datos:**
```typescript
{
  id: article.slug || article.documentId,
  title: article.title,
  description: article.description,
  pubDate: new Date(article.publishedAt),
  heroImage: getStrapiMedia(article.cover.url),
  author: { name, email, avatar },
  category: { name, slug, description },
  blocks: article.blocks || []
}
```

### Notas Técnicas

- **Astro Version**: v5.14.1
- **Content Collections**: Usando loader dinámico con Strapi
- **Estilos**: CSS scoped en el componente
- **Variables CSS**: Definidas en `src/styles/global.css`
- **Tema oscuro**: Soportado vía variables CSS

### Estado Final

**US-006 COMPLETADA**

- Blog carga correctamente desde Strapi
- BlogCards en columna única centrada
- Espaciado apropiado entre cards
- Diseño responsive optimizado
- Respeta Scope Rule architecture

---

## US-007: Category Counting & Filtering

### Historia de Usuario

Como usuario, quiero que `<CategoryCard>` de `callous-cluster\src\pages\index.astro` cargue correctamente "articlecount" también cuando se haga click que la página se cargue y filtre correctamente los blogs por categorías (`src/pages/blog/category/[slug].astro`)

### Criterios de Aceptación Cumplidos

#### 1. El contador en `<CategoryCard>` funciona correctamente

- **Implementado**: Cálculo dinámico del contador de artículos por categoría
- **Método**: Se filtran todos los articles por `category.slug` y se cuenta
- **Ubicación**: `src/pages/index.astro` líneas 41-50

#### 2. Página de categoría filtrada correctamente

- **Funciona**: Click en CategoryCard abre `/blog/category/{slug}`
- **Filtrado**: Solo muestra artículos de la categoría seleccionada
- **Layout**: Columna única centrada (consistente con `/blog`)
- **Responsive**: Optimizado para móviles

### Cambios Implementados

#### `src/pages/index.astro`

**Cálculo del Contador de Artículos:**

```typescript
// Calculate article count for each category
const categoriesWithCount = categories.map((category) => {
  const count = articles.filter(
    (article) => article.category?.slug === category.slug
  ).length;
  return {
    ...category,
    articleCount: count,
  };
});
```

**Uso en CategoryCard:**

Antes:
```astro
articleCount={category.articles?.length || 0}
```

Después:
```astro
articleCount={category.articleCount}
```

#### `src/pages/blog/category/[slug].astro`

**Layout Actualizado a Columna Única:**

Antes:
```css
.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
}
```

Después:
```css
.blog-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.blog-grid > * {
  width: 100%;
}
```

**Mejoras Adicionales:**
- Traducción al español: "artículo" / "artículos"
- Botón "Volver" traducido
- Responsive mejorado (768px y 480px breakpoints)
- Espaciado consistente con `/blog`

#### `src/components/CategoryCard.astro`

Ya existente y funcionando correctamente:
- Props `articleCount` definido
- Muestra contador con formato correcto
- Link a `/blog/category/{slug}` funcional
- Colores armoniosos por triangulación
- Animaciones hover

### Arquitectura (Scope Rule Compliant)

```
src/
├── pages/
│   ├── index.astro                      ✅ MODIFICADO - Calcula articleCount
│   └── blog/
│       └── category/
│           └── [slug].astro             ✅ MODIFICADO - Layout columna única
├── components/
│   └── CategoryCard.astro               ✅ GLOBAL (usado en index y categories)
└── lib/
    └── strapi.ts                        ✅ Sin cambios (funciones ya existen)
```

### Flujo de Funcionamiento

**En la Página de Inicio (`index.astro`):**

```typescript
// 1. Obtener articles
const articles = await getArticles(); // ~2 artículos

// 2. Obtener categories
const categories = await getCategories(); // ~4 categorías

// 3. Calcular articleCount para cada categoría
const categoriesWithCount = categories.map((category) => {
  const count = articles.filter(
    (article) => article.category?.slug === category.slug
  ).length;
  return { ...category, articleCount: count };
});

// 4. Renderizar CategoryCards
categoriesWithCount.map((category, index) => (
  <CategoryCard
    name={category.name}
    slug={category.slug}
    description={category.description}
    articleCount={category.articleCount}  // ✅ Contador correcto
    index={index}
  />
))
```

**Click en CategoryCard:**

```
Usuario hace click → Link: /blog/category/{slug}
                   ↓
         Página [slug].astro se genera
                   ↓
      getStaticPaths() filtra posts por category.slug
                   ↓
      Renderiza BlogCards filtrados en columna única
```

**En la Página de Categoría (`[slug].astro`):**

```typescript
export async function getStaticPaths() {
  const posts = await getCollection('blog');

  // Get unique categories
  const categories = [...new Set(
    posts
      .filter(post => post.data.category)
      .map(post => post.data.category)
  )];

  // Generate path for each category
  return categories.map((category) => ({
    params: { slug: category.slug },
    props: {
      category,
      posts: posts.filter(
        post => post.data.category?.slug === category.slug
      ).sort(...)
    },
  }));
}
```

### Ejemplos de Datos

**Categorías con Contador:**

```typescript
categoriesWithCount = [
  {
    name: "Backend",
    slug: "Backend",
    description: "Nodejs.,C#.net, PHP laravel...",
    articleCount: 0  // ✅ Calculado dinámicamente
  },
  {
    name: "FronteEnd",
    slug: "FrontEnd",
    description: "Rectajs, Angular, Astro...",
    articleCount: 2  // ✅ 2 artículos en esta categoría
  },
]
```

### Páginas Generadas Estáticamente

Astro genera estas rutas en build time:

```
/blog/category/Backend       → 0 artículos
/blog/category/FrontEnd      → 2 artículos
/blog/category/tech          → 0 artículos
/blog/category/IA            → 0 artículos
```

### Responsive Design

| Breakpoint | Gap | Max-width | Padding |
|------------|-----|-----------|---------|
| Desktop (>768px) | 2.5rem | 800px | 2rem |
| Tablet (768px) | 2rem | 100% | 1.5rem |
| Móvil (480px) | 1.5rem | 100% | 1rem |

### Notas Técnicas

1. **getStaticPaths()**: Se ejecuta en build time, genera rutas estáticas
2. **Filtrado**: Se hace en la colección de Astro, no en Strapi API
3. **Contador**: Calculado dinámicamente desde articles array
4. **Layout**: Consistente con `/blog` (columna única)
5. **Scope Rule**: CategoryCard es global (usado en múltiples páginas)

### Estado Final

**US-007 COMPLETADA**

- Contador de artículos funcionando correctamente
- Click en CategoryCard abre página filtrada
- Página de categoría en columna única
- Filtrado correcto por categoría
- Layout consistente con `/blog`
- Responsive optimizado
- Respeta Scope Rule architecture

### Próximos Pasos (Opcionales)

1. Agregar ordenamiento en página de categoría (por fecha, título, etc.)
2. Implementar paginación si hay muchos artículos
3. Agregar breadcrumbs para mejor navegación
4. Meta tags específicos por categoría para SEO
