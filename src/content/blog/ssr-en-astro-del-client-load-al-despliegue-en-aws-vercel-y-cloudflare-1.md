---
title: 'Astro a fondo: SSG, SSR, imágenes y por qué olvidate de las SPAs'
description: 'Todo lo que necesitás saber sobre Astro: cómo funciona, la diferencia entre SSG y SSR, Islands Architecture, optimización de imágenes y cuándo usar cada modo.'
pubDate: 'May 18 2026'
---

Astro no es otro framework de React. No compite con Next.js. Compite con el problema de fondo: **mandás demasiado JavaScript al navegador y nadie te lo pidió**.

Este post cubre todo — desde cómo funciona Astro por dentro hasta cuándo tiene sentido pasarte de SSG a SSR, con imágenes optimizadas de regalo.

---

## El problema que Astro resuelve: las SPAs

SPA significa **Single Page Application**. Una sola página HTML que el servidor manda al navegador — después, toda la navegación ocurre en el cliente con JavaScript.

React, Vue y Angular son SPAs por defecto. El flujo es:

```
Navegador pide /blog
  → Servidor responde: <html><div id="root"></div><script src="bundle.js"></script>
  → Navegador descarga bundle.js (puede ser 500KB, 1MB, 2MB)
  → JavaScript parsea y ejecuta
  → React renderiza el contenido
  → Usuario finalmente ve algo
```

El problema está en ese tiempo de espera. Hasta que el bundle parsea y ejecuta, el usuario ve una página en blanco. Eso se mide como **LCP** (Largest Contentful Paint) — uno de los Core Web Vitals que Google usa para rankear.

En mobile con 4G regular, un bundle de 1MB puede tardar 3-5 segundos en ejecutar. Tres segundos de pantalla en blanco es suficiente para que el usuario cierre la pestaña.

Astro va en la dirección contraria.

---

## Cómo funciona Astro: MPA con Islands

Astro genera **HTML separado por cada ruta**. El contenido llega listo al navegador — sin esperar bundle, sin parsear JavaScript para ver algo.

```
Navegador pide /blog
  → Servidor responde: HTML completo con todo el contenido ya renderizado
  → Navegador muestra la página
  → JavaScript hidrata solo los componentes que lo necesitan
```

Esto se llama **MPA** (Multi Page Application). Cada ruta es su propio documento HTML.

La diferencia en números:

```
SPA (React puro)
  First contentful paint:   ~1.8s
  Largest contentful paint: ~3.2s
  JavaScript enviado:       ~800KB

Astro (mismo contenido)
  First contentful paint:   ~0.4s
  Largest contentful paint: ~0.6s
  JavaScript enviado:       ~12KB
```

---

## Islands Architecture: interactividad donde hace falta

El modelo de Astro se llama **Islands Architecture**. La página es HTML estático. Las partes interactivas son "islas" que se hidratan de forma independiente.

```astro
---
import SearchBar from './SearchBar.jsx';
import ThemeToggle from './ThemeToggle.svelte';
---

<!-- HTML puro — cero JavaScript -->
<header>
  <nav>...</nav>
  <!-- Isla — hidrata inmediatamente -->
  <ThemeToggle client:load />
</header>

<!-- HTML puro — cero JavaScript -->
<main>
  <h1>Blog</h1>
  <ul>...</ul>
</main>

<!-- Isla — hidrata solo cuando entra al viewport -->
<SearchBar client:visible />
```

Las directivas de hidratación te dan control preciso:

```
client:load    → inmediato, para interacción visible arriba del fold
client:idle    → cuando el browser queda disponible, no bloquea LCP
client:visible → cuando entra al viewport, ideal para contenido largo
client:only    → solo en cliente, sin SSR del componente
```

Además, Astro es agnóstico de framework. Podés mezclar React, Vue y Svelte en el mismo proyecto:

```astro
---
import ReactChart from './ReactChart.jsx';
import VueCalendar from './VueCalendar.vue';
import SvelteCounter from './SvelteCounter.svelte';
---

<ReactChart client:load />
<VueCalendar client:visible />
<SvelteCounter client:idle />
```

Eso funciona en producción. Sin configuración extra.

---

## SSG: el modo por defecto

Con `output: 'static'` (el default), Astro hace todo en build time:

```js
// astro.config.mjs
export default defineConfig({
  output: 'static', // default, no hace falta declararlo
});
```

```astro
---
// Esto se ejecuta UNA SOLA VEZ en build time
const posts = await fetch('https://tu-api.com/posts').then(r => r.json());
---
<ul>
  {posts.map(post => <li>{post.title}</li>)}
</ul>
```

`astro build` genera archivos `.html` por cada ruta. Esos archivos se suben a **S3 + CloudFront** y el servidor nunca entra en juego después.

Lo que ganás:
- Hosting prácticamente gratis
- CDN global sin configuración extra
- Sin cold starts, sin timeouts, sin memoria que gestionar
- Escala a millones de visitas sin tocar nada

El límite: el contenido tiene la edad del último build. Para un blog o documentación — completamente aceptable.

---

## SSR: cuándo tiene sentido moverse

Con `output: 'server'`, el comportamiento cambia por completo:

```js
// astro.config.mjs
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
```

```astro
---
// Esto se ejecuta en el SERVIDOR por cada request
const posts = await db.select().from(articles).orderBy(desc(articles.publishedAt));
// Datos siempre frescos — no dependen del último build
---
```

Ya no generás archivos. Generás un servidor Node.js que responde requests. Ese servidor corre en un **EC2, Lambda, contenedor en ECS**, o cualquier plataforma serverless que soporte Node.js.

```
SSG → archivos estáticos → S3 + CloudFront
SSR → servidor Node.js  → EC2 / Lambda / serverless
```

Las ventajas que SSR habilita:

**Datos frescos por request.** Un artículo publicado aparece en el siguiente refresh, no en el próximo deploy.

**Contenido personalizado.** SSG sirve el mismo HTML para todos. SSR puede leer una cookie, consultar la DB, y devolver HTML distinto por usuario.

```astro
---
const session = Astro.cookies.get('session')?.value;
const user = session ? await getUserFromSession(session) : null;
---
{user ? <Dashboard user={user} /> : <LoginPrompt />}
```

**Lógica de servidor integrada.** Validación, rate limiting, autenticación — en el mismo proceso que renderiza la página.

---

## Hybrid: lo mejor de los dos mundos

No es todo o nada. Con `output: 'hybrid'` mezclás rutas estáticas con rutas SSR:

```js
// astro.config.mjs
export default defineConfig({
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
});
```

```astro
---
// src/pages/blog/index.astro — pre-renderizada en build
export const prerender = true;
---
```

```astro
---
// src/pages/dashboard.astro — SSR por request
export const prerender = false;
const user = await getUser(Astro.request);
---
```

El blog es estático (S3 + CloudFront). El dashboard es dinámico (servidor). Mismo proyecto, sin reescribir nada.

---

## Optimización de imágenes

Las imágenes son habitualmente el recurso más pesado de una página. Una foto de 3MB en JPG puede convertirse en 180KB en AVIF sin pérdida perceptible de calidad.

Astro lo resuelve de forma nativa con `<Image />`:

```astro
---
import { Image } from 'astro:assets';
import foto from '../assets/foto.jpg';
---

<Image src={foto} alt="descripción" width={800} height={600} />
```

Lo que hace automáticamente:

**Conversión de formato.** Genera WebP y AVIF. El navegador recibe el formato más eficiente que soporta.

```
foto.jpg original: 2.4MB
  → foto.webp:     480KB  (navegadores modernos)
  → foto.avif:     180KB  (Chrome, Firefox)
```

**Prevención de layout shift.** Requiere `width` y `height`, los inyecta en el HTML. El navegador reserva espacio antes de cargar. Sin saltos de página.

**Lazy loading por defecto.** Las imágenes fuera del viewport no cargan hasta que el usuario llega a ellas.

**Responsive automático con `srcset`:**

```astro
<Image
  src={foto}
  alt="descripción"
  widths={[400, 800, 1200]}
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
/>
```

Un mobile no descarga una imagen de 1600px. Astro genera múltiples tamaños y el navegador elige.

Para imágenes remotas (CDN, base de datos), declarás el dominio en config:

```js
// astro.config.mjs
export default defineConfig({
  image: {
    domains: ['tu-cdn.com', 'images.unsplash.com'],
  },
});
```

---

## El veredicto

Todo apunta al mismo problema: **cuánto trabajo le mandás al navegador del usuario**.

Una SPA le manda todo el JavaScript y le dice "arreglátelas". Astro le manda HTML listo y JavaScript solo donde hace falta. Las imágenes optimizadas le mandan bytes útiles, no bytes de más.

Usá SSG cuando el contenido no cambia por usuario — blog, docs, portfolio, landing. El deploy va a S3 + CloudFront. Hosting casi gratis, escala sola.

Migrá a SSR cuando necesitás datos frescos por request, autenticación, o contenido personalizado. El servidor corre en EC2, Lambda, o cualquier plataforma que soporte Node.js.

El punto fuerte de Astro no es SSR — otros lo hacen igual de bien. El punto fuerte es que podés empezar estático, migrar rutas a SSR de a una, y nunca reescribir el proyecto desde cero.
