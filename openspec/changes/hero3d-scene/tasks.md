# Tasks: Hero 3D Scene Skeleton (`hero3d`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400-500 (4 flat TS files ~35+75+130+55, 1 test ~25, HeroCanvas.astro ~70, index.astro +3, global.css +15, package.json +2) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR, committed by work unit (WU0-WU7 below) |
| Delivery strategy | ask-on-risk (default; not overridden this run) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Separate from the line-budget guard: WU0 is a **functional decision gate** (bundle size), not a size-of-PR decision. If WU0's measured gzip exceeds the spec's 100KB hard ceiling, apply MUST STOP regardless of the line-budget verdict above — see WU0.

### Suggested Work Units

| Unit | Goal | Notes |
|------|------|-------|
| WU0 | Bundle spike + decision gate | Gates everything below. See STOP condition. |
| WU1 | `sceneWeights.ts` + unit test | Pure math, no three.js dependency |
| WU2 | `stage.ts` | Renderer/scene/camera/resize/context-loss |
| WU3 | `heroBlob.ts` | Mesh + shader, reads `sceneWeights` only |
| WU4 | `index.ts` | Entry singleton, wiring, ticker |
| WU5 | `HeroCanvas.astro` + `index.astro` + `global.css` | Gate script, mount, canvas CSS |
| WU6 | Route isolation + manual QA | Verification only, no new code |

## WU0: Bundle Spike (Decision Gate) — do this FIRST, in isolation

- [x] 0.1 `fnm use v20.20.2`. Confirm whether the repo's authoritative install tool is npm or pnpm (both `package-lock.json` and `pnpm-lock.yaml` exist, `node_modules/.pnpm` suggests pnpm was actually used) — pick one and note it, don't mix. **Resolved: pnpm is authoritative** (`vercel.json` buildCommand/installCommand use pnpm, `node_modules/.pnpm` present). Gotcha found: the corepack-pinned pnpm (11.14.0) requires Node >=22.13 and crashes under Node 20 (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`) — ran `pnpm add`/`pnpm add -D` under the shell's default `fnm` Node (v22.23.1, pnpm resolves to 11.1.1 there) and switched to `fnm use v20.20.2` only for the Astro build/measure step. `package-lock.json` was NOT touched by either install (verified via `git status` before/after).
- [x] 0.2 Install `three` (pinned to latest stable, `^0.185.1`, via `pnpm add three -w` — workspace root needs `-w` per `pnpm-workspace.yaml`). Checked `node_modules/three/package.json`: no `types`/`typings` field, `exports` map has no `types` condition, `find node_modules/three -iname "*.d.ts"` returns zero files → three ships **no bundled types**. Added `@types/three` (`^0.185.4`) as devDependency, matching the installed three version.
- [x] 0.3 Created a throwaway entry (`src/features/home/three/spike-entry.ts`, named imports only: `WebGLRenderer, Scene, PerspectiveCamera, Mesh, IcosahedronGeometry, ShaderMaterial, Color`) and a temporary one-line dynamic `import()` in `src/pages/index.astro`'s existing script block to force a dedicated chunk in the `/` route build.
- [x] 0.4 `fnm use v20.20.2 && npm run build`. Emitted chunk: `dist/client/_astro/spike-entry.ioutScBz.js` — Vite's own build log reports it directly: **505.40 kB raw, gzip: 127.39 kB**.
- [x] 0.5 **STOP condition triggered**: 127.39 KB gzip > 100 KB hard ceiling (spec `Requirement: Bundle Budget`). Per instruction, did NOT swap three.js for hand-rolled WebGL, did NOT silently raise the budget. Reverted all spike changes (`git checkout -- src/pages/index.astro package.json pnpm-lock.yaml`, deleted `spike-entry.ts` and the now-empty `src/features/home/` tree) — working tree is back to its pre-WU0 state. **Apply HALTED here. WU1-WU6 not started.** See apply-progress report for the renegotiation options surfaced to the user.

## WU1: `src/features/home/three/sceneWeights.ts`

- [x] 1.1 Implement `get(key)`, `set(key, "in"|"out", v)`, `tick()` — `weight = clamp(in * (1 - out), 0, 1)`. Only `set` writes `in`/`out`; nothing writes `weight` directly.
- [x] 1.2 Implement `attachIntersectionDriver(el, key): () => void` inside this same file (driver stays here until a second driver exists).
- [x] 1.3 `src/features/home/three/sceneWeights.test.ts` (co-located, matches `src/features/exams/lib/scoring.test.ts` convention): assert `weight` formula incl. `in=1,out=1 → 0` edge case. Run: `npm run test:unit`.
- [x] Verify: `npm run test:unit` green (3 passed). Rollback: delete the 2 files, no other module imports this yet.

## WU2: `src/features/home/three/stage.ts`

- [x] 2.1 `init(canvas, onContextLost): StageContext | null` — `WebGLRenderer({canvas, alpha:true, antialias:false, powerPreference:"low-power"})`, `setClearAlpha(0)`. `alpha:true` is LOAD-BEARING — omitting it paints opaque black over `.hero::before` and breaks light mode.
- [x] 2.2 `PerspectiveCamera(35, aspect, 0.1, 100)` at z=6. `setPixelRatio(Math.min(devicePixelRatio, 2))`.
- [x] 2.3 `ResizeObserver` on the canvas parent (not `window.resize` — `.hero` reflows on font load). Reapply the DPR clamp on every resize callback, guard 0×0.
- [x] 2.4 `webglcontextlost` listener calls the injected `onContextLost` callback. Deliberately NO `preventDefault()` on this event (no restoration attempted; CSS crosshatch is already the fallback) — do not "fix" this if reviewed.
- [x] 2.5 `destroy()`: disconnect ResizeObserver, remove the contextlost listener, `renderer.dispose()` then `forceContextLoss()`. Return `null` from `init` on renderer construction failure (never throw across this boundary).
- [x] Verify: file compiles (`npx tsc --noEmit` after `fnm use v20.20.2`) — clean, zero errors. Rollback: delete file, no consumers yet.

## WU3: `src/features/home/three/heroBlob.ts`

- [x] 3.1 `IcosahedronGeometry(1.4, 4)`, `ShaderMaterial` with inline template-literal GLSL (unlit fresnel rim, 2-colour gradient, `NormalBlending`, `transparent:true`, `depthWrite:false`).
- [x] 3.2 Uniforms `uTime, uProgress, uColorA, uColorB, uFresnelPower, uOpacity`. Read `--accent`/`--border-strong` via `getComputedStyle(...).trim()` (leading whitespace gotcha) on init and on the existing `themechange` (`ThemeSwitcher.astro:37`) and `modechange` (`ModeToggle.astro:30`) document events — do not add a new event. Only plain-hex custom props (never `--accent-soft`, which is `rgba()`).
- [x] 3.3 `resize(aspect)`: `aspect > 1.2` → `mesh.position.x = 1.8`, `scale = 1`; else `x = 0`, `scale = 0.6`. No JS media queries.
- [x] 3.4 `tick(dt)`: smooth `displayed += (weight - displayed) * min(1, dt*4)` reading `sceneWeights.get("hero").weight` (read-only); `uProgress = displayed`; `uTime` accumulates only while rendering (`displayed > 0.001`, so scrolling back doesn't jump).
- [x] 3.5 `destroy()`: remove theme/mode listeners, `mesh.removeFromParent()` (equivalent to `scene.remove(mesh)` without heroBlob needing to hold a `scene` reference), `geometry.dispose()`, `material.dispose()`.
- [x] Verify: `npx tsc --noEmit` — clean. Rollback: delete file.

## WU4: `src/features/home/three/index.ts`

- [x] 4.1 Started-guard, then in order: `stage.init` → `attachIntersectionDriver` → `heroBlob.init` → `gsap.ticker.add(tick)`. Ticker add LAST.
- [x] 4.2 Static `import gsap from "gsap"` (already in the `/` graph via `index.astro:230-234` — this keeps the three chunk three-only for an honest budget measurement). Do NOT call `gsap.ticker.fps()`, `.lagSmoothing()`, or `.remove()` on any callback this module didn't add — those are process-global and would alter every existing tween on `/`.
- [x] 4.3 Per-frame `tick`: early-return before `renderer.render` when `weight === 0` (zero GPU cost while scrolling past — literal reading of this task item; `heroBlob.tick()` still runs each frame to let `displayed` decay/rise smoothly in the background at zero GPU cost, so re-entering the viewport resumes from a partially-decayed value instead of popping). Wrap the whole callback body in try/catch — on throw, call this module's own `destroy()` and let the page fall back silently (mirror `DiagramBlock.astro`'s try/catch pattern).
- [x] 4.4 Exported `init`/`destroy`, teardown order: `ticker.remove(tick)` → driver detach → `heroBlob.destroy()` → `stage.destroy()` → `started = false`.
- [x] Verify: `npx tsc --noEmit` — clean. Rollback: delete file.

## WU5: Wiring — `HeroCanvas.astro`, `index.astro`, `global.css`

- [x] 5.1 `src/features/home/components/HeroCanvas.astro`: `<canvas aria-hidden="true">` (no `tabindex`, `pointer-events: none` via scoped CSS), scoped CSS `position:absolute; inset:0; z-index:0` below `.hero__inner` (`.hero{position:relative}` already at `global.css:1038`).
- [x] 5.2 Gate script in the same file, in order: `!canvas` guard → `matchMedia('(prefers-reduced-motion: reduce)')` → `hasWebGL()` (real probe: `canvas.getContext('webgl2'||'webgl')`, not a `typeof` check) → `requestIdleCallback(load, {timeout:2000})` with `setTimeout(300)` fallback → `import("../three").then(init).catch(() => {})`. Both gates MUST run before the `import()` call, not after.
- [x] 5.3 `src/pages/index.astro`: add `<HeroCanvas />` inside `.hero`, before `.hero__inner` in DOM order (z-index handles the paint order). 2-line diff (one import, one `<HeroCanvas />`). Did NOT touch the existing `<script>` block at lines 229-234 or the typewriter logic below it.
- [x] 5.4 `src/styles/global.css`: NOT touched — `.hero { position: relative }` (line 1038) and `.hero__inner { z-index: 1 }` (line 1053) already existed; HeroCanvas.astro's scoped CSS fully covers the canvas.
- [x] 5.5 Confirmed NOT added: `astro:before-swap` handler, `beforeunload`/`pagehide` listener. Intentional — see design.md §5.
- [x] Verify: `fnm use v20.20.2 && npm run build` succeeded. Rollback: remove `<HeroCanvas />` usage + delete `src/features/home/`, no global.css hunk to revert.

## WU6: Route Isolation + Manual QA (verification only)

- [x] 6.1 `fnm use v20.20.2 && npm run build` succeeded. `npm run preview` is **not supported by the `@astrojs/vercel` adapter** (`[preview] The @astrojs/vercel adapter does not support the preview command.`) — could not curl a running server. Verified route isolation instead against the compiled SSR output: `grep -rl "HeroCanvas" .vercel/output/_functions/pages/ .vercel/output/_functions/chunks/` returns only `pages/index.astro.mjs`; `pages/blog.astro.mjs`, `pages/about.astro.mjs`, `pages/cv.astro.mjs` all return zero matches for `HeroCanvas`/`three`. Since only `index.astro`'s compiled renderer imports/renders the `HeroCanvas` component, no other route can ever emit the script tag that triggers the dynamic `import()`.
- [x] 6.2 Re-measured gzip size of the final chunk: **`dist/client/_astro/index.Cv4X_BWn.js` — 508.90 kB raw, gzip: 129.24 kB** (Vite's own build log). Against the WU0 baseline (127.39 kB gzip, minimal spike with fewer named imports) this is a ~1.85 kB regression from the real shader/geometry/uniforms code, well within budget: ≤130KB target (129.24 < 130, passes) and ≤140KB hard ceiling (passes with room).
- [x] 6.3 `npx tsc --noEmit` passes with zero errors. `npm run check` (`astro check`, 120 files): 0 errors, 0 warnings, 30 hints — all 30 hints are in pre-existing files unrelated to this change (confirmed via `grep -i "features/home\|HeroCanvas\|pages/index.astro"` on the check output: zero matches).
- [ ] 6.4 Manual QA — light theme: canvas renders, hero text stays readable, no black rectangle.
- [ ] 6.5 Manual QA — dark theme: same, verify `themechange`/`modechange` re-tint the shader without a page reload.
- [ ] 6.6 Manual QA — `prefers-reduced-motion: reduce` (OS or DevTools emulation): no three.js network request fires, hero renders identical to current prod.
- [ ] 6.7 Manual QA — WebGL disabled (`chrome://flags` or `webgl.disabled` in Firefox, or DevTools WebGL override): no three.js network request fires, no console error, `.hero::before` visible.
- [ ] 6.8 Manual QA — mobile viewport (DevTools device emulation, real device if available): canvas mounts, no layout shift, resize handling holds across orientation change.
- [ ] 6.9 Manual QA — DevTools console on `/`: zero errors/warnings across all above states, including a simulated `webglcontextlost` (DevTools "Highlight WebGL context loss" or force-lose via `WEBGL_lose_context` extension in console) — confirm fallback to `.hero::before` with no surfaced error.
- [ ] 6.10 Manual QA — `/blog` (or any non-`/` route): Network tab shows zero requests for the hero3d chunk or `three` itself.
- [ ] Verify: all above checked off. Rollback: n/a (verification phase; if any item fails, return to the relevant WU2-WU5 file, not a rollback of this unit).

## Gotchas carried from design (apply-time reference, not new tasks)

- `getComputedStyle(...).getPropertyValue(...)` returns leading whitespace — always `.trim()`.
- three's `ColorManagement` is ON by default (r152+), `outputColorSpace` defaults to sRGB — `Color.set('#hex')` is already correct; do not add manual conversion.
- No `accentchange` event exists yet (no accent-switcher UI) — don't invent a listener for it.
