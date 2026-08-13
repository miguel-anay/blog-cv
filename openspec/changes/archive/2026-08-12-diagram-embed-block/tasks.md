# Tasks: Animated Diagram Embed Block

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~160-220 (new file ~140-190 + renderer diff ~20-30) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `DiagramBlock.astro` + `RichTextRenderer.astro` wiring + manual verification | PR 1 | Single component + single switch-case; base = main |

## Phase 1: Component Scaffold (`shared.diagram` — spec req: Block Contract Recognition, Missing SVG Field Tolerance)

- [x] 1.1 Create `src/features/blog/components/DiagramBlock.astro`; define `Props` type matching the `DiagramBlock`/`DiagramStep` interfaces from design.md (`svg`, `alternativeText?`, `caption?`, `steps?`).
- [x] 1.2 Guard clause: if `svg` is missing, empty, or not a `string`, render nothing (`return null`-equivalent frontmatter early return) — satisfies "Missing SVG Field Tolerance".
- [x] 1.3 Markup: root `<div>` (or `<figure>` if `caption` present) with a `data-diagram-root` attribute, inner element using `set:html={svg}`, and a `data-diagram-steps` attribute serialized via `JSON.stringify(steps ?? [])`.

## Phase 2: Timeline Runner (spec req: Steps Timeline Tolerance, Reduced Motion, Viewport-Triggered Playback)

- [x] 2.1 In `DiagramBlock.astro`'s hoisted `<script>`, `querySelectorAll("[data-diagram-root]")` and iterate each root (dedup-safe per design — Astro bundles this script once across N instances).
- [x] 2.2 Per root: parse `data-diagram-steps` JSON; if parse fails, not an array, or empty → skip (no `IntersectionObserver`, no GSAP import) — leaves SSR'd SVG as final state.
- [x] 2.3 Check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` before creating the `IntersectionObserver` for that root; if true, skip entirely (no GSAP import) — satisfies "Reduced Motion Compliance".
- [x] 2.4 Create one `IntersectionObserver` per valid root; on first intersection (`isIntersecting`), `observer.unobserve(root)` then `await import("gsap")` inside a `try/catch` — on rejection, catch and no-op (static diagram stays).
- [x] 2.5 On successful import, build `const tl = gsap.timeline()`; for each step, resolve `root.querySelectorAll(step.target)` (scoped, per design's duplicate-ID rationale); if 0 matches, `console.warn` and skip that step (no throw).
- [x] 2.6 Map each valid step 1:1 per design's runtime mapping: `tl.from(els, { ...step.from, duration: step.duration ?? 0.6, delay: step.delay ?? 0, ease: step.ease ?? "power2.out", stagger: step.stagger ?? 0 }, step.position)`. Skip (warn) steps missing `target` or `from` before mapping.

## Phase 3: Renderer Wiring (spec req: Block Contract Recognition, Unknown Block Passthrough Preserved)

- [x] 3.1 In `src/pages/blog/components/RichTextRenderer.astro`, import `DiagramBlock` from `../../../features/blog/components/DiagramBlock.astro`.
- [x] 3.2 Add `case "shared.diagram": return <DiagramBlock svg={block.svg} alternativeText={block.alternativeText} caption={block.caption} steps={block.steps} />;` directly above the existing `default: return null;` — do not reorder or touch other cases.

## Phase 4: Manual Verification (strict TDD = false; no wired test runner — manual browser check per CLAUDE.md static-first convention)

- [x] 4.1 Run `npm run dev`; render an article body containing a `shared.diagram` block with valid `svg` + `steps[]`; confirm SVG renders and, on scrolling into view, the declared `from()` animation plays once. (Verified via headless Playwright: `import("gsap")` fired exactly once after the diagram root entered the viewport, unobserve prevents replay.)
- [x] 4.2 Confirm `import("gsap")` is not requested (Network tab) until the diagram root scrolls into view, and never for articles without a `shared.diagram` block. (Verified: 0 gsap requests before scroll, 1 after, on a page with a 2000px spacer pushing the diagram off-screen at load.)
- [x] 4.3 Enable OS "reduce motion", reload, confirm GSAP is never imported and the SVG shows its final, complete state with no animation. (Verified via `page.emulateMedia({ reducedMotion: "reduce" })`: 0 gsap requests, all 3 SVG child elements present/visible.)
- [x] 4.4 Disable JavaScript in devtools, reload, confirm the full SVG is visible with nothing hidden. (Verified via Playwright route-blocking of all script requests: 0 gsap requests, all 3 SVG child elements present in DOM — SSR output is the complete diagram.)
- [x] 4.5 Test malformed blocks: block missing `svg` (renders nothing, no console error, siblings unaffected), `steps` missing/not-array (static SVG, no timeline), a step with an unmatched `target` (skipped with `console.warn`, other steps still animate). (Verified via SSR curl + Playwright console listener: missing-svg block produced no output with sibling paragraphs intact; `data-diagram-steps="[]"` for the no-steps block; unmatched-target step logged `DiagramBlock: no elements matched selector ".does-not-exist"` without throwing, while sibling steps still ran.)
- [x] 4.6 Confirm `shared.rich-text`, `shared.media`, `shared.code`, and an unrecognized `__component` still render exactly as before (no regression from the switch addition). (Verified via SSR curl: `shared.rich-text` and `shared.code` rendered identically to pre-change markup; `shared.unknown-thing` produced no output, matching the unchanged `default: return null`.)
