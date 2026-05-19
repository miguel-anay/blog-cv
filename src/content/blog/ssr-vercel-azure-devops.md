---
title: 'SSR con Vercel + Azure DevOps: el deploy que no baja la app'
description: 'Cómo montar un blog con Astro SSR, Turso como base de datos, Azure DevOps para CI y Vercel para CD — sin Lambda, sin cold starts, con preview deployments automáticos.'
pubDate: 'May 18 2026'
---

> Este post es la segunda parte de [SSG: todo lo que necesitás saber](/blog/ssg-todo-lo-que-necesitas-saber). Si todavía no lo leíste, arrancá por ahí — este post asume que ya entendés la diferencia entre SSG y SSR, y por qué SSG queda corto en ciertos casos.

---

## El problema que SSR resuelve

SSG genera HTML en build time. Todos los usuarios ven el mismo HTML. El contenido tiene la edad del último deploy.

Eso está perfecto para un blog. Pero en cuanto necesitás:

- Contenido que varía por usuario (dashboard, cuenta, perfil)
- Datos frescos en cada request (sin esperar un nuevo deploy)
- Lógica de autenticación antes de servir la página

...SSG no puede ayudarte. Ahí entra SSR.

```
── SSG (lo que hace) ───────────────────────────────────────────────

Build time: framework llama a la API → genera HTML para TODOS
Request:    usuario recibe un archivo HTML estático

Resultado:  todos ven lo mismo / contenido tiene edad del deploy

── SSR (lo que hace) ───────────────────────────────────────────────

Build time: solo compila el código
Request:    servidor ejecuta el código → genera HTML para ESE usuario

Resultado:  cada usuario puede recibir HTML distinto / datos frescos
```

---

## Por qué Vercel y no Lambda para SSR

En el post de SSG usamos Lambda para la blog-api (Hono + Turso). Funciona perfecto porque es liviana (~200KB compilado) y SSG la llama solo en build time.

El problema aparece cuando querés correr el **servidor SSR de Astro** en Lambda:

```
Bundle de Astro SSR sin comprimir: ~2.8MB
Lambda 512MB disponible:           ~0.33 vCPU para el INIT

Resultado: Lambda tarda 3-10 segundos en parsear el módulo
           → cold start inaceptable para un servidor web
```

Vercel resuelve esto por diseño — sus serverless functions están optimizadas para arrancar rápido con bundles grandes. Sin configuración extra.

Además:

| Característica | Lambda (AWS) | Vercel |
|---|---|---|
| Cold starts con bundle grande | ❌ 3-10 segundos | ✅ < 300ms |
| Preview deployments por PR | ❌ Manual y complejo | ✅ Automático |
| Canary deployment | ❌ CodeDeploy + aliases | ✅ Nativo en dashboard |
| SSL + dominio custom | ❌ ACM + Route53 + CloudFront | ✅ Un comando |
| Logs en tiempo real | ❌ CloudWatch (lag) | ✅ Dashboard instantáneo |

La tradeoff: menos control granular sobre la infraestructura. Para un proyecto personal — completamente aceptable.

---

## ¿Terraform para este stack?

En el post de SSG usamos Terraform para todo: S3, CloudFront, Lambda, CodePipeline, IAM. Tiene sentido porque son recursos de AWS que se crean, destruyen y replican.

Para este stack (Azure DevOps + Vercel + Turso + GitHub), **Terraform no es la herramienta correcta**.

Existen providers de Terraform para los tres:

```hcl
terraform {
  required_providers {
    azuredevops = { source = "microsoft/azuredevops" }
    vercel      = { source = "vercel/vercel" }
    github      = { source = "integrations/github" }
  }
}
```

Pero la ecuación para un proyecto personal no cierra:

```
Lo que ganás con Terraform:
  ✅ Setup reproducible
  ✅ Estado versionado

Lo que perdés:
  ❌ 3 tokens de API para manejar y rotar
  ❌ Estado .tfstate que tenés que guardar (y no commitear)
  ❌ Más setup que el problema que resuelve

La alternativa:
  azure-pipelines.yml  → IaC del pipeline (está en Git)
  vercel.json          → IaC del deploy (está en Git)
  CLI para setup inicial → 5 comandos, una sola vez
```

**Regla práctica**: usá Terraform cuando manejás infraestructura de AWS (recursos que creás, destruís y escalás). Para plataformas SaaS (Vercel, Azure DevOps) donde el setup es una sola vez, el CLI es la herramienta correcta.

---

## La arquitectura completa

```
Desarrollador
     │
     │ git push origin main
     ▼
┌─────────────────┐
│     GitHub      │  Repositorio fuente (blog-cv)
│   (main branch) │
└────────┬────────┘
         │ webhook (push event)
         │
    ┌────┴──────────────────────────┐
    │                               │
    ▼                               ▼
┌───────────────────┐      ┌────────────────────┐
│   Azure DevOps    │      │      Vercel         │
│   Pipelines       │      │                     │
│                   │      │  Cada PR:           │
│  CI:              │      │  → URL de preview   │
│  ✅ typecheck      │      │    única y lista    │
│  ✅ build check    │      │    para revisar     │
│  ✅ publica logs   │      │                     │
│                   │      │  Cada push a main:  │
│  Si falla → ❌     │      │  → Deploy a prod    │
│  notifica al dev  │      │  → SSL automático   │
│                   │      │  → CDN global       │
└───────────────────┘      └─────────┬──────────┘
                                     │
                           ┌─────────▼──────────┐
                           │  Vercel Functions   │
                           │  (Astro SSR)        │
                           │                     │
                           │  Por cada request:  │
                           │  ejecuta código →   │
                           │  llama a Turso →    │
                           │  devuelve HTML      │
                           └─────────┬──────────┘
                                     │ libSQL (HTTP)
                           ┌─────────▼──────────┐
                           │       Turso         │
                           │  (libSQL en la nube)│
                           └─────────────────────┘
```

Sin Lambda intermediaria. Sin S3. Sin CloudFront. Sin API Gateway. El servidor Astro en Vercel llama a Turso directo con Drizzle.

---

## Cómo funciona SSR en Astro

La configuración es simple. En lugar de `output: 'static'` (SSG), usás `output: 'server'` con el adapter de Vercel:

```js
// astro.config.mjs
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',      // cada request ejecuta código
  adapter: vercel(),     // Vercel maneja el runtime
  site: 'https://blog.miguel-anay.nom.pe',
})
```

Con `output: 'server'`, cada página tiene acceso a la request en tiempo real:

```astro
---
// src/pages/blog/index.astro
// Esto se ejecuta en el servidor por cada request
const { data: articles, meta } = await getArticles({ page: 1, pageSize: 10 });
// Los artículos son siempre frescos — no dependen del último build
---

<ol>
  {articles.map(post => <BlogCard {...post} />)}
</ol>
```

---

## La conexión directa a Turso

Sin Lambda intermediaria, el servidor Astro en Vercel se conecta a Turso con Drizzle directamente:

```typescript
// src/lib/db.ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (_db) return _db;
  _db = drizzle(
    createClient({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_TOKEN,
    }),
    { schema }
  );
  return _db;
}
```

```typescript
// src/lib/api.ts — query directa, sin HTTP intermediario
export async function getArticles(opts = {}): Promise<ArticleListResponse> {
  const db = getDb();
  const rows = await db
    .select({ article: articles, author: authors })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .orderBy(desc(articles.publishedAt))
    .limit(opts.pageSize ?? 10)
    .offset(((opts.page ?? 1) - 1) * (opts.pageSize ?? 10));

  // ... armar response con categorías
}
```

En SSG (post anterior), `api.ts` hacía un `fetch` a la Lambda URL. En SSR, llama a la base de datos directamente. Menos latencia, menos puntos de fallo.

---

## El CI con Azure DevOps

Azure DevOps Pipelines se conecta al repo de GitHub. Cada push y cada PR disparan el pipeline definido en `azure-pipelines.yml`:

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main, develop]

pr:
  branches:
    include: [main]

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: blog-cv-secrets    # TURSO_URL, TURSO_TOKEN
  - name: NODE_VERSION
    value: '22'

stages:
  - stage: CI
    displayName: 'Continuous Integration'
    jobs:
      - job: Validate
        displayName: 'Typecheck + Build'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(NODE_VERSION)

          - script: npm install -g pnpm
            displayName: 'Install pnpm'

          - script: pnpm install --frozen-lockfile
            displayName: 'Install dependencies'

          - script: pnpm astro check
            displayName: 'Astro typecheck'

          - script: pnpm build
            displayName: 'Build verification'
            env:
              TURSO_URL: $(TURSO_URL)
              TURSO_TOKEN: $(TURSO_TOKEN)
```

**Variable groups**: los secretos (`TURSO_URL`, `TURSO_TOKEN`) viven en un variable group en Azure DevOps — no en el repositorio. El pipeline los inyecta como variables de entorno durante la ejecución.

```
Azure DevOps → Yiwu → Pipelines → Library → blog-cv-secrets
  TURSO_URL    = libsql://blog-prod-miguelanay.aws-us-east-1.turso.io
  TURSO_TOKEN  = *** (secreto, no se muestra)
```

**¿Por qué Azure DevOps si Vercel ya buildea?**

Vercel también typecheckea y compila cuando deployea. La diferencia es que Azure DevOps:
- Falla en el CI antes de que Vercel intente deployar
- Da feedback claro al desarrollador con logs estructurados
- Puede tener gates adicionales: tests de integración, coverage, security scans
- Bloquea el PR si el CI no pasa — Vercel solo deployea si el código llega

El CI es la red de seguridad. El CD es el actuador.

---

## El CD con Vercel

Vercel se conecta a GitHub y despliega automáticamente. No hay YAML de deploy que mantener — Vercel escucha el repositorio.

### Setup inicial (una sola vez)

```bash
# Linkear el proyecto local a Vercel
npx vercel link
# → Seleccionar cuenta / nombre del proyecto

# Agregar variables de entorno a producción
echo "libsql://tu-db.turso.io" | npx vercel env add TURSO_URL production
echo "tu-token" | npx vercel env add TURSO_TOKEN production

# Conectar el repo de GitHub (desde vercel.com → Settings → Git)
# → GitHub → tu-usuario/blog-cv → Connect

# Dominio custom (una sola vez)
npx vercel domains add blog.miguel-anay.nom.pe
# → Vercel genera el certificado SSL automáticamente
# → Configurar CNAME en tu DNS: cname.vercel-dns.com
```

La config del proyecto vive en `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "astro",
  "outputDirectory": "dist"
}
```

### Preview deployments por PR

Cada PR abierto contra `main` genera una URL única lista para revisar:

```
PR #12 "feat: agregar sección de newsletter"
  └─ Vercel build
       └─ https://blog-cv-git-feat-newsletter-miguel-anays-projects.vercel.app

PR #13 "fix: paginación en mobile"
  └─ Vercel build
       └─ https://blog-cv-git-fix-pagination-miguel-anays-projects.vercel.app
```

Revisás el feature en producción real antes de mergear. Cuando mergeás a `main`, Vercel deployea a producción automáticamente.

### Canary deployment

Vercel tiene traffic splitting nativo. Sin CodeDeploy, sin aliases de Lambda, sin configuración extra:

```
Vercel Dashboard → Deployment → Promote → Traffic Split

Versión v42 (actual) ████████████████████████▓▓░░  90%
Versión v43 (nueva)  ░░░░░░░░░░░░░░░░░░░░░░░░░▒▓██  10%

[monitoreo: error rate, latencia, Core Web Vitals]

sin errores → 100% a v43
con errores → rollback automático a v42
```

---

## El flujo completo de un deploy

```
1. git push origin main
   │
2. GitHub notifica a Azure DevOps y Vercel (webhook)
   │
   ├─→ Azure DevOps (~2 minutos)
   │     pnpm install
   │     pnpm astro check  ← falla acá si hay error de tipos
   │     pnpm build        ← falla acá si el código no compila
   │     ✅ o ❌ → notificación al desarrollador
   │
   └─→ Vercel (~45 segundos)
         pnpm install
         pnpm build (astro build)
         bundle serverless function
         deploy a edge network global
         ✅ URL de producción lista
```

Desde el `git push` hasta que el usuario ve la versión nueva: **menos de 60 segundos**.

---

## Separación de responsabilidades

| | GitHub | Azure DevOps | Vercel | Turso |
|---|---|---|---|---|
| **Rol** | Fuente de verdad | CI — valida | CD — despliega | DB — almacena |
| **Qué ve** | Todo el código | Código fuente + secretos de CI | Código fuente + env vars prod | Solo consultas |
| **Puede modificar prod** | ❌ | ❌ | ✅ | N/A |
| **Falla si hay error de tipos** | N/A | ✅ | ✅ (también buildea) | N/A |
| **Rollback** | N/A | N/A | ✅ un click | N/A |

El principio es el mismo que en SSG: **el proceso que valida no despliega, el proceso que despliega no compila**.

---

## ¿Cuándo usar SSR en lugar de SSG?

| Necesitás... | Usá |
|---|---|
| Blog, portfolio, documentación, landing | SSG + AWS (CodePipeline + S3 + CloudFront) |
| Contenido igual para todos los usuarios | SSG |
| Datos frescos por request | SSR + Vercel |
| Autenticación en el servidor | SSR + Vercel |
| Preview deployments por PR | SSR + Vercel |
| Costo mínimo (centavos por mes) | SSG |
| Sin cold starts garantizado | SSR + Vercel |

La regla: si todos los usuarios ven lo mismo y el contenido puede tener minutos de delay → SSG. Si el contenido varía por usuario o necesita ser fresco en cada request → SSR con Vercel.

---

## Conclusión

Este stack no usa AWS. No hay Terraform. No hay buckets que configurar ni pipelines de CloudFormation que debuggear.

Lo que tiene:

1. **GitHub**: fuente de verdad, con branches claros (`main` = producción, `SSR`, `SSG`)
2. **Azure DevOps CI**: typecheck + build antes de que cualquier cosa llegue a producción
3. **Vercel CD**: deploy automático, preview por PR, canary nativo, SSL automático
4. **Turso**: base de datos libSQL en la nube, conexión directa desde Vercel sin intermediarios
5. **Drizzle**: queries type-safe directas, sin ORM pesado ni HTTP extra

El `azure-pipelines.yml` y el `vercel.json` que vivien en el repo **son** el IaC de este stack. No necesitás Terraform para algo que podés versionar en dos archivos de configuración.

Desde el `git push` hasta que el usuario ve la versión nueva: **menos de 60 segundos**. Sin rezar. Sin downtime.
