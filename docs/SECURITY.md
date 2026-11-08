# Reporte de seguridad — Sitio personal de Miguel Anay

- **Estado:** Vigente (hallazgos abiertos, ninguno corregido en este documento)
- **Fecha:** 2026-11-08
- **Alcance:** código de `blog-cv` (Astro 5 SSR en Vercel, Turso/libSQL vía Drizzle, sin login): middleware del invitado, API de exámenes (`src/pages/api/exams/**`), módulo `/docs` (GitHub API), renderizado de HTML, manejo de secretos, cabeceras HTTP y dependencias de producción.
- **Metodología:** revisión manual del código + `pnpm audit --prod`. No se hicieron pruebas dinámicas ni pruebas contra producción.
- **Documento anterior:** [PRD.md](PRD.md) (RF6, RNF2, RNF3 son los requisitos que este reporte responde)
- **Documento relacionado:** [TECH-DESIGN.md](TECH-DESIGN.md)

Este reporte es la respuesta de seguridad al PRD. Cada hallazgo cita archivo y línea leídos durante la revisión;
lo que no se pudo verificar se declara como tal.

## 1. Requisitos del PRD y veredicto

| Requisito | Enunciado | Veredicto |
|---|---|---|
| RF6 | Un intento solo puede verlo o modificarlo quien lo creó | Cumplido (ver C-02, C-03). Observaciones menores: S-05, S-06 |
| RNF2 | El sitio no expone secretos al cliente; credenciales solo en variables de entorno de Vercel | Cumplido en el código revisado (ver C-07). Observación: S-09 |
| RNF3 | `/docs` no funciona como proxy abierto: solo repos de una lista permitida | Cumplido (ver C-05, C-06) |

## 2. Resumen de hallazgos

| ID | Severidad | Área | Hallazgo | Estado |
|---|---|---|---|---|
| S-01 | Media | Dependencias | `pnpm audit --prod`: 94 vulnerabilidades (3 críticas, 36 altas); `astro` 5.18.1 y `drizzle-orm` 0.43.1 instalados entran en rangos afectados | Abierto |
| S-02 | Media | Cabeceras | Sin CSP ni otras cabeceras de seguridad configuradas | Abierto |
| S-03 | Baja | XSS | `set:html` sin sanitizador sobre contenido de Strapi, de la base de datos y SVG | Aceptado (fuente confiable) |
| S-04 | Baja | XSS | `innerHTML` con `textContent` de encabezados y `id` en el índice de `BlogPost.astro` | Abierto |
| S-05 | Baja | Autorización | `403` vs `404` revela qué ids de intento existen (ids enteros secuenciales) | Aceptado |
| S-06 | Baja | Validación | `answers` no valida que pregunta/opción pertenezcan al examen del intento; cuerpo JSON `null` produce 500 | Abierto |
| S-07 | Baja | Disponibilidad | Creación ilimitada de invitados (una fila `user` por cookie nueva), sin límite de tasa | Abierto |
| S-08 | Baja | Esquema | Tablas heredadas de Better Auth (`session`, `account`, `verification`) sin uso, con columnas de credenciales | Abierto |
| S-09 | Baja | Secretos / CI | Variables `BETTER_AUTH_*`, `GOOGLE_*`, `FACEBOOK_*`, `LINKEDIN_*` aún en `ci.yml` | Abierto |
| S-10 | Info | Cookie | La cookie `guest_id` no usa el prefijo `__Host-` | Aceptado |

No se encontró ningún hallazgo de severidad Alta confirmado. S-01 puede escalar a Alta si se verifica que una
de las vulnerabilidades críticas es alcanzable en ejecución (ver su sección).

## 3. Hallazgos

### S-01 — Dependencias con vulnerabilidades conocidas (Media, Abierto)

**Evidencia.** `pnpm audit --prod` (con red, ejecutado el 2026-11-08) terminó con:
`94 vulnerabilities found — Severity: 7 low | 48 moderate | 36 high | 3 critical`.

- Versiones instaladas: `astro` 5.18.1 y `drizzle-orm` 0.43.1 (`node_modules/*/package.json`); `package.json:33-34` declara `^5.14.1` y `^0.43.1`.
- Las 3 críticas según el audit:
  - `astro`: ejecución remota de código en la optimización de imágenes AVIF (afecta `<7.2.8`), ruta `.>@astrojs/mdx>astro`.
  - `tar` (`<=7.5.18`, DoS de decodificación): ruta `.>@astrojs/vercel>@vercel/nft>@mapbox/node-pre-gyp>tar`, es decir, herramienta de build.
  - `shell-quote` (`<=1.8.3`): ruta `blog-api>drizzle-orm>gel>shell-quote`, solo en el workspace `blog-api` (`pnpm-workspace.yaml`).
- Altas relevantes: `drizzle-orm <0.45.2` (inyección SQL por identificadores mal escapados), `astro` (XSS reflejado por nombre de slot, SSRF por cabecera Host en la página de error prerenderizada), `vite`, `hono`, `devalue`, `zod`, entre otras.
- El conteo incluye rutas del workspace `blog-api`, que no se despliega con el sitio; no se separó cuántas de las 94 pertenecen solo a ese workspace.

**Riesgo.** Las versiones de `astro` y `drizzle-orm` instaladas están en rangos marcados como vulnerables. No se
verificó la alcanzabilidad: el código revisado no construye identificadores SQL dinámicos con entrada del usuario
(ver C-04), lo que reduce la exposición a la advertencia de Drizzle; no se comprobó si el sitio usa el endpoint de
optimización de imágenes que afectaría la crítica de `astro`. Varias del resto son transitivas de herramientas de build.

**Recomendación.** Actualizar `drizzle-orm` a `>=0.45.2` y `astro` a una versión parcheada (evaluando el salto de
versión mayor reportado por el audit); ejecutar `pnpm audit --prod` en CI; revisar `pnpm why` de cada crítica para
separar build-time, workspace `blog-api` y runtime.

### S-02 — Sin CSP ni cabeceras de seguridad (Media, Abierto)

**Evidencia.** `vercel.json:1-13` solo define comandos de build y una redirección `www`; no hay clave `headers`.
`astro.config.mjs:1-50` no configura cabeceras y `src/middleware.ts:1-50` no las agrega. No existe `public/_headers`.
Solo `docs/[repo]/[...page].astro:35` fija `Cache-Control`.

**Riesgo.** Sin `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ni protección de
framing, cualquier fallo de inyección de HTML (S-03, S-04) no tiene segunda barrera. No hay evidencia de
explotación; es una defensa en profundidad ausente.

**Recomendación.** Agregar `headers` en `vercel.json` (al menos `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`) y una CSP en modo `Report-Only` antes de endurecerla;
hay scripts inline en componentes (p. ej. `DocsShell.astro:370+`), por lo que la CSP necesitará nonces o hashes.

### S-03 — `set:html` sin sanitizador (Baja, Aceptado)

**Evidencia.**
- `src/pages/blog/components/RichTextRenderer.astro:202`: `set:html={block.body}` para `shared.rich-text` (contenido de Strapi).
- `src/features/courses/components/SectionList.astro:40`: `set:html={marked.parse(section.content)}`; `marked` no sanitiza y el contenido viene de la tabla `course_sections`. No hay `DOMPurify` ni similar en `package.json` (grep de `sanitize|DOMPurify` sin resultados).
- `src/features/blog/components/DiagramBlock.astro:58,87`: `set:html={svg}`; un SVG puede contener `<script>`.
- `src/features/docs/components/DocsShell.astro:98`: `set:html={html}` con HTML de la API de GitHub (`Accept: application/vnd.github.html`, `github-docs.ts:149`), que GitHub entrega sanitizado (comentario en `github-docs.ts:2-3`). Es la única de las cuatro con sanitización de un tercero; la reescritura de `href`/`src` (`github-docs.ts:86-103`) deja intactas las URL con esquema (`isExternal`, línea 78).

**Riesgo.** Todas las fuentes las controla el autor (CMS, base de datos propia, repo allowlisted), por lo que
la explotación requiere comprometer esas fuentes. Si se compromete cualquiera, el XSS es directo y almacenado.

**Recomendación.** Aceptado mientras las fuentes sean exclusivamente del autor. Si se abre la edición a terceros,
sanitizar en servidor antes de `set:html`. La CSP de S-02 reduciría el impacto.

### S-04 — `innerHTML` con texto de encabezados (Baja, Abierto)

**Evidencia.** `src/layouts/BlogPost.astro:194`: ``li.innerHTML = `<a href="#${h.id}" ...>${h.textContent}</a>` ``,
donde `h` son encabezados del propio artículo; `h.id` puede derivarse de `textContent` (líneas 187-192, aunque
ese camino lo limpia a `[a-z0-9-]`). Si el `id` ya existe en el HTML, se usa tal cual.

**Riesgo.** Un encabezado cuyo texto contenga marcado literal escapado (por ejemplo `&lt;img onerror=...&gt;` mostrado
como texto) se reinterpreta como HTML al pasar por `textContent` → `innerHTML` (DOM XSS). Requiere que el autor
publique ese contenido; no hay entrada de visitantes en ese camino.

**Recomendación.** Construir el nodo con `createElement('a')`, `a.href = '#' + id`, `a.textContent = h.textContent`.

Sin riesgo equivalente: `DocsShell.astro:381` escapa con `esc()` (línea 373) antes de `innerHTML`, y
`attempt-controller.ts:292` asigna literales constantes.

### S-05 — `403` frente a `404` enumera intentos (Baja, Aceptado)

**Evidencia.** `src/pages/api/exams/attempts/_lib.ts:35-41`: id inexistente → 404; id de otro usuario → 403.
Los ids son enteros positivos (`_lib.ts:12-16`).

**Riesgo.** Un visitante puede saber qué ids de intento existen. No obtiene datos ni puede operar sobre ellos
(RF6 se mantiene, ver C-02). Impacto de confidencialidad nulo salvo conteo aproximado de intentos.

**Recomendación.** Aceptar o responder 404 en ambos casos; el costo del cambio es bajo.

### S-06 — Validación incompleta en `answers` (Baja, Abierto)

**Evidencia.**
- `src/pages/api/exams/attempts/[id]/answers.ts:21-25`: `body = await context.request.json()` dentro de `try`, pero el cuerpo `null` es JSON válido; la línea 27 (`body.questionId`) lanza `TypeError` fuera del `try` y produce 500 en lugar de 400.
- `src/lib/exam-api.ts:334-386` (`saveAnswer`): inserta/actualiza con `questionId` y `selectedOptionId` tal como llegan; no comprueba que la pregunta pertenezca al examen del intento ni que la opción pertenezca a la pregunta. Solo actúan las claves foráneas, si están activas.

**Riesgo.** Un visitante solo puede ensuciar sus propios intentos (la propiedad sí se verifica); si la corrección
calcula el puntaje recorriendo las preguntas del examen (`exam-api.ts:419-426`), las filas ajenas no deberían contar.
No se verificó el cálculo de puntaje de extremo a extremo.

**Recomendación.** Validar el tipo del cuerpo (`typeof body === 'object' && body !== null`) y comprobar
pertenencia pregunta→examen y opción→pregunta antes de guardar.

### S-07 — Creación ilimitada de invitados (Baja, Abierto)

**Evidencia.** `src/middleware.ts:19-45`: cualquier petición a `/exams` o `/api/exams` sin cookie válida genera un
UUID; en métodos distintos de GET/HEAD, línea 44, inserta una fila en `user` (`onConflictDoNothing`). No hay límite
de tasa en el repositorio revisado (no se encontró ninguno en `src/`, `vercel.json` ni `astro.config.mjs`).
Las peticiones con cookie válida también ejecutan el insert en cada escritura.

**Riesgo.** Un cliente que descarte cookies puede inflar la tabla `user` y consumir cuota de Turso. Impacto:
coste/disponibilidad, no confidencialidad.

**Recomendación.** Limitar tasa en el borde (Vercel Firewall) y/o crear la fila solo al crear un intento; limpieza
periódica de invitados sin intentos.

### S-08 — Tablas de autenticación heredadas (Baja, Abierto)

**Evidencia.** `src/lib/schema.ts:211-260` (sección "Better Auth tables"): `user`, `session` (con `token`, `ipAddress`,
`userAgent`), `account` (con `accessToken`, `refreshToken`, `idToken`, `password`) y `verification`. Solo `user`
se usa (`middleware.ts:3,44`, y la clave foránea `exam_attempts.user_id`, `schema.ts:181`); un grep en `src/` de
`session|account|verification` no encontró uso fuera del esquema. El ADR [0002-sin-login](adr/0002-sin-login.md)
documenta que el sitio no tiene login.

**Riesgo.** Superficie sin propósito: si alguna vez se escribieran datos allí, serían credenciales en una base sin
controles pensados para ellas. Hoy no se escriben desde el código.

**Recomendación.** Eliminar `session`, `account` y `verification` del esquema con una migración revisada
(cambio sobre datos persistidos: verificar primero que las tablas estén vacías en Turso, lo que esta revisión no comprobó).
La fila de invitado usa `email` sintético `guest_<uuid>@guest.local` (`middleware.ts:35`), sin datos personales.

### S-09 — Variables de un sistema de login retirado en CI (Baja, Abierto)

**Evidencia.** `.github/workflows/ci.yml:31-38` inyecta `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_*`,
`FACEBOOK_*` y `LINKEDIN_*` desde secretos de GitHub en el paso de build. Ningún archivo de `src/` las lee
(el grep de `BETTER_AUTH` solo devolvió `ci.yml`, `docs/adr/0002-sin-login.md` y `openspec/changes/better-auth/*`;
`.env.example` no las lista).

**Riesgo.** Secretos vigentes sin uso quedan expuestos a cada ejecución de CI. No hay evidencia de fuga.

**Recomendación.** Quitar esas líneas de `ci.yml` y borrar los secretos correspondientes en GitHub (acción manual
del propietario; no verificable desde el código).

### S-10 — Cookie sin prefijo `__Host-` (Info, Aceptado)

**Evidencia.** `src/middleware.ts:9,24-30`: nombre `guest_id`, `path: '/'`, `httpOnly`, `sameSite: 'lax'`,
`secure` condicionado a HTTPS, `maxAge` de un año.

**Riesgo.** Sin `__Host-`, un subdominio hermano podría fijar una cookie `guest_id`. El valor debe ser un UUID
(`middleware.ts:10,21`) y no otorga acceso a intentos ajenos sin conocer el UUID de otro invitado (no enumerable
con 122 bits aleatorios), por lo que el impacto práctico es una fijación de sesión anónima.

**Recomendación.** Opcional: renombrar a `__Host-guest_id` (requiere `secure` siempre, que en desarrollo local por HTTP no aplica).

## 4. Controles verificados

| ID | Control | Evidencia |
|---|---|---|
| C-01 | Cookie de invitado: UUID generado con `crypto.randomUUID()` (CSPRNG), validado con regex antes de usarse como clave; `httpOnly`, `sameSite=lax`, `secure` en HTTPS | `middleware.ts:10,19-31` |
| C-02 | Propiedad de intentos en las 5 rutas con `[id]` (`status`, `submit`, `answers`, `resume`, `pause`): todas llaman a `resolveOwnedAttemptId` (400/404/403) antes de la lógica; la identidad sale de `context.locals.user` (cookie), nunca del cuerpo | `[id]/status.ts:11`, `submit.ts:12`, `answers.ts:17`, `resume.ts:13`, `pause.ts:11`; `_lib.ts:26-44` |
| C-03 | Defensa en profundidad: las funciones de datos filtran por `userId` en la propia consulta (`getAttemptById` con `and(eq(id), eq(userId))`; `UPDATE` con ambas condiciones). Las páginas SSR del intento y de resultados usan `getAttemptById(…, user.id)`. `POST /attempts` toma `userId` de la sesión, no del formulario | `exam-api.ts:160-166,290,313,450`; `[attemptId].astro:25`; `results.astro:20,40`; `attempts/index.ts:9,24` |
| C-04 | Inyección SQL: todo el acceso a datos pasa por el constructor de Drizzle (`eq`, `and`, `isNotNull`) con valores parametrizados; el grep de `sql\``, `sql.raw`, `.execute(`, `.run(` en `src/` no devolvió ningún resultado | `exam-api.ts` (ej. 24, 52, 87, 166); `db.ts:19` |
| C-05 | Proxy abierto / SSRF: el parámetro `repo` se resuelve contra la lista `DOC_REPOS` y se responde 404 si no está; `owner` y `repo` salen de la lista, nunca del usuario; el host de la petición es siempre `api.github.com` | `docs/[repo]/[...page].astro:8-9`; `repos.ts:20-28`; `github-docs.ts:133` |
| C-06 | Recorrido de rutas en `[...page]`: el parámetro `page` solo se compara con `docFiles` (rutas que GitHub devolvió en el árbol, filtradas a `docs/*.md` sin segmentos ocultos); la ruta consultada es `docs/<entrada de la lista>`, no el texto del usuario | `[...page].astro:19-23`; `github-docs.ts:36-42` |
| C-07 | Secretos: `.env`, `.env.local` están ignorados (`.gitignore:59` `.env*`) y `git ls-files` solo muestra `.env.example` (versionado pese al patrón), que contiene marcadores (`libsql://tu-db…`, `eyJ...`, `re_...`). `TURSO_*` y `GITHUB_TOKEN` se leen en servidor (`db.ts:10-11`, `github-docs.ts:126`); no hay variables `PUBLIC_*` en `src/` (grep sin resultados). `.vercel/` está ignorado y sin archivos versionados | `.gitignore:42,59`; `git ls-files` |
| C-08 | CSRF en formularios: Astro 5 aplica `checkOrigin` por defecto y `astro.config.mjs:20-33` declara `allowedDomains` para que el origen coincida detrás de Vercel; combinado con `sameSite=lax`, un POST entre sitios no lleva la cookie | `astro.config.mjs:17-33`; `middleware.ts:27` |
| C-09 | Validación de entradas numéricas: `examId`, `questionId`, `selectedOptionId` y `[id]` se validan como enteros positivos antes de usarse; `flaggedForReview` solo acepta booleano | `attempts/index.ts:18-22`; `answers.ts:27-39`; `_lib.ts:12-16` |
| C-10 | Estado del tiempo del examen: pausa/reanudación/envío son del servidor y `saveAnswer` rechaza escrituras en intento pausado o vencido, incluso por llamada directa a la API | `exam-api.ts:347-359` |

## 5. Fuera de alcance

- Pruebas dinámicas (fuzzing, escaneo DAST, pruebas de penetración) y revisión de infraestructura de Vercel o Turso (ACL de la base, tokens, rotación, firewall).
- El workspace `blog-api` y `infra/` (Terraform): solo aparecen en el audit como rutas de dependencia; el código no se revisó.
- Newsletter (Resend), formularios de contacto y cualquier otra ruta de `src/pages/api/` distinta de `exams`; solo existen las rutas de exámenes listadas en la revisión.
- Contenido real de Strapi, de la base de datos y de los repositorios documentados (se asume escrito por el autor).
- Estado real de los secretos en GitHub Actions y en Vercel, y si las tablas heredadas contienen filas.
- Historial completo de git (no se buscaron secretos en commits anteriores; solo el estado actual de los archivos versionados).
- Alcanzabilidad en ejecución de cada una de las 94 vulnerabilidades del audit.
