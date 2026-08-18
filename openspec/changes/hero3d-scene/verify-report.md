# Verify Report: hero3d-scene

**Mode**: Standard (strict_tdd: false, no configured test runner as a gate — one hand-rolled vitest test verified independently)
**Verdict**: PASS WITH WARNINGS

## Task Completeness

WU0-WU5 fully checked off and code matches. WU6.1-6.3 (route isolation, bundle re-measure, tsc/astro check) checked off and independently re-verified. WU6.4-6.10 (manual browser QA: light/dark theme reactivity, reduced-motion, WebGL-disabled, mobile viewport, context-loss simulation, `/blog` network tab) remain `[ ]` in tasks.md and are **UNVERIFIED** — this agent has no browser and did not claim to have run them. Carry forward as open checklist items before archiving.

## Independent Verification (real execution evidence, not apply's word)

| # | Claim | Verified | Evidence |
|---|-------|----------|----------|
| 1 | Bundle budget ≤130KB target / <140KB ceiling | **PASS** | Ran `fnm use v20.20.2 && npm run build` myself. Vite build log: `dist/client/_astro/index.Cv4X_BWn.js — 508.90 kB raw, gzip: 129.24 kB`. Matches apply's claim exactly. 0.76KB headroom to target, 10.76KB headroom to hard ceiling. |
| 2 | Route isolation — zero three.js bytes on non-`/` routes | **PASS** | `grep -rl "HeroCanvas\|three" .vercel/output/_functions/pages/**/*.mjs` — only `pages/index.astro.mjs` matches (4 hits). All 14 other route files (about, blog + 4 subroutes, courses + 2 subroutes, cv, exams + 2 subroutes, login, rss, sitemap, _image) return 0 matches. |
| 3 | No `import * as THREE`, no `three/examples/jsm/*` | **PASS** | Grepped `src/`: zero matches for either pattern. Only named imports from `"three"` in `stage.ts` and `heroBlob.ts`. |
| 4 | `alpha: true` passed to `WebGLRenderer` | **PASS** | `src/features/home/three/stage.ts:29` — `alpha: true` present with a comment explaining it's load-bearing. |
| 5 | Both gates precede dynamic `import()` in `HeroCanvas.astro` | **PASS** | `HeroCanvas.astro:30` — `if (canvas && !matchMedia(...).matches && hasWebGL())` wraps the entire `load`/`import()` definition and invocation. If either gate is false, `import()` is never reached — confirmed by control-flow read, not assumption. `hasWebGL()` uses a real `getContext("webgl2"||"webgl")` probe, not a `typeof` check. |
| 6 | No forbidden `gsap.ticker` calls | **PASS** | Only `gsap.ticker.remove(tick)` in `index.ts:48`, removing the module's own callback (`tick`, defined in the same file, added at `index.ts:42`). No `.fps()`, no `.lagSmoothing()`, no removal of a foreign callback. |
| 7 | Only `src/pages/index.astro` imports `HeroCanvas` | **PASS** | `grep -rl "HeroCanvas" src` (via plain `grep`, not the shell's `rg` alias — see note below) → only `src/pages/index.astro`. |
| 8 | Canvas accessibility | **PASS** | `HeroCanvas.astro:7` — `<canvas class="hero-canvas" aria-hidden="true">`, no `tabindex`. Scoped CSS `pointer-events: none` at line 14. |
| 9 | Teardown/dispose | **PASS on the happy path** — see WARNING 1 for a partial-init edge case. `index.ts` `destroy()`: `ticker.remove(tick)` → `detach()` (IntersectionObserver) → `heroBlob.destroy()` (removes `themechange`/`modechange` listeners, `mesh.removeFromParent()`, `geometry.dispose()`, `material.dispose()`) → `stage.destroy()` (`resizeObserver.disconnect()`, remove `webglcontextlost` listener, `renderer.dispose()` then `forceContextLoss()`). Order matches design.md exactly. |
| 10 | `sceneWeights` contract + test | **PASS** | `sceneWeights.ts:23` — `s.weight = clamp01(s.in * (1 - s.out))` matches the spec formula exactly. Ran `npm run test:unit -- src/features/home/three/sceneWeights.test.ts` myself: `Test Files 1 passed (1)`, `Tests 3 passed (3)`, including the `in=1,out=1 → 0` edge case. |
| 11 | TypeScript clean | **PASS** | `npx tsc --noEmit` under Node 20: zero output, zero errors. `npm run check` (astro check, 120 files): `0 errors, 0 warnings, 30 hints`; independently grepped the 30 hints for `features/home\|HeroCanvas\|pages/index.astro\|three/` — zero matches, confirming all hints are in pre-existing unrelated files. |
| 12 | `package-lock.json` unmodified | **PASS** | `git diff $(git merge-base main HEAD) HEAD -- package-lock.json` → 0 lines changed. |
| 13 | Commit hygiene | **PASS** | 5 commits, all `feat(hero3d): ...` conventional format. `git log ... --format='%B' \| grep -i "co-authored\|generated with\|claude"` → zero matches. Per-commit `git show --stat`: no `.atl/*`, `.gitignore`, `public/cv\|diagrams\|uploads`, or `scripts/data/*` in any of the 5 commits — the mis-staging incident apply-progress describes was fully recovered before these commits landed. |

**Note on tooling**: this environment's `rg` shell function is aliased to invoke the Claude Code binary itself and silently mangled search strings (e.g. `HeroCanvas` search returned unrelated `ln` results). Cross-checked every `rg` result with plain `command grep` before trusting it — flagging this as an environment gotcha for future verify/apply runs in this repo, not a code defect.

## Critical Review of Implementation (beyond spec conformance)

Read all of `src/features/home/three/*.ts` and `HeroCanvas.astro` end to end.

### WARNING 1 — Partial-init leak on mid-init throw
`src/features/home/three/index.ts:26-44`. `init()` is not wrapped in its own try/catch. If `stage.init()` succeeds but `attachIntersectionDriver()` or `heroBlob.init()` throws, the function throws out before `gsap.ticker.add(tick)` / `started = true` run. `ctx` and possibly `detach` remain set at module scope, but `started` stays `false`. Since `destroy()` guards with `if (!started) return;`, a subsequent call to `destroy()` (or a retry of `init()`) is a no-op / re-allocates a second `stage` on top of the first without ever releasing the first `ResizeObserver` / `webglcontextlost` listener / `IntersectionObserver`. In the current architecture this is **not reachable in practice**: `HeroCanvas.astro` calls `import("../three").then(m => m.init(canvas)).catch(() => {})` exactly once per page load, the outer `.catch` silently swallows the throw (satisfying the spec's Failure Isolation requirement — the rest of the page is unaffected), and this is an MPA with no client router, so there's no code path that calls `init()` a second time today. Flagging as a latent robustness gap, not a spec violation: if a future change (e.g. adopting ViewTransitions) ever calls `init()` twice, this becomes a real leak. Fix would be a try/catch inside `init()` that calls `destroy()`-equivalent cleanup on any throw before rethrowing/swallowing.

### WARNING 2 — Bundle budget margin is thin
Measured 129.24KB gzip against a 130KB **target** — only 0.76KB of headroom (the 140KB hard ceiling has a healthy 10.76KB margin). This is a real, current pass, not a defect, but any future addition to `heroBlob.ts` (a second material, more uniforms, a larger geometry) risks tripping the target threshold on the next measurement. Recommend a CI/build-log size check going forward rather than relying on manual re-measurement.

### Reviewed, no defect found
- **Race between observer and init**: `attachIntersectionDriver` is called after `stage.init` succeeds and before `heroBlob.init`; the `IntersectionObserver` callback fires asynchronously, so `sceneWeights.hero` stays at its initial `{in:0,out:0,weight:0}` for the first frame(s) — this manifests as a harmless fade-in via the `displayed` smoothing, not a bug.
- **Double-init on fast navigation**: not applicable — confirmed zero `ClientRouter`/`ViewTransitions`/`astro:before-swap` usage anywhere in `src/`, this is a classic MPA, full unload on navigation.
- **Shader uniform updates that never fire**: `themechange`/`modechange` are dispatched on `document` in `ThemeSwitcher.astro:37` and `ModeToggle.astro:30` and listened on `document` in `heroBlob.ts:70-71` — verified the dispatch/listen targets match.
- **Theme-change listeners leaking**: removed in `heroBlob.destroy()`.
- **Render loop running when weight is 0**: `index.ts:18` skips `renderer.render()` when `weight === 0`, but `heroBlob.tick()` still runs every frame regardless (cheap CPU-only smoothing). This is a documented, deliberate simplification vs. design.md's literal pseudocode (`w===0 && displayed<0.001`) — apply-progress calls this out explicitly and it satisfies the "zero GPU cost" wording literally. Not a defect; downgraded from a WARNING candidate to informational because it's harmless and disclosed.
- **Resize math**: `resize(aspect)` threshold (`aspect > 1.2`) and DPR clamp (`Math.min(devicePixelRatio, 2)` reapplied on every `ResizeObserver` callback, not just at init) both match spec text exactly.
- **`destroy()` never called**: it is wired as `onContextLost` into `stage.init(canvas, destroy)` and as the catch-handler inside `tick()`'s try/catch — both real call sites exist and are reachable.

## Spec Compliance Matrix

| Requirement | Status |
|---|---|
| Route-Scoped Mount | COMPLIANT (verified via compiled SSR output) |
| Pre-Import Gating | COMPLIANT (control-flow read) |
| Fallback Preservation | PARTIALLY VERIFIED — code path is correct (no DOM/style added when gates fail, try/catch present); the actual "no layout shift"/"no console error" browser assertions are UNVERIFIED (WU6.6, 6.7, 6.9) |
| Decorative Accessibility | COMPLIANT |
| sceneWeights Contract | COMPLIANT + unit-tested (3/3 passing) |
| Module Lifecycle Contract | COMPLIANT on the happy path; see WARNING 1 for a mid-init-throw edge case |
| Resize Handling and DPR Cap | COMPLIANT |
| Bundle Budget | COMPLIANT (129.24KB / 130KB target, 140KB ceiling) — see WARNING 2 on margin |
| Failure Isolation | COMPLIANT for the described scenarios; WARNING 1 is an adjacent gap not covered by the spec's literal scenarios |

## UNVERIFIED (carry forward — requires a browser, not run by this agent)

- 6.4 Light theme rendering (no black rectangle)
- 6.5 Dark theme + `themechange`/`modechange` re-tint without reload
- 6.6 `prefers-reduced-motion: reduce` — no network request
- 6.7 WebGL disabled — no network request, no console error
- 6.8 Mobile viewport — no layout shift, resize across orientation change
- 6.9 Console cleanliness across all states + simulated `webglcontextlost`
- 6.10 `/blog` network tab — zero hero3d/three requests

## Overall Verdict: PASS WITH WARNINGS

0 CRITICAL, 2 WARNING, 0 SUGGESTION (bundle-margin note folded into WARNING 2). All automatable spec requirements and tasks are independently verified against real build/test/grep output, not apply's claims. The only gate to archive is the human-only manual QA checklist (6.4-6.10), which is expected to require a browser and was never claimed as done by apply.
