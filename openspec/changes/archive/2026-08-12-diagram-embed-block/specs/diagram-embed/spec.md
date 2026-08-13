# Diagram Embed Specification

## Purpose

Defines the `shared.diagram` article block: a draw.io-authored inline SVG paired with a declarative GSAP `steps[]` timeline, rendered by `DiagramBlock.astro` and dispatched from `RichTextRenderer.astro`.

## Requirements

### Requirement: Block Contract Recognition

`RichTextRenderer.astro` MUST add a `case "shared.diagram"` branch that renders `DiagramBlock.astro` for blocks where `__component === "shared.diagram"`.

#### Scenario: Diagram block in article body

- GIVEN an article body array containing a block with `__component: "shared.diagram"`
- WHEN `RichTextRenderer.astro` renders the body
- THEN it dispatches that block to `DiagramBlock.astro`

### Requirement: Missing SVG Field Tolerance

Because `body` is typed as `z.array(z.any())`, the block is not schema-validated before reaching the renderer. `DiagramBlock.astro` MUST NOT throw when `svg` is missing, empty, or not a string. It MUST render nothing for that block instead of crashing the page.

#### Scenario: Block missing svg field

- GIVEN a `shared.diagram` block with no `svg` property
- WHEN the block is rendered
- THEN the component renders no output for that block
- AND no error is thrown, and sibling blocks render normally

### Requirement: Steps Timeline Tolerance

`steps[]` MUST be treated as optional and untrusted. If `steps` is missing, not an array, or empty, the component MUST skip animation setup and leave the SVG in its authored (static) state. If an individual step's `target` selector matches no element, that step MUST be skipped as a no-op rather than throwing.

#### Scenario: Missing or malformed steps array

- GIVEN a `shared.diagram` block with `svg` present and `steps` absent (or not an array)
- WHEN the page loads and the block scrolls into view
- THEN no GSAP timeline is built for that block
- AND the SVG remains visible in its authored final state

#### Scenario: Step target not found in SVG

- GIVEN a `steps[]` entry whose `target` selector matches no element in the inline SVG
- WHEN the timeline is built
- THEN that step is skipped without throwing
- AND remaining valid steps still animate

### Requirement: Reduced Motion Compliance

The component MUST check `prefers-reduced-motion: reduce` before triggering playback. When reduced motion is preferred, it MUST NOT import GSAP or run the timeline; the SVG MUST remain visible in its complete, final state (the same DOM state `from()` tweens animate away from and back to).

#### Scenario: User prefers reduced motion

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the diagram scrolls into view
- THEN GSAP is not dynamically imported
- AND the diagram is shown fully rendered with no animation

### Requirement: Viewport-Triggered Playback

Animation MUST NOT start until the diagram root enters the viewport. An `IntersectionObserver` MUST gate a dynamic `import("gsap")`; GSAP MUST NOT be requested for articles that never render a `shared.diagram` block, nor before the diagram intersects the viewport.

#### Scenario: Diagram never scrolled into view

- GIVEN an article containing a `shared.diagram` block
- WHEN the page loads and the user never scrolls the diagram into view
- THEN `import("gsap")` is never called

#### Scenario: Diagram scrolls into view

- GIVEN a `shared.diagram` block with valid `steps[]`
- WHEN its root element intersects the viewport for the first time
- THEN GSAP is dynamically imported and the declared timeline plays once

### Requirement: No-JS Static Fallback

With JavaScript disabled, the hoisted `<script>` never executes and `from()` tweens never run. The SSR-rendered SVG MUST already represent the complete, readable diagram — no animation-only state MUST be required for correctness.

#### Scenario: JavaScript disabled

- GIVEN a browser with JavaScript disabled
- WHEN a page containing a `shared.diagram` block is loaded
- THEN the full SVG diagram is visible with no missing or hidden elements

### Requirement: Unknown Block Passthrough Preserved

Adding `case "shared.diagram"` MUST NOT change existing behavior for any other block type. The renderer's `default: return null` for unrecognized `__component` values MUST remain unchanged.

#### Scenario: Existing block types unaffected

- GIVEN an article body containing `shared.rich-text`, `shared.media`, and `shared.code` blocks
- WHEN the body is rendered after this change
- THEN each block renders identically to its pre-change output

#### Scenario: Still-unrecognized component type

- GIVEN a block with an `__component` value that is neither `shared.diagram` nor any other known type
- WHEN the body is rendered
- THEN the renderer returns `null` for that block, as before

### Requirement: Inline SVG Size Guidance

Inline SVG SHOULD stay near ~50KB to avoid bloating SSR HTML. This change does NOT add runtime size enforcement or an automatic fallback to an `image` block — oversized SVG still renders as given. Size discipline is an authoring-time concern for the upstream draw.io export pipeline (out of scope here).

#### Scenario: Oversized SVG payload

- GIVEN a `shared.diagram` block whose `svg` string exceeds ~50KB
- WHEN the block is rendered
- THEN it renders normally with no truncation, rejection, or fallback substitution
