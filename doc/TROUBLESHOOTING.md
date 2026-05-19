# Troubleshooting

## Error: "Collection blog does not exist or is empty"

### Causa

El error indica que el content collection "blog" no está cargando artículos desde Strapi. Puede deberse a:

1. Strapi no está corriendo
2. Variables de entorno no configuradas o no cargadas
3. Un artículo tiene campos con valor `null` que el schema no acepta
4. El servidor de Astro no fue reiniciado después de cambios en `.env`

### Diagnóstico

**Verificaciones básicas:**

```bash
# ¿Strapi está corriendo?
curl http://localhost:1337/api/articles?populate=*

# ¿Las variables de entorno están cargadas?
node -e "console.log(process.env.STRAPI_URL)"
```

**Verificar logs al iniciar Astro:**

Cuando reinicies el servidor, deberías ver en la consola:

```
🔍 Starting to load articles from Strapi...
🌐 Fetching articles from: http://localhost:1337/api/articles?populate=*&sort=publishedAt:desc
🔑 Using API Token: Yes (token present)
📦 Received 1 articles from Strapi API
✅ Loaded 1 articles from Strapi
📝 Mapping article: purevas2  (slug: asdasd)
✅ Successfully mapped 1 articles
```

Si ves `❌` en lugar de `✅`, hay un error de conexión o de schema.

**Pasos de diagnóstico:**

1. Reiniciar el servidor: `Ctrl+C` luego `npm run dev`
2. Verificar logs en la terminal del servidor Astro
3. Si hay error de schema, revisar qué campo es `null` en los artículos de Strapi

### Solución implementada

**El error raíz fue:** uno de los artículos en Strapi tenía `description: null`, pero el schema de Astro esperaba un `string` obligatorio.

**Error original:**
```
[InvalidContentEntryDataError] blog → ssr-en-astro-del-client-load-al-despliegue-en-aws-vercel-y-cloudflare-1
data does not match collection schema.

description: Expected type "string", received "null"
```

**Fix aplicado en `src/content.config.ts`:**

Antes:
```typescript
schema: z.object({
  title: z.string(),
  description: z.string(),  // ❌ Requería string no-null
  ...
})
```

Después:
```typescript
schema: z.object({
  title: z.string(),
  description: z.string().nullable().optional().default(''),  // ✅ Acepta null/undefined
  ...
})
```

**Fix aplicado en el mapper (`src/lib/strapi.ts`):**

Antes:
```typescript
return {
  title: article.title,
  description: article.description,  // ❌ Podía ser null
  ...
};
```

Después:
```typescript
return {
  title: article.title || 'Sin título',
  description: article.description || '',  // ✅ Fallback a string vacío
  ...
};
```

**Fix de variables de entorno duales (`src/lib/strapi.ts`):**

```typescript
const STRAPI_URL = typeof process !== 'undefined' && process.env?.STRAPI_URL
  ? process.env.STRAPI_URL
  : (typeof import.meta !== 'undefined' && import.meta.env?.STRAPI_URL)
    ? import.meta.env.STRAPI_URL
    : 'http://localhost:1337';
```

### Soluciones alternativas

#### Opción 1: Forzar recarga de la colección

```bash
rm -rf .astro
npm run dev
```

#### Opción 2: Usar variables públicas (si `process.env` no funciona)

1. Renombra las variables en `.env`:
```env
PUBLIC_STRAPI_URL=http://localhost:1337
PUBLIC_STRAPI_API_TOKEN=tu_token_aqui
```

2. Actualiza `src/lib/strapi.ts`:
```typescript
const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = import.meta.env.PUBLIC_STRAPI_API_TOKEN;
```

#### Opción 3: Loader mínimo para debug

Si nada funciona, prueba esta configuración mínima en `src/content.config.ts` para aislar el problema:

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  loader: async () => {
    console.log('🔍 Testing loader...');

    const response = await fetch('http://localhost:1337/api/articles?populate=*', {
      headers: {
        'Authorization': 'Bearer TU_TOKEN_AQUI'
      }
    });

    const json = await response.json();
    console.log('Response:', json);

    return json.data.map((article: any) => ({
      id: article.slug || article.documentId,
      title: article.title,
      description: article.description,
      pubDate: new Date(article.publishedAt),
    }));
  },
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
  }),
});

export const collections = { blog };
```

> **No commitear** la versión con token hardcodeado.

#### Opción 4: Hardcodear URL temporalmente (solo para debug)

```typescript
// En src/lib/strapi.ts (SOLO PARA DEBUG - NO COMMITEAR)
const STRAPI_URL = 'http://localhost:1337';
const STRAPI_API_TOKEN = 'tu_token_completo_aqui';
```

---

## Error: Categorías dan 404

### Causa

La página `/blog/category/FrontEnd` devuelve 404 porque los artículos en Strapi no tienen categorías asignadas.

**Evidencia en los logs:**

```
📝 Mapping article: SSR en Astro... (slug: ssr-en-astro..., category: none)
📝 Mapping article: purevas2  (slug: asdasd, category: none)
```

En Strapi v5, cuando creas un artículo, la relación con `category` no se asigna automáticamente. Debes crear las categorías y asignarlas manualmente a cada artículo.

### Solución

**Paso 1: Verificar que las categorías existen en Strapi**

1. Abre el panel de admin: `http://localhost:1337/admin`
2. Ve a **Content Manager** → **Categories**
3. Deberías ver categorías como: Backend, FrontEnd, tech, IA

**Paso 2: Asignar categorías a los artículos**

1. Ve a **Content Manager** → **Articles**
2. Abre cada artículo
3. Busca el campo **"Category"**
4. Selecciona una categoría del dropdown
5. Haz click en **Save** y luego **Publish**
6. Repite para todos los artículos

**Paso 3: Verificar en la API**

```bash
curl "http://localhost:1337/api/articles?populate=*"
```

Debes ver la categoría en la respuesta:

```json
{
  "data": [
    {
      "id": 1,
      "title": "SSR en Astro...",
      "slug": "ssr-en-astro...",
      "category": {
        "id": 3,
        "name": "FrontEnd",
        "slug": "FrontEnd"
      }
    }
  ]
}
```

**Paso 4: Reiniciar el servidor de Astro**

```bash
# Detener el servidor (Ctrl+C)
npm run dev
```

Deberías ver en los logs:

```
📝 Mapping article: SSR en Astro... (slug: ssr-en-astro..., category: FrontEnd)
📂 Generating 1 category pages: [ 'FrontEnd' ]
  ✓ /blog/category/FrontEnd - 1 posts
```

**Paso 5: Verificar la página**

Visita: `http://localhost:4321/blog/category/FrontEnd`

Deberías ver:
- Header con el nombre de la categoría
- Descripción de la categoría (si existe)
- Contador de artículos
- Lista de artículos filtrados en columna única

### Resumen del comportamiento

| Estado | Resultado |
|--------|-----------|
| Sin categorías asignadas en Strapi | `getStaticPaths()` devuelve array vacío → páginas 404 |
| Con categorías asignadas | Rutas generadas automáticamente → filtrado correcto |

### Alternativa para pruebas rápidas

Si quieres probar sin Strapi, puedes crear datos de prueba en `[slug].astro`:

```typescript
export async function getStaticPaths() {
  const testCategories = [
    { name: 'Frontend', slug: 'FrontEnd', description: 'Frontend tech' },
    { name: 'Backend', slug: 'Backend', description: 'Backend tech' }
  ];

  return testCategories.map(category => ({
    params: { slug: category.slug },
    props: { category, posts: [] }
  }));
}
```

La solución correcta es siempre asignar categorías en Strapi.

---

## Recomendaciones para Strapi

Para evitar errores de schema en el futuro:

1. Marcar el campo `description` en el Content Type "Article" como **Required** en Strapi
2. O proporcionar un valor por defecto en Strapi
3. O mantener el schema de Astro flexible con `.nullable().optional().default('')`

## Notas Generales

- El loader se ejecuta durante el build time de Astro
- Las variables de entorno deben estar disponibles cuando Astro inicia
- El archivo `.env` debe estar en la raíz del proyecto (`callous-cluster/`)
- Si cambias `.env`, SIEMPRE reinicia el servidor de Astro
