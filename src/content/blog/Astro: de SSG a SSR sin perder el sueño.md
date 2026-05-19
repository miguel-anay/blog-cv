---
title: 'Astro: de SSG a SSR sin perder el sueño'
description: 'Por qué Astro arranca estático y cuándo tiene sentido pasarte a SSR. Las ventajas reales del framework, no el marketing.'
pubDate: 'May 18 2026'
---

Astro no es otro framework de React. No compite con Next.js. Compite con el problema de fondo: **mandás demasiado JavaScript al navegador y nadie te lo pidió**.

---

## Lo que Astro resuelve de entrada

La apuesta de Astro es simple: HTML y CSS son suficientes para la mayoría de las páginas. JavaScript va donde hace falta, no en todos lados.

El resultado es lo que llaman **Islands Architecture**. El servidor genera HTML estático. Si una parte de la página necesita interactividad — un toggle, un carrusel, un buscador — ese componente se hidrata solo, independiente del resto.

```
Página Astro
├── Header (HTML puro — sin JS)
├── Hero (HTML puro — sin JS)
├── ThemeToggle (React, client:load — JS solo acá)
├── ArticleList (HTML puro — sin JS)
└── Footer (HTML puro — sin JS)

JS enviado al navegador: solo el ThemeToggle
```

No es magia. Es elegir con precisión qué merece cargarse en el cliente.

---

## Las directivas de hidratación

Astro te da control quirúrgico sobre cuándo y cómo se carga el JavaScript de un componente:

```astro
<!-- Carga inmediata — para interacción visible arriba del fold -->
<SearchBar client:load />

<!-- Carga cuando el browser queda idle — no bloquea el LCP -->
<Analytics client:idle />

<!-- Carga cuando entra al viewport — perfecto para contenido largo -->
<CommentsSection client:visible />

<!-- Solo en cliente, sin SSR del componente -->
<LiveChat client:only="react" />
```

La diferencia con React puro: en React todo hidrata, querás o no. En Astro, lo que no marcás con `client:*` no envía ni un byte de JavaScript.

---

## SSG: el modo por defecto

Con `output: 'static'` (o sin configurar nada, es el default), Astro hace todo en build time:

```js
// astro.config.mjs
export default defineConfig({
  output: 'static', // default — no hace falta declararlo
});
```

```astro
---
// src/pages/blog/index.astro
// Esto se ejecuta UNA SOLA VEZ en build time
const posts = await fetch('https://tu-api.com/posts').then(r => r.json());
---
<ul>
  {posts.map(post => <li>{post.title}</li>)}
</ul>
```

Cuando corre `astro build`, genera archivos `.html` por cada ruta. Esos archivos se suben a S3 + CloudFront y el servidor nunca entra en juego después.

**Qué ganás:**
- Hosting prácticamente gratis (S3 cobra por GB almacenado, no por request)
- CDN global sin configuración extra
- Sin cold starts, sin timeouts, sin memoria que gestionar
- Escala a millones de visitas sin tocar nada

**El límite:** el contenido tiene la edad del último build. Si publicás un artículo nuevo, el HTML viejo sigue sirviendo hasta el próximo deploy.

Para un blog personal o documentación — completamente aceptable.

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
// src/pages/blog/index.astro
// Esto se ejecuta en el SERVIDOR por cada request
const posts = await db.select().from(articles).orderBy(desc(articles.publishedAt));
// Los datos son siempre frescos — no dependen del último build
---
```

La diferencia conceptual es importante: ya no generás archivos. Generás un servidor Node.js que responde requests.

Ese servidor necesita correr en algún lado: un EC2, un contenedor en ECS, una Lambda, una Vercel Function. Lo que sea que pueda ejecutar Node.js y escuchar en un puerto.

```
SSG → archivos estáticos → S3 + CloudFront
SSR → servidor Node.js  → EC2 / Lambda / serverless
```

---

## Las ventajas que SSR habilita

### Datos frescos por request

Con SSG, un artículo publicado en el CMS aparece en el blog en el próximo deploy. Con SSR, aparece en el próximo refresh.

### Contenido personalizado

SSG sirve el mismo HTML para todos. SSR puede mirar la request, leer una cookie, consultar la base de datos, y devolver HTML distinto por usuario.

```astro
---
const session = Astro.cookies.get('session')?.value;
const user = session ? await getUserFromSession(session) : null;
---
{user ? <Dashboard user={user} /> : <LoginPrompt />}
```

Imposible en SSG. Trivial en SSR.

### Lógica de servidor real

Validación de formularios, rate limiting, webhooks, autenticación. Todo eso requiere un servidor. Con SSR el servidor es el mismo proceso que renderiza la página.

---

## Hybrid: lo mejor de los dos mundos

No es todo o nada. Astro permite mezclar:

```js
// astro.config.mjs
export default defineConfig({
  output: 'hybrid', // SSG por defecto, SSR opt-in
  adapter: node({ mode: 'standalone' }),
});
```

```astro
---
// src/pages/blog/index.astro — esta ruta se pre-renderiza en build
export const prerender = true;
---
```

```astro
---
// src/pages/dashboard.astro — esta ruta es SSR
export const prerender = false;
const user = await getUser(Astro.request);
---
```

El blog es estático (S3 + CloudFront). El dashboard es dinámico (servidor). Mismo proyecto.

---

## Por qué Astro y no Next.js

Next.js es un framework de React con opiniones fuertes sobre todo. Astro es agnóstico: podés escribir componentes en React, Vue, Svelte, o solo HTML. Y lo mezcla sin conflicto.

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

Eso funciona. En producción. Sin configuración extra.

La razón práctica: si ya tenés componentes en un framework y querés migrar gradualmente, Astro los importa todos. No necesitás reescribir nada.

---

## El veredicto

Astro es la elección correcta cuando:

- El contenido no cambia por usuario (blog, docs, portfolio, landing)
- Querés el mejor rendimiento de carga sin trabajo extra
- Vas a hostear en S3 + CloudFront y no querés pagar por servidor

Migrás a SSR cuando:

- Necesitás contenido fresco en cada request
- Tenés autenticación o sesiones
- Querés lógica de servidor integrada en las páginas

El punto fuerte de Astro no es SSR — otros lo hacen igual de bien. El punto fuerte es que podés empezar estático, migrar rutas a SSR de a una, y nunca reescribir el proyecto desde cero.
