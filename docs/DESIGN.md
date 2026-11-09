# Design — Sistema visual

- **Estado:** Vigente
- **Última revisión:** 2026-11-08
- **Anterior:** [PRD.md](PRD.md) · **Siguiente:** [TECH-DESIGN.md](TECH-DESIGN.md)
- **Decisión:** [ADR 0003](adr/0003-diseno-mintlify.md)

## 1. Qué resuelve

Responde a estos puntos del PRD:
- **O4**, "verse profesional en cualquier pantalla";
- **RNF1**, responsive desde 390 px;
- **RF8**, modo claro y oscuro;
- **RF9**, escena 3D en la portada.

Quien llega desde un CV tiene que leer contenido, no decoraciones. Por eso el sistema prioriza tres cosas:
1. Texto de lectura cómoda.
2. Mucho blanco.
3. Un solo color de acento.

## 2. Principios

1. **El contenido manda.** De las decoraciones solo queda una, el hero 3D, y solo en la portada.
2. **Un archivo de verdad.** Todo valor visual sale de un token de `src/styles/global.css`. Ningún componente
   define colores ni tamaños sueltos.
3. **Claro por defecto.** El modo oscuro es una preferencia del visitante, no una decisión del sitio.
4. **Celular primero.** Cada layout se prueba a 390 px antes que en escritorio.

## 3. Tokens

### Tipografía

| Token | Valor | Uso |
|---|---|---|
| `--font-sans` | Inter | Todo el texto |
| `--font-mono` | Geist Mono | Código, etiquetas técnicas, stack |
| `--fs-micro` / `--fs-caption` | 12 / 13 px | Metadatos, pies |
| `--fs-sm` / `--fs-md` | 14 / 16 px | Interfaz / cuerpo de artículos y docs |
| `--fs-h5` … `--fs-h1` | 18 / 22 / 28 / 36 / 48 px | Títulos |

### Color (modo claro)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#ffffff` | Fondo |
| `--bg-sunken` | `#f7f7f7` | Superficies hundidas, código en línea |
| `--border` | `#e5e5e5` | Líneas finas, bordes de tarjeta |
| `--text` / `--text-strong` | `#1c1c1e` / `#0a0a0a` | Cuerpo / títulos |
| `--text-muted` | `#5a5a5c` | Descripciones |
| `--accent` | `#00b48a` | Enlaces y acento legible sobre blanco |
| `--accent-bright` | `#00d4a4` | Indicadores activos, CTA de acento |
| `--primary` | `#0a0a0a` | Botón principal (pill negro) |
| `--code-bg` | `#1c1c1e` | Bloques de código (oscuros en ambos modos) |

El modo oscuro redefine los mismos tokens bajo `html[data-mode="dark"]`. Los componentes no saben en qué modo
están.

### Forma y espacio

| Token | Valor | Uso |
|---|---|---|
| `--radius-lg` | 12 px | Tarjetas |
| `--radius-full` | pill | Botones, buscador, chips |
| `--max-w` | 1280 px | Ancho máximo del contenido |
| `--pad-x` | 32 px (16 px en celular) | Margen lateral |

## 4. Componentes

| Componente | Dónde | Regla |
|---|---|---|
| Header | `src/components/layout/Header.astro` | Marca, navegación (Blog, Docs, Cursos, Exámenes, Sobre mí, CV) y botón de modo |
| MobileNav | `src/components/layout/MobileNav.astro` | Menú en celular |
| Footer | `src/components/layout/Footer.astro` | Cuatro columnas: sitio, sobre mí, redes, stack |
| ModeToggle | `src/components/ModeToggle.astro` | Botón circular; guarda `site-mode` en `localStorage` |
| Tarjeta | `.blog-card`, `.repo` | Borde de 1 px, radio de 12 px, sin sombra salvo en hover |
| Botones | `.btn-primary`, `.btn-ghost`, `.btn-accent` | Pill; el hover cambia solo el color de fondo |
| Encabezado de página | `.page-head` | Eyebrow, título y bajada |

## 5. Layouts

| Página | Layout |
|---|---|
| Portada | Hero 3D (three.js + GSAP), cifras, últimos artículos |
| Blog y artículo | Grilla de tarjetas / columna de lectura de 720 px |
| Docs | Tres columnas: árbol de 240 px, contenido de 720 px, índice de 200 px. En celular, el árbol colapsa |
| Exámenes | Pregunta, opciones y temporizador visible |
| CV | Secciones apiladas: experiencia, proyectos, educación, cursos |

## 6. Reglas que se aprendieron en la implementación

- **No animes con CSS lo que anima GSAP.** Una transición de `opacity` en CSS hace que GSAP termine en el valor
  equivocado: el CTA de la portada quedó invisible por eso.
- **En grillas de celular, usá `minmax(0, 1fr)`, no `1fr`.** `1fr` crece con el contenido y desbordó la
  portada 13 px a 390 px.
- **Sin flash de tema.** `BaseHead.astro` lee `site-mode` antes de pintar.

## 7. Verificación

- `tests/e2e/responsive.spec.ts` comprueba que no haya desborde horizontal.
- `tests/e2e/visual-check.spec.ts` toma capturas de las páginas principales.
