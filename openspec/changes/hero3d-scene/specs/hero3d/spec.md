# Hero 3D Scene Specification

## Purpose

Defines the `hero3d` capability: a Three.js skeleton (renderer, camera, scene, sizes, `sceneWeights` state, one placeholder mesh) mounted into the homepage `.hero` section only, with a locked degradation contract so the existing `.hero::before` crosshatch remains the fallback for every user who cannot or should not run it.

## Requirements

### Requirement: Route-Scoped Mount

The three.js entry MUST be imported only from `src/pages/index.astro`. No shared layout, shared component, or any other route MUST import it, directly or transitively.

#### Scenario: Homepage renders the canvas

- GIVEN a request to `/`
- WHEN the page renders
- THEN a `<canvas>` element is present inside `.hero`

#### Scenario: Every other route ships zero three.js bytes

- GIVEN the production build output
- WHEN inspecting the JS chunks referenced by any route other than `/`
- THEN none of them contain three.js code or reference the hero3d entry chunk

### Requirement: Pre-Import Gating

Both `prefers-reduced-motion: reduce` and WebGL-unsupported MUST be checked BEFORE the dynamic `import()` of the three.js entry. If either gate fails, the dynamic import MUST NOT execute.

#### Scenario: User prefers reduced motion

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the homepage mount script runs
- THEN `import()` of the three.js entry is never called
- AND no three.js network request is observed

#### Scenario: WebGL unavailable

- GIVEN a browser or environment where WebGL context creation fails or is unsupported
- WHEN the homepage mount script runs
- THEN `import()` of the three.js entry is never called
- AND no three.js network request is observed

#### Scenario: Both gates pass

- GIVEN `prefers-reduced-motion` is not set to `reduce` AND WebGL is supported
- WHEN the homepage mount script runs
- THEN the three.js entry is dynamically imported and initialized

### Requirement: Fallback Preservation

When either gate fails, when JavaScript is disabled, or when the three.js entry fails at any step, the page MUST render exactly as it does today: the existing `.hero::before` crosshatch background, no new UI element, no layout shift, and no console errors.

#### Scenario: Reduced motion or no WebGL

- GIVEN either pre-import gate fails
- WHEN the hero section renders
- THEN `.hero::before` is visible and unchanged
- AND no additional DOM node, style, or fallback UI is introduced
- AND no error is logged to the console

#### Scenario: JavaScript disabled

- GIVEN a browser with JavaScript disabled
- WHEN `/` is loaded
- THEN the hero renders with `.hero::before` visible, identical to the current production page
- AND no layout shift occurs when compared to the JS-enabled render

### Requirement: Decorative Accessibility

The canvas MUST be non-interactive and excluded from the accessibility tree. It MUST NOT participate in tab order, focus, or hit-testing.

#### Scenario: Canvas mounted

- GIVEN the three.js entry has initialized
- WHEN inspecting the canvas element
- THEN it has `aria-hidden="true"`
- AND it has `pointer-events: none`
- AND it has no `tabindex` and cannot receive keyboard focus

### Requirement: sceneWeights Contract

The `sceneWeights` module MUST expose a per-section entry keyed by section name (e.g. `hero`) with three fields: `in` (number, written by the scroll driver), `out` (number, written by the scroll driver), and `weight` (number, derived). `weight` MUST be computed as `clamp(in * (1 - out), 0, 1)`. Only the scroll driver (the `IntersectionObserver` callback) MUST write to `in`/`out`. All 3D objects MUST treat `sceneWeights` as read-only and MUST read `weight`, never write to it or to `in`/`out`.

#### Scenario: Scroll driver writes in/out

- GIVEN the hero section intersects the viewport per the configured `IntersectionObserver` thresholds
- WHEN the observer callback fires
- THEN it updates `sceneWeights.hero.in` and/or `sceneWeights.hero.out`
- AND it does not write directly to `sceneWeights.hero.weight`

#### Scenario: Derived weight follows the formula

- GIVEN `sceneWeights.hero.in` and `sceneWeights.hero.out` hold arbitrary values within their expected ranges
- WHEN the weight is derived on the next tick
- THEN `sceneWeights.hero.weight` equals `clamp(in * (1 - out), 0, 1)`, never outside `[0, 1]`

#### Scenario: Placeholder object reads weight only

- GIVEN the placeholder mesh's per-frame update runs
- WHEN it accesses `sceneWeights.hero`
- THEN it reads `weight` to drive its visual response
- AND it performs no write to any field of `sceneWeights`

### Requirement: Module Lifecycle Contract

Every module under `src/features/home/three/` that owns GPU or event-loop resources MUST export an `init` function and a `destroy` function. `destroy` MUST release every GPU resource the module allocated (geometry, material, renderer) via their `dispose()` methods and MUST remove the module's callback from the shared `gsap.ticker`. Calling `destroy` MUST leave no dangling references that keep the module's resources alive.

#### Scenario: Destroy releases GPU resources

- GIVEN the three.js entry has been initialized and is running
- WHEN `destroy()` is called
- THEN every geometry, material, and the renderer created by the module have `dispose()` invoked on them

#### Scenario: Destroy stops the render loop

- GIVEN the three.js entry has been initialized and is running
- WHEN `destroy()` is called
- THEN the module's render callback is removed from `gsap.ticker`
- AND no further frames are rendered by that module after `destroy()` returns

#### Scenario: WebGL context loss triggers teardown

- GIVEN the three.js entry is running
- WHEN a `webglcontextlost` event fires on the canvas
- THEN `destroy()` is invoked
- AND the page falls back to the `.hero::before` crosshatch with no error surfaced to the user

### Requirement: Resize Handling and DPR Cap

On viewport resize, the renderer and camera MUST update to the new dimensions, and the device pixel ratio MUST be re-clamped to `Math.min(window.devicePixelRatio, 2)` on every resize, not only at initialization.

#### Scenario: Window resized

- GIVEN the three.js scene is running at an initial size and DPR
- WHEN the browser window is resized
- THEN the renderer and camera are updated to the new viewport dimensions
- AND the renderer's pixel ratio is set to `Math.min(window.devicePixelRatio, 2)`

#### Scenario: High-DPR display

- GIVEN `window.devicePixelRatio` is greater than 2 (e.g. 3)
- WHEN the scene initializes or resizes
- THEN the renderer's pixel ratio is set to exactly 2, never the raw device value

### Requirement: Bundle Budget

The three.js entry chunk that ships to `/` MUST target ≤130KB gzip and MUST NOT exceed 140KB gzip. This is verified against the production build output, not against source size.

The original ≤80KB target / 100KB ceiling was written before any measurement. A WU0 spike measured a minimal scene — named imports only (`WebGLRenderer`, `Scene`, `PerspectiveCamera`, `Mesh`, `IcosahedronGeometry`, `ShaderMaterial`, `Color`), no `import * as THREE`, no `three/examples/jsm/*` — at **127.39KB gzip**. `WebGLRenderer` transitively pulls in three's shader-chunk graph and does not tree-shake below this floor, so the original numbers were unreachable by construction rather than by implementation error. The budget was renegotiated upward by explicit user decision.

The budget remains a real constraint: it exists to catch `import * as THREE`, accidental `examples/jsm` imports, and duplicate three copies — all of which push well past 140KB.

#### Scenario: Build output within target

- GIVEN a production build (`npm run build`)
- WHEN measuring the gzip size of the hero3d entry chunk
- THEN it is ≤130KB gzip

#### Scenario: Build output exceeds hard ceiling

- GIVEN a production build (`npm run build`)
- WHEN the gzip size of the hero3d entry chunk exceeds 140KB
- THEN this requirement is considered violated and the change MUST NOT be shipped as-is

### Requirement: Failure Isolation

Any error raised during three.js gating, dynamic import, initialization, or the render loop MUST be caught and MUST NOT propagate to break any other part of the homepage. The pattern MUST mirror the try/catch + silent-fallback structure used in `src/features/blog/components/DiagramBlock.astro`.

#### Scenario: Initialization throws

- GIVEN the dynamic `import()` or `init()` call throws for any reason (e.g. unexpected runtime error, unsupported extension)
- WHEN the error occurs
- THEN it is caught within the mount script
- AND the rest of the homepage (header, hero text, sections below the hero) renders and functions normally
- AND no unhandled exception reaches the browser console as an uncaught error

#### Scenario: Render loop throws mid-session

- GIVEN the scene is running and a per-frame update throws
- WHEN the error occurs
- THEN it is caught, the module tears itself down via `destroy()`
- AND the hero falls back to `.hero::before` with the rest of the page unaffected
