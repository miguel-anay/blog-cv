# cv-page Specification

## Purpose

Static `/cv` route within the Astro blog that renders Miguel's professional CV — hero, projects, experience timeline, and education — driven by a local JSON data file, integrated with the blog's shared layout, theme, and SEO components.

---

## Requirements

### Requirement: CV Route Availability

The system MUST expose a static page at the URL path `/cv` that is reachable from any page of the site without a full-page reload loop or redirect.

#### Scenario: User visits /cv directly

- GIVEN the built site is deployed
- WHEN a user navigates to `/cv`
- THEN the page returns HTTP 200 with the full CV content rendered

#### Scenario: User navigates from blog to /cv

- GIVEN the user is on any blog page
- WHEN they click the "CV" link in the Header
- THEN the browser navigates to `/cv` and the page renders all four CV sections

---

### Requirement: Hero Section

The `/cv` page MUST render a Hero section containing a descriptive paragraph about Miguel with inline-highlighted mentions of companies and technologies.

#### Scenario: Hero renders with highlighted text

- GIVEN the CV data is loaded
- WHEN the Hero component renders
- THEN the paragraph text is visible and technology/company names appear visually distinguished from plain text (e.g., via color, weight, or background)

#### Scenario: Hero section is always visible without scrolling

- GIVEN the page has loaded
- WHEN the viewport is desktop or mobile
- THEN the Hero section is the first content block visible above the fold

---

### Requirement: Projects Section

The `/cv` page MUST render a Projects section displaying all projects from `cv-data.json` as a 2-column grid of cards.

Each card MUST include: project image, project title, description, technology icons, and a link to the project.

#### Scenario: All projects from cv-data.json are rendered

- GIVEN `cv-data.json` contains N projects
- WHEN the Projects section renders
- THEN exactly N project cards are visible in the grid

#### Scenario: Project card contains required fields

- GIVEN any single project card
- WHEN it renders
- THEN it shows the project image, title, description, at least one technology icon, and a clickable link

#### Scenario: Technology icons are rendered per project

- GIVEN a project with multiple `tecnologias` entries
- WHEN the card renders
- THEN each technology in the array has a corresponding icon visible on the card

#### Scenario: Project link opens correctly

- GIVEN a project card with a non-empty `link` field
- WHEN the user clicks the link
- THEN the browser navigates to the project URL (opens in new tab or same tab per design decision — MUST be consistent across all cards)

---

### Requirement: Experience Timeline

The `/cv` page MUST render an Experience section as a vertical timeline where each entry shows: company logo, company name, date range, description, and an optional certificate link.

#### Scenario: All experience entries render in order

- GIVEN `cv-data.json` contains M experience entries
- WHEN the Experience section renders
- THEN M entries appear in the timeline in the same order as the array

#### Scenario: Entry with certificate link renders a link

- GIVEN an experience entry where `certificado` is present and non-empty
- WHEN that entry renders
- THEN a visible link to the certificate PDF is rendered

#### Scenario: Entry without certificate renders no link

- GIVEN an experience entry where `certificado` is absent or empty
- WHEN that entry renders
- THEN no certificate link element is present in the DOM

#### Scenario: Company logo renders

- GIVEN an experience entry with a `logo` field
- WHEN the entry renders
- THEN the company logo image is displayed adjacent to the company name

---

### Requirement: Education Section

The `/cv` page MUST render an Education section split into two groups: Universidades and Especializaciones, each listing their respective entries from `cv-data.json` with title, institution, and a link to the credential (Credly or PDF).

#### Scenario: University group renders all entries

- GIVEN `cv-data.json` contains university education entries
- WHEN the Education section renders
- THEN all university entries appear under a "Universidades" heading

#### Scenario: Specializations group renders all entries

- GIVEN `cv-data.json` contains specialization entries
- WHEN the Education section renders
- THEN all specialization entries appear under a "Especializaciones" heading

#### Scenario: Credential link is present and reachable

- GIVEN any education entry with a credential URL
- WHEN the user clicks the credential link
- THEN the browser navigates to the Credly badge page or PDF

---

### Requirement: Shared Layout Integration

The `/cv` page MUST use the shared `BaseHead`, `Header`, and `Footer` components — the same ones used across all blog pages — with no duplication of layout logic.

#### Scenario: Header is present and contains CV nav link

- GIVEN the `/cv` page has rendered
- WHEN the user inspects the Header
- THEN a nav link to `/cv` is present alongside existing blog navigation links

#### Scenario: Footer shows Miguel's real social links

- GIVEN the site is built with the updated Footer
- WHEN any page renders (blog or /cv)
- THEN the Footer displays Miguel's actual social/contact links — NOT the Astro template placeholder links

#### Scenario: Dark mode applies to /cv

- GIVEN the user has toggled dark mode via the existing ThemeToggle
- WHEN they navigate to `/cv`
- THEN the page applies the dark theme consistently with the rest of the blog

---

### Requirement: Data Source Integrity

The system MUST load CV content exclusively from `src/data/cv-data.json` at build time. No runtime API calls, no CMS, no hardcoded content in component files.

#### Scenario: Build succeeds with valid cv-data.json

- GIVEN `src/data/cv-data.json` is present and schema-valid
- WHEN `npm run build` executes
- THEN the build completes without errors and `/cv` is in the static output

#### Scenario: CV types match data shape

- GIVEN `src/lib/cv-types.ts` defines types for cv-data.json fields
- WHEN TypeScript compiles
- THEN no type errors are reported for CV data imports or component prop usage

---

### Requirement: Astro/Tailwind Compatibility

The `/cv` page and its feature components MUST NOT contain `next/image` imports or Tailwind v3-only utility classes. All styling MUST use Tailwind v4 CSS-first syntax compatible with the existing blog configuration.

#### Scenario: Build produces no next/image errors

- GIVEN the migration is complete
- WHEN `npm run build` runs
- THEN no build errors reference `next/image`, `next/link`, or any Next.js module

#### Scenario: No Tailwind v3 residuals

- GIVEN the codebase after migration
- WHEN a static analysis or grep for v3-specific patterns runs
- THEN no Tailwind v3-only utilities (e.g., `tailwind.config.js` references, `theme.extend` inline patterns) appear in CV files

---

### Requirement: Performance Parity

The `/cv` page SHOULD achieve Lighthouse scores (Performance, Accessibility, SEO) equal to or greater than existing blog pages.

#### Scenario: Lighthouse audit passes

- GIVEN the built site is deployed
- WHEN a Lighthouse audit runs against `/cv`
- THEN Performance >= existing blog average, Accessibility >= 90, SEO >= 90

---

## Scope Rule Compliance

| Component | Location | Justification |
|-----------|----------|---------------|
| Hero.astro | `src/features/cv/components/` | CV-only |
| ProjectCard.astro | `src/features/cv/components/` | CV-only |
| ExperienceTimeline.astro | `src/features/cv/components/` | CV-only |
| Education.astro | `src/features/cv/components/` | CV-only |
| Header.astro | `src/components/layout/` | Shared (already exists) |
| Footer.astro | `src/components/layout/` | Shared (already exists) |

---

## Out of Scope

- Decommissioning the Next.js CV repo
- CMS-driven CV content
- i18n / multi-language support
- Print stylesheet or PDF export from the browser
- DNS redirects from old CV domain
- Visual redesign (parity with current CV, not redesign)
