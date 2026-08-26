# internal-legend-markers — Phase 4 Research Report

**Files:** `showcase/migrated/charts/internal/legend.tsx` (orphan), `showcase/migrated/charts/internal/legend-context.tsx` (orphan), `showcase/migrated/charts/internal/chart-legend.tsx` (orphan), `showcase/migrated/charts/internal/chart-legend-hover.tsx`, `showcase/migrated/charts/internal/chart-markers.tsx`, `showcase/migrated/charts/internal/series-marker-mark.ts`

**Legacy source(s):** `repos/bklit-ui/packages/ui/src/charts/legend/` (`legend.tsx`, `legend-context.tsx`, `legend-item.tsx`, `legend-label.tsx`, `legend-marker.tsx`, `legend-value.tsx`, `legend-progress.tsx`), `repos/bklit-ui/packages/ui/src/charts/chart-legend.tsx`, `repos/bklit-ui/packages/ui/src/charts/chart-legend-hover.tsx`, `repos/bklit-ui/packages/ui/src/charts/markers/chart-markers.tsx`, `repos/bklit-ui/packages/ui/src/charts/markers/marker-group.tsx`, `repos/bklit-ui/packages/ui/src/charts/series-point-marker.tsx`

## Feature summary

Two legend stacks plus marker plumbing: (1) a compositional legend kit — `Legend` maps items through a cloned child inside nested contexts, with `LegendItem/Marker/Label/Value/Progress` atoms over base-ui `Progress` — and (2) a self-contained one-shot `ChartLegend` with progress/simple item variants and a `renderItem` escape hatch. `ChartLegendHoverProvider/useChartLegendHover` syncs legend hover into charts (consumed by line, area, bar, composed, candlestick). Markers: `ChartMarkersOverlay` renders date-bucketed event markers as an HTML overlay with hover fan-out arc, count badge, and dashed guide line (replacing legacy SVG `<g>` + portal); `series-marker-mark.ts` builds TanStack `dot()` marks with ring-gradient defs for series point markers.

## Public API

Group exported surface (no public API); parity vs the corresponding legacy module(s). Component rows cover their props.

| Prop/Export | Type | Legacy parity | Notes |
|---|---|---|---|
| `legendCssVars` (`legend-context.tsx`) | const token map | same | Identical 5 vars: `--legend`, `-foreground`, `-muted`, `-muted-foreground`, `-track` |
| `LegendItemData` | type | same | `{label, value, maxValue?, color}` unchanged |
| `LegendContextValue` / `LegendItemContextValue` | type | same | Same fields incl. `isFaded`, `percentage` |
| `LegendProvider` / `LegendItemProvider` | component | same | Plain context providers, verbatim |
| `useLegend` / `useLegendItem` | hook | same | Same throw-on-missing error messages |
| `Legend` (`legend.tsx`) / `LegendProps` | component | same | Verbatim consolidation of legacy `legend/legend.tsx`; all 7 props identical (items, hoveredIndex, onHoverChange, title, titleClassName, className, children) incl. controlled/uncontrolled hover split |
| `LegendItem` / `LegendItemProps` | component | same | Port of legacy `legend/legend-item.tsx`; barrel additionally aliases as `LegendItemComponent` |
| `LegendMarker` / `LegendMarkerProps` | component | same | Default `"h-2.5 w-2.5"` |
| `LegendLabel` / `LegendLabelProps` | component | same | |
| `LegendValue` / `LegendValueProps` | component | same | 5 props identical; `formatValue` default now module-local `intFmt` (legacy imported from `chart-formatters`) |
| `LegendProgress` / `LegendProgressProps` | component | same | base-ui `Progress.Root/Track/Indicator`, null when no `maxValue` |
| `ChartLegend` (`chart-legend.tsx`) / `ChartLegendProps` | component | same | Near-verbatim port of legacy top-level `chart-legend.tsx`; all 16 props identical (incl. `renderItem`, `displayPercentage = showPercentage ?? showProgress`) |
| `LegendItem` (chart-legend's own type) | type | renamed | Barrel re-exports as `ChartLegendLegendItem` |
| default export (`ChartLegend`) | — | missing | Legacy `export default ChartLegend` dropped |
| `ChartLegendHoverProvider` (`chart-legend-hover.tsx`) | component | same | Verbatim; `useMemo` context value |
| `useChartLegendHover` | hook | same | Same nullable-context noop fallback |
| `ChartMarkersOverlay` (`chart-markers.tsx`) / `ChartMarkersProps` | component | renamed | vs legacy `ChartMarkers` (`markers/chart-markers.tsx`): `useChart()` context reads replaced by explicit props (`xScale`, `marginLeft`, `marginTop`, `innerHeight`, `animationDuration`); HTML absolute-positioned overlay replaces SVG `<g>` + `createPortal` fan |
| `ChartMarkersOverlay.containerRef` | prop | renamed | Accepted-but-unused — overlay positions itself absolutely; legacy used it as portal target |
| `ChartMarkersOverlay.xScale` | prop | renamed | New explicit contract: must return inner-relative coords; overlay adds margins itself (matches legacy `portalX = x + marginLeft`) — documented in source comment |
| `ChartMarkersOverlay.onMarkerHoverChange` | prop | renamed | vs legacy `onHover(markers \| null)`: boolean entered callback; legacy crosshair-hide (`setTooltipData(null)`) not ported |
| `ChartMarkersOverlay.maxFanned` | prop | same | Hoisted from legacy `MarkerGroup.maxFanned` to overlay level; badge still shows full count |
| `size` / `showLines` / `animate` / `items` | props | same | Same defaults (28 / true / true) |
| `ChartMarker` (local interface) | type | same | Field-identical to legacy; also duplicated in `internal/types.ts` (see Deviations) |
| `MarkerTooltipContent` / `MarkerTooltipContentProps` | component | missing | No migrated counterpart; tooltip marker section with 2-marker cap + "+N more…" gone |
| `useActiveMarkers` | hook | missing | Tooltip-date → active markers lookup not ported |
| `MarkerGroup` / `MarkerGroupProps` (standalone) | component | missing | Folded into private `MarkerGroupView`; legacy extras `forceOpen`, `iconFill`, `isMuted`, `isActive` not exposed |
| `__isChartMarkers` component flag | — | missing | SVG-layer detection hack no longer needed |
| `getMarkerVisualExtent` (`series-marker-mark.ts`) | util fn | renamed | Legacy `getSeriesMarkerVisualExtent` (`series-point-marker.tsx`), body identical |
| `SeriesPointMarkerStyle` | type | renamed | Moved to `internal/types.ts` (internal-foundation group); comment cites origin |
| `SeriesPointMarker` / `StaticSeriesPointMarker` | component | missing | Motion enter/static circle components not carried — geometry rebuilt via TanStack `dot()` marks; scatter enter handled inline in `scatter-chart.tsx` (comment cites legacy) |
| `MarkerSeriesConfig` | type | extra | `{dataKey, stroke, showMarkers?, markers?}` config carrier |
| `buildMarkerGradientDefs` / `MarkerGradientDef` | util fn | extra | Ring rendered as SVG gradient stops (`fillFadeStart/End`, `gapFadeStart/End`, ±half-pixel softening) |
| `buildMarkerMarks` | util fn | extra | Builds `dot()` `ChartMark`s keyed `${dataKey}__marker`, fill `url(#gradient)` when ringed |
| `shouldShowMarkers` | util fn | extra | Gate helper |
| `MARKER_DIM_OPACITY` / `MARKER_DIM_BLUR_PX` / `MARKER_DIM_TRANSITION` / `MARKER_ACTIVE_SCALE` | constant | extra | Exports mirror bklit series-dim behavior (`0.5`, `2px`, `"opacity 0.15s ease-in-out, filter 0.15s ease-in-out"`, `1.35`); no in-tree consumer — `internal/hover-chrome.ts` re-declares the same values privately |
| `MARKER_ENTER_BLUR_PX` / `MARKER_ENTER_DURATION_MS` | constant | extra | bklit scatter enter values (`2px`, `500ms`); no in-tree consumer |

## Inventory

| Item | Kind | Origin | Impl | TanStack-native candidate? | Notes |
|---|---|---|---|---|---|
| `intFmt = new Intl.NumberFormat("en-US").format` | constant | BKLIT | CUSTOM | maybe | Module-level memoized formatter in both legend.tsx and chart-legacy.tsx; legacy shared one via `chart-formatters` (internal-foundation has `formatters`) ; TS-check: none |
| Default className bundle (title `"text-sm font-semibold"`, label `"text-sm font-medium"`, value `"text-sm tabular-nums"`, pct `"text-xs tabular-nums"`, marker `"h-2.5 w-2.5"`, track `"h-1.5"`) | constant | BKLIT | CUSTOM | no | Magic class strings duplicated across legend.tsx and chart-legend.tsx (same in legacy) ; TS-check: none |
| Item hover chrome classes `cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out` + conditional `bg-legend-muted` | CSS class | BKLIT | CUSTOM | no | Tailwind utilities, identical in legacy ; TS-check: none |
| `transition-all duration-500` on Progress indicators | CSS class | BKLIT | CUSTOM | no | Progress fill animation timing ; TS-check: none |
| `.legend-container` + `:has([data-hovered]) > *:not([data-hovered]) { opacity: 0.5 }` + `> * { transition: opacity 150ms ease-out }` (styles.css:986–993) | CSS class | BKLIT | CUSTOM | maybe | Deliberately unscoped so Legend/ChartLegend work outside `[data-bkm-chart]`; drives sibling fade ; TS-check: none — no `:has()`/sibling-fade CSS hooks in TS scene styles |
| `data-hovered={isHovered ? "" : undefined}` attribute protocol | constant | BKLIT | CUSTOM | no | DOM contract feeding the `:has()` selector ; TS-check: none |
| Tailwind legend color tokens (`text-legend-foreground`, `bg-legend-muted`, `bg-legend-track`, `text-legend-muted-foreground`) | CSS class | BKLIT | CUSTOM | no | Theme-token utilities ; TS-check: none — TS theme is `{foreground,muted,grid,background,palette}` fills only |
| base-ui `Progress.Root/Track/Indicator` composition | component | BKLIT | CUSTOM | no | External dep (`@base-ui/react/progress`) ; TS-check: none |
| `cloneElement(children)` per-item rendering | component | BKLIT | CUSTOM | no | Compositional child-template pattern (legacy same) ; TS-check: none — native legends render fixed dot+label scenes, not composable children |
| `LegendContext` + `LegendItemContext` (provide/consume, throw guards) | context | BKLIT | CUSTOM | maybe | Orphan module; nothing consumes in migrated tree ; TS-check: partial — `InteractiveColorLegendItemContext` is per-item `{visible}` callback context, no React provider |
| Controlled/uncontrolled hover state (`isControlled`, internal `useState`) | hook | BKLIT | CUSTOM | maybe | Same pattern in Legend and ChartLegend ; TS-check: partial — `controlledSignal` (@tanstack/charts/interaction/signal) covers controlled side only, no uncontrolled fallback |
| `onMouseEnter`/`onMouseLeave` listeners on legend items | side-effect | BKLIT | CUSTOM | maybe | Only interaction channel; no keyboard/focus support (parity with legacy) ; TS-check: partial — `interactiveColorLegend` buttons add keyboard+click toggles, no hover-sync channel |
| `legendCssVars` token map | constant | BKLIT | CUSTOM | no | Exported for consumers styling legends ; TS-check: none |
| `ChartLegendHoverContext` (nullable + noop fallback, `useMemo` value) | context | BKLIT | CUSTOM | maybe | Decouples legend hover from chart internals; provider mounted by showcase demos, not by charts themselves ; TS-check: partial — `setControlledFocus({source:'programmatic'})` drives chart focus externally, no index-based hover bridge |
| `FAN_RADIUS = 50`, `FAN_ANGLE = 160` | constant | BKLIT | CUSTOM | no | Fan arc geometry, identical to legacy `marker-group.tsx` ; TS-check: none |
| `getCirclePosition(index, total)` fan math (start `-90 − FAN_ANGLE/2`, step `FAN_ANGLE/(total−1)`) | util fn | BKLIT | CUSTOM | maybe | Module-level in migrated (was inline in legacy) ; TS-check: none |
| `markerY = -8` px offset above chart area | constant | BKLIT | CUSTOM | no | Same value in legacy `ChartMarkers` ; TS-check: none |
| Entrance stagger `(animationDuration/1000 + idx * 0.1) * 1000` ms | constant | BKLIT | CUSTOM | no | Per-bucket index delay, same as legacy ; TS-check: CONTRADICTS no — native `stagger({offset, each})` (@tanstack/charts/motion) |
| Badge geometry: 18×18 circle at `(size/2 + 2, −size/2 − 2)`, fontSize 11, weight 600 | constant | BKLIT | CUSTOM | no | Legacy drew r=9 SVG circle + text; migrated HTML div ; TS-check: none |
| Hover scale `1.12` + `transform 150ms ease-out` on clickable circles | constant | BKLIT | CUSTOM | no | Legacy was motion `whileHover {scale: 1.15}` — slightly different value ; TS-check: partial — dot `states` style `r` tweens mark size on focus; DOM zoom stays custom |
| `boxShadow: "0 4px 12px rgba(0,0,0,0.15)"` | constant | BKLIT | CUSTOM | no | Legacy had static `shadow-lg` + hover `0 4px 20px rgba(0,0,0,0.25)`; migrated drops tap/hover shadow delta ; TS-check: none |
| Collapsed-fan exit state (opacity 0, scale 0.6, blur 2px) + `220ms ease-out` opacity/transform/filter transitions | constant | BKLIT | CUSTOM | maybe | Replaces legacy motion variants (`hidden`/`visible`/`fanned`) that were spring-based (stiffness 300, damping 25) — CSS tween now ; TS-check: partial — mark states tween opacity/r via `ChartMarkStateTransition`; no filter/blur channel |
| Fan stagger `i * 40ms` transition delays | constant | BKLIT | CUSTOM | no | Matches legacy `delay: index * 0.04` ; TS-check: CONTRADICTS no — native `stagger({each})` (@tanstack/charts/motion) |
| Dashed guide line: `borderLeft: 1px dashed var(--chart-marker-border)`, top `size/2 + 4`, height `lineHeight + |y|`, opacity 0.6→1 on hover | component | BKLIT | CUSTOM | no | Legacy was SVG `motion.line` with `strokeDasharray="4,4"` ; TS-check: CONTRADICTS no — native `ruleY({strokeDasharray})` (@tanstack/charts) |
| Center halo dot (size·0.5, `var(--chart-marker-border)`, opacity 0.5) shown during fan | component | BKLIT | CUSTOM | no | ; TS-check: none — a plain `dot()` mark could paint it, but no fan/halo primitive |
| Date bucketing via `date.toDateString()` Map | util fn | BKLIT | CUSTOM | maybe | Grouping key, same as legacy ; TS-check: partial — `binTimeX/Y` with d3 time interval buckets by day; no toDateString-keyed grouping of arbitrary items |
| `setTimeout` reveal scheduling + cleanup effect | side-effect | BKLIT | CUSTOM | maybe | Delayed entrance per group; legacy used motion `delay` instead ; TS-check: CONTRADICTS no — native motion `delay` timing field (@tanstack/charts/motion) |
| `window.matchMedia("(prefers-reduced-motion: reduce)")` checked every render (no listener) | side-effect | BKLIT | CUSTOM | yes | Re-implements `use-prefers-reduced-motion` (internal-foundation) inline; skips transitions when set ; TS-check: native — `respectReducedMotion` in `motion()` renderer + mark-state transitions auto-check matchMedia |
| `window.__qaSetMarkerFan` global read each render (D229 QA hook) | side-effect | CUSTOM | CUSTOM | no | Forces fan open deterministically for screenshot.mjs; zero-cost when unset ; TS-check: none |
| Direct DOM mutation: `e.currentTarget.style.transform = "scale(…)"` on circle hover | side-effect | BKLIT | CUSTOM | no | Imperative hover zoom in `MarkerCircleHtml` ; TS-check: none |
| Click handling: `onClick()` else `window.open(href, "_blank", "noopener,noreferrer")` else `location.href` | side-effect | BKLIT | CUSTOM | no | Same semantics as legacy ; TS-check: none |
| HTML overlay layering (`position: absolute`, `inset: 0`, `pointerEvents` none/auto tiers, `zIndex: 5`, `aria-hidden`) | component | BKLIT | CUSTOM-ON-TS | maybe | Replaces SVG `<g>` + `createPortal` + hit-area `<rect>`; whole-fan hover area prevents flicker between circles (legacy same idea) ; TS-check: none — closest is `ChartHostControlExtension` HTML controls (interactive legend), not general overlays |
| Inner-relative xScale contract + margin offsetting | util fn | CUSTOM | CUSTOM | no | Migrated-specific coordination documented in source comment ; TS-check: none |
| `--chart-marker-{background,border,foreground,badge-background,badge-foreground}` CSS vars (styles.css:6–18, light+dark) | CSS class | BKLIT | CUSTOM | no | Replaces legacy `chartCssVars.*` JS map with plain CSS vars ; TS-check: none |
| Default marker style values (radius 5, strokeWidth 2, ringGap 2, outlineWidth 0, highlight pad `radius*0.35`, extent fudge +2) | constant | BKLIT | CUSTOM | no | Identical defaults in legacy `series-point-marker.tsx` / `getSeriesMarkerVisualExtent` ; TS-check: none |
| Gradient stop math (`fillEnd = r/outer·100`, `gapEnd`, `halfPx = 0.5/outer·100`, clamped ±) | util fn | CUSTOM | CUSTOM | maybe | Anti-aliased hard-stop rings; new technique replacing stacked SVG circles ; TS-check: partial — spec `gradients` renders `<linearGradient>` only (`svg.ts`); ring needs radialGradient, stops math stays custom |
| `dot(renderData, {…})` TanStack marks + `url(#id)` gradient fills | mark | BKLIT | TS-NATIVE | yes | Point markers expressed directly in TanStack mark pipeline (the migration's core win for this group) ; TS-check: native — `dot()` with `fill: url(#id)` (@tanstack/charts); note native gradients are linear-only |
| `useId()` sanitized gradient base id (`[^a-zA-Z0-9_-]` stripped) | hook | CUSTOM | CUSTOM | no | Done by callers (line-chart.tsx:211); ids `${baseId}-mgrad-${idx}` ; TS-check: partial — svg.ts has identical private `sanitizeId`; not exported |
| `MARKER_*` dim/active/enter constants (see Public API) | constant | BKLIT | CUSTOM | maybe | Exported but consumed nowhere; real consumers re-declare them in `internal/hover-chrome.ts` ; TS-check: partial — dot `states` cover opacity/r tweens on focus; blur px and CSS transition strings stay custom |
| `void stroke` discard after mark construction | util fn | CUSTOM | CUSTOM | no | Stroke resolved for gradient defs but dots render stroke-less ; TS-check: none |

## Imports

- `internal/types` (internal-foundation group) — `ChartDatum`, `SeriesPointMarkerStyle` in `series-marker-mark.ts`
- Within-group: `legend.tsx` → `legend-context.tsx` (types + providers + hooks)
- Non-internal: `@tanstack/charts` (`dot`, `ChartMark`) in `series-marker-mark.ts`; `@base-ui/react/progress` in `legend.tsx` / `chart-legend.tsx`; `@/lib/utils` (`cn`, app alias) in `legend.tsx` / `chart-legend.tsx`; `react` throughout
- No imports from internal-interaction, internal-animation, internal-axes-grid, or internal-brush groups

## Deviations

- **Three of six modules are orphans**: `legend.tsx`, `legend-context.tsx`, `chart-legend.tsx` are reachable only via the barrels (`internal/index.ts`, `charts/index.ts`). The entire compositional legend kit and the one-shot `ChartLegend` are dead code in the migrated tree (charts render their own legends); `chart-legend-hover.tsx`, `chart-markers.tsx`, `series-marker-mark.ts` do have live consumers.
- `ChartMarker` is defined twice identically — locally in `chart-markers.tsx` and canonically in `internal/types.ts` (the barrel exports the types.ts copy). Drift risk.
- `MARKER_*` constants are exported from `series-marker-mark.ts` but consumed nowhere; `internal/hover-chrome.ts` privately re-declares the same four dim/active values and uses those. Duplication with a single behavioral owner.
- `chart-markers.tsx` reads `prefers-reduced-motion` via raw `matchMedia` per render instead of the existing `use-prefers-reduced-motion` hook (internal-foundation) — no change listener, inconsistent with the rest of the tree.
- `ChartMarkersProps.containerRef` is accepted but never used (not even destructured) — leftover from the portal-based legacy design.
- Legacy marker features not carried: `MarkerTooltipContent` + `useActiveMarkers` (tooltip marker rows with "+N more…" cap), `forceOpen`, `iconFill` (edge-to-edge icons), `isMuted` cluster spotlighting, `isActive` crosshair interplay (guide line hiding + crosshair suppression via `setTooltipData(null)`), `whileTap` press feedback, spring physics (all motion replaced by CSS tweens; hover scale 1.15→1.12).
- `void stroke` dead store in `buildMarkerMarks` — stroke is resolved (and used for gradients) but the dot mark always renders `stroke: "none"`.
- `chart-legend.tsx` inlines `intFmt` instead of importing the shared formatter (legacy imported from `chart-formatters`); duplicated in `legend.tsx`.
- Production component contains the `window.__qaSetMarkerFan` QA hook (D229, documented in-source) — deliberate harness affordance living in shipped code.
- Barrel exports `LegendItem` twice under two names (`LegendItemComponent` alias + direct) — harmless but redundant.
