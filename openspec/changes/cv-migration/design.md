# Design: CV Migration (Next.js → Astro `/cv`)

## Technical Approach

Static, JSON-driven Astro page that composes feature-local section components and reuses the blog's shared layout (`Header`, `Footer`, `BaseHead`, `ThemeToggle`). The CV is data-only (no API, no DB), so a single `cv.astro` page imports a typed `cv-data.json` and delegates rendering to four feature components under `src/features/cv/components/`. All interactivity already covered by the existing `ThemeToggle` island — the CV itself ships zero JS.

Tailwind v3 utilities in the source are mostly v4-compatible; only the `border-s` / `-start-1.5` logical-property utilities and `tracking-wide` family need a verification pass. No `tailwind.config.js` needed — v4's CSS-first config and `@import "tailwindcss"` already in `src/styles/global.css` handle utility generation.

## Architecture Decisions

### Decision: Where CV components live

| Option | Tradeoff | Decision |
|---|---|---|
| `src/components/cv/` (shared) | Wrong: not reused outside `/cv` | Rejected |
| `src/features/cv/components/` (feature-local) | Matches Scope Rule (1 feature → feature folder) | **Chosen** |
| Inline everything in `cv.astro` | One huge file, no separation of concerns | Rejected |

**Rationale**: Scope Rule is absolute in this codebase. CV sections (Hero, ProjectCard, ExperienceTimeline, Education) are used only by `cv.astro`, so they MUST stay feature-local. Co-locating them under `src/features/cv/` mirrors how `FormattedDate.astro` lives under `src/features/blog/`.

### Decision: Data + types location

| Option | Tradeoff | Decision |
|---|---|---|
| `src/data/cv-data.json` + `src/lib/cv-types.ts` | Data global, types in `lib` (matches existing `strapi-types.ts` pattern) | **Chosen** |
| Both inside `src/features/cv/` | Tighter feature boundary, but breaks current `lib/` convention for types | Rejected |
| Inline JSON literal in `.astro` | No reusability, no typing, huge file | Rejected |

**Rationale**: The repo already places shared TS types in `src/lib/` (`strapi-types.ts`, `constants.ts`). Types are not feature-internal implementation detail — they're contracts. JSON data is treated as a static asset accessed via ESM import. Hand-pick only types from `definitions.ts` lines 91-159; drop the tutorial/invoice leftovers.

### Decision: Image strategy

| Option | Tradeoff | Decision |
|---|---|---|
| All via `astro:assets` `<Image>` | Optimization, but needs imports in `.astro` and breaks remote `/public/` URLs in JSON | Rejected for now |
| All plain `<img>` from `/public/` | Zero config, mirrors original Next.js paths in JSON | **Chosen for v1** |
| Hybrid: hero via `astro:assets`, project thumbnails via `<img>` | More complexity, low immediate gain | Deferred |

**Rationale**: The JSON references `/agencia_virtual.png`, `/assets/reactjs.png`, etc. — all `/public/`-relative. Plain `<img>` keeps the JSON portable and avoids touching `astro:assets`' import-time resolver for paths that come from data. Optimization can be retro-fitted later by replacing `<img>` with `<Image>` only for the hero/project screenshots.

### Decision: Tailwind v3 → v4 adaptation

| Concern | Approach |
|---|---|
| `border-s`, `-start-1.5` (logical props) | v4 supports both; keep as-is, verify in build |
| `bg-gradient-to-r` | v4 syntax unchanged; keep |
| `dark:` variant | Already in use across blog; no change |
| `tailwind.config.js` | Does not exist in target — v4 CSS-first via `@import "tailwindcss"` |
| Custom classes / arbitrary values | Audit per-section; replace with v4 equivalents if any break |

**Rationale**: The blog already runs Tailwind v4. The CV source is mostly stock utilities — no PostCSS plugins, no preset overrides. Migration is mostly copy-paste plus an audit pass.

### Decision: Header nav integration

**Choice**: Append `{ href: "/cv", label: "CV" }` to the existing `menuItems` array in `Header.astro` AND add a matching `<HeaderLink href="/cv">CV</HeaderLink>` in the desktop `<div>`. Both menus stay in sync.

**Alternatives rejected**:
- Conditional rendering by path: not needed — `/cv` should be visible everywhere
- Separate `CvHeader.astro`: violates DRY; the blog header is the site header

**Rationale**: `Header.astro` already drives both desktop (`HeaderLink`) and mobile (`MobileMenu`) from `menuItems` for the mobile case. Desktop uses hardcoded `<HeaderLink>`s — keep that pattern and add one more entry. Two-line change.

### Decision: Footer social link fix

**Choice**: Replace the three Astro template links (Mastodon, Twitter/`astrodotbuild`, GitHub/`withastro/astro`) with Miguel's: LinkedIn `miguel-anay`, YouTube `@M1Anay`, GitHub `miguel-anay`. Update copyright if needed.

**Rationale**: The `Header.astro` already has Miguel's correct socials — the footer is the residual template default. This is a layout bug fix riding alongside the CV migration, but it's in scope per the proposal.

### Decision: Dark mode

**Choice**: No code changes. Both projects already use the `.dark` class on `<html>` and Tailwind's `dark:` variants. The existing `ThemeToggle.tsx` already drives this on the blog side and will cover `/cv` automatically because it lives in the shared `Header`.

## Data Flow

    cv-data.json ──→ cv.astro (import + type-assert as CvData)
                         │
                         ├──→ Hero.astro          (personal)
                         ├──→ ProjectCard.astro × N (proyectos[])
                         ├──→ ExperienceTimeline.astro (experiencia[])
                         └──→ Education.astro     (educacion)

    BaseHead ── slot in <head>
    Header   ── slot above <main>      ← +CV nav link
    Footer   ── slot below <main>      ← +Miguel socials
    ThemeToggle (client:load) ── inside Header (already wired)

Build pipeline: `astro build` → static HTML → S3 + CloudFront (unchanged).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/pages/cv.astro` | Create | Compose `BaseHead`, `Header`, four `features/cv` sections, `Footer` |
| `src/features/cv/components/Hero.astro` | Create | "Sobre mí" block with highlighted companies & technologies |
| `src/features/cv/components/ProjectCard.astro` | Create | Single project card; rendered N times in `cv.astro` |
| `src/features/cv/components/ExperienceTimeline.astro` | Create | Full `<ol>` timeline of experience entries with sub-projects |
| `src/features/cv/components/Education.astro` | Create | Universities + specialization courses sections |
| `src/data/cv-data.json` | Create | Verbatim copy from `cv_miguelanay/app/lib/cv-data.json` |
| `src/lib/cv-types.ts` | Create | Lines 91-159 of original `definitions.ts`, CV types only |
| `src/components/layout/Header.astro` | Modify | Append `/cv` to desktop links and `menuItems` array |
| `src/components/layout/Footer.astro` | Modify | Replace Astro template socials with Miguel's accounts |
| `public/*.png`, `public/assets/*.png`, `public/TRABAJO/*.pdf`, `public/ESTUDIO/*.pdf` | Create | Copy logos, project screenshots, tech icons, certificates from old repo |

## Interfaces / Contracts

`src/lib/cv-types.ts`:

```ts
export type CvTecnologia = { nombre: string; icono: string; clases: string };
export type CvProyecto = {
  titulo: string; empresa: string; descripcion: string;
  url: string; imagen: string; tecnologias: CvTecnologia[];
};
export type CvSubProyecto = { nombre: string; descripcion: string };
export type CvExperiencia = {
  periodo: string; cargo: string; empresa: string;
  certificado: string | null; logo: string;
  tecnologias: string; proyectos: CvSubProyecto[];
};
export type CvCurso = {
  nombre: string; institucion: string; fecha: string;
  certificado: string | null; externo?: boolean;
};
export type CvEspecializacion = { categoria: string; cursos: CvCurso[] };
export type CvUniversidad = { nombre: string; titulo: string };
export type CvEducacion = {
  universidades: CvUniversidad[];
  especializaciones: CvEspecializacion[];
};
export type CvPersonal = {
  nombre: string; sitio: string; descripcion: string;
  empresasDestacadas: [string, string];
  tecnologiasDestacadas: string;
  linkedin: string; anio: string;
};
export type CvData = {
  personal: CvPersonal; proyectos: CvProyecto[];
  experiencia: CvExperiencia[]; educacion: CvEducacion;
};
```

Each section component declares its own `Props` interface accepting only the slice it needs (e.g. `Hero` takes `CvPersonal`, `ExperienceTimeline` takes `CvExperiencia[]`). This keeps components testable in isolation and decoupled from the full `CvData` shape.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Build | `astro build` succeeds with `--strict` typing | Run after every section component lands |
| Visual | Parity with original Next.js `/cv` | Manual visual diff at `localhost:4321/cv` vs Next.js dev |
| Dark mode | Toggle works on `/cv` end-to-end | Manual: click `ThemeToggle` on `/cv`, verify all sections respond |
| Nav | Header link reaches `/cv` from `/`, `/blog`, `/about` | Manual click-through |
| Static output | `dist/cv/index.html` present, references public assets correctly | `ls dist/cv` + open in `npm run preview` |
| Lighthouse | Performance + a11y not worse than `/blog` | Run Lighthouse on `npm run preview` |

No unit tests planned — this is a presentational, data-driven page with no logic. Verification is build + visual.

## Migration / Rollout

No data migration. Single deployment via existing S3 + CloudFront pipeline. The old Next.js CV repo stays online untouched until DNS/redirect cutover (out of scope, handled separately). Rollback = `git revert` the migration commit(s); CV reverts to old domain by simply not flipping DNS.

## Open Questions

- [ ] Confirm certificate PDF paths (`/TRABAJO/*`, `/ESTUDIO/*`) should be served from `/public/` as-is or moved under `/public/cv/` to avoid namespace collisions with future blog assets
- [ ] Confirm `Header.astro` desktop nav label: "CV" vs "Currículum" vs Spanish/English mix (rest of nav is English: Home/Blog/About)
- [ ] Hero copy uses fragile `descripcion.split(...)` to highlight companies — should be reshaped into structured JSON during port, or kept verbatim for v1?
