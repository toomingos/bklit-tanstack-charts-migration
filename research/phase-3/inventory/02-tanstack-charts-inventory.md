# TanStack Charts — Capability Inventory

Source analyzed: `repos/tanstack-charts` (read-only clone). All file paths below are
relative to that repo root unless stated otherwise. This document is a reference,
not a comparison — see `03-stack-comparison.md` for the bklit-ui ↔ TanStack Charts
architectural diff.

## 0. Status snapshot (read this first)

- Every package in the monorepo is `"version": "0.0.0"` and `"private": true`
  (confirmed for `packages/charts-core/package.json`,
  `packages/react-charts/package.json`, `packages/charts-core-d3/package.json`,
  and all other `packages/*/package.json`). Root `package.json` name is
  `tanstack-charts-poc`. README.md's own badge reads **`status-pre--alpha`** and
  states in prose: *"TanStack Charts is currently an unpublished `0.0.0` product
  proof. The packages are not published or ready for production use yet."*
  (repeated verbatim in `docs/comparison.md`). This is a **pre-alpha proof-of-concept
  monorepo**, not a project with a stable published semver line. Treat every API
  in this doc as subject to change, and treat source + the conformance test
  `cases/` (§9) as ground truth over prose in `PLAN.md` where they conflict —
  `PLAN.md` explicitly warns its own historical sections may be stale (§10).
  `publishConfig` blocks exist in the core packages' `package.json`s, i.e. the
  monorepo is structured to publish later but has not yet.
- There are **two parallel core packages**:
  - `@tanstack/charts` (`packages/charts-core`) — the framework-neutral grammar,
    marks, scenes, renderers. This is what `@tanstack/react-charts` actually
    depends on (`packages/react-charts/package.json` → `"dependencies": { "@tanstack/charts": "workspace:*" }`).
  - `@tanstack/charts-d3` (`packages/charts-core-d3`) — a second, overlapping
    implementation/spike that also has its own `lineY`, `barY`, `dot`, `rect`,
    `facet`, `focus`, `nearest`, plus a few things `charts-core` lacks
    (`createGridPointIndex` spatial index, `bin`/`group`/`stackY` transforms,
    `scaleColorLinear`, `scaleLog`/`scaleSqrt`/`scaleSymlog`, `scaleTime`/`scaleUtc`).
    **For a React migration, `packages/charts-core` is the relevant package** —
    charts-core-d3 looks like an earlier or parallel exploration track, not
    something react-charts consumes.
- The example app in `examples/charts-react/src/App.tsx` literally labels itself
  "TanStack Stats native spike" and "real migration gate" in its own UI copy —
  further confirming this is early-stage, actively-being-proven-out code, built
  in part to validate migrating TanStack's own `stats.tanstack.com` charts.
- The full mark/grammar surface documented below is confirmed against both
  `packages/charts-core/src/*.ts` source and the shipped docs in `docs/reference/`
  and `docs/examples/`, which stay in sync with the source (checked via the
  `docs/reference/index.md` import-map table against `packages/charts-core/src/index.ts`
  and `packages/charts-core/package.json`'s `exports` field).

---

## 1. The grammar — `defineChart` and `ChartSpec`

### 1.1 `defineChart` overloads

Source: `packages/charts-core/src/scene.ts` (implementation), full contract
documented in `docs/reference/chart-definitions.md`.

```ts
import { defineChart } from '@tanstack/charts'

// 1. Static — data/options already known
function defineChart<const TMarks, const TSpec>(spec: TSpec): StaticChartDefinition<...>

// 2. Responsive — spec depends on resolved surface size/theme
function defineChart<const TSpec>(
  chart: (context: ChartBuildContext) => TSpec,
): DynamicChartDefinition<...>

// 3. Responsive, with definition-level behavior options alongside the builder
function defineChart<const TSpec>(
  config: DynamicChartConfig<TSpec>,
): DynamicChartDefinition<...>

// 4. Re-derive a new definition from an existing one plus different options
function defineChart<TDatum, TXValue, TYValue>(
  definition: ChartDefinition<TDatum, TXValue, TYValue>,
  options: ChartDefinitionOptions<TDatum, TXValue, TYValue>,
): ChartDefinition<TDatum, TXValue, TYValue>
```

`ChartBuildContext` (passed to the responsive builder function):

```ts
interface ChartBuildContext {
  width: number   // current full surface width, host-controlled
  height: number  // current full surface height, host-controlled
  theme: ChartTheme // default build-time theme tokens
}
```

Definition identity **is** the update boundary: the same rules as `useMemo` —
rebuild the definition when captured values change; the runtime re-derives the
scene when the definition object changes or the chart surface resizes
(`docs/reference/chart-definitions.md`, `docs/guides/dynamic-data-and-animation.md`).

### 1.2 `ChartSpec` — full shape

Source: `docs/reference/chart-spec.md`, types in `packages/charts-core/src/types.ts`.

```ts
interface ChartSpec<TMarks extends readonly ChartMark[]> {
  marks: TMarks                          // required, ordered mark layers (paint order = array order)
  x: ChartAxisOptions | null             // required — null only if no mark uses an x scale
  y: ChartAxisOptions | null             // required — null only if no mark uses a y scale
  guides?: boolean                       // false hides both axes/grid/titles + their implicit margin
  color?: ChartColorOptions              // shared categorical/continuous color scale + legend
  gradients?: readonly ChartLinearGradient[]  // SVG gradient resources (resource-aware renderer)
  clip?: boolean                         // clip marks group to inner chart bounds (resource-aware renderer)
  margin?: number | Partial<ChartMargin> // lock some/all sides; omitted sides auto-measured
  theme?: Partial<ChartTheme>            // override foreground/muted/grid/background/palette
}
```

`ChartDefinitionOptions` (definition-level behavior, orthogonal to the spec,
apply to both static and responsive definitions — hosts/adapters cannot
override them): `focus`, `maxFocusDistance`, `spatialIndex`, `animate`,
`keyboard`, `tooltip` (`docs/reference/chart-definitions.md`).

There is **no `ariaLabel` field on `ChartSpec` or the definition** — accessible
name/description are host/adapter-level concerns. Confirmed both from
`mountChart(element, { definition, ariaLabel: '...', onRender })` in
`docs/guides/interactions-and-selections.md` and from the React `Chart`
component's own `ariaLabel`/`ariaDescription` props used in
`examples/charts-react/src/App.tsx` (e.g. `ariaLabel="TanStack package momentum ranking"`,
`ariaDescription="A horizontal ranking that reorders when its data changes."`).

### 1.3 Axis options (`x`/`y`)

Source: `docs/reference/scales-guides-and-color.md`.

```ts
interface ChartAxisOptions<TValue extends ChartValue> {
  scale: ChartScale | ConfiguredScaleLike<TValue> | ChartScaleFactory<TValue>
  nice?: boolean | number
  guide?: boolean
  ticks?: number
  format?: (value: TValue) => string
  grid?: boolean
  label?: string
  reverse?: boolean
  tickRotate?: number
  labelOffset?: number
}
```

| Option        | Default                                 | Meaning |
|---------------|------------------------------------------|---------|
| `scale`       | required                                  | A **D3 scale factory** (domain inferred from mark channels, e.g. `scaleLinear`, `scaleUtc`), a **configured scale instance** (fixed domain, e.g. `scaleLinear().domain([0,100])`), or an advanced custom `ChartScale`. |
| `nice`        | `false`                                    | Applied after domain inference (must run after, since factory-supplied domains aren't known until then). |
| `guide`       | `true` for a non-null axis                 | Renders axis/ticks/title/grid. |
| `ticks`       | responsive target (see below)              | Suggested count, not guaranteed. |
| `format`      | scale formatter, else `String()`           | Tick label formatter. |
| `grid`        | `false` for x, `true` for y                | Grid rules at tick positions. |
| `label`       | none                                       | Axis title text. |
| `reverse`     | `false`                                    | Reverses the pixel range only (not the caller's scale). |
| `tickRotate`  | `0`                                        | Degrees. |
| `labelOffset` | auto                                       | Distance of title from axis. |

Default responsive tick target (no explicit `ticks`): `clamp(2, floor(width/92), 8)`
for x, `clamp(2, floor(height/48), 7)` for y.

Scales are **copied** by the runtime before responsive range/domain are applied —
a caller's configured scale instance is never mutated, so one configured scale
object is safe to reuse across responsive re-renders.

Bar/area marks contribute an implicit zero baseline to domain inference when
their baseline is not explicit.

### 1.4 Color

```ts
interface ChartColorOptions {
  scale?: ConfiguredColorScaleLike<any, any> | ChartColorScaleFactory<any, any>
  type?: ChartColorScale        // custom color-scale resolver
  domain?: readonly ChartKey[]
  range?: readonly string[]
  nice?: boolean | number
  legend?: ChartColorLegend
}
```

Resolution order: (1) `color.scale` if given, (2) custom `color.type`, (3)
built-in ordinal scale from `domain`/observed channel values × `range`/theme
palette. Marks contribute to one shared chart-level color scale via their `z`
or `color` channel. `ChartKey = string | number`.

Built-in legends: `colorLegend({ label?, itemWidth? })` (categorical,
`itemWidth` default 110, min 64) and `colorGradientLegend({ label?, steps?, width?, format? })`
(continuous, `steps` default 32/min 2, `width` default 240) — both from
`@tanstack/charts/legend` (`packages/charts-core/src/legend.ts`). Custom legend
extension point: `ChartColorLegend = { height(itemCount, width): number; render(context): SceneNode }`.

### 1.5 Margins, guides, clip, gradients

- `margin?: number | Partial<ChartMargin>` — omitted sides are auto-measured
  from tick glyph bounds, rotation, label overhang, axis title bounds, and
  color-legend height (`docs/reference/scales-guides-and-color.md` §"Automatic
  guide layout"). A custom `ChartTextMeasurer` can be supplied through host/
  adapter/`createChartScene` layout options for exact (not estimated) text
  measurement in static/SSR compilation.
- `guides: false` hides both axes/grid/titles and reclaims their margin;
  per-axis `guide: false` hides one axis without removing its scale (so
  interaction/scale math is unaffected).
- `clip?: boolean` and `gradients?: readonly ChartLinearGradient[]` are scene
  *data* only — consumed by the **resource-aware** SVG renderer,
  `renderChartSvgWithResources` from `@tanstack/charts/svg/resources`
  (`packages/charts-core/src/svg-resources.ts`). The plain `renderChartSvg` does
  not resolve clip-paths/gradients. `idPrefix` scopes generated resource IDs
  when multiple charts share one document.

### 1.6 Animation options (`ChartAnimationOptions`)

Source: `docs/guides/dynamic-data-and-animation.md`. `animate` on a definition
accepts `true` or:

```ts
interface ChartAnimationOptions {
  duration?: number        // ms
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
           | ((progress: number) => number)
  respectReducedMotion?: boolean  // default true
  resize?: boolean                // default false — responsive relayout does not restart animation
}
```

Numeric geometry and compatible path data interpolate; entering/exiting nodes
reconcile by `key`. **Interruption model**: if a definition update arrives
while a transition is in flight, the next transition begins from the geometry
currently painted on screen (not from the pre-interruption target) — this is
the "interruptible" behavior. Static SVG rendering, SSR, and bare
`createChartScene` do not animate at all (animation is a host/runtime-level
concern layered on top of scene compilation, not part of scene compilation
itself).

### 1.7 Streaming / "live" data guidance

There is no dedicated "live/streaming" mark or API. `docs/guides/dynamic-data-and-animation.md`
§"Streaming" prescribes an application-owned pattern for high-rate data: keep
full history outside the chart if needed, capture a bounded visible window,
preserve keys for rows that survive the window roll, keep viewport state
controlled, and coalesce upstream updates when only the latest state matters.
`host.update(...)` (or the equivalent definition swap) is applied synchronously.
This directly maps to how a bklit-ui `live-line` chart would be implemented:
`lineY` over a windowed/rolling array, driven by a definition rebuilt on each
tick.

---

## 2. Marks — full inventory

Two independent facts anchor this section: (a) `packages/charts-core/src/index.ts`
export list, and (b) `packages/charts-core/package.json`'s `exports` map, which
adds several **opt-in subpath-only** capabilities not exported from the package
root — most importantly `@tanstack/charts/polar` and `@tanstack/charts/geo`.
Root-export marks keep the default bundle Cartesian-only; polar/geo code paths
(and their D3 dependencies) are only pulled in if the app imports the subpath.

### 2.1 Root-exported Cartesian marks

| Mark | Source | Channels/options (from source + `docs/reference/marks/*.md`) | Chart type(s) it expresses |
|---|---|---|---|
| `lineY(data, options)` | `packages/charts-core/src/line.ts:23-35` (`LineYOptions`) | `id`, `x`, `y` (number), `z` (group/color), `key` (defaults unique `datum.id`, then infers from `x`), `stroke` (visual channel), `strokeOpacity`, `strokeWidth`, `strokeDasharray`, `points` (boolean — also emit dot markers at each vertex), `curve` (`ChartCurve` — D3 curve factory bridge) | Line chart, multi-series line, sparkline, trend overlay |
| `areaY(data, options)` | `packages/charts-core/src/area.ts:23-35` (`AreaYOptions`) | `id`, `x`, `y` (top boundary), `y1`/`y2` (explicit interval endpoints — `number` constant or channel; this is the stacked/ranged-area mechanism, app-computed, see mapping table), `z`, `key`, `fill` (visual channel), `fillOpacity`, `stroke` (visual channel — area's own outline), `strokeWidth`, `curve` | Area chart, stacked area (`y1`/`y2` app-computed), range/band area, streamgraph baseline |
| `areaX(data, options)` | `packages/charts-core/src/area-x.ts` | Mirror of `areaY` but along x (horizontal area); `d3AreaXCurve` bridge in `packages/charts-core/src/d3-area-x.ts` | Horizontal area chart |
| `barY(data, options)` | `packages/charts-core/src/bar.ts:25-41` (`BarYOptions`) | `x` (categorical), **either** `y` (single quantitative value, implicit zero baseline) **or** explicit `y1`/`y2` (pre-computed interval endpoints — this is how stacked bars are done, see below), `z`/`color` (group + color-scale input), `key` (defaults to unique `x`), `fill`/`fillOpacity`, `groupScale` (optional D3 band scale positioning `z` groups within each `x` band — this is the grouped-bar mechanism), `inset` (px removed from both categorical edges), `radius` | Vertical bar chart, grouped bars (`groupScale`), stacked bars (`y1`/`y2`, app-computed — confirmed no built-in stack transform, see mapping table) |
| `barX(data, options)` | `packages/charts-core/src/bar.ts:43-59` (`BarXOptions`) | Mirror of `barY`: `y` categorical, either `x` or `x1`/`x2`, `z`/`color`, `key` defaults to unique `y`, `groupScale`, `inset`, `radius` | Horizontal bar chart / ranking chart (used directly in the React example's ranking chart and in `packages/charts-fixtures/src/stats-parity.ts`'s stacked-bar fixture, which passes `x1: 'value1', x2: 'value2'`) |
| `rect(data, options)` | `packages/charts-core/src/rect.ts:20-35` (`RectOptions`) | `id`, `x`/`x1`/`x2`, `y`/`y1`/`y2` (explicit interval channels, not band-inferred like bar), `z`, `key` (defaults to the x/y interval tuple), `fill`, `fillOpacity`, `stroke`, `strokeWidth`, `inset`, `radius` | Histogram bins, candlestick body (ranged rect), Gantt/interval bars, heatmap cells at arbitrary (non-grid) intervals |
| `cell(data, options)` | `packages/charts-core/src/rect.ts` (same file, band-oriented sibling of `rect`) | Ordinal x/y band pair + `fill` (typically color-scale driven) | **Heatmap** (ordinal row/col matrix), calendar heatmap |
| `dot(data, options)` | `packages/charts-core/src/dot.ts:22-34` (`DotOptions`) | `id`, `x`, `y`, `z`, `key`, `r` (number or channel), `rScale` (`ChartNumericScale` — area-preserving radial mapping), `fill`, `fillOpacity`, `stroke`, `strokeOpacity`, `strokeWidth` | Scatterplot, bubble chart, point overlay on lines |
| `hexagon(data, options)` | `packages/charts-core/src/hexagon.ts` | Position + size, similar channel shape to `dot` but hexagonal | Hexbin density chart |
| `ruleX(data, options)` / `ruleY(data, options)` | `packages/charts-core/src/rule.ts:12-28` (`RuleYOptions`/`RuleXOptions`) | Single positional channel (`y` for `ruleY`, `x` for `ruleX` — one full-width/height line per datum, e.g. `ruleY([target])` for a threshold), `stroke`/`strokeOpacity`/`strokeWidth`/`strokeDasharray`. **No `y1`/`y2` on rule itself** — a rule is a single line at one value, not a segment; endpoint-style error bars are built by pairing a rule/tick with a `link` or `dot`. | Reference/threshold lines, gridlines, zero-baselines (used throughout the fixtures as `ruleY([0])`) |
| `link(data, options)` | `packages/charts-core/src/link.ts:22-35` (`LinkOptions`) | Required `x1,y1,x2,y2` channels (one segment per datum), `z`, `key`, `stroke` (visual channel), `strokeOpacity`/`strokeWidth`/`strokeDasharray`, `curve` | Candlestick wick, error-bar segment, node-link diagram edges, connector lines |
| `arrow(data, options)` | `packages/charts-core/src/arrow.ts:22-35` (`ArrowOptions`), geometry in `arrow-geometry.ts` | Required `x1,y1,x2,y2`, `z`, `key`, `stroke`, `strokeOpacity`/`strokeWidth`, `headLength`, `headAngle` (scale-independent arrowhead) | Directed edges, annotated call-outs |
| `vector(data, options)` | `packages/charts-core/src/vector.ts:25-39` (`VectorOptions`) | Required `x,y` anchor, `length` (fixed px or channel), `rotate` (degrees clockwise, 0 = up; fixed or channel), `anchor` (`VectorAnchor`), `z`, `key`, `stroke`, `strokeOpacity`/`strokeWidth`, `headLength`/`headAngle` | Vector field maps (direction + magnitude) |
| `tickX(data, options)` / `tickY(data, options)` | `packages/charts-core/src/tick.ts:21-44` (`TickXOptions`/`TickYOptions`) | Required `x` AND `y` (both — a tick is positioned at one x/y pair, then drawn as a short perpendicular mark), `z`, `key`, `stroke`, `strokeOpacity`/`strokeWidth`, `length` (px), `inset` | Boxplot whisker caps, gauge tick marks (Cartesian), rug plots |
| `text(data, options)` | `packages/charts-core/src/text.ts:21-36` (`TextOptions`, `TextAnchor = 'start'\|'middle'\|'end'`) | `x`,`y`, `text` (accessor to `string\|number`), `z`, `key`, `fill` (visual channel), `fontSize`, `fontWeight`, `anchor` (visual channel), `rotate`, `dx`, `dy` (all three as visual channels — can vary per datum) | Direct data labels, annotations |
| `frame(options)` | `packages/charts-core/src/frame.ts:4-13` (`FrameOptions`) | `fill`, `fillOpacity`, `stroke`, `strokeOpacity`, `strokeWidth`, `inset`, `radius` — draws a background/border rect around the **resolved inner chart bounds** (no data source, spec-level decoration only) | Panel border/backdrop decoration |
| `facet(data, options)` / `facetChart(...)` | `packages/charts-core/src/facet.ts:23-31` (`FacetOptions`) | Required `by` (grouping channel) and `chart` (`(data, key) => ChartSpec` — a full nested spec factory per facet group), `columns`, `minWidth`, `gap`, `label` (boolean or `(key) => string`), `axes` (`FacetAxes` — shared vs. per-panel axis behavior) | Small multiples / trellis charts |
| `colorLegend(...)` / `colorGradientLegend(...)` | `packages/charts-core/src/legend.ts` | See §1.4 | Legend rendering for any color-mapped chart |

D3 bridge helpers exported from the root: `d3Curve` (`d3-shape.ts`) wraps a D3
curve factory for `lineY`/`areaY`/etc; `d3AreaXCurve` is the `areaX`-specific
curve bridge.

Every mark is constructed via the shared `createMark` factory
(`packages/charts-core/src/mark.ts`) — this is also the public custom-mark
extension point (§6).

### 2.2 `geo.ts` — opt-in geographic marks (`@tanstack/charts/geo`)

Source: `packages/charts-core/src/geo.ts`; full contract in
`docs/reference/marks/geo.md`; usage patterns in `docs/examples/maps-and-spatial.md`.
**Not exported from the package root** — deliberately opt-in so a Cartesian-only
bundle never pulls in `d3-geo`.

```ts
import { geoShape } from '@tanstack/charts/geo'

function geoShape<TDatum extends GeoPermissibleObjects>(
  source: Iterable<TDatum>,
  options: GeoShapeOptions<TDatum>,
): ChartMark<TDatum, number, number>
```

`GeoShapeOptions`: `id`, `className`, `projection` (required — a
`(GeoProjectionContext) => GeoProjection | GeoStreamWrapper | null` factory,
called with the **final responsive plot bounds** so `fitExtent` recomputes on
resize), `key` (defaults unique `id` then index), `color` (color-scale input +
interaction group), `r`/`rScale` (Point/MultiPoint pixel radius, via D3
`geoPath().pointRadius()`), `fill`/`fillOpacity`/`stroke`/`strokeOpacity`/
`strokeWidth`/`strokeDasharray`/`opacity`, `anchor` (semantic lon/lat override
for the interaction point; defaults to `geoCentroid()`).

Each feature becomes one SVG path via `geoPath(projection)`; the projection and
any boundary/atlas data (TopoJSON→GeoJSON conversion via `topojson-client`,
`world-atlas`/`us-atlas`) are entirely application-owned — TanStack ships no
boundary datasets. Use `x: null`, `y: null`, `guides: false` on the outer
`ChartSpec` since `geoShape` doesn't materialize Cartesian channels.

**This is TanStack's native choropleth primitive** — confirmed both in source
and in `docs/examples/maps-and-spatial.md`, which shows GeoJSON region
choropleth, world/US-state choropleth, bubble maps, globes/projections, and
route overlays all built from the one `geoShape` mark plus different D3
projections.

### 2.3 `polar.ts` — opt-in polar/radial marks (`@tanstack/charts/polar`)

Source: `packages/charts-core/src/polar.ts`; full contract in
`docs/reference/marks/polar.md`; every derived chart type demonstrated in
`docs/examples/polar-and-radar.md`. Also **not exported from the package
root** — same opt-in rationale.

```ts
import {
  angleGrid, polar, radialArc, radialArea, radialDot,
  radialGrid, radialLine, radialRule, radialText,
} from '@tanstack/charts/polar'
```

- **`polar(options)`** — the positionless coordinate *container* mark.
  `{ id?, className?, marks: PolarMark[], guides?: PolarGuide[], angle?: PolarAngleOptions, radius?: PolarRadiusOptions, startAngle?=0, endAngle?=2π, inset?=0, radiusRatio?=1 }`.
  Resolves center/radius/angle-radius scales responsively; paints guide
  backgrounds → marks → guide foregrounds. The outer `ChartSpec` must set
  `x: null, y: null, guides: false` because Cartesian axes don't participate.
  D3 angle convention: 0 = 12 o'clock, positive = clockwise.
- **`radialArc(source, options)`** — one D3 arc per interval: `startAngle`,
  `endAngle`, `padAngle` (default from datum fields of the same name, else 0),
  `innerRadius`/`outerRadius`/`cornerRadius`/`padRadius` (each a `PolarLength`
  — pixels or a responsive callback), `generator` (full override — a
  responsive D3 `arc` factory reading the original datum, for **per-datum
  variable-radius rings**), `key`, `z`, fill/stroke styling.
- **`radialLine(source, options)`** / **`radialArea(source, options)`** — `angle`
  + `radius` channels, `curve` (D3 curve factory — use `curveLinearClosed` to
  close a radar polygon), `z` (one path per group); `radialArea` also takes
  `radius1` (inner bound, default 0).
- **`radialDot(source, options)`** — `angle`/`radius`, `r`/`rScale` (default
  3.5px), emits one interaction point per datum.
- **`radialText(source, options)`** — `angle`/`radius` through the container's
  copied polar scales, then D3 radial point projection; `text`, anchor,
  baseline, rotation, `dx`/`dy`.
- **`radialRule(source, options)`** — one radial segment per datum: `angle`,
  `radius1`/`radius2` (default 0), stroke styling. Explicitly documented for
  **gauge needles, gauge/pie ticks, and pie-label leader lines**.
- **`radialGrid(options)`** / **`angleGrid(options)`** — decorative polar guides
  (concentric circles/polygons; angular spokes), label position/rotation
  callbacks via `PolarGuideLabelContext`. Emit no interaction points.

**How each polar-family chart type is actually composed** (from
`docs/examples/polar-and-radar.md`, all confirmed runnable examples):

| Chart type | Composition |
|---|---|
| Pie | `d3-shape`'s `pie()` → `radialArc` with `innerRadius: 0` |
| Donut | Same `pie()` → `radialArc` with a nonzero `innerRadius` (ratio of container radius) |
| Gauge (arc-fill style) | `pie()` restricted to a partial `startAngle`/`endAngle` interval → `radialArc`; "differs from a pie only in inner radius and angular interval" (doc's own words) |
| Gauge (needle style) | `radialArc` background track + `radialRule` needle + `radialText` value readout — shown as the `98-needle-gauge` catalog example, composition only, no dedicated needle primitive |
| Radar | `polar({ angle: { scale: scaleBand }, radius: { scale: scaleLinear } })` + `radialGrid`/`angleGrid` guides + `radialArea` (closed curve) + `radialLine` + `radialDot` |
| Rose (polar area) | `radialArc` with `generator` returning per-datum variable-radius D3 arcs |
| Radial bar | Same `radialArc.generator` composition, concentric rather than nested |
| **Sunburst** | Same `radialArc.generator` pattern, fed by an application-run D3 **hierarchy partition layout** (`d3.hierarchy` + `d3.partition`), e.g. `arc().startAngle(n=>n.x0).endAngle(n=>n.x1).innerRadius(n=>n.y0*radius).outerRadius(n=>n.y1*radius)` — shown verbatim in the reference doc as the sunburst pattern |
| Numeric polar line/scatter | `polar({ angle: {scale: scaleLinear}, radius: {scale: scaleLinear} })` + `radialLine`/`radialDot` (no D3 `pie` needed — continuous angle domain) |

Bottom line: **pie, donut, gauge, radar, rose, radial-bar, and sunburst are all
one shared `polar` + `radialArc`/`radialLine`/`radialArea`/`radialRule`/
`radialText` primitive set**, differentiated only by which D3 layout
(`d3-shape` `pie`, or `d3-hierarchy` `partition`) prepares the input rows. There
is no separate "pie mark" or "sunburst mark."

### 2.4 Is anything in `polar.ts`/`geo.ts` unexported or unfinished?

Verified by cross-referencing `packages/charts-core/src/index.ts` (root export
list — does **not** include `polar`/`geo`) against `packages/charts-core/package.json`
`exports` map (**does** include `"./polar": "./src/polar.ts"` and
`"./geo": "./src/geo.ts"`, with matching `publishConfig.exports` dist paths) and
against `docs/reference/index.md`'s "Import map" table, which explicitly lists
`@tanstack/charts/polar` → `polar, radial arc/line/area/dot marks, and radial/angle guides`
and `@tanstack/charts/geo` → `geoShape and geographic projection types` as public,
documented, capability subpaths — the same pattern used for `/canvas`, `/focus`,
`/export`, etc. **Conclusion: polar and geo are real, finished, documented,
public capabilities — just intentionally not in the default bundle**, for
bundle-size isolation (a Cartesian-only consumer never pays for `d3-geo`/extra
`d3-shape` arc code). This is not an unfinished/experimental corner; it's the
same deliberate "narrowest stable entry point" pattern used throughout the
package (`docs/reference/index.md`: "Import from the narrowest stable entry
point when bundle isolation matters. Do not import internal source files.").

**Further confirmed by the conformance benchmark suite** (see §9): every one of
`benchmarks/conformance/cases/75-radar`, `76-pie`, `77-donut`, `78-gauge`,
`93-labeled-pie`, `94-center-donut`, `95-rounded-donut`, `96-nested-donut`,
`97-rose`, `98-needle-gauge`, `99-comparative-radar`, `100-radial-bars`,
`101-sunburst`, `102-world-choropleth`, `103-bubble-map`,
`104-orthographic-globe`, `105-route-map`, `106-polar-line`, `107-polar-scatter`,
`108-country-choropleth`, `109-us-state-choropleth` contains a real,
CI-exercised `tanstack.ts` implementation importing from `@tanstack/charts/polar`
or `@tanstack/charts/geo` (e.g. `76-pie/tanstack.ts` imports `polar, radialArc`
and builds arcs with raw `d3-shape` `pie()`; `75-radar/tanstack.ts` imports
`angleGrid, polar, radialArea, radialGrid`). These are compared pixel/behavior-wise
against reference-library implementations (mostly Observable Plot, some
Recharts/ECharts) on every conformance run — i.e. pie/donut/radar/gauge/sunburst/
choropleth are not just "exported," they are actively regression-tested. Note,
however, that `PLAN.md`'s own most-recent "current status" checkpoint
(`### D3-native product checkpoint — 2026-07-27`, `PLAN.md:178`) lists the
*current* product-profile marks as only `lineY, areaY, barX, barY, dot, rect,
cell, ruleX, ruleY, text` plus facets — **omitting polar/geo entirely**, despite
the working conformance cases. Treat this as the plan prose lagging the
implementation, not as evidence the capability is unsupported (§10 has more on
this discrepancy).

### 2.5 Confirmed absent: no Sankey, no Funnel mark or example

Repo-wide search (`grep -rli "sankey\|funnel" .` across `.ts`, `.tsx`, `.md`,
excluding `node_modules`) returns matches only in `PLAN.md` (this migration
project's own planning doc, not TanStack's) and `competitor-profiles/ag-charts.md`
(a competitor-analysis doc, listing Sankey/Funnel as things a *competitor*
supports). **TanStack Charts ships no Sankey and no Funnel mark, guide, or
documented composition recipe** — unlike the polar/radar and geo families,
there is no `docs/examples/*.md` page or reference doc describing how to build
either. `docs/examples/networks-and-hierarchies.md` covers tidy trees, Delaunay
adjacency, and force-directed networks (all application-laid-out `link` + `dot`
+ `text` compositions) but explicitly does not mention Sankey. See §8 for the
gap analysis and extension path.

### 2.6 Candlestick, boxplot, and other "compositions, not marks" called out by TanStack's own docs

`docs/guides/choosing-a-chart.md` states this design philosophy directly: *"A
boxplot, for example, is a prepared summary rendered with rectangles, rules,
ticks, and dots. A candlestick is a link plus a ranged rectangle."*
`docs/examples/intervals-and-financial.md` confirms candlestick = `link` (the
high-low wick) + `rect` (the open-close body, ranged/interval rectangle, not a
band-inferred `bar`), one row per period, directional color as a secondary
(non-exclusive) cue.

### 2.7 Brush/zoom/pan — confirmed application-owned, not a mark

`docs/guides/interactions-and-selections.md` states the chart library does
**not** bundle `d3-brush`/`d3-zoom`/`d3-selection` — they're optional direct
dependencies the app wires up itself. The documented pattern for a brush chart:

```ts
import { focusDisabled } from '@tanstack/charts/focus/disabled'

const gestureDefinition = defineChart(definition, {
  focus: focusDisabled,   // disable native pointer focus/tooltip so it doesn't fight the brush
  keyboard: false,
})

mountChart(element, {
  definition: gestureDefinition,
  ariaLabel: 'Selectable monthly range',
  onRender: mountBrushOverlay,   // app-supplied render hook draws the d3-brush selection rect
})
```

A "complete brush" per the docs must itself own: drag start/move/end/cancel,
reverse-drag normalization, semantic (e.g. month) snapping, a visible selected
range, focusable handles, current-range text, reset, and selection
preservation across data updates — i.e. this is explicitly scoped as
application responsibility, with the chart runtime only providing the
`onRender` escape hatch and a way to turn off competing native interaction.
Zoom/pan follows the same pattern with `d3-zoom`. See §8 for the bklit-ui
`brush` chart mapping.

---

## 3. React adapter — `packages/react-charts`

Source: `packages/react-charts/src/Chart.tsx` (93 lines), `RendererChart.tsx`
(296 lines — the shared implementation), `CanvasChart.tsx` (32 lines),
`core.ts`/`canvas.ts`/`index.ts` (entry points); doc contract in
`docs/framework/react/adapter.md`.

### 3.1 What the package actually is

`@tanstack/react-charts` is a **thin lifecycle/SSR adapter**, explicitly
scoped: *"Chart definitions, scale resolution, guide layout, scenes,
rendering, animation, and interaction remain in the framework-neutral core"*
(`docs/framework/react/adapter.md:6-8`). It depends on `@tanstack/charts`
(`packages/react-charts/package.json`, workspace dependency, §0), peer-depends
on `react`/`react-dom` `^19.0.0`.

Three entry points, all delegating to one shared implementation
(`RendererChartImplementation`, `RendererChart.tsx:94-222`):

| Entry | File | Renderer | Notes |
|---|---|---|---|
| `Chart` (default) | `Chart.tsx:59-92` | `createSvgChartRenderer(renderChartSvg)` via `@tanstack/charts/svg` + `@tanstack/charts/svg/renderer` | Default import never pulls Canvas into the module graph |
| `Chart` from `/canvas` | `CanvasChart.tsx:23-31` | `canvasChartRenderer` from `@tanstack/charts/canvas` | Trivial 32-line wrapper — just swaps the `renderer` prop |
| `Chart`/`RendererChart` from `/core` | `RendererChart.tsx:86-92` | Caller-supplied `renderer` prop (required) | For a fully custom renderer; no built-in choice |

### 3.2 Render lifecycle (the imperative-update architecture)

This is the single most important adapter fact for a migration: **React
commits the chart's DOM exactly once.**

`ChartSurface` (`RendererChart.tsx:23-38`) is:
```tsx
const ChartSurface = React.memo(
  React.forwardRef<HTMLDivElement, ChartSurfaceProps>(function ChartSurface(
    { markup }, ref,
  ) {
    return (
      <div ref={ref} className="ts-chart-surface" style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: markup }} />
    )
  }),
  () => true,   // <-- always returns true: this component NEVER re-renders after mount
)
```
`initialMarkupRef.current ??= adapter.prerender()` (`RendererChart.tsx:174-175`)
computes that one-time markup string during the *first* React render (this is
what makes SSR deterministic — `prerender()` is pure, synchronous, and safe to
call server-side).

All subsequent updates bypass React reconciliation entirely, via two
`useLayoutEffect`s (`RendererChart.tsx:177-187`):
```tsx
React.useLayoutEffect(() => {                 // mount-only (empty deps)
  const container = containerRef.current
  if (!container) return
  adapter.update(hostOptions)
  adapter.mount(container)
  return () => adapter.destroy()
}, [])

React.useLayoutEffect(() => {                 // every commit with new hostOptions
  adapter.update(hostOptions)
}, [adapter, hostOptions])
```
`adapterRef.current ??= createChartRendererAdapter(hostOptions)`
(`RendererChart.tsx:172`, from `@tanstack/charts/adapter/renderer`,
implementation `packages/charts-core/src/adapter-renderer.ts:12`) creates
exactly one adapter instance per component instance, kept for the component's
lifetime. Framework-agnostic sibling: `createChartAdapter`
(`packages/charts-core/src/adapter.ts:21`) is the non-renderer-specific
version used by `mountChart`/`mountChartRenderer` directly
(`docs/framework/react/adapter.md`'s "Render lifecycle" numbered list, steps
1-5, describes this same sequence generically for every framework adapter:
initial markup during render → layout-effect mount → runtime handoff → later
commits call `host.update` → cleanup destroys host+runtime).

Practical consequence for migrating bklit-ui components: **the chart's own
prop changes never trigger a React re-render of the SVG/Canvas subtree** —
they trigger an imperative `adapter.update()` call instead. This is why
definition identity (not deep-equality) is the update boundary (§1.1) — the
adapter's `update()` is what decides, from the new `hostOptions`, whether to
recompute the scene.

### 3.3 `ChartCommonProps` — the full React prop surface

Source: `Chart.tsx:19-49`, mirrored in `RendererChartCommonProps`
(`RendererChart.tsx:40-68`):

```ts
interface ChartCommonProps<TDatum, TXValue, TYValue> {
  ariaLabel: string                    // required
  ariaDescription?: string
  height?: number
  aspectRatio?: number
  width?: number
  initialWidth?: number                // default 640, RendererChart.tsx:105
  className?: string
  style?: React.CSSProperties
  tabIndex?: number
  idPrefix?: string
  renderSvg?: ChartSvgRenderer<...>    // Chart-only: override renderChartSvg
  measureText?: ChartTextMeasurer
  onFocusChange?: (point: ChartPoint<...> | null) => void
  onFocusGroupChange?: (points: readonly ChartPoint<...>[]) => void
  onSelect?: (point: ChartPoint<...> | null) => void
  onRender?: (context: ChartRenderContext<...>) => void
  renderTooltipBody?: (context: ChartTooltipBodyRenderContext<...>) => React.ReactNode
}
type ChartProps<TDatum, TXValue, TYValue> = ChartCommonProps<...> & { definition: ChartDefinition<...> }
```

Sizing precedence (`RendererChart.tsx:205-218`, table form in
`docs/framework/react/adapter.md:99-105`):

| Props given | Outer host CSS | Scene size |
|---|---|---|
| no `width`, fixed `height` | `width:100%`; fixed height | container width × fixed height |
| fixed `width` + `height` | fixed CSS box | same fixed dims |
| fixed `width` + `aspectRatio` | fixed width, CSS `aspect-ratio` | width ÷ ratio |
| `aspectRatio` only | `width:100%`, CSS aspect-ratio | measured width ÷ ratio |
| neither `height` nor `aspectRatio` | `width:100%`; `height:320px` | measured width × 320 |

`initialWidth` (default `640`, `RendererChart.tsx:105`) governs the
server/initial scene when `width` is unset. Nonpositive/non-finite
`aspectRatio` is discarded (`RendererChart.tsx:122-127`).

`className`/`style` apply only to the outer `.ts-chart-host` div
(`RendererChart.tsx:207-216`); `style` is spread **last**, so it can override
the adapter's computed `width`/`height`/`aspectRatio` — `docs/framework/react/adapter.md:130-135`
explicitly warns not to set a conflicting `style.width` alongside a fixed
`width` prop.

### 3.4 Tooltip body composition

`renderTooltipBody` receives `ChartTooltipBodyRenderContext` (`RendererChart.tsx:70-76`
— extends the core `ChartTooltipBodyContext` with a `defaultBody: React.ReactNode`)
and is mounted via `createPortal(renderTooltipBody({...}), tooltipBodyTarget.element)`
(`RendererChart.tsx:189-203`) into a DOM node the shared host owns and hands
back through `onTooltipBodyChange` (`RendererChart.tsx:139-144, 164-166`).
Composing `defaultBody` (built by `DefaultTooltipBody`, `RendererChart.tsx:224-278`
— renders `content.title`/color swatch/rows with tabular-nums styling) keeps
the core title/rows/formatting/swatches while allowing arbitrary React
around it (e.g. buttons, richer layout) — `pinned`/`dismiss` are provided so a
custom body can render interactive controls only while pinned
(`docs/framework/react/adapter.md:140-152`).

### 3.5 SSR / hydration story

| Renderer | Server output | Client behavior |
|---|---|---|
| SVG (default) | Complete, deterministic, accessible SVG at `initialWidth` (`docs/framework/react/adapter.md:61-68`) | Layout effect adopts and reconciles that exact SVG — no placeholder-only mode |
| Canvas | Same outer structure + named Canvas root + **two** `aria-hidden` canvases, **no server-side pixel painting** (`docs/framework/react/adapter.md:70-73`, confirmed in `packages/react-charts/src/CanvasChart.tsx` which has no server-specific branch — painting happens entirely client-side via `mountCanvasChart`) | Client adopts elements, sizes backing stores, paints, attaches focus/keyboard/tooltip/selection host |

`idPrefix` defaults to a sanitized `React.useId()`-derived string
(`RendererChart.tsx:118-121`: `` `ts-chart-${generatedId.replaceAll(/[^a-zA-Z0-9_-]/g, '')}` ``)
— stable across hydration without a caller-supplied prefix. `tabIndex`
defaults to `0` on both server and client; `keyboard: false` on the
*definition* (not a React prop) forces it to `-1`
(`docs/framework/react/adapter.md:80-81`). Determinism requirements —
identical data, scale domains, definitions, dimensions, and custom renderers
on both sides — are the same cross-framework checklist in
`docs/guides/ssr-and-hydration.md:70-79, 131-143` ("Hydration checklist").

### 3.6 Update/prop flow summary and callback freshness

Every committed React prop set is forwarded whole to `adapter.update()`
(`RendererChart.tsx:185-187`) — there is no partial-props diffing on the
adapter boundary. Consequently focus/selection/render callbacks always see
the **latest committed** function identities (`docs/framework/react/adapter.md:172-176`,
"Callback freshness") even though the underlying scene/DOM may not have
changed — React's own batching can omit intermediate application states, but
whatever is committed is forwarded completely (`docs/framework/react/adapter.md:56-57`).
Definition identity remains the actual re-render/recompute boundary: a fixed
definition should be constructed at module scope (`Chart.tsx`/`RendererChart.tsx`
never memoize it themselves), a definition that captures component state
needs `useMemo` (`docs/framework/react/adapter.md:154-170`).

### 3.7 Explicit "core boundary" (what the React adapter does *not* own)

Per `docs/framework/react/adapter.md:178-189`, the adapter deliberately does
not redefine: marks or chart specs, D3 scale/transform ownership,
tooltip/focus semantics, animation/reconciliation, or custom marks/renderers
— all of that is core (`@tanstack/charts`) behavior identical across every
framework adapter (React/Preact/Vue/Solid/Svelte/Angular/Lit/Alpine/Octane,
per §10.3's version table). This is favorable for migration risk: porting
bklit-ui's React-specific chart logic is really about replacing bklit-ui's
own rendering/interaction stack with this adapter's imperative shell — the
actual chart grammar underneath is framework-neutral and won't need
React-specific reinterpretation later if other frameworks are ever in scope.

---

## 4. Interactivity system

Source: `docs/reference/focus-and-interaction.md` (284 lines, full doc);
implementation in `packages/charts-core/src/focus.ts`, `focus-disabled.ts`;
types in `packages/charts-core/src/types.ts`.

### 4.1 Default behavior (no configuration)

`docs/reference/focus-and-interaction.md:11-28`: pointer movement finds the
nearest point within `maxFocusDistance` (default **48** scene pixels); pointer
leave/cancel clears unpinned focus; the SVG participates in tab order via
`tabIndex` (default `0`) when `keyboard` is enabled; focusing the SVG selects
the first point in keyboard task order; arrow keys move through points sorted
by pixel x then pixel y; `Home`/`End` jump to first/last; `Enter`/Space toggle
an enabled sticky tooltip and call `onSelect`; a click focuses+selects the
nearest point (or `null`); the renderer's focus ring follows the primary
point. `keyboard: false` removes keyboard handling and forces `tabIndex -1`.

### 4.2 Focus presets (`ChartFocusMode`)

Set via `defineChart(definition, { focus: 'group-x', tooltip: true })`
(`docs/reference/focus-and-interaction.md:34-39`):

| Preset | Pointer resolution | Group returned to callbacks/tooltip | Keyboard navigation |
|---|---|---|---|
| `nearest` | Nearest point in 2D | Primary point only | Every point |
| `nearest-x` | Nearest x, then nearest y | Primary point only | Every point |
| `nearest-y` | Nearest y, then nearest x | Primary point only | Every point |
| `group-x` | Nearest x, then nearest y within that x | One point per group sharing semantic x (nearest first) | One representative per semantic x |
| `group-y` | Nearest y, then nearest x within that y | One point per group sharing semantic y (nearest first) | One representative per semantic y |

Grouping compares semantic values (dates by timestamp); duplicate points
sharing a `group` value collapse to one member in grouped focus
(`docs/reference/focus-and-interaction.md:49-50`). The equivalent
`focusX`/`focusY`/`focusNearestX`/`focusNearestY` strategy objects are
directly importable from `@tanstack/charts/focus` for composition.

### 4.3 Disabling native focus — `focusDisabled`

```ts
import { focusDisabled } from '@tanstack/charts/focus/disabled'
```
Resolves/groups/navigates to **no** points — for an application that owns its
own gestures, selection paint, and accessibility semantics (e.g. bklit-ui's
`brush` chart, §8). It does **not** remove the rendered focus DOM node or
listeners; pair it with `keyboard: false` and no `tooltip`
(`docs/reference/focus-and-interaction.md:56-66`).

### 4.4 Custom focus strategies — the full extension contract

```ts
interface ChartFocusStrategy<TDatum, TXValue, TYValue> {
  resolve(points, x: number, y: number, maxDistance: number): readonly ChartPoint[]
  group(points, point: ChartPoint): readonly ChartPoint[]
  navigation(points): readonly ChartPoint[]
}
```
(`docs/reference/focus-and-interaction.md:71-91`) — `resolve` gets scene-pixel
pointer coordinates, returns primary point first; `group` runs when an
existing point is restored/reached via keyboard; `navigation` returns the
ordered keyboard task set. `ChartFocusMode` accepts either a preset string or
a full `ChartFocusStrategy` object — this is the escape hatch for bespoke
selection semantics bklit-ui's `use-chart-interaction.ts`-style hooks might
need replicated.

### 4.5 Spatial indexes (dense-data pointer lookup)

```ts
type ChartSpatialIndexFactory<TDatum, TXValue, TYValue> =
  (points: readonly ChartPoint[]) => ChartSpatialIndex<TDatum, TXValue, TYValue>
```
The default lookup (`findNearestPoint`, `packages/charts-core/src/scene.ts`,
§5) is a **linear scan** of all interaction points. A dense chart (scatter
with thousands of points, hexbin, etc.) can inject a factory; the host
rebuilds the index whenever the scene or definition changes, and the index
itself owns both the search algorithm and applying `maxDistance`
(`docs/reference/focus-and-interaction.md:252-270`). A custom `focus`
strategy takes precedence over `spatialIndex` for pointer resolution if both
are set. `charts-core-d3`'s `createGridPointIndex` (§0) is the only built-in
example of this factory shape in the monorepo today — `charts-core` itself
ships no spatial index implementation, only the factory type and the linear
default.

### 4.6 Native tooltips

`tooltip: true` enables the default structured label/value table; grouped
focus adds a shared-axis heading + one swatch/value row per series. Full
options (`docs/reference/focus-and-interaction.md:109-130`):

```ts
interface ChartTooltipOptions<TDatum, TXValue, TYValue> {
  className?: string
  portal?: boolean
  items?: readonly ChartTooltipItem<...>[]
  sort?: ChartTooltipSort<...>
  anchor?: ChartTooltipAnchor<...>
  placement?: 'auto' | ChartTooltipPlacement | readonly ChartTooltipPlacement[]
  offset?: number
  content?: (points, context) => ChartTooltipContent
  format?: (point) => string
  formatGroup?: (points) => string
  sticky?: boolean
}
```

| Option | Default | Meaning |
|---|---|---|
| `className` | none | appended after `ts-chart-tooltip` |
| `portal` | `false` | escape clipping via top-layer/fixed positioning |
| `items` | automatic x/y | ordered rows for the focused point |
| `sort` | `color-domain` | grouped row order (`color-domain`, `focus`, or custom comparator) |
| `anchor` | `point` | `point` / `pointer` / `group-center` / coordinate resolver |
| `placement` | `auto` | 8 directions or an ordered fallback list |
| `offset` | `10` | scene-px gap anchor↔box |
| `content` | automatic rows | full override, returns title+rows |
| `format` / `formatGroup` | none | text-only override (precedence: `content` > `formatGroup` > `format` > default) |
| `sticky` | `true` | click/Enter/Space pins; repeat or `Escape` unpins |

`items` (`docs/reference/focus-and-interaction.md:151-186`) accepts `x`,
`group` shorthands, a `channel` reference, a scalar `field`, or a derived
`text` callback; array order is row order; a nullish field/text omits the
row. `anchor: 'group-center'` uses the focused points' bounding-box center; a
resolver receives focused points + pointer + chart bounds and can return
`null` to fall back to the primary point. `placement` fallback lists try each
candidate in order, falling back to the least-overflowing one, shifted inside
the surface (`docs/reference/focus-and-interaction.md:190-223`).
`portal: true` prefers a manual Popover (top-layer, keeps chart DOM ancestry
for CSS inheritance) and falls back to a fixed-position element moved to
`ownerDocument.body` when Popover is unavailable. A display-only tooltip
carries `role="status" aria-live="polite"`; a pinned custom body gets
non-modal dialog semantics.

### 4.7 Interaction callbacks

```ts
interface ChartInteractionCallbacks {
  onFocusChange?: (point: ChartPoint | null) => void
  onFocusGroupChange?: (points: readonly ChartPoint[]) => void
  onSelect?: (point: ChartPoint | null) => void
}
```
Focus callbacks fire only when the primary focus **key** changes, except that
a scene rebuild that preserves the focused key still reports the point with
updated coordinates/datum. `onSelect` reports clicks (`null` for a
point-less click) and keyboard activation (Enter/Space do nothing until a
point is already focused) — `docs/reference/focus-and-interaction.md:234-250`.

### 4.8 Application-owned gestures (brush/zoom/pan/crosshair)

Brushes, zoom, drag, scroll, crosshair overlays, and custom selections attach
via a wrapper listener or the `onRender` hook against the live SVG; semantic
state stays outside the scene, a dynamic definition is updated by identity
swap, and listeners must be cleaned up before the next attach/unmount
(`docs/reference/focus-and-interaction.md:275-283`). This is the same
mechanism documented for bklit-ui's `brush` mapping in §2.7/§8.

---

## 5. Rendering & animation model

Source: `docs/reference/rendering-and-export.md` (518 lines, full doc),
`docs/reference/runtime-and-scene.md` (227 lines, full doc),
`packages/charts-core/src/reconcile.ts` (293 lines), `svg-renderer.ts`,
`canvas.ts`.

### 5.1 Scene compilation pipeline

`docs/reference/runtime-and-scene.md:6-12`, five stages: (1) a definition
produces a `ChartSpec`; (2) marks materialize channels; (3) scales and guide
layout resolve against current size; (4) marks emit a keyed `ChartScene`; (5)
the selected renderer (SVG/Canvas/custom) consumes that scene. Two entry
points: `createChartRuntime()` (`@tanstack/charts/runtime`) for repeated
renders of static or responsive definitions — `runtime.render(definition, {
width, height })` — versus `createChartScene(staticDefinition, size, layout?)`
(`@tanstack/charts/scene`) for a single static compilation; the latter throws
if a materialized positional channel has no scale (use explicit `x: null`/
`y: null` when a dimension truly isn't used). The runtime does **not** cache
application data — a responsive builder gets the current size on every
direct render; memoization is entirely adapter/application-owned
(`docs/reference/runtime-and-scene.md:56-60`). This simplicity is a deliberate
divergence from `packages/charts-core-d3/src/runtime.ts` (107 lines vs. the
live package's 51), which additionally implements an async-abortable
`prepare(input, {signal})` pipeline with `AbortController` and
`shallowInputEqual`/`inputEqual` memoization — none of that async/memoized
machinery exists in, or is inherited by, `packages/charts-core`/`react-charts`.
Treat the D3 package's richer runtime as an abandoned experiment, not a hidden
capability of the package this migration depends on (§0).

`ChartScene` shape (`docs/reference/runtime-and-scene.md:141-156`): `width`,
`height`, `margin`, `chart` (inner plot bounds), `nodes` (ordered
renderer-neutral display tree), `points` (interaction targets), `scales`,
`colors`, `gradients`, `theme`. Scene node kinds
(`docs/reference/runtime-and-scene.md:176-184`): `group` (children +
translation/clip), `rule` (x1/y1/x2/y2), `polyline`, `area`, `dot`, `rect`,
`label` — every node carries a stable `key`, optional `className`,
`SceneStyle`, `ariaHidden`. `ChartPoint` (interaction targets,
`docs/reference/runtime-and-scene.md:196-218`) carries `key`, `markId`,
`group`/`groupLabel`, `datum`/`datumIndex`, semantic `xValue`/`yValue` (+
optional interval endpoints `x1Value`/`x2Value`/`y1Value`/`y2Value` and
`xInterval`/`yInterval: 'range'|'difference'`), pixel `x`/`y`, and resolved
`color`.

### 5.2 Renderer choice table

`docs/reference/rendering-and-export.md:18-35` lists the full framework
matrix — every one of React/Preact/Vue/Solid/Svelte/Angular/Lit/Alpine/Octane
exposes the same three-entry pattern (default SVG component, `/canvas`
component, `/core` renderer-neutral component), confirming §3.7's "adapters
are thin, identical shells" conclusion holds across the whole ecosystem, not
just React.

### 5.3 SVG renderer

`renderChartSvg(scene, options)` (`@tanstack/charts/svg`) returns a complete
markup string: `role="img"`, `aria-roledescription="chart"`, responsive
`width="100%" height="100%"`, the scene's dimensions as `viewBox`,
overflow-visible. `RenderChartSvgOptions`: `ariaLabel` (required),
`ariaDescription?`, `className?`, `tabIndex?` (default `0`), `idPrefix?`.
Every scene node's key becomes a `data-ts-key` attribute
(`packages/charts-core/src/svg-renderer.ts:122`) for reconciliation; the
renderer appends one hidden focus circle:
```html
<circle data-ts-chart-focus="" visibility="hidden" r="5"
  fill="var(--ts-chart-focus-fill, Canvas)" stroke-width="2.5"
  vector-effect="non-scaling-stroke" pointer-events="none" aria-hidden="true"/>
```
(`packages/charts-core/src/svg-renderer.ts:48`, verbatim — this is the
concrete implementation behind §7's focus-ring theming claim).

### 5.4 Canvas renderer

`mountCanvasChart(container, { definition, ariaLabel })` from
`@tanstack/charts/canvas` — same definition/sizing/focus/spatial-index/
keyboard/tooltip/selection/update/destroy contract as `mountChart`. Paints to
**two separate canvases**: a base scene canvas and a `focusCanvas` overlay
(`packages/charts-core/src/canvas.ts:126, 145` — `findOrCreateCanvas(root,
'ts-chart-canvas__focus')`), so focus changes repaint only the small overlay,
never the full scene. `pixelRatio` (`CanvasChartRendererOptions`, `canvas.ts:20`)
defaults to `devicePixelRatio` then `1`; an explicit finite positive value
pins both backing stores at that ratio (`canvas.ts:137-168` — resize logic
recomputes both canvases' backing-store dimensions on ratio/scene change,
stashing the resolved ratio in `root.dataset.tsChartPixelRatio`). The focus
fill color is resolved the same way as SVG: `resolver.resolve('var(--ts-chart-focus-fill,
Canvas)')` (`canvas.ts:201`) — so Canvas and SVG focus rings match visually.
Server prerender emits a deterministic named shell with two `aria-hidden`
canvases and **paints no pixels** server-side (§3.5). Renderer-specific
tradeoffs called out in the doc (`docs/reference/rendering-and-export.md:195-203`):
Canvas repaints raster pixels rather than retaining one DOM node per scene
node; Canvas animation crossfades whole frames rather than interpolating
keyed elements like SVG; curved/polar/geo `path` geometry needs browser
`Path2D`; scene-node `className` values create no styleable Canvas
descendants; gradients need geometry with measurable bounds.

### 5.5 Keyed reconciliation — `reconcileChartSvg`

```ts
import { reconcileChartSvg } from '@tanstack/charts/reconcile'
const cancel = reconcileChartSvg(container, nextMarkup, { duration: 240, easing: 'ease-out' })
```
(`packages/charts-core/src/reconcile.ts`, 293 lines). Adopts a compatible
existing SVG root, matches children by `data-ts-key`, moves retained nodes
into new order, inserts entries, removes exits; same-tag sibling order is the
fallback identity for a keyless node. **Without** animation, attribute/
structure changes commit synchronously. **With** animation: numeric
attributes with compatible string structure interpolate; entering nodes fade
from zero opacity; exiting nodes fade to zero then get removed;
non-interpolable values commit immediately; the returned cancel function
stops the in-flight frame loop. The DOM/framework host calls reconciliation
and cancellation automatically — this whole mechanism is invisible to
adapter consumers (`docs/reference/rendering-and-export.md:234-269`).

### 5.6 Animation options and the interruption model

```ts
interface ChartAnimationOptions {
  duration?: number                 // default 240ms, clamped to >= 0
  easing?: 'linear'|'ease'|'ease-in'|'ease-out'|'ease-in-out' | ((progress: number) => number)  // default 'ease-out'
  respectReducedMotion?: boolean    // default true
  resize?: boolean                  // default false
}
```
`animate: true` on a definition = `{ duration: 240, easing: 'ease-out',
respectReducedMotion: true }`. `respectReducedMotion`/`resize` are **host-
enforced** definition policies — a direct `reconcileChartSvg(container,
markup, animation)` call runs the animation unconditionally, without
consulting media queries or render reasons (`docs/reference/rendering-and-export.md:295-307`).
Host animation only begins **after** the initial render (no animate-on-mount
flash); an update that produces no scene render doesn't start anything; the
current animation options apply to the *next* reconciliation; responsive/
explicit size changes commit immediately unless `resize: true` (confirms
§1.6's "responsive relayout does not restart animation" default). **Interruption**:
a transition interrupted by a new update resumes from whatever geometry is
currently painted on screen, not from the pre-interruption target — this is
what makes rapid successive updates (e.g. a `live-line` tick every second)
visually stable rather than jumpy. Stable mark IDs and datum keys are called
out as essential for meaningful transitions
(`docs/reference/rendering-and-export.md:271-309`).

### 5.7 Export (SVG serialization, raster image)

`serializeChartSvg(target, { width?, height?, includeFocus? })` /
`downloadChartSvg(target, filename?)` from `@tanstack/charts/export` clone
the mounted SVG, add the XML namespace, strip the focus circle unless
`includeFocus`, and can inline computed `currentColor`/CSS-custom-property-
dependent paint (fill/stroke/opacity/font/dasharray, plus gradient stop
color/opacity) so the exported file doesn't depend on the live stylesheet.
`renderChartImage`/`downloadChartImage` (same subpath) rasterize via an
offscreen canvas — `scale` (default `2`, clamped ≥ `0.1`), `background`,
`type` (`image/png`|`image/jpeg`|`image/webp`, default PNG despite the
options-type name `RenderChartPngOptions`), `quality`. Requires a real
browser document/window, nonzero dimensions, Canvas 2D, and (for an SVG
source) successful `<img>` decode; Canvas-sourced export uses the base layer
directly and only composites the focus overlay when `includeFocus` is true
(`docs/reference/rendering-and-export.md:311-399`).

---

## 6. Extension points — the public inversion-of-control surface

Source: `docs/reference/custom-extensions.md` (227 lines, full doc — the
canonical extension reference), `packages/charts-core/src/mark.ts` (170
lines), `mark-with-scale-values.ts`.

TanStack Charts' own framing (`docs/reference/custom-extensions.md:6-9`):
*"narrow inversion-of-control boundaries around its scene compiler. Prefer
composition with built-in marks first. Add an extension when the chart
requires geometry or behavior that cannot be expressed without distorting its
data model."* This directly informs the gap analysis in §8 — Funnel/Sankey
are exactly the "distorting the data model" case this line is describing.

### 6.1 Custom marks — `createMark`

```ts
import { createMark } from '@tanstack/charts'   // packages/charts-core/src/mark.ts:37

function createMark<TDatum, TXValue, TYValue>(
  initialize: (context: MarkInitializeContext) => InitializedMark<TDatum, TXValue, TYValue>,
): ChartMark<TDatum, TXValue, TYValue>
```
`initialize` runs once per scene compilation, receiving `{ markIndex: number }`.
It returns:
```ts
interface InitializedMark<TDatum, TXValue, TYValue> {
  id: string
  channels: Readonly<Record<string, MaterializedChannel>>
  render(context: MarkRenderContext): MarkScene<TDatum, TXValue, TYValue>
}
interface MaterializedChannel {
  scale?: string        // 'x' | 'y' | 'color' to participate in a shared scale
  values: readonly unknown[]
  includeZero?: boolean // hint for a custom scale resolver
}
```
`render` gets final resolved geometry:
```ts
interface MarkRenderContext {
  markIndex: number
  chart: ChartBounds
  scales: Readonly<Record<string, ResolvedScale>>
  theme: ChartTheme
  color(value: ChartKey | null | undefined): string
  layout: ChartLayoutOptions
}
```
and returns `{ nodes: readonly SceneNode[], points?: readonly ChartPoint[] }`
— `points` is optional and only needed if the custom mark should participate
in native pointer/keyboard focus (`docs/reference/custom-extensions.md:11-87`).

**Mark-authoring requirements checklist** (`docs/reference/custom-extensions.md:89-99`,
verbatim rules): give the mark a stable ID (derive from `markIndex` only when
layer order is stable); materialize every value needed for scale-domain
inference *before* rendering; map through `context.scales` — never
recalculate responsive ranges yourself; give every scene node/point a
deterministic key; emit finite geometry only; preserve the original datum and
index in every interaction point; use one honest focus coordinate + semantic
x/y pair per point; keep preprocessing outside `render`. This checklist is the
practical spec for a Funnel or Sankey custom mark (§8) — e.g. a Sankey mark
would materialize node/link `x`/`y` channels from an app-run `d3-sankey`
layout, then emit `rect` (nodes) and custom ribbon-path (links) scene nodes
each with a stable key.

Every built-in mark (`lineY`, `areaY`, `barY`, `dot`, etc., §2.1) is itself
built via this exact `createMark` factory — there is no privileged internal
API unavailable to application code.

### 6.2 Distinct point/scale value types — `createMarkWithScaleValues`

```ts
import { createMarkWithScaleValues } from '@tanstack/charts/mark/scale-values'
// packages/charts-core/src/mark-with-scale-values.ts:19
```
For interval geometry whose materialized endpoint value types differ from
its interaction-anchor value types (e.g. a mark whose scale domain is built
from raw numeric bin edges but whose focus point should report a formatted
label type). Also exports `ChartMarkPointX`/`ChartMarkPointY`/
`ChartMarkScaleX`/`ChartMarkScaleY`. The doc is explicit this is an
*exceptional* subpath — "use it only when the distinction is real; ordinary
custom marks should use `createMark`" (`docs/reference/custom-extensions.md:104-129`).

### 6.3 Custom curves

```ts
interface ChartCurve {
  line(points: readonly (readonly [number, number])[]): string
  area(top: readonly (readonly [number, number])[], bottom: readonly (readonly [number, number])[]): string
}
interface AreaXCurve {
  areaX(right: readonly (readonly [number, number])[], left: readonly (readonly [number, number])[]): string
}
```
Bridges `d3Curve` (`@tanstack/charts/d3/shape`) and `d3AreaXCurve`
(`@tanstack/charts/d3/area-x`) adapt any D3 curve factory to these contracts
— this is how a caller supplies e.g. `curveCatmullRom` or `curveBasis`
without TanStack shipping every D3 curve itself
(`docs/reference/custom-extensions.md:131-159`).

### 6.4 Custom scales, color scales, legends, text measurement

- **`ChartScale`** — resolves semantic values + responsive range into a
  complete mapping + tick set; docs flag this as "an unchecked math boundary
  — prefer a configured callable scale when possible"
  (`docs/reference/custom-extensions.md:161-168`).
- **`ChartColorScale`** — maps observed values/domain/range hints/theme
  tokens to a `ResolvedColorScale`; **`ChartColorLegend`** independently
  reserves layout height and emits a scene node (`docs/reference/custom-extensions.md:170-177`,
  cross-referenced in §1.4).
- **`ChartTextMeasurer`** — lets non-browser rendering, special fonts, or an
  app-owned typography engine supply painted glyph bounds; affects guide/
  margin layout only, not mark text rendering itself
  (`docs/reference/custom-extensions.md:179-186`, cross-referenced in §1.5).

### 6.5 Custom spatial indexes and custom focus strategies

Both documented in full under §4.4/§4.5 above; `docs/reference/custom-extensions.md:188-205`
cross-references the same `ChartSpatialIndexFactory` and `ChartFocusStrategy`
contracts as the canonical extension boundary, confirming these are the same
public surface whether reached from the interactivity doc or the extensions
doc.

### 6.6 Custom renderers

A `ChartRenderer` owns both deterministic server markup (`prerender()`) and
one mounted `ChartSurface` (`render()`, `clientToScene()`, `paintFocus()`,
`destroy()` — full interface in §5's "Custom renderers" reference,
`docs/reference/rendering-and-export.md:406-461`).
`mountChartRenderer` (`@tanstack/charts/renderer`) — or a framework's `/core`
entry (React: `packages/react-charts/src/RendererChart.tsx`, §3.1) — keeps
responsive sizing, runtime updates, focus, keyboard, tooltip, and selection
behavior **shared across every renderer**, so a custom renderer only needs to
own painting and coordinate conversion, not the whole interaction stack. The
built-in Canvas renderer (`@tanstack/charts/canvas`) is explicitly cited as
"demonstrat[ing] the boundary without changing the default SVG imports"
(`docs/reference/custom-extensions.md:207-217`) — i.e. it is dogfooding this
exact public extension point, not a privileged internal implementation.
For a narrower change (SVG serialization only, keeping the shared SVG
interaction/reconciliation machinery), pass a `ChartSvgRenderer` as
`renderSvg` to a host, or adapt one via `createSvgChartRenderer` from
`@tanstack/charts/svg/renderer` — must preserve an SVG root, stable
`data-ts-key` identities, a `[data-ts-chart-focus]` element, and the scene
coordinate system (`docs/reference/custom-extensions.md:219-222`,
`docs/reference/rendering-and-export.md:503-517`).

### 6.7 Summary — extension path per bklit-ui gap

Cross-referencing §8's gap list against this section: **Funnel** and
**Sankey** (the two confirmed gaps) are both addressable purely through
§6.1's `createMark` boundary — no core/scene/renderer changes needed. A
Sankey mark would additionally need an app-owned node/link layout (parallel
to how sunburst pairs `radialArc.generator` with app-run `d3-hierarchy`
`partition()`, §2.3) — most plausibly `d3-sankey`, not a TanStack dependency.
No gap identified in this repo requires a custom renderer, custom scale, or
custom focus strategy — those extension points exist for different classes
of problems (alternate rendering surfaces, non-D3-shaped domains, bespoke
gesture systems) than "missing chart type," which is uniformly a marks-layer
problem here.

---

## 7. Theming

Source: `docs/guides/themes-and-styling.md`, `packages/charts-core/src/scene.ts`
(default palette + `defaultChartTheme`), `packages/charts-core/src/svg-renderer.ts`
(focus-ring paint), `packages/charts-core/src/canvas.ts` (Canvas paint
resolution).

TanStack Charts deliberately does **not** install a global visual theme — it
inherits the surrounding application via plain CSS inheritance and custom
properties:

- **Foreground / muted text / grid lines** default to `currentColor` — set the
  container's `color` and the chart's text/grid follow normal CSS light/dark
  behavior with **no JavaScript theme switch required**.
- **Background** defaults to `transparent`.
- **Categorical palette** — six CSS custom properties, each with an inline
  fallback hex value baked into `defaultChartTheme`
  (`packages/charts-core/src/scene.ts:44-49`):
  ```
  --ts-chart-1  (fallback #2563eb)
  --ts-chart-2  (fallback #f97316)
  --ts-chart-3  (fallback #10b981)
  --ts-chart-4  (fallback #8b5cf6)
  --ts-chart-5  (fallback #ec4899)
  --ts-chart-6  (fallback #06b6d4)
  ```
  Override any subset at any container boundary (e.g. `.revenue-chart { --ts-chart-1: ... }`)
  — the lowest-cost branding path, and it survives OS/app theme changes without
  rebuilding the chart definition.
- **Focus-ring color** — `--ts-chart-focus-fill`, falling back to the CSS
  system color `Canvas` (i.e. adapts to OS light/dark/forced-colors mode by
  default). Emitted directly in the SVG renderer's output as a hidden
  `<circle data-ts-chart-focus="" ... fill="var(--ts-chart-focus-fill, Canvas)">`
  (`packages/charts-core/src/svg-renderer.ts:48`) that becomes visible on
  focus/hover; also resolved by the Canvas renderer
  (`packages/charts-core/src/canvas.ts:201`) so Canvas and SVG rendering match.
  Example apps override it explicitly for dark mode, e.g.
  `examples/charts-octane/src/styles.css`: `--ts-chart-focus-fill: #121413` in
  light mode, `#ffffff` in dark mode; `packages/charts-core-d3/docs/responsive-theme-accessibility.md`
  shows `--ts-chart-focus-fill: Canvas` in light mode overridden per
  `prefers-color-scheme: dark`.
- **Definition-level `theme` override** (`ChartTheme`, partial):
  ```ts
  interface ChartTheme {
    foreground: string
    muted: string
    grid: string
    background: string
    palette: readonly string[]
  }
  ```
  Set explicit scene colors when a chart needs a fixed visual system regardless
  of surrounding CSS. `palette` is replaced wholesale, not merged by index. A
  responsive `chart` builder receives the *default* build-time theme via
  `ChartBuildContext.theme`; an application-level theme override returned by
  that same builder is merged in afterward during scene creation.
- **Mark-level styling** — fill/stroke/opacity/width/dash/corner-radius/font
  are per-mark options (fixed constant or data-driven visual channel), layered
  on top of scale-resolved and theme-resolved defaults.
- **Canvas-specific behavior**: the Canvas renderer resolves `currentColor` and
  CSS custom properties against the chart's *computed* environment (inherits
  root font, repaints on ancestor class/style/`data-theme`/`color-scheme`/
  forced-colors/viewport changes) — but rasterized nodes are **not** DOM
  descendants, so a node's `className` cannot be targeted by a CSS selector
  post-paint; data-dependent paint must go through mark options or the chart
  theme, while container CSS only controls palette variables/inherited color/
  typography.
- **Native tooltip styling**: the default tooltip is an HTML element inside the
  chart container, styled via `tooltip.className` in application CSS. With
  `tooltip.portal: true`, it prefers a manual-Popover path that keeps the
  element under the chart in the DOM (inheritance/scoped selectors keep
  working); if Popover is unavailable, it falls back to a fixed-position
  element moved to `ownerDocument.body` (needs a document-level selector for
  styling in that fallback case).
- **Gradients** (`ChartLinearGradient[]`, `gradients` spec field) are opt-in SVG
  resources consumed only by the resource-aware renderer
  (`renderChartSvgWithResources` from `@tanstack/charts/svg/resources`); Canvas
  also consumes declared gradients/clips, but a Canvas gradient needs
  measurable node bounds — path-only geometry with no point bounds should use
  an explicit paint instead.

---

## 8. Mapping table — bklit-ui chart types → TanStack Charts

| bklit-ui chart | TanStack expression | Native or composed? | Notes / gap flag |
|---|---|---|---|
| `area` | `areaY` (or `areaX` for horizontal) | Native mark | **`packages/charts-core/src` has no built-in stack transform** (confirmed: `grep -rl "stack" packages/charts-core/src/*.ts` matches nothing). `areaY` accepts an explicit `y1` baseline channel, so stacked/streamgraph/normalized area (`docs/examples/stacked-and-composition.md`) is built by the **application** computing `y1`/`y2` interval endpoints per row (order, offset, normalization all app-owned per the doc's own wording: "The application owns series order, offset, normalization, and the denominator"). `packages/charts-core-d3` *does* export a `stackY` transform (`bin, group, stackY` in its index) but that package is not what `react-charts` depends on — see §0. This is a real porting-effort delta worth flagging to `03-stack-comparison.md`. |
| `bar` | `barY`/`barX` | Native mark | Same stacking caveat as `area` — no built-in stack helper in `charts-core`. Grouped/stacked bars shown working in `examples/charts-react` (`createStatsLatestChart`), implying the fixtures package pre-computes stacked intervals. |
| `line` | `lineY` | Native mark | `points: true` option overlays dots at vertices |
| `live-line` | `lineY` + app-owned windowing | Composed (no special API) | No streaming-specific mark; §1.7 documents the bounded-window pattern explicitly recommended by TanStack's own docs |
| `candlestick` | `link` (wick) + `rect` (ranged body) | Composed, but explicitly documented by TanStack itself | Confirmed low-risk — this is TanStack's own worked example (`docs/examples/intervals-and-financial.md`) |
| `pie` | `@tanstack/charts/polar` → `polar` + `radialArc` fed by `d3-shape` `pie()` | Native (opt-in subpath) | Not a root export — needs the `/polar` subpath |
| `ring`/`donut` | Same as pie, `innerRadius` > 0 | Native (opt-in subpath) | Identical primitive to pie |
| `radar` | `/polar` → `polar` + `radialArea`/`radialLine`/`radialDot` + `radialGrid`/`angleGrid` | Native (opt-in subpath) | Full worked example in docs |
| `gauge` | `/polar` → `polar` + `radialArc` (partial pie interval) + `radialRule` (needle) + `radialText` (readout) | Composed from polar primitives, but with a documented worked example (incl. needle-gauge) | Not a single-call mark; needs a small composition helper if bklit-ui's gauge API is a single component |
| `sunburst` | `/polar` → `polar` + `radialArc.generator` fed by an app-run `d3-hierarchy` `partition()` layout | Composed, documented pattern, no dedicated mark | App must own the hierarchy layout (`d3-hierarchy` is not a TanStack dependency) |
| `scatter` | `dot` (bubble via `r`/`rScale`) | Native mark | |
| `funnel` | **No native mark, no documented composition, no example.** Nearest building blocks: `barX`/`barY` (or `rect`) sized proportionally per stage, manually computed trapezoid/taper would need a **custom mark** (`createMark`) since built-in rect/bar are axis-aligned rectangles, not tapered shapes | **GAP** | See extension path below |
| `heatmap` | `cell` (ordinal row/col matrix) or `rect` (arbitrary quantitative bins) + a continuous/threshold color scale | Native mark | `docs/examples/heatmaps-and-densities.md` also covers density contours (custom-mark territory) and hexbin (`hexagon` mark) as heatmap-adjacent variants |
| `choropleth` | `@tanstack/charts/geo` → `geoShape` | Native (opt-in subpath) | Full worked examples: GeoJSON region map, world/US-state choropleth |
| `sankey` | **No native mark, no documented composition, no example.** `link` could express edges as straight/curved connectors but Sankey needs ribbon width proportional to flow value plus a node layout algorithm (`d3-sankey`, not a TanStack dependency) — would need a **custom mark** to draw variable-width ribbons | **GAP** | See extension path below |
| `composed` (mixed mark types on shared scales) | Any combination of root marks in one `ChartSpec.marks` array | Native — this is literally the grammar's core design | `docs/reference/chart-spec.md`'s own example composes `areaY` + `ruleY` + `lineY` in one spec |
| `brush` | Composition: `focusDisabled` + `mountChart({ onRender })` + app-owned `d3-brush`/`d3-zoom` | Composed, application-owned by design | Not a gap so much as an explicit architectural choice — TanStack deliberately does not own gesture/zoom state; bklit-ui's brush interaction logic (drag, snapping, handles) will need to be reimplemented against this `onRender` extension point rather than ported as-is |

### Sankey/Funnel — no conformance case either

Repo-wide search for `sankey|funnel` across `benchmarks/conformance/cases/`,
`packages/charts-core/src`, `packages/charts-core-d3/src`, and `docs/` returns
nothing but a `PLAN.md` mention (see §10) — reinforcing §2.5's conclusion that
these are genuine gaps, not merely undocumented features.

### Gap summary

- **Confirmed real gaps (no native mark, no documented recipe, no example anywhere in the repo or docs): Funnel, Sankey.** Both would require authoring a genuinely custom mark via `createMark` (`packages/charts-core/src/mark.ts`) that emits its own scene geometry (tapered polygons for funnel; variable-width ribbon paths for Sankey, likely paired with an externally-run `d3-sankey` layout the same way sunburst pairs with `d3-hierarchy`). This is the single most-templated extension path in the codebase (`docs/guides/custom-marks-and-renderers.md`), so it is *feasible*, just not off-the-shelf.
- **Not gaps, contrary to a naive first assumption: pie, donut, radar, sunburst, gauge, choropleth.** All are native, documented, first-class (if opt-in-subpath) TanStack capabilities via `@tanstack/charts/polar` and `@tanstack/charts/geo`. The only "cost" is that several (gauge, sunburst) are compositions of 2-4 primitives rather than one mark call, so bklit-ui's single-component APIs for these (e.g. a `<Gauge value={72} />`) will need a thin wrapper layer that assembles the polar composition — this is an API-surface/DX concern, not a capability gap.
- **Candlestick, heatmap, composed, brush**: fully expressible, several explicitly demonstrated in TanStack's own docs as worked examples.

---

## 9. Benchmarks infrastructure (reusable methodology)

Layout under `benchmarks/`:

- `benchmarks/comparison/` — cross-library benchmark. `README.md`,
  `bundle-baseline.json`, `types.ts` (adapter contract), `libraries/` (per-library
  adapters), `stress/` (stress-test scenarios).
- `benchmarks/conformance/` — catalog-recipe conformance vs. reference libraries.
  `README.md`, `AI-EVALUATION.md`, `INTERACTION-UX-AUDIT.md`, `catalog*.ts`,
  `cases/` (102 numbered case directories, each with a raw-data fixture, a
  reference-library implementation, and a `tanstack.ts` implementation),
  `shared/`.
- `benchmarks/bundle-size/` — bundle-budget policy. `README.md`,
  `universal-baseline.json`.
- `benchmarks/entries/` — 71 standalone bundle-measurement entry files
  (`charts-*.ts`), one per isolated capability, e.g. `charts-polar-pie-svg.ts`,
  `charts-polar-gauge-svg.ts`, `charts-geo-svg.ts`, `charts-hexagon-svg.ts`,
  `charts-facet-svg.ts`, `charts-react-canvas.ts`.
- `benchmarks/rendering.ts` — the timing harness (mount/update measurement
  scaffolding shared by the comparison and stress runs).

### 9.1 Comparison suite

Benchmarks TanStack Charts against **Chart.js 4.5.1, Apache ECharts 6.1.0,
Recharts 3.10.1, Observable Plot 0.6.17** (pinned versions per
`docs/comparison.md`) on identical deterministic data across line/bar/area/
scatter, at three capability tiers (`basic`, `interactive`, `advanced`). Fixed
800×400 canvas, DPR 1, animations disabled, stable datum identity for a fair
comparison.

Commands:

```bash
pnpm browser:install                          # pinned Playwright chromium
pnpm benchmark                                # full bundle+timing matrix
pnpm benchmark:size / pnpm benchmark:perf      # one side only
pnpm benchmark -- --profile=quick|full
pnpm benchmark -- --library=tanstack,chartjs --chart=line,bar
pnpm benchmark:stress:quick|standard|full      # large-data, rapid-update, interaction, resize, dashboard, lifecycle
pnpm benchmark:check / pnpm benchmark:update-baseline   # bundle-baseline.json gate, 3%/512B tolerance
```

Output: `.benchmark-output/results/comparison.{json,md}`. Adding a competitor
library = implementing `benchmarks/comparison/types.ts`'s adapter contract in
`libraries/`, pinning its version, regenerating the baseline.

### 9.2 Conformance suite

Reproduces standard chart-catalog recipes — **Observable Plot is the default
reference**, some cases reference Recharts or ECharts explicitly. One raw-data
fixture + one reference implementation + one `tanstack.ts` implementation per
case, reporting a source-line ratio (how much more/less code TanStack needs vs.
the reference library for the same chart).

Commands:

```bash
pnpm conformance:quick / pnpm conformance    # 320/640/960px, light/dark matrix
pnpm conformance:size                        # bundle+type audit only
pnpm dev:conformance                         # interactive gallery, localhost:5194
pnpm catalog:check / pnpm catalog:build      # metadata validation / tanstack.com artifact build
```

Output: `.benchmark-output/conformance/results/plot-catalog.{json,md}` +
screenshots. Published to `tanstack.com/charts/catalog/*` via a versioned
`catalog.json` (schema v2) with an iframe embed protocol (`theme=`, `height=`,
`revision=`) — this is exactly the embed mechanism seen throughout
`docs/examples/*.md` (e.g. the `76-pie`, `101-sunburst` iframes cited in §2.3).

**102 conformance cases exist**, each with a real `tanstack.ts`. Confirmed by
direct inspection: `76-pie/tanstack.ts` imports `polar, radialArc` from
`@tanstack/charts/polar`, builds arcs via raw `d3-shape` `pie()`; `75-radar/tanstack.ts`
imports `angleGrid, polar, radialArea, radialGrid` from the same subpath, using
`scalePoint`/`scaleLinear` D3 scales directly. Other relevant case IDs:
`28-candlestick`, `24-quantitative-binned-heatmap`, `25-calendar-heatmap`,
`heatmap-labeled`, `40-force-directed-network`, `36-hierarchy-tree`,
`89-brush-range-selection`, `90-zoomable-time-window`, `74-recharts-treemap`,
`71-recharts-population-pyramid`. **No `sankey` or `funnel` case exists.**

### 9.3 Bundle-size policy

Three tiers (`benchmarks/bundle-size/README.md`): **Locked** (ordinary
Cartesian consumers, byte-identical to `universal-baseline.json`), **Budgeted**
(optional feature/D3 capability, per-feature gzip ceiling — polar and geo
entries live here, e.g. "a minimal arc, D3 pie, full scale-backed gauge
composition... a scale-backed polar line and scatter composition, and
projected GeoJSON" are each isolated budgeted entries), **Measured**
(comparison-library bundles, unbounded, informational only).

```bash
pnpm bundle
pnpm bundle:check
pnpm bundle:update-baseline
```

**Recommended reuse for this migration**: adopt the comparison suite's
methodology (`benchmarks/rendering.ts` harness, fixed-viewport/no-animation
protocol, `--profile=quick|full`) directly for measuring bklit-ui vs. migrated
TanStack components — the harness is already framework-adapter-pluggable via
`benchmarks/comparison/types.ts`, so a `bklit-ui` adapter could be added
alongside `chartjs`/`echarts`/`recharts` for an apples-to-apples run, and the
conformance suite's "source-line ratio" idea is a reasonable second metric for
migration-simplicity tracking per component.

---

## 10. Root strategy docs — what affects this migration

### 10.1 `PORTABLE-CHART-SPEC.md` (104 lines, read in full)

A **design proposal, not implemented** — no code in the repo implements it.
Proposes a not-yet-shipped, pre-v1 JSON serialization format for chart
definitions (a live `ChartDefinition` contains functions and can't be
serialized as-is). Reserved JSON nodes `{"$call":[name, ...args]}` and
`{"$data": name}`; a future `defineChartDefinition(spec, { registry })` would
validate/resolve calls through a core registry plus app-supplied extensions
(synchronous, allowlisted, no `eval`/code-strings/dynamic imports). A separate
"document" wrapper (`definition` + `data`) is described as a transport
convenience only. Open items noted in the doc: registry namespacing/versioning,
a possible third reserved node for responsive chart context (width/height/
theme). Prior art cited: deck.gl JSON, Mapbox expressions, Vega-Lite data,
Vega View API, Plotly streaming. **Not relevant to a direct React migration**
today (nothing to interoperate with yet), but worth revisiting if bklit-ui ever
wants a serializable/headless chart-config layer.

### 10.2 `PLAN.md` (3215 lines) and `API-FRICTION.md` (3069 lines) — high-signal excerpts

`PLAN.md` is a living plan with historical sections explicitly marked
superseded by the doc's own headers — later/current sections should be
trusted over earlier ones, and the doc says so itself.

- **`### D3-native product checkpoint — 2026-07-27`** (`PLAN.md:178`) — the
  current, authoritative status section. Lists the current product-profile
  marks as only `lineY, areaY, barX, barY, dot, rect, cell, ruleX, ruleY, text`
  plus facets/sparklines/custom marks. **Polar and geo are conspicuously absent
  from this list** despite being real, working subpath exports exercised by
  20+ conformance cases and dedicated bundle-size budget entries (§9.3) — a
  documentation lag, not evidence the capability is unsupported. Trust the
  source/conformance cases/`package.json` `exports` over this prose list when
  they conflict.
- **`## Historical proposed Plot-inspired native engine subset`** (`PLAN.md:1003`)
  → **`#### Polar`** (`PLAN.md:1152`): "Arc mark; Angle and radius channels;
  **Pie, donut, radial bar, and gauge compositions**... A small polar profile
  covers a common dashboard expectation without putting polar geometry in the
  cartesian kernel." This is the design rationale for why polar is an opt-in
  subpath rather than a root export.
- **`### Required chart coverage`** (`PLAN.md:1197`), item 13: "Pie or donut
  through the optional polar profile" — listed as a required-coverage bar for
  the prototype to be credible, i.e. pie/donut support was a planning
  requirement, not an afterthought.
- **`### Explicit initial exclusions`** (`PLAN.md:1220-1230`): *"Sankey, chord,
  force simulation, and specialized network layouts"* explicitly excluded from
  scope — corroborating §2.5/§8's Sankey gap finding. Note this exclusion list
  is partially stale: `40-force-directed-network` now has a working
  `tanstack.ts` conformance case (built via custom marks), so "force
  simulation" shipped despite being on the exclusion list; **Sankey/chord still
  have zero implementation anywhere** in source, docs, or conformance cases.
- **`## Historical expected capability map`** (`PLAN.md:2958`) is explicitly
  self-labeled non-authoritative: *"do not infer current support from this
  list."* Lists Heatmaps under "Common charts" (`PLAN.md:2977`) and "Trees and
  supported network-like layouts" under "Advanced grammar capability" —
  informational only per the doc's own caveat.
- Bundle-size figures (historical bundle table, checkpoint-era): "Pie and arc
  geometry: 2.74 kB → Polar profile"; "Geographic geometry: 9.21 kB → Geo
  profile" — both opt-in, tree-shaken budgets, consistent with §9.3's Budgeted
  tier and the "pay for what you import" design.
- `PLAN.md:485-486` (2026-07-26, one day before the "current" checkpoint):
  "Pending: add polar, polygon, contour, hierarchy, force, Delaunay/Voronoi,
  geo, brush, drag, and zoom only as explicit D3-backed [capabilities]" — polar/
  geo were "pending" the day before the checkpoint that omits them; the
  conformance cases and package exports show they landed since, even though the
  checkpoint prose was never updated to reflect it.
- Candlestick appears only in narrative chart-type lists (`PLAN.md:1075, 2113, 2304`)
  and as conformance case `28-candlestick` (compared directly against
  Observable Plot) — never called out as a distinct mark, consistent with
  §2.6's "composed from `link` + `rect`" finding.

`API-FRICTION.md` is a running, evidence-only friction log (133 numbered
findings, F-001…F-133 — its own contribution rule per `AGENTS.md` is "log
evidence from the actual task; do not add speculative wishlist items").
Relevant hits:

- **F-058** (`API-FRICTION.md:1326`) "Radar checks ignored polar labels" — a
  conformance-tooling bug implying polar/radar support existed early enough to
  need such checks (further corroborating radar's real-support status).
- **F-057** (`API-FRICTION.md:1309`) "D3 hierarchy coordinates use screen-space
  y" — relevant to hierarchy/tree/sunburst marks (`36-hierarchy-tree`,
  `101-sunburst`): d3-hierarchy layouts need a y-flip when mapped onto
  TanStack's coordinate space. **Worth remembering if bklit-ui's sunburst
  migration uses `d3-hierarchy` directly.**
- **F-066** (`API-FRICTION.md:1514`) "Disabling native focus required a custom
  strategy" and **F-087** (`API-FRICTION.md:1946`) "Custom focus strategies
  erased application types" — both relevant to the interactivity extension
  surface (custom focus strategies are a real, exercised path with a typing
  rough edge that was tracked/resolved).
- No findings specifically flag "gauge," "sankey," "funnel," or "choropleth" as
  unsupported chart *types* — the log tracks friction encountered while
  building things, not a gap register, so absence of an entry is not evidence
  of ease, just that nobody logged one for those (largely because sankey/funnel
  were never attempted).

### 10.3 Framework/version context

`docs/installation.md`'s "Framework compatibility" table pins nine adapters to
recent peer ranges: React/React DOM `^19.0.0`, Preact `>=10`, Vue `>=3.5`, Solid
`>=1.8`, Svelte `^5.20.0`, Angular `>=19`, Lit `>=3.1.3`, Alpine `>=3.15`,
Octane `^0.1.13`. Confirms adapters are thin lifecycle-only wrappers around the
shared `@tanstack/charts` runtime — nothing framework-specific in the grammar
itself, which is favorable for a React-first migration since the core contract
being adopted (marks, scenes, scales) is identical to what every other
framework adapter consumes.

---

## Phase 3 delta note — D137–D146 post-freeze changes

> Appended 2026-08-18 per PLAN-phase-3.md 0.1. This file is a **verbatim copy** of the Phase 2 freeze state (tag `phase-2-complete-2026-08-08`); nothing above this line was edited. This appendix records what changed in the D137–D146 window *after* the Phase 2 freeze, so Phase 3 readers know where the copied inventory is stale. Source: `docs/phase-2/LOG.md` for D137–D141; git commit messages for D142–D146.

| Delta | Subject | What changed post-freeze | Source |
|---|---|---|---|
| D137 | RingChart reveal | `migrated/charts/ring-chart.tsx`: WAAPI stolen by StrictMode teardown + deferred-paint stall. Fixes: `isMountedRef+setTimeout(0)`; hover defer gated on `pendingExpandAnimsRef.has(i) && !seenRingRevealedRef.has(i)`; `ringConfigs` memoized by content key (not `children` identity); reveal moved to `onPostPaint` (2×rAF+setTimeout 0); `data-bkm-revealed` on `<svg.ts-chart>` root; stale `style.transform="scale(1)"` cleared before WAAPI so `fill:backwards` paints `scale(0)` correctly | LOG.md D137 |
| D138 | GaugeChart reveal | `gauge.tsx`: ARC target selector mismatch (`.ts-chart__radial-arc` stale vs live `[data-ts-key="gauge-bg"]`/`[data-ts-key="gauge-active"]` — 7× 0-target false-alarms) + `radar-spring.ts` `createSpringResolver(...,0,0)` `initialDelta=0` flatline → fixed to `0,1`; `transformOrigin:"0px 0px"` delegated to `styles.css` | LOG.md D138 |
| D139 | Critique sweep | Removed dead `runDeferredReveal`/`createDeferredRevealGuard` from `deferred-reveal.ts` (live primitives `onPostPaint`+`setRevealDeadline` kept); flagged 5× cloned `springFromBounce/resolveEnterTransition/revealTiming/buildProgressKeyframes` (keep per-family precedent) + duplicated `TOOLTIP_SPRING`/`BOX_OFFSET` hover constants; `.ts-bkm-heatmap-rect` retired (`#if 0`'d) | LOG.md D139 |
| D140 | RadarChart reveal + hover | `radar-chart.tsx`: same spring `0,0` flatline fix (D138 root); `focus:"nearest"` never hits `polar/radialArea` centroids via spatial index → `focusDisabled` + imperative `pointerenter/leave` on `radial-area path`/`radial-dot circle` groups; `onPostPaint` scale `0→1` reveal about polar center; `seenRevealedRef:Set`+`pendingRevealRef:Map` gate blocks hover `scale(1.05)` during reveal; `setRevealDeadline` cleanup | LOG.md D140 |
| D141 | HeatmapChart reveal + hover | `heatmap-components.tsx`: reintroduced deferred reveal (`revealInputsRef`+`seenRevealEpochRef`+`onPostPaint`) with single-pass `Map<key,delayMs>` (`computeHeatmapEnterFadeDelayMs`/`resolveHeatmapEnterFadeDurationSec`/`HEATMAP_DEFAULT_ENTER_EASE`, default `delay:0 dur:1600 cubic-bezier(0.85,0,0.916,0.282) fill:backwards`); hover darkening fixed via two load-bearing separate guards (`seen===epoch` and `dataset.bkmRevealed==="1"`) | LOG.md D141 |
| D142–D143 | SunburstChart hover/zoom + debt | commit `4df1aff`: WAAPI reveal with `bkmRevealed` guard + `setRevealDeadline` + `onPostPaint` keyed by `data-ts-key`; labels morph via `transitionGeometry` with hover dimming (no remount); zoom dims unrelated labels (0.25) instead of culling (`isRelatedArc`); **deleted orphaned `internal/sunburst-hover-chrome.ts` (112 lines)**; deduped `getSunburstPathMap` (4 sites) + `isRelatedArc` (3 sites); `applyAlphaToColor` → `color-mix`; removed `d3 arc()` wrapper; `usePrefersReducedMotion` hook; `pendingReveal` Map→Set | ⚠️ commit message only, NOT in LOG.md |
| D144 | ChoroplethChart native zoom | commit `490aeba`: replaced hand-rolled `ProvidedZoom` (`createProvidedZoom`/`useZoomState`, ~260 lines) with bklit's native `<Zoom>`; svg is gesture target via `containerRef`; single `<g.transform>` drives marks+graticule; pinch/wheel share focal+compose+clamp; removed dead `featureByTsKeyFallback` + `isMountedRef` dance; extracted `applyZoomToGroups`; graticule single outer `<g>` via `graticuleGRef` | ⚠️ commit message only, NOT in LOG.md |
| D145 | ChoroplethChart tooltip clear | commit `6a05c09`: country→ocean left `hoveredKey` live so tooltip stuck at `opacity:0` through 200ms exit timer; `handleLeave`/`handleRootLeave` consolidated into `clearHover()`; `svg:mousemove/leave/pointerleave` clear when event target has no `data-ts-key` ancestor; re-wire on reconnect so TanStack re-renders don't drop the listener | ⚠️ commit message only, NOT in LOG.md |
| D146 | Showcase build | commit `692fc28`: `showcase/tsconfig.json` paths `../repos/...` → `./repos/...` (Vercel Root Directory = `showcase/`, `clone-repos.sh` places repos at `showcase/repos`); webpack+turbopack aliases for `@tanstack/*` generated from `package.json` exports (like `bench/app/vite.config.ts`); `globals.css` source includes showcase-relative paths | ⚠️ commit message only, NOT in LOG.md |

**Impact on this file (02 — tanstack-charts inventory):** none — `repos/tanstack-charts` was not modified post-freeze. D146 only changed harness alias resolution (`bench/app`-style dynamic aliases), not the core library surface this inventory documents.
