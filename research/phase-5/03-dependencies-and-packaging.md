# Phase 5 / 03 — Dependencies & Packaging Plan

> Library census, keep/remove rulings, and the staged path to a dependency-clean package. Constraint from `02`: vendored bklit-ui compiles as source into host apps and needs both visx packages — so uninstalls are staged behind the legacy-bklit sunset.

## Census (migrated charts runtime deps)

| Library | Sites | Ruling | Rationale |
|---|---|---|---|
| `@tanstack/charts` (+ `/polar`, `/geo`, `/focus/disabled`, `/mark/scale-values`, `/svg/resources`) | 55 | **Keep** | Migration target |
| `@tanstack/react-charts` | 15 | **Keep** | `<Chart>` host for 14/17 charts |
| `d3-scale` / `d3-shape` / `d3-geo` | direct | **Keep** | Same family as charts-core internals (`charts-core` deps: d3-array 3.2.4, d3-geo 3.1.1, d3-scale 4.0.2, d3-shape 3.2.0) |
| `d3-sankey` | direct | **Keep now → drop after re-vendor** | Not in vendored core; upstream latest ships `sankeyDiagram` mark → layout math moves into scene spec post-upgrade |
| `@visx/pattern` | 1 import site (bridge) | **Drop imports** (uninstall: stage 2) | Port presets to plain `<pattern>` JSX; scene passes url(#id) through on SVG hosts |
| `@visx/zoom` | 2 files + barrel re-export | **Drop imports** (uninstall: stage 2) | Hand-rolled matrix hook per `02-visx-removal.md`; no native equivalent exists anyway |
| WAAPI | browser API | n/a | Residue sanctioned only for app-owned hover chrome |

## Version pins & transitive chain

All pins exact `4.0.1-alpha.0`: showcase/package.json L26/L31 · bench/app/package.json L22/L27 · root L32 (zoom only) · repos/bklit-ui/packages/ui L63/L68.
Uninstalling zoom later also drops transitives: `@use-gesture/react`+`core` 10.3.1, `@visx/event` (verify no other consumer); pattern drops `classnames` (repos use clsx).
Config cleanup at uninstall: bench/app/vite.config.ts:89–91 aliases + tsconfig paths :344–352.

## Staging

**Stage 0 — now:** migrated code drops visx imports (pattern port + zoom hook per `02`). Packages stay installed; showcase keeps legacy bklit charts intentionally. Gate with QA matrix in `02`.

**Stage 1 — after ≥0.14 re-vendor:** drop `d3-sankey` (sankey mark). Re-scope heatmap onto binning/color/focus/stagger primitives (`01` §#1).

**Stage 2 — legacy bklit sunset:** remove `@visx/pattern`, `@visx/zoom` (+transitives) from all host package.jsons; prune bench aliases/tsconfig paths. End state: `react` + TanStack charts family + d3 kernel only.

## Risk register (carried)

- url(#id) passthrough is undocumented + unpinned by upstream tests → guards mandatory (`02`): in-SVG defs via renderSvg wrapper, registry test, solid-fill degradation on non-svg surfaces.
- Pinch continuous-vs-stepped = user-visible deviation → log ruling before implementation.
- Zoom-state parity has no automated gate (D34 manual protocol) → scripted screenshot compare required at removal time.

---

## Census re-run — 2026-08-27 (5.3.5 closeout)

Runtime `@tanstack/charts` + `@tanstack/react-charts` both pinned exact **0.15.0**. Census taken over 154 `.ts`/`.tsx` files under `showcase/migrated/**`, counting `from "<specifier>"` sites.

### Non-relative import sites under `showcase/migrated/**`

| Specifier | Sites | Ruling | Notes |
|---|---|---|---|
| `react` / `react-dom` / `react-dom/client` | 80 / 3 / 2 | **Keep** | Host framework |
| `@tanstack/charts` | 57 | **Keep** | Migration target |
| `@tanstack/react-charts` | 15 | **Keep** | `<Chart>` host |
| `@tanstack/charts/polar` | 7 | **Keep** | pie · gauge · ring · radar · sunburst |
| `@tanstack/charts/focus/disabled` | 5 | **Keep** | D234 — suppresses the default focus ring for bklit hover-sync parity |
| `@tanstack/charts/{transform/fold, svg/resources, spring, regression, network/sankey, motion/definition, geo, d3/shape}` | 1 each | **Keep** | Sanctioned subpath APIs adopted across 5.3.2 |
| `d3-shape` | 18 (5 type-only) | **Keep** | Same d3 kernel charts-core itself depends on |
| `d3-scale` | 18 (5 type-only) | **Keep** | ditto |
| `d3-geo` | 3 (1 type-only) | **Keep** | choropleth projection + graticule |
| `d3-array` | 1 | **Keep** | `bisector` in live-line |
| `d3-sankey` | 1 — **type-only** | **Retired at runtime** | See below |
| `geojson` | 1 (types) | **Keep** | choropleth feature typing |
| `@base-ui/react/progress` | 2 | **Keep** | app-owned legend chrome, not chart runtime |
| `@number-flow/react` | 1 | **Keep** | app-owned centre-stat odometer |
| `@use-gesture/react` | 1 | **Keep** | See below |
| `@visx/*` | **0** | **Removed** | DoD clause met |

### The three findings worth carrying

**1. `@visx/*` is at zero import sites in migrated code — DoD clause met (D398).**
21 textual `@visx` mentions remain under `showcase/migrated/**` and every one is comment prose documenting what was ported and why (`choropleth-chart.tsx:2,4,7,129`, `internal/zoom-engine.tsx:3,5`, …). Zero `import`/`export` statements. Per **D392** no package was uninstalled from any manifest: declarations stand at **14** (`showcase/package.json`), **14** (`bench/app/package.json`), **8** (root) — `showcase/repos/bklit-ui/.../choropleth-chart.tsx` imports `@visx/zoom` and is impl-A of every QA comparison, so uninstalling would break the test instrument. Uninstall stays **Stage 2** (legacy-bklit sunset).

**2. `d3-sankey` is now type-only — Stage 1's runtime goal is already met.**
`internal/sankey-layout.ts:11-14` is an `import type` of `SankeyLink`/`SankeyNode`, erased at build. Layout math moved to `sankeyDiagram()` from `@tanstack/charts/network/sankey` (`internal/sankey-mark.ts:36-40`); the hand-rolled wrapper and its defensive input clone are retired (the native layout never mutates input rows). The aliases stay only because the public `getNodeColor` contract and `laidOutNodesRef` consumers were written against those shapes. The manifest entry (`d3-sankey@0.12.3`) can be demoted to a `devDependency` at Stage 2 — deferred, since demoting it now changes no emitted byte.

**3. Removing `@visx/zoom` promoted a transitive into a direct dependency.**
The T19 local zoom port (`internal/zoom-engine.tsx:37`) still uses `useGesture` from `@use-gesture/react`, which used to arrive *through* `@visx/zoom`. It is now declared directly at `showcase/package.json:20` (`10.3.1`, exact). Net effect on the dependency graph is a reduction — `@visx/zoom` + `@visx/event` + `classnames` drop out, `@use-gesture/react`+`core` stay — but the earlier Stage-2 note ("uninstalling zoom later also drops `@use-gesture`") no longer holds and is corrected here.

### Harness-side residue (not a DoD violation, parked)

`bench/app/src/scenarios/migrated-*.tsx` — 12 files — still `import { curveNatural } from "@visx/curve"`. This is *caller* code passing a curve prop, deliberately identical to the bklit scenario beside it so the A/B pair differs only in the chart implementation. `@visx/curve@4.0.1-alpha.0` is a pure re-export of d3-shape's curve factories (via `@visx/vendor`, verified in `lib/index.js`), and curve factories are stateless, so behaviour is identical either way. The one real consequence is bundle measurement: `@visx/vendor` bundles its own d3-shape copy, so both sides of the bench carry a duplicate — symmetric, and it inflates rather than flatters the migrated figure. Rewriting the scenarios to import from `d3-shape` would invalidate the standing A/B baseline, so it is **parked**, not fixed.

### End state (unchanged from `Staging` above, now with distances)

Stage 0 ✅ complete · Stage 1 ✅ complete at runtime (d3-sankey type-only) · Stage 2 pending legacy-bklit sunset: uninstall `@visx/*` from the 3 manifests, prune `bench/app/vite.config.ts:61-63` aliases and `bench/app/tsconfig.json:59-66` paths, demote `d3-sankey` to dev. Target end state: `react` + TanStack charts family + d3 kernel (+ two app-owned UI deps).
