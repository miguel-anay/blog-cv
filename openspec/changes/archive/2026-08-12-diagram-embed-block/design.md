# Design: Animated Diagram Embed Block

## Technical Approach

`RichTextRenderer.astro` gains a `case "shared.diagram"` that delegates to a new
`DiagramBlock.astro`. The component emits inline SVG via `set:html` plus a
`data-diagram-steps` JSON attribute. One hoisted `<script>` (bundled by Vite,
deduped by Astro across N instances) picks up every root with
`querySelectorAll`, and on first viewport intersection dynamically imports
`gsap` and replays `steps[]` as a timeline of `from()` tweens.

Because every tween is `from()`, the SSR'd DOM is already the finished diagram.
No-JS, reduced-motion, GSAP-failed-to-load, and off-screen are all the *same*
code path: do nothing. There is no separate fallback to maintain.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Props → script | `data-diagram-steps` JSON attribute | `define:vars` | `define:vars` forces the script inline, un-bundled — bare `import("gsap")` would not resolve. Hoisted script cannot see frontmatter, so data must travel through the DOM. Load-bearing, not stylistic. |
| Selector scope | `root.querySelectorAll(target)` | `document.querySelector` / `getElementById` | Two draw.io exports in one article can ship the same `#node-1`. Scoping to the root makes duplicate IDs harmless. |
| GSAP import | `await import("gsap")` inside the observer callback | static `import gsap from "gsap"`; reuse `src/lib/gsap-utils.ts` | `gsap-utils.ts` statically pulls ScrollTrigger + SplitText — reusing it triples the chunk for features we don't use. Dynamic core-only import keeps diagram-free articles at zero GSAP bytes. |
| Script location | inside `DiagramBlock.astro` | inside `RichTextRenderer.astro` | Astro only bundles a component's script on pages that render it. Also keeps the rollback ("delete the file") clean. |
| 50KB SVG cap | Documented convention, **no runtime enforcement** | SSR reject / SSR warn | Rejecting leaves a silent hole in a published article — the worst failure mode. A server warn lands in Vercel logs nobody reads. The author is present in `claude-commands` at export time; enforce there, where someone can act. |
| `steps[]` validation | Client-side, in the runner | SSR-side filter | Selector resolution can only be checked in the browser. One validation site beats two. |

## Data Flow

    API body[] ──→ RichTextRenderer switch ──→ DiagramBlock.astro
                                                    │
                          set:html(svg) + data-diagram-steps(JSON)
                                                    ↓
                                              SSR HTML (final visual state)
                                                    ↓
      hoisted script → IntersectionObserver → import("gsap") → timeline.from(...)

## File Changes

| File | Action | Description |
|---|---|---|
| `src/features/blog/components/DiagramBlock.astro` | Create | Markup + hoisted timeline runner. Path per CLAUDE.md Scope Rule (blog-only); the `src/pages/blog/components/` drift stays untouched. |
| `src/pages/blog/components/RichTextRenderer.astro` | Modify | Import + `case "shared.diagram"` before `default: return null` |

## Interfaces / Contracts

```ts
type DiagramStep = {
  target: string;                          // CSS selector, scoped to diagram root
  from: Record<string, number | string>;   // gsap from-vars: autoAlpha, x, y, scale, rotation…
  duration?: number;                       // s, default 0.6
  delay?: number;                          // s, default 0
  ease?: string;                           // default "power2.out"
  stagger?: number;                        // s between matched elements, default 0
  position?: string | number;              // timeline slot: "<", "+=0.2", 0.5; default appends
};

type DiagramBlock = {
  __component: "shared.diagram";
  svg: string;
  alternativeText?: string;
  caption?: string;
  steps?: DiagramStep[];
};
```

Runtime mapping is 1:1:

```js
tl.from(els, { ...s.from, duration: s.duration ?? 0.6, delay: s.delay ?? 0,
               ease: s.ease ?? "power2.out", stagger: s.stagger ?? 0 }, s.position);
```

## Tolerance Rules

| Input | Behaviour |
|---|---|
| `svg` missing / not a string / blank | Return `null` — matches existing `default:` |
| `steps` missing / not an array | Render static diagram, never build a timeline |
| Step missing `target` or `from` | Skip it, `console.warn`, keep the rest |
| `target` matches 0 elements | Skip it, `console.warn`, keep the rest |
| `prefers-reduced-motion: reduce` | Never build the timeline; never load GSAP |
| `import("gsap")` rejects | `catch` → static diagram |

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | Step validation + vars mapping | Extract the pure `toTweenVars(step)` mapper; assert defaults and rejects |
| E2E | Static render, malformed block, reduced motion | Playwright (already in repo): assert SVG present + no console error |

## Migration / Rollout

No migration. `body: z.array(z.any())` already accepts the block; unknown blocks
render `null` today, so old content is unaffected. Rollback = delete the case.

## Open Questions

- [ ] None blocking. Spec phase may tighten the tolerance table; the runner
      follows it without structural change.
