# reference-area — Phase 4 Research Report

**Files:** `showcase/migrated/charts/reference-area.tsx`
**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/reference-area.tsx`, `repos/bklit-ui/packages/ui/src/charts/reference-area-registration-context.tsx`

## Feature summary

Compositional `<ReferenceArea>` add-on: a shaded horizontal/vertical band (rect + top/bottom edge lines) drawn behind chart marks, with optional pattern fills, both-edge fade mask, bracket markers, and Y-tick label recoloring inside the band. Legacy rendered the band itself (motion/react) via chart contexts; the migrated file is a null-rendering config carrier tagged `CHART_ROLE="referenceArea"` — host charts (line, area, bar, scatter, composed, candlestick, live-line = 7 consumers) extract its props and render the band through `ReferenceAreaLayers` (internal-axes-grid scope).

## Public API

Migrated exports (file + barrel `charts/index.ts`): `ReferenceArea`, `ReferenceAreaProps`, `ReferenceAreaStrokeStyle`, `ReferenceAreaIfOverflow`. All 28 props exist in both interfaces with identical names/types/defaults; defaults are applied in the rendering layer, not the carrier.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `ReferenceArea` | component | same | Null-render carrier, `CHART_ROLE="referenceArea"`, `displayName="ReferenceArea"`, default export. Legacy rendered `motion.g` directly; rendering now compiled by host into `ReferenceAreaLayers` |
| `ReferenceAreaProps` | type export | same | Interface identical to legacy |
| `ReferenceAreaStrokeStyle` | type export | same | `"solid" \| "dashed"` |
| `ReferenceAreaIfOverflow` | type export | same | Legacy exported it from `reference-area-geometry` via barrel; migrated re-exports from `reference-area.tsx`. Values `"hidden" \| "visible" \| "discard"` |
| `y1` | `number?` | same | Lower Y bound; omitted → plot top |
| `y2` | `number?` | same | Upper Y bound; omitted → plot bottom |
| `x1` | `Date \| number?` | same | Omitted → plot left |
| `x2` | `Date \| number?` | same | Omitted → plot right |
| `yAxisId` | `string \| number?` | same | Default `"left"` — but ignored by migrated layer (see Deviations) |
| `fill` | `string?` | same | Default `color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)` preserved |
| `fillOpacity` | `number?` | same | Default 1 |
| `pattern` | `PatternPresetId?` | same | Default `"none"` |
| `patternColor` | `string?` | same | Legacy default `chartCssVars.foregroundMuted` === `var(--chart-foreground-muted)` (verified) |
| `patternScale` | `number?` | same | Default 1 |
| `patternStrokeWidth` | `number?` | same | |
| `patternRadius` | `number?` | same | |
| `patternComplement` | `boolean?` | same | |
| `patternFill` | `string?` | same | |
| `patternDotFill` | `boolean?` | same | |
| `patternTileBackground` | `string?` | same | |
| `stroke` | `string?` | same | Default `var(--chart-foreground-muted)` |
| `strokeWidth` | `number?` | same | Default 1 |
| `strokeStyle` | `ReferenceAreaStrokeStyle?` | same | Default `"dashed"` |
| `strokeDasharray` | `string?` | same | Default `"4,4"` |
| `fadeEdges` | `boolean?` | same | Default true |
| `fadeEdgesLength` | `number?` | same | Default 10 (% of plot width per edge) |
| `axisLabelColor` | `string?` | same | Recolors Y ticks inside band via `createTickColorResolver` |
| `showMarkers` | `boolean?` | same | Default false |
| `markerColor` | `string?` | same | Default `var(--chart-1)` |
| `markerSize` | `number?` | same | Default 6 |
| `ifOverflow` | `ReferenceAreaIfOverflow?` | same | Default `"hidden"` |
| `className` | `string?` | same | Same type — but dropped by `ReferenceAreaLayers`, never applied (see Deviations) |
| `computeReferenceAreaRect` | fn export | missing | Legacy barrel export (`reference-area-geometry`); lives only in `internal/reference-area-geometry.ts`, not re-exported |
| `ReferenceAreaRect` | type export | missing | Same — legacy barrel export, not re-exported by migrated barrel |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `ReferenceArea` carrier | component | BKLIT | CUSTOM-ON-TS | maybe | Null render; props harvested by host charts; TS-check: none — composition is defineChart marks array; no declarative carrier |
| `CHART_ROLE` symbol tag | constant | CUSTOM | CUSTOM | maybe | `Symbol.for("migrated.chartRole")` from `children.tsx`; replaces bklit's displayName matchers; TS-check: none — marks array has no child-props harvesting |
| `ReferenceAreaProps` | type | BKLIT | TS-NATIVE | yes | 28 props, 1:1 with legacy; TS-check: none — no ReferenceAreaProps equivalent; nearest is RectOptions |
| `ReferenceAreaStrokeStyle` | type | BKLIT | TS-NATIVE | yes | TS-check: none — no strokeStyle union export; raw `strokeDasharray` string on rules/SceneStyle |
| `ReferenceAreaIfOverflow` re-export | type | BKLIT | TS-NATIVE | yes | TS-check: partial — `clip: true/false` (defineChart) covers hidden/visible, lacks discard |
| Child extraction (`extractReferenceAreaProps`/`Configs`) | util fn | CUSTOM | CUSTOM-ON-TS | maybe | `internal/reference-area-config.ts` (internal-axes-grid scope); TS-check: none — marks array composition, no child extraction |
| Band geometry + overflow clamp/discard | util fn | BKLIT | CUSTOM-ON-TS | maybe | `computeReferenceAreaRect`, `clampRectToPlot`, `isFullyInsidePlot`; TS-check: partial — `rect()` maps x1/x2/y1/y2 via chart scales, lacks clamp/discard modes |
| Y-tick recolor (`createTickColorResolver`) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Replaces legacy registration-context channel; TS-check: none — `ChartAxisTickLabelOptions` has no fill/color option |
| Band rect + top/bottom edge lines | mark | BKLIT | CUSTOM-ON-TS | maybe | Plain SVG `rect`/`line`, maskable; TS-check: native — `rect` + `ruleY` marks (`@tanstack/charts`) |
| Edge-fade gradient + mask | overlay | BKLIT | CUSTOM-ON-TS | maybe | `edgeFadeMaskStops` (fade-mask.ts); clamp 0–45% preserved; TS-check: partial — `ChartLinearGradient` in spec, no `<mask>` support |
| Pattern preset fill | overlay | BKLIT | CUSTOM-ON-TS | maybe | `renderPatternPreset` (pattern-preset.ts); TS-check: none — no pattern/tile fill anywhere in TanStack |
| Bracket markers | mark | BKLIT | CUSTOM | maybe | `bracketMarkerPath` triangles at band center, size 6 default; TS-check: none — no marker/bracket mark; crosshair `marker` is a circle |
| Enter fade `REFERENCE_AREA_ENTER_MS = 420` | constant | BKLIT | CUSTOM | maybe | Legacy `ENTER_FADE_MS = 420` + easeOut — parity preserved; TS-check: partial — `motion: { type:'tween', duration }` exists but rect/band enter tracks absent |
| `DEFAULT_FILL` color-mix string | constant | BKLIT | TS-NATIVE | yes | Identical string; TS-check: none — bklit CSS-var color-mix default, TanStack theme has no equivalent |
| Value defaults (`"4,4"`, 10%, `var(--chart-1)`, 6px, `"hidden"`, 1) | constant | BKLIT | TS-NATIVE | yes | All preserved in layer defaults; TS-check: none — bklit-specific values, no TanStack counterpart |
| Phase gate (`ready`/`revealing`/`gridTweenReady`) | constant | BKLIT | CUSTOM-ON-TS | maybe | `isReferenceAreaVisiblePhase`; TS-check: none — no phase-gate concept; motion phases are enter/update/exit |
| `useId`-based DOM ids (`bkm-ref-pattern-*`, `bkm-ref-fade-*`) | constant | BKLIT | TS-NATIVE | yes | Id scheme renamed from legacy `chart-reference-area-*`; TS-check: none — React `useId` concern; TanStack uses `idPrefix` only |
| Layout-effect `g.style.opacity/transition` writes + rAF flip | hook | BKLIT | CUSTOM | no | Replaces motion/react `animate`; direct DOM mutation, single `requestAnimationFrame`; TS-check: CONTRADICTS no — native `motion()` renderer + `respectReducedMotion` |
| `prefers-reduced-motion` matchMedia check | hook | CUSTOM | CUSTOM | maybe | One-shot read into ref; legacy component had no reduced-motion branch; TS-check: native — `respectReducedMotion` in `motion()`/`ChartMarkStateTransition` |
| Overlay `<svg>` (absolute, `zIndex: -1`, `pointerEvents: none`) | overlay | CUSTOM | CUSTOM-ON-TS | maybe | Renders outside the main chart SVG; TS-check: partial — declaration-order layering + `decorative()` in-chart, no external overlay API |
| `chart-reference-area` class | CSS class | BKLIT | — | no | Legacy default className; dropped — zero `reference` rules in migrated `styles.css`; TS-check: none — no CSS class contract |
| Bar band-scale x resolution | util fn | BKLIT | CUSTOM-ON-TS | maybe | `isBarChart` + `barScale`, band-center mapping (casts x1/x2 to string); TS-check: native — `scaleBand().bandwidth()` (`@tanstack/charts/scales/band`); `rect` maps bands natively |
| X-scale rebuild (scaleUtc/scaleLinear, `xRangePadding` inset, candlestick) | util fn | BKLIT | CUSTOM-ON-TS | maybe | Layer reconstructs scales from domains instead of consuming chart scales; TS-check: native — axis `scale` factory/instance + `viewport.domain` (defineChart) |
| `isLoaded` gate in enter effect | constant | CUSTOM | CUSTOM | maybe | Migrated-only pre-reveal hold (`opacity: 0` until loaded); TS-check: none — no loading-gate concept in TanStack |

## Imports

From `reference-area.tsx` itself:
- `./internal/pattern-preset` — type-only (`PatternPresetId`)
- `./internal/reference-area-geometry` — type-only (`ReferenceAreaIfOverflow`)
- `./children` (sibling, not `internal/`) — `CHART_ROLE` symbol

Runtime pipeline (reassigned to **internal-axes-grid**; not this part's scope, listed for traceability): `internal/reference-area-config.ts`, `internal/reference-area-geometry.ts`, `internal/reference-area-layer.tsx` — consumed by 7 host charts (line, area, bar, scatter, composed, candlestick, live-line). Layer additionally imports `internal/fade-mask`, `internal/pattern-preset`, `internal/use-chart-margin` types.

## Deviations

- **`className` silently dropped**: carrier accepts it and `extractReferenceAreaProps` captures it, but `ReferenceAreaLayers` never forwards it; legacy applied `className ?? "chart-reference-area"`. Default class has no migrated `styles.css` counterpart.
- **`yAxisId` accepted but ignored**: `ReferenceAreaLayer` builds a single `scaleLinear` from one `yDomain`; legacy resolved the real per-axis scale via `useYScale(yAxisId)`. Multi-Y-axis parity gap.
- **Registration context dropped**: legacy `ReferenceAreaRegistrationContext` (provided by `time-series-chart-shell.tsx`, consumed only by the add-on) is gone; `axisLabelColor` now flows via `extractReferenceAreaConfigs` → `createTickColorResolver`. Internal-only surface (not in legacy barrel) — no public break.
- **Public barrel gap**: legacy exported `computeReferenceAreaRect` + `ReferenceAreaRect` from `charts/index.ts`; migrated barrel does not.
- **Animation channel changed**: motion/react opacity animation → direct `g.style` mutation + CSS transition + rAF; adds migrated-only `prefers-reduced-motion` short-circuit and `isLoaded` gate.
- **Render location changed**: band renders in its own absolutely-positioned overlay `<svg>` with `zIndex: -1` instead of inside the chart's mark tree (z-order parity assumption).
- **Suspicious duplication**: `internal/reference-area-config.ts` re-derives the role via inline `Symbol.for("migrated.chartRole")` + displayName fallback instead of importing `CHART_ROLE`/`roleOf` from `children.tsx`.
- **Dead-import workaround**: `composed-chart.tsx:404` has `void extractReferenceAreaConfigs;` — imported then voided.
- **Type looseness**: bar path in the layer casts `x1`/`x2` to `string` (`band(String(v))`) though the public prop type is `Date | number`.
