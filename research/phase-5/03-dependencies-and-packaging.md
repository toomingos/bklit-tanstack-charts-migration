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
