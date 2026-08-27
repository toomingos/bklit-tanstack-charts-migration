# 5.0.2 — Breaking-change sweep: `@tanstack/charts@0.15.0` / `@tanstack/react-charts@0.15.0` compat matrix

**Scope.** Every `@tanstack/*` import statement under `showcase/migrated/**` and `showcase/packages/**`, checked against the
published 0.15.0 tarballs extracted at:

- `pkg/tanstack-charts-0.15.0/` (dist `.d.ts` = authoritative typings)
- `pkg/tanstack-react-charts-0.15.0/`

`showcase/packages/**` contains zero `@tanstack/*` imports (only `.ts`/`.tsx` under `showcase/migrated/**` reference the
runtime). `showcase/package.json` already pins `@tanstack/charts@0.15.0` and `@tanstack/react-charts@0.15.0` directly
(5.0.1 re-vendor is done).

**Method.** A Python AST-light scanner walked every `import { … } from "@tanstack/…"` (value and `import type` /
inline `type` bindings, multi-line imports included) across all 153 `.ts`/`.tsx` files under `showcase/migrated/**`.
That produced **92 import statements** collapsing to **43 distinct (subpath, binding) pairs** across **12 distinct
subpaths**. Each pair was checked against the corresponding `dist/*.d.ts`, resolved via the `exports` map in
`pkg/tanstack-charts-0.15.0/package.json` / `pkg/tanstack-react-charts-0.15.0/package.json`, following
`export * from` / `export type { … } from` barrel chains where needed (e.g. `@tanstack/charts` bare barrel →
`dist/index.d.ts` → `./d3-shape.js`, `./scene.js`, `./universal-types.js`, etc.; `@tanstack/charts/svg/resources` →
`dist/svg-resources.d.ts` → re-exports `renderChartSvg` from `./svg.js` as `renderChartSvgWithResources`).

For every pair, the signature (not just the name) was diffed against the pre-upgrade vendored source at
`local_cache/tanstack-charts-a285ce7-v0.14.0/packages/charts-core/src/*.ts` (the v0.14.0-era clone; this is the
`a285ce7` snapshot referenced by the task — `showcase/repos/tanstack-charts` no longer exists as a path in this repo,
`repos/tanstack-charts` at the repo root is a separate, newer working clone at a later commit and was **not** used as
the baseline).

---

## Compat matrix

Legend: **OK** = binding exists in 0.15.0 with an unchanged or purely-additive (new optional fields/params) signature.
No row in this sweep is MISSING, RENAMED, or UNRESOLVED.

### `@tanstack/react-charts` (bare barrel → `dist/index.d.ts` → `Chart.d.ts`)

| subpath | binding | kind | status | used in | action |
|---|---|---|---|---|---|
| `@tanstack/react-charts` | `Chart` | value | OK — `ChartProps`/`ChartCommonProps` byte-for-byte identical to the v0.14.0 clone's `Chart.tsx` | 15 files: `area-chart.tsx`, `bar-chart.tsx`, `candlestick-chart.tsx`, `choropleth-chart.tsx`, `composed-chart.tsx`, `gauge.tsx`, `internal/heatmap-components.tsx`, `line-chart.tsx`, `live-line-chart.tsx`, `pie-chart.tsx`, `radar-chart.tsx`, `ring-chart.tsx`, `sankey-chart.tsx`, `scatter-chart.tsx`, `sunburst-chart.tsx` | none |

### `@tanstack/charts` (bare barrel → `dist/index.d.ts`)

| subpath | binding | kind | status | used in | action |
|---|---|---|---|---|---|
| `@tanstack/charts` | `defineChart` | value | OK — overload set grew (named `scales` map added, `x`/`y` typed as `ChartPositionScaleOptions` which `extends ChartAxisOptions`, purely additive optional fields `channel`/`side`) | 15 files (all chart entry files) | none |
| `@tanstack/charts` | `createMark` | value | OK — gained optional 3rd param `renderer?: ChartMarkRenderer` and 2 new generic slots `TXScaleId='x'`/`TYScaleId='y'` with defaults; existing 2-arg calls unaffected | 13 files: `candlestick-chart.tsx`, `internal/area-fill-mark.ts`, `internal/bar-column-track-mark.ts`, `internal/bar-depth-marks.ts`, `internal/bar-pulse-mark.ts`, `internal/bar-squares-mark.ts`, `internal/bar-trimmed-mark.ts`, `internal/live-line-mark.ts`, `internal/pattern-area-mark.ts`, `internal/profit-loss-line-mark.ts`, `internal/projection-line-mark.ts`, `internal/sankey-mark.ts`, `internal/series-bar-mark.ts` | none |
| `@tanstack/charts` | `d3Curve` | value | OK — identical implementation | `area-chart.tsx`, `composed-chart.tsx`, `line-chart.tsx`, `live-line-chart.tsx` | none |
| `@tanstack/charts` | `lineY` | value | OK — `LineYOptions` gained `CartesianScaleBindings` (optional `xScale`/`yScale`) via its base `LineOptions`; additive | `area-chart.tsx`, `composed-chart.tsx`, `line-chart.tsx` | none |
| `@tanstack/charts` | `barY` | value | OK — `BarYOptions` gained `CartesianScaleBindings`; additive | `bar-chart.tsx` | none |
| `@tanstack/charts` | `group` | value | OK — `GroupOptions`/`group()` identical | `bar-chart.tsx` | none |
| `@tanstack/charts` | `ruleY` | value | OK — `RuleYOptions` gained optional `yScale?: string`; additive | `internal/grid-highlight-mark.ts` | none |
| `@tanstack/charts` | `cell` | value | OK — `CellOptions = Omit<RectOptions, 'x1'\|'x2'\|'y1'\|'y2'>`, `RectOptions` gained `CartesianScaleBindings`; additive | `internal/heatmap-components.tsx` | none |
| `@tanstack/charts` | `dot` | value | OK — `DotOptions` gained `CartesianScaleBindings`; additive | `internal/series-marker-mark.ts`, `scatter-chart.tsx` | none |
| `@tanstack/charts` | `link` | value | OK — `LinkOptions` gained `CartesianScaleBindings`; required fields (`x1`,`y1`,`x2`,`y2`) unchanged | `internal/sankey-mark.ts` | none |
| `@tanstack/charts` | `ChartMark` | type | OK — grew from 3 to 7 generic params, all new ones defaulted; structurally compatible with every inferred usage in our code (none of our code instantiates `ChartMark<…>` with explicit generics beyond the original 3) | 20 files (all mark/type-import sites) | none |
| `@tanstack/charts` | `StaticChartDefinition` | type | OK — unchanged shape | `area-chart.tsx`, `choropleth-chart.tsx`, `scatter-chart.tsx` | none |
| `@tanstack/charts` | `ChartScale` | type | OK — unchanged | `area-chart.tsx`, `candlestick-chart.tsx`, `composed-chart.tsx`, `line-chart.tsx`, `scatter-chart.tsx` | none |
| `@tanstack/charts` | `ChartPoint` | type | OK — unchanged | 11 files | none |
| `@tanstack/charts` | `ChartValue` | type | OK — unchanged | `choropleth-chart.tsx`, `internal/sankey-mark.ts`, `scatter-chart.tsx` | none |
| `@tanstack/charts` | `SceneNode` | type | OK — unchanged | 16 files | none |
| `@tanstack/charts` | `ChartCurve` | type | OK — unchanged | `internal/area-fill-mark.ts`, `internal/live-line-mark.ts`, `internal/pattern-area-mark.ts` | none |
| `@tanstack/charts` | `ChartFocusStrategy` | type | OK — unchanged | `internal/bar-focus-strategy.ts`, `internal/candlestick-focus-strategy.ts`, `internal/scatter-focus-strategy.ts` | none |
| `@tanstack/charts` | `ChartMotionContext` | type | OK — unchanged | `internal/native-stagger.ts` | none |
| `@tanstack/charts` | `ChartMotionRole` | type | OK — unchanged | `internal/native-stagger.ts` | none |
| `@tanstack/charts` | `MarkRenderContext` | type | OK — unchanged | `internal/sankey-mark.ts` | none |
| `@tanstack/charts` | `SceneLabel` | type | OK — unchanged | `internal/sankey-mark.ts` | none |

### Subpath exports (each verified against the `exports` map: subpath → `dist/<file>.d.ts`)

| subpath | binding | kind | status | used in | action |
|---|---|---|---|---|---|
| `@tanstack/charts/focus/disabled` | `focusDisabled` | value | OK — `focus-disabled.d.ts` object literal byte-identical to clone's `focus-disabled.ts` | `gauge.tsx`, `pie-chart.tsx`, `radar-chart.tsx`, `ring-chart.tsx`, `sunburst-chart.tsx` | none |
| `@tanstack/charts/transform/fold` | `fold` | value | OK — `transform-fold.d.ts` overloads identical to clone's `transform-fold.ts` | `radar-chart.tsx` | none |
| `@tanstack/charts/geo` | `geoShape` | value | OK — `geo.d.ts` `GeoShapeOptions`/`GeoProjectionInput` identical to clone's `geo.ts` | `choropleth-chart.tsx` | none |
| `@tanstack/charts/svg/resources` | `renderChartSvgWithResources` | value | OK — `svg-resources.d.ts` is a 1-line re-export (`export { renderChartSvg as renderChartSvgWithResources } from './svg.js'`), identical to clone | `gauge.tsx` | none |
| `@tanstack/charts/network/sankey` | `sankeyDiagram` | value | OK — see signature note below | `internal/sankey-mark.ts` | none (informational) |
| `@tanstack/charts/network/sankey` | `SankeyLink` (aliased `NativeSankeyLink`) | type | OK — unchanged shape | `internal/sankey-mark.ts` | none |
| `@tanstack/charts/network/sankey` | `SankeyNode` (aliased `NativeSankeyNode`) | type | OK — unchanged shape | `internal/sankey-mark.ts` | none |
| `@tanstack/charts/d3/shape` | `d3Curve` | value | OK — same `d3-shape.d.ts` export the bare barrel re-exports; identical function | `internal/sankey-mark.ts` | none |
| `@tanstack/charts/spring` | `createChartSpring` | value | OK — `spring.d.ts` identical to clone's `spring.ts` (same damped-harmonic-oscillator implementation, same option/result shapes) | `internal/spring.ts` | none |
| `@tanstack/charts/spring` | `ChartSpring` | type | OK — unchanged | `internal/spring.ts` | none |
| `@tanstack/charts/regression` | `linearRegressionRowsY` | value | OK — `regression.d.ts` signature identical to clone's `regression.ts` | `internal/projection-utils.ts` | none |
| `@tanstack/charts/motion/definition` | `stagger` (aliased `nativeStagger`) | value | OK — `motion-definition.d.ts` identical to clone's `motion-definition.ts` | `internal/native-stagger.ts` | none |
| `@tanstack/charts/polar` | `polar` | value | OK, with a **documented soft-deprecation** — see finding below | `gauge.tsx`, `pie-chart.tsx`, `radar-chart.tsx`, `ring-chart.tsx`, `sunburst-chart.tsx` | optional forward-migration (see Verdict) |
| `@tanstack/charts/polar` | `radialArc` | value | OK — `RadialArcOptions` identical | `gauge.tsx`, `pie-chart.tsx`, `ring-chart.tsx`, `sunburst-chart.tsx` | none |
| `@tanstack/charts/polar` | `radialArea` | value | OK — `RadialAreaOptions` identical | `radar-chart.tsx` | none |
| `@tanstack/charts/polar` | `radialDot` | value | OK — `RadialDotOptions` identical | `radar-chart.tsx` | none |
| `@tanstack/charts/polar` | `angleGrid` | value | OK — `AngleGridOptions`/`angleGrid()` identical | `radar-chart.tsx` | none |
| `@tanstack/charts/polar` | `PolarMark` | type | OK — gained optional `renderer?`, `__angleScaleId?`, `__radiusScaleId?`; the object-literal `quadMark: PolarMark<unknown> = { initialize, motion? }` in `gauge.tsx` remains valid (missing optional props are never an error) | `gauge.tsx` | none |
| `@tanstack/charts/polar` | `PolarGuide` | type | OK — unchanged (`render` signature identical) | `internal/radar-reveal.ts`, `radar-chart.tsx` | none |
| `@tanstack/charts/polar` | `PolarGuideScene` | type | OK — unchanged (`background`/`foreground` fields identical) | `internal/radar-reveal.ts` | none |

**Total: 43 distinct (subpath, binding) pairs. All 43 = OK. 0 MISSING. 0 RENAMED. 0 SIGNATURE-CHANGED (breaking). 0 UNRESOLVED.**

---

## Signature-diff findings (priority list per task step 5)

All of the following are **additive, non-breaking** changes verified by diffing 0.15.0's `dist/*.d.ts` against
`local_cache/tanstack-charts-a285ce7-v0.14.0/packages/charts-core/src/*.ts`. None require code changes to compile or
run correctly; listed for awareness since the task asked for parameter/option-shape deltas on the priority APIs.

1. **`ChartMarkMotionOptions<TDatum>`** (`types.ts` → `types.d.ts`) now `extends ChartMarkOptions` (`{ renderer?: ChartMarkRenderer }`)
   instead of being a bare `{ motion?: ChartMotionDefinition<TDatum> }`. Net shape: `{ renderer?, motion? }` — `motion` unchanged, `renderer` new-optional. This ripples (via `extends`) into every mark options interface that already carried `motion` (`BarYOptions`, `DotOptions`, `LinkOptions`, `RectOptions`/`CellOptions`, `RegressionOptions`, `SankeyDiagramOptions`, etc.) — none of our code sets `renderer`, so no action needed.
2. **`createMark(initialize, motion?, renderer?)`** — new optional 3rd parameter for custom mark renderers, plus two new defaulted generic scale-id parameters (`TXScaleId='x'`, `TYScaleId='y'`) on `ChartMark<…>` itself. All 13 of our `createMark(...)` call sites pass exactly `(initialize)` or `(initialize, motion)` — unaffected.
3. **`CartesianScaleBindings`** (`{ xScale?: string; yScale?: string }`) is a new mixin now applied to `BarYOptions`/`BarXOptions`, `DotOptions`, `LinkOptions`, `LineYOptions`/`LineXOptions` (via `LineOptions`), `RectOptions`/`CellOptions`, and directly to `RuleYOptions`/`RuleXOptions` — supports the new named-scale system. Purely additive optional fields; none of our option objects are affected.
4. **`defineChart`'s `x`/`y` options** narrowed from `ChartAxisOptions<TValue>` to `ChartPositionScaleOptions<TValue>`, which `extends ChartAxisOptions` and adds two new optional fields (`channel?: 'x'|'y'`, `side?: ChartAxisSide`). A new top-level `scales?: Readonly<Record<string, ChartPositionScaleOptions | null>>` option was also added alongside `x`/`y`. Our `defineChart({ x: {...}, y: {...}, marks: [...] })` call shape is unaffected — `ChartAxisOptions`'s fields (`scale`, `nice`, `reverse`, `viewport`, `grid`, `axis`) are unchanged.
5. **`polar()`'s `PolarOptions`** gained `scales?: PolarScales<TMarks>` (a `{ angle, radius }` named-scale map, mirroring the Cartesian `scales` addition above). The pre-existing top-level `angle?`/`radius?` fields are now marked `@deprecated` in the `.d.ts` JSDoc ("Move this value to `scales.angle`" / "`scales.radius`") but are **still present, still typed, still functional** — not removed. `radar-chart.tsx:409-411` uses the old flat form (`polar({ angle: {...}, radius: {...}, ... })`); it compiles and runs unchanged against 0.15.0.
6. **`sankeyDiagram()`'s `SankeyDiagramOptions`** — in the v0.14.0 clone, `motion?: ChartMotionDefinition<ChartMarkDatum<TMarks[number]>>` was declared as its own field directly on the interface; in 0.15.0 the interface now `extends ChartMarkMotionOptions<ChartMarkDatum<TMarks[number]>>` instead, which supplies the identical `motion?` field (see finding 1) plus the new optional `renderer?`. Net field set for callers is unchanged (`motion` still present, still optional, same type) plus one new optional field. `internal/sankey-mark.ts`'s `sankeyDiagram({ nodes, links, nodeKey, source, target, value, marks, ... })` call is unaffected.
7. All other priority-list subpaths checked (`/focus/disabled`, `/svg/resources`, `/motion/definition`, `/spring`, `/regression`, `/geo`, `/d3/shape`, `/transform/fold`) diffed **byte-for-byte identical** between the v0.14.0 clone and 0.15.0's `.d.ts` — no signature drift at all in those eight subpaths.

---

## Verdict

- **Total (subpath, binding) pairs checked: 43** (collapsing 92 raw import statements across 12 distinct subpaths: bare `@tanstack/charts`, bare `@tanstack/react-charts`, `/focus/disabled`, `/transform/fold`, `/polar`, `/geo`, `/svg/resources`, `/network/sankey`, `/d3/shape`, `/spring`, `/regression`, `/motion/definition`).
- **OK: 43 / 43** (100%).
- **MISSING: 0. RENAMED: 0. SIGNATURE-CHANGED (breaking): 0. UNRESOLVED: 0.**
- **Required mechanical fixes: none.** Nothing in `showcase/migrated/**` needs to change to compile or run correctly against `@tanstack/charts@0.15.0` / `@tanstack/react-charts@0.15.0`.
- **Non-blocking, forward-looking note (not a required fix):** `showcase/migrated/charts/radar-chart.tsx:409-411` calls `polar({ angle: { scale: scalePoint<string>().domain(metricKeys) }, radius: { scale: scaleLinear().domain([0, 100]) }, guides, marks: [...] })` using the top-level `angle`/`radius` fields that 0.15.0 now marks `@deprecated` in favor of a `scales: { angle, radius }` map. Since this is a docs-only deprecation with no removal and no behavior change, it is **not required** by 5.0.2's "mechanical renames only" scope; recommend tracking as a low-priority cleanup item for whichever later batch touches `radar-chart.tsx`'s `polar()` call (e.g. alongside 5.2.2's B3 interaction/polar batch), rather than fixing it now.
- **Established facts corroborated by this sweep:** the lead's earlier finding that the clone→0.15.0 exported-symbol diff is additive-only holds at the binding level too — every one of the 43 pairs we actually import resolved by exact name, and every changed option/type shape we found was a strict superset (new optional fields/params/generics) of the v0.14.0-era shape, not a rename or removal.
