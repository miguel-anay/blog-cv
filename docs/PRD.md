# PRD — Sitio personal de Miguel Anay

- **Estado:** Vigente
- **Última revisión:** 2026-11-08
- **Siguiente documento del pipeline:** [DESIGN.md](DESIGN.md)

> Este PRD se escribió en noviembre de 2026, con el producto ya en producción, para ordenar lo que el sitio
> promete y medirlo. Las decisiones anteriores están registradas en [`adr/`](adr/README.md).

## 1. Problema

Un desarrollador que busca trabajo o clientes tiene su experiencia repartida: el CV en un PDF, los artículos
en LinkedIn, los apuntes de cursos en Drive y la documentación de sus proyectos en cada repositorio. Quien
evalúa su perfil tiene que juntar todo eso a mano, y lo que no encuentra en dos minutos no existe.

Además, preparar certificaciones exige practicar con exámenes cronometrados, y las plataformas que los
ofrecen son pagas o no permiten cargar preguntas propias.

## 2. Usuarios

| Usuario | Qué busca | Qué lo frustra hoy |
|---|---|---|
| **Reclutador o cliente** | Evaluar en minutos la experiencia y la forma de pensar | Un CV en PDF sin evidencia de trabajo real |
| **Desarrollador lector** | Artículos técnicos y documentación de proyectos | Contenido disperso y sin búsqueda |
| **Estudiante de certificación** | Practicar exámenes con tiempo y ver resultados | Registrarse y pagar para practicar |
| **Miguel (autor)** | Publicar sin tocar código | Desplegar para corregir una coma |

## 3. Objetivos

| # | Objetivo | Cómo se mide |
|---|---|---|
| O1 | Concentrar perfil, contenido y proyectos en un solo sitio | Blog, CV, cursos, exámenes y docs accesibles desde la navegación principal |
| O2 | Publicar sin desplegar | Un artículo, curso o pregunta cargado en la base aparece sin build |
| O3 | Practicar exámenes sin cuenta | Un visitante completa un examen sin registrarse |
| O4 | Verse profesional en cualquier pantalla | 0 px de desborde horizontal a 390 px; texto de 14 a 16 px |
| O5 | Documentación de proyectos siempre al día | Un cambio en el repo se ve en `/docs` en menos de 15 minutos |

## 4. Fuera de alcance

- Cuentas de usuario, login o perfiles ([ADR 0002](adr/0002-sin-login.md)).
- Comentarios en artículos.
- Panel de administración web: el contenido se carga con skills de Claude Code (`/publish-articulo`,
  `/publish-cv`, `/publish-pregunta`) directo en la base.
- Monetización.

## 5. Requisitos funcionales

| ID | Requisito | Prioridad | Objetivo |
|---|---|---|---|
| RF1 | Listado paginado de artículos con categorías y página por artículo | Must | O1, O2 |
| RF2 | RSS y sitemap del contenido publicado | Must | O1 |
| RF3 | CV con datos personales, experiencia, proyectos, educación y cursos | Must | O1, O2 |
| RF4 | Cursos con secciones y recursos | Should | O1, O2 |
| RF5 | Exámenes cronometrados: iniciar, responder, pausar, reanudar, enviar y ver resultados | Must | O3 |
| RF6 | Un intento solo puede verlo o modificarlo quien lo creó | Must | O3 |
| RF7 | `/docs/<repo>` publica el `README.md` y `docs/**/*.md` de repos permitidos, con árbol, índice y búsqueda | Should | O5 |
| RF8 | Modo claro por defecto y modo oscuro opcional que se recuerda | Could | O4 |
| RF9 | Portada con escena 3D | Could | O4 |

## 6. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF1 | Responsive desde 390 px, sin scroll horizontal |
| RNF2 | El sitio no expone secretos al cliente; credenciales solo en variables de entorno de Vercel |
| RNF3 | `/docs` no funciona como proxy abierto: solo repos de una lista permitida |
| RNF4 | Si GitHub falla, solo `/docs` se degrada; el resto del sitio responde |
| RNF5 | Cada cambio pasa CI (type check, tests y build) antes del merge |

## 7. Métricas de éxito

- Las 13 rutas públicas responden 200 en producción.
- El flujo de examen pasa el E2E `tests/e2e/exam-flow.spec.ts`.
- Ningún hallazgo de severidad alta abierto en [SECURITY.md](SECURITY.md).

## 8. Trazabilidad

| Documento | Responde a |
|---|---|
| [DESIGN.md](DESIGN.md) | RF8, RF9, O4, RNF1 |
| [TECH-DESIGN.md](TECH-DESIGN.md) | Todos los RF y RNF |
| [adr/](adr/README.md) | Las decisiones que tomó TECH-DESIGN |
| [BACKLOG.md](../BACKLOG.md) | Cada ítem cita su RF |
| [SECURITY.md](SECURITY.md) | RF6, RNF2, RNF3 |
