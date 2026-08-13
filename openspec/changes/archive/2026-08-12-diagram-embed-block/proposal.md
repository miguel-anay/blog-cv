# Proposal: Animated Diagram Embed Block

## Intent

Articles can only embed static images. A diagram authored in draw.io and animated with GSAP must render as a live, in-page animation. `RichTextRenderer.astro` hits `default: return null` on unknown block types, so today the CMS cannot even send such a block. This is step 1 of 2; the `claude-commands` publishing command (step 2) depends on this contract existing.

## Scope

### In Scope

- New block contract `__component: "shared.diagram"` consumed by `RichTextRenderer.astro`.
- New `DiagramBlock.astro` rendering inline SVG + declarative GSAP timeline.
- Viewport-triggered playback, `prefers-reduced-motion` respect, no-JS static fallback.

### Out of Scope

- draw.io → SVG export pipeline (`claude-commands` repo).
- hyperframes composition and LinkedIn mp4 generation.
- The `/publish-articulo` command changes that emit this block.
- CMS/Turso schema work — `body: z.array(z.any())` already accepts it.

## Capabilities

### New Capabilities

- `diagram-embed`: contract, rendering, and playback of animated SVG diagram blocks in article bodies.

### Modified Capabilities

- None.

## Approach

**Block shape** (mirrors `shared.code`'s inline-content pattern, not `shared.media`'s URL pattern):

```json
{
  "__component": "shared.diagram",
  "svg": "<svg …>…</svg>",
  "alternativeText": "…",
  "caption": "…",
  "steps": [{ "target": "#node-1", "from": { "autoAlpha": 0, "y": 20 }, "duration": 0.5, "position": "<" }]
}
```

Inline SVG is mandatory, not stylistic: GSAP cannot reach inside `<img src="*.svg">`. `steps[]` is the serialized form of the timeline shared with hyperframes — declarative data only, never JS strings (no `eval`).

**Rendering**: plain Astro component, `set:html` for the SVG, hoisted Astro `<script>` that `querySelectorAll`s diagram roots — the same pattern the image modal already uses in this file. No React island, no `client:visible`, no `@gsap/react` dependency.

**Playback**: `IntersectionObserver` → dynamic `import("gsap")` on first intersection, so GSAP never loads on articles without a diagram. Uses `from()` tweens so the un-animated DOM is the final state — no-JS and reduced-motion both fall back to a complete, readable diagram for free.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/blog/components/RichTextRenderer.astro` | Modified | New `case "shared.diagram"` |
| `src/features/blog/components/DiagramBlock.astro` | New | Renderer + timeline runner |
| `src/content.config.ts` | None | Schema already permissive |
| `package.json` | None | `gsap@3.15` present |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Inline SVG bloats SSR HTML | Med | Cap at ~50KB; oversized diagrams fall back to `image` block |
| SVG carries `onload=`/`onclick=` attributes | Low | First-party content only; same trust level as existing `shared.rich-text` `set:html` |
| `steps[]` target IDs drift from re-exported SVG | Med | Missing target is a no-op, not a crash; diagram stays readable |
| draw.io strips/rewrites element IDs on export | Med | Upstream concern; contract requires stable IDs |

## Rollback Plan

Delete the `case "shared.diagram"` branch — unknown blocks return `null` again and articles render without the diagram. Deleting `DiagramBlock.astro` is then safe; nothing else imports it. No data migration, no dependency to uninstall.

## Dependencies

- Downstream only: `claude-commands` must emit blocks matching this contract. Nothing blocks this change.

## Success Criteria

- [ ] A `shared.diagram` block renders its SVG and plays its timeline on scroll-into-view.
- [ ] Articles with no diagram block ship zero GSAP bytes.
- [ ] With JS disabled or `prefers-reduced-motion: reduce`, the complete diagram is visible.
- [ ] Malformed/absent `steps[]` renders a static diagram instead of throwing.
