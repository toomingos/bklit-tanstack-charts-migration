# 05 — Stack & Libraries

## Workspace

| Field | Value |
|-------|-------|
| `packageManager` | `pnpm@11.15.1` (`package.json:6`) |
| `packages` | `packages/*`, `examples/*` (`pnpm-workspace.yaml:1`) |
| `engines.node` | `>=22` |

## Dependency table

| Package | Version | Kind | Role | Where used | Notes |
|---------|---------|------|------|------------|-------|
| `react` | `19.2.3` | devDep root; `peer ^19` in `react-charts` | Adapter runtime; `memo`, `useId`, `createPortal` | `packages/react-charts/src/Chart.tsx`, `RendererChart.tsx` | Thin adapter — no chart logic in React |
| `react-dom` | `19.2.3` | devDep root; `peer ^19` | `createPortal` for custom tooltip body | `RendererChart.tsx:2` | `tooltipBodyTarget.element` portal |
| `@tanstack/charts` | `workspace:*` | dep of `react-charts` | Framework-neutral core | `react-charts` imports `adapter/renderer`, `svg`, `svg/renderer`, `reconcile` | `charts-core` has no React import |
| `d3-scale` | `4.0.2` | dep `charts-core` | `scaleLinear`, `scaleTime`, `scaleBand`, `scaleOrdinal` for color | `packages/charts-core/src/scales.ts`, `configured-scale.ts` | Also `d3Scale` re-export for consumer scale factories |
| `d3-array` | `3.2.4` | dep `charts-core` | `least` for `nearestPoint`; extent/ticks helpers | `nearest.ts:1`, `scales.ts` |  |
| `d3-shape` | `3.2.0` | dep `charts-core` | `line`, `area`, `curve*`, `stack` paths | `line.ts`, `area.ts`, `stack.ts` | Generates `d` strings for `polyline`/`area` nodes |
| `d3-geo` | `3.1.1` | dep `charts-core` | `geoPath`, `geo*` projections | `geo.ts` | Opt-in via `geo` mark |
| `@types/d3-*` | `^3.x` | devDep root | Types for d3 modules | `devDependencies` | `d3-scale@4.0.9`, `d3-shape@3.1.8`, `d3-geo@3.1.0`, `d3-array@3.2.2` |
| `Canvas` (browser) | n/a | runtime | `measureText` for label layout | `packages/charts-core/src/dom-text.ts:10` | Offscreen `<canvas>.getContext('2d')`; fallback `estimateSceneText` |
| `ResizeObserver` | browser | runtime | Container width observation | `packages/charts-core/src/renderer.ts:190` | Only when `width` prop absent |
| `MutationObserver` | browser | runtime | Canvas theme detection | `packages/charts-core/src/canvas.ts:615` | Watches `class/style/data-theme` ancestors |

### Directly **not** used

| Library | Status |
|---------|--------|
| `visx/*` | Not a dependency anywhere — TanStack owns its SVG/Canvas renderers |
| `motion` / `framer-motion` | Not used — animation is `reconcile.ts` rAF tweens + Canvas cross-fade |
| `react-use-measure` | Not used — `ResizeObserver` direct |
| `d3-selection` / `d3-transition` / `d3-brush` / `d3-zoom` | Not used — imperative handlers own the DOM |
| `zod` / `tanstack/query` / router | Not in chart packages |

Root `devDependencies` include heavier libs (`echarts`, `recharts`, `chart.js`, `@observablehq/plot`) only for `scripts/compare-*` / `benchmark` / `competitor-profiles` — not bundled with charts.

## `charts-core` exports

`packages/charts-core/package.json:16` — 30+ subpath exports (`./adapter`, `./bar`, `./line`, `./area`, `./dot`, `./rect`, `./geo`, `./focus`, `./canvas`, `./dom`, `./reconcile`, `./svg/renderer`, …) with `sideEffects:false` for tree-shaking. Each mark (`bar.ts`, `line.ts`, etc.) is independently importable.

## Framework adapters

| Package | Framework | File | Mechanism |
|---------|-----------|------|-----------|
| `@tanstack/react-charts` | React 19 | `packages/react-charts/src/RendererChart.tsx` | `createChartRendererAdapter` + `ChartSurface` memo + portal |
| `@tanstack/solid-charts` | Solid | `packages/solid-charts/src/Chart.tsx` | Solid equivalent |
| `@tanstack/svelte-charts` | Svelte 5 | `packages/svelte-charts/src/` |  |
| `@tanstack/vue-charts` | Vue | `packages/vue-charts/src/` |  |
| `@tanstack/preact-charts` | Preact | `packages/preact-charts/src/` |  |
| `@tanstack/lit-charts` | Lit | `packages/lit-charts/src/` |  |
| `@tanstack/octane-charts` | Octane | `packages/octane-charts/src/` |  |

All depend on `workspace:*` `@tanstack/charts` (i.e. `charts-core`). Adapter pattern identical — only host glue differs.

## Roles diagram

```
charts-core (framework-neutral)
 ├─ scene.ts / runtime.ts      definition → scene graph (scales, colors, nodes, points)
 ├─ scales.ts / configured-scale.ts   d3-scale factories + nice/domain
 ├─ d3-shape / d3-geo         path strings (line/area/geo)
 ├─ d3-array                  nearest (least), ticks
 ├─ svg-renderer.ts           scene → SVG string
 ├─ svg-surface.ts / reconcile.ts  string → live DOM + animation
 ├─ canvas.ts                 scene → Canvas2D (alternative surface)
 ├─ renderer.ts               mountChartRenderer — host, resize, focus, tooltip
 ├─ adapter*.ts / dom.ts      adapter lifecycle (prerender/mount/update/destroy)
 ├─ dom-text.ts               Canvas measureText cache
 └─ focus.ts / nearest.ts     focus presets + spatialIndex

react-charts (thin React shell)
 ├─ Chart.tsx                 memo(renderer) + onRender adapt
 └─ RendererChart.tsx         useLayoutEffect mount/update/destroy + memo ChartSurface + portal
```

## Build / packaging

- `sideEffects:false` (`charts-core/package.json:6`) + `exports` map — per-mark tree-shaking.
- Root `typecheck: tsc --noEmit`, `format: prettier --write`, `test: vitest run` (incl. `solid`/`svelte`/`octane` configs).
- `tsconfig.json` strict; `pnpm` workspaces.

→ Load `01`, render `02`, hooks/updates `03`, interactivity `04`.
