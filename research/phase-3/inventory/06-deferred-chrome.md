# 06 — Deferred Chrome Families Catalog (Phase 3 Initiative Targets 6–12)

> **PLAN-phase-3.md 0.2.** Catalogue of the bklit-ui chrome families that have
> **no migrated counterpart** (verified absent in `migrated/charts/` —
> `find`/`grep` 0 hits on 2026-08-18, HEAD `5a2c444`) and were deferred to
> Phase 3 initiatives 6–12. Family → initiative mapping follows
> `docs/phase-3/PROGRESS.md` (the source of truth).
>
> **Method (honest scope):** each row re-verified against
> `repos/bklit-ui/packages/ui/src/charts/` at HEAD. Line counts are verbatim
> `wc -l` on 2026-08-18. Prop surfaces below are the exported interfaces read
> from the file headers, not reconstructed from memory. If an audit later
> finds a partial migrated implementation I missed, it belongs in the
> initiative's audit, not in a silent edit of this catalog.
>
> **Design-token contract:** magic values named here (`FAN_RADIUS 50`,
> `FAN_ANGLE 160`, `BRUSH_TRACK_OUTER_FADE 0.15`,
> `BAR_DEPTH_PERSPECTIVE_RATIO 0.45`, `BACKGROUND_ENTER_FADE_MS 420`,
> `COMPACT_TICKER_THRESHOLD 60`) must land in the single design-tokens module
> (00-layer-contract) when their initiative runs.
>
> **Native-candidate column** names the TanStack public API each family should
> be built on per the architecture contract (no internals, no deep imports,
> no rendered-DOM patching).

---

## 1. Family table

| # | Deferred family | bklit files (`repos/bklit-ui/packages/ui/src/charts/`) | Migrated state | Initiative | TanStack-native candidates |
|---|---|---|---|---|---|
| 1 | ReferenceArea + Segment | `reference-area.tsx`, `reference-area-config.ts` (68), `reference-area-geometry.ts` (136), `reference-area-registration-context.tsx` (16), `segment.tsx` (152) | **absent** | 6 | `ruleY`/`rect`/`link` marks + `clip`; `ifOverflow: "hidden"\|"extend"` parity; `PatternPreset` bridge via family 7 |
| 2 | ProjectionLine + TerminalMarker | `projection-line.tsx` (234), `projection-line-end-marker.tsx` (69), `projection-utils.ts` (386), `projection-config.ts` (129) | **absent** | 7 | dashed `ruleY`/`link` + `gradientStart→End` stroke; `curveKind linear\|bezier`, `mode auto\|target\|manual` |
| 3 | Legend + ChartLegend + ProfitLoss | `legend/` 8 files (390 total: `legend.tsx` 104, `legend-context.tsx` 92, `legend-item.tsx` 36, `legend-label.tsx` 23, `legend-marker.tsx` 23, `legend-progress.tsx` 49, `legend-value.tsx` 46, `index.ts` 17), `chart-legend.tsx` (261), `chart-legend-hover.tsx` (44), `profit-loss-line.tsx` (190), `profit-loss-segments.ts` (123), `profit-loss-legend.tsx` (58), `profit-loss-legend-hover.tsx` (29) | **absent** (heatmap has its own `heatmap-legend.tsx` island — not the cartesian Legend) | 8 | `colorLegend()` / `colorGradientLegend()`; hover highlight via `onFocusGroupChange` → legend DOM only |
| 4 | ChartBrush + BrushLayout | `chart-brush.tsx` (343, `@visx/brush`), `chart-brush-handle.tsx` (116), `chart-brush-layout.tsx` (123), `chart-brush-selection-overlay.tsx` (109), `chart-brush-track-overlay.tsx` (141, `BRUSH_TRACK_OUTER_FADE 0.15` line 10), `filter-data-by-x-domain.ts` (59) | **absent** | 9 | filtered data + definition swap (no `@visx/brush`): brush = selection state → re-`defineChart` |
| 5 | Markers + Series chrome | `markers/chart-markers.tsx` (214), `markers/marker-group.tsx` (520, `FAN_RADIUS 50` :11, `FAN_ANGLE 160` :12), `markers/index.ts`, `series-markers.tsx` (294), `series-point-marker.tsx` (209), `series-hover-dim.tsx` (60), `series-highlight-layer.tsx` (49), `highlight-segment.tsx` (65), `highlight-segment-bounds.ts` (71), `use-highlight-segment.ts` (61), `series-dash-tail-overlay.tsx` (82), `dash-tail-stroke.tsx` (75), `path-stroke-utils.ts` (89), `line-series-terminal-marker.tsx` (94) | **absent** (`FAN_ANGLE` 0 hits in migrated — verified) | 10 | `dot` mark + custom `createMark` + `focus` highlight; fan geometry via design tokens |
| 6 | PatternArea + BarSquares/BarDepth + misc series | `pattern-area.tsx` (49), `pattern-preset.tsx` (186, `PATTERN_PRESET_IDS` 8: `none/diagonal/horizontal/vertical/cross/dots/circles/accent`), `visx-pattern.tsx` (33), `bar-squares.tsx` (635), `bar-squares-layout.ts` (99), `bar-depth.tsx` (1074), `bar-depth-geometry.ts` (44, `BAR_DEPTH_PERSPECTIVE_RATIO = 0.45` :14), `series-bar.tsx` (321), `series-bar-layout.ts` (61) | **absent** (composed uses custom `seriesBarMark` — unrelated) | 11 | one custom `createMark` family per feature; pattern defs via chart `defs` extension point |
| 7 | Showcase shell + type-debt | `chart-defs.ts` (72), `chart-child-passthrough.ts` (117), `chart-center-typography.ts` (16), `motion-utils.ts`, `x-axis.tsx` (`selectEvenlySpacedIndices`), `bar-x-axis.tsx`, `bar-y-axis.tsx`, `live-x-axis.tsx`, `live-y-axis.tsx`, `decimate-time-series.ts`, `generate-chart-skeleton-data.ts` + `heatmap/generate-heatmap-skeleton-data.ts`, loading family (see 05 family 18) | partial (overlays cover x/y-axis; `internal/decimate.ts` exists; `internal/formatters.ts` subset) | 12 | `chart-defs`/`chart-child-passthrough` passthrough (`isPostOverlay`/`isUnderlay`/`isClipExcluded`/`CHART_CLIP_PASSTHROUGH`, verified exports at `chart-child-passthrough.ts:11/68/93/103`); showcase `ignoreBuildErrors` → clean `tsc` |

---

## 2. Per-family detail (verified prop surfaces)

### 2.1 ReferenceArea + Segment (initiative 6)

`reference-area.tsx` exports `ReferenceAreaProps`: `y1?/y2?` (data bounds, extend
when omitted), `x1?/x2?` (`Date|number`, extend when omitted), `yAxisId?`
(default `"left"`), `fill?` (default `color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)`),
`fillOpacity?`, `pattern?: PatternPresetId`, `patternColor?/patternScale?/patternStrokeWidth?/patternRadius?/patternComplement?/patternFill?/patternDotFill?/patternTileBackground?`,
`stroke?`, `ReferenceAreaStrokeStyle = "solid"|"dashed"`. Geometry split across
`reference-area-geometry.ts` (`computeReferenceAreaRect`, `ifOverflow`),
`reference-area-config.ts`, `reference-area-registration-context.tsx`
(`useReferenceAreaRegistration` — bklit's y-domain registration side-channel;
Phase 3 06 must decide: native `y.domain` extension (D200 init 6 "y-domain
registration") or a declarative config carrier like migrated `children.tsx`).

`segment.tsx` exports `SegmentBackground` (`fill?` default
`var(--chart-segment-background)`) + `SegmentLineFrom`/`SegmentLineTo` — a
150ms fade rect for `ChartSelection` drag select (`selection.active &&
Math.abs(endX-startX)>5`). Dragging is the bklit `useChartInteraction`
`selection` flow (05 family 19); initiative 6 decides whether segment survives
without a native selection model.

### 2.2 ProjectionLine + TerminalMarker (initiative 7)

`projection-line.tsx` `ProjectionLineProps`: `data: ProjectionPoint[]` (anchor
+ horizon), `yAxisId?`, `stroke?` (default `var(--chart-3)`),
`strokeStyle?: "solid"|"gradient"`, `gradientStart?/gradientEnd?` (defaults
`stroke`/`var(--chart-5)`), `strokeWidth?` (default 2), `curveKind?:
"linear"|"bezier"`, `curve?: CurveFactory`, `strokeDasharray?` (default
`"6,4"`), `strokeOpacity?`, `showEndMarker?` (default true), deprecated
`showEndpoints?`, `radius?` (default 5). `projection-utils.ts` (386)
`buildProjectionPath`/`buildHorizontalTangentBezierPath` +
`ProjectionCurveKind`; `projection-config.ts` (129) carries `mode
auto|target|manual`. `projection-line-end-marker.tsx` renders the horizon dot
**outside the reveal clip** (`__isPostOverlay` family) — the clip-exclusion
mechanics live in `chart-child-passthrough.ts` (family 7).

### 2.3 Legend + ChartLegend + ProfitLoss (initiative 8)

- `legend/legend.tsx`: `LegendProps {items: LegendItemData[], hoveredIndex?, onHoverChange?, title?, titleClassName?, className?, children: ReactElement}` — child-driven legend item rendering (`legend-item/legend-label/legend-marker/legend-progress/legend-value`, `legend-context.tsx` provider).
- `chart-legend.tsx`: `ChartLegendProps {items: LegendItem[]{label,value,maxValue?,color}, hoveredIndex?, onHover?, showProgress?, showMarker? (true), showValue? (true), showPercentage?, formatValue?, title?, className?, titleClassName?, itemClassName?, labelClassName?}` + `LegendItem` record. Renders an HTML list — not SVG marks.
- `chart-legend-hover.tsx` (:44) — `useChartLegendHover` used by `series-markers.tsx`/`bar-squares.tsx` to hover-dim series from legend hover.
- `profit-loss-*`: `profit-loss-line.tsx` (190, gradient up/down line), `profit-loss-segments.ts` (123), `profit-loss-legend.tsx` (58) + `profit-loss-legend-hover.tsx` (29) — dedicated legend for PL charts (initiative 8 note: PL is built on Line family).

### 2.4 ChartBrush + BrushLayout (initiative 9)

`chart-brush.tsx` wraps `@visx/brush` (`onBrushEnd/onChange`, `brushDirection: "horizontal"|"vertical"|"both"`, `initialBrushPosition`, `useWindowMoveEvents`, `renderBrushHandle`, `selectedBoxStyle`, `handleSize`, `margin`); `chart-brush-handle.tsx` custom handle renderer; `chart-brush-selection-overlay.tsx` (`ChartBrushSelectionPattern`); `chart-brush-track-overlay.tsx` (mini strip styling, `BRUSH_TRACK_OUTER_FADE 0.15`); `chart-brush-layout.tsx` render-prop layout (`ChartBrushLayoutState {xDomain, xDomainSlotCount, brushSelection, onBrushSelectionChange}`, `enabled`/`fitMainContent`/`brushStrip`) driving **zoomed main chart** via `filter-data-by-x-domain.ts` (`resolveBrushTrackXExtent`, `xExtentMax` for projection horizon). Initiative 9 replaces `@visx/brush` with filter-state → definition swap; consumers Line/Area/Composed.

### 2.5 Markers + Series chrome (initiative 10)

- `markers/chart-markers.tsx`: `ChartMarkersProps {items: ChartMarker[], size? (28), showLines? (true), animate? (true)}` + `MarkerTooltipContent` (caps at 2 markers); `MarkerGroup` tooltip portal.
- `markers/marker-group.tsx` (520): `ChartMarker {date, icon, title, description?, content?, color?, onClick?, href?, target?}` + `MarkerGroupProps {x, y, ...}` — **`FAN_RADIUS = 50`, `FAN_ANGLE = 160`** (lines 11-12) drive the circular fan of stacked markers (`startAngle = -90 - FAN_ANGLE/2` line 158).
- Series chrome family: `series-markers.tsx` (`SeriesMarkersProps extends SeriesPointMarkerStyle {dataKey, fill?, animate?}`), `series-point-marker.tsx` (`SeriesPointMarkerStyle {fill?, stroke?, strokeWidth? (2), ringGap? (2), outlineWidth?, outlineColor?, radius? (5), fadeOnHover? (true), inactiveOpacity? (0.5), inactiveBlur? (2), enterBlur? (2), showActiveHighlight? (true)}`), `series-hover-dim.tsx`, `series-highlight-layer.tsx` (band highlight), `highlight-segment.tsx` + `highlight-segment-bounds.ts` + `use-highlight-segment.ts`, `series-dash-tail-overlay.tsx` + `dash-tail-stroke.tsx` + `path-stroke-utils.ts`, `line-series-terminal-marker.tsx` (94) — the `__isPostOverlay` dashed tail + terminal marker family.

### 2.6 PatternArea + BarSquares/BarDepth + misc (initiative 11)

- `pattern-area.tsx`: `PatternAreaProps {dataKey, fill (pattern url), curve?}` — `AreaClosed` with `fill: url(#pattern-id)`.
- `pattern-preset.tsx`: `PATTERN_PRESET_IDS` (8 ids), `PatternPresetOptions {color?, scale?, strokeWidth?, radius?, complement?, fill?, dotFill?, tileBackground?}`, `isCirclePattern`; rendered via `visx-pattern.tsx` (`PatternCircles`/`PatternLines` port, 33 lines).
- `bar-squares.tsx` (635): `BarSquaresProps {dataKey, yAxisId?, fill?, stroke?, squareGap? (3), squareRadius? (0.25), ...}` — per-datum stacked-square columns (`motion.rect` per square; `bar-squares-layout.ts` `computeSquareColumn`).
- `bar-depth.tsx` (1074): `BarDepthBack`/`BarDepthFront`/`BarPulse` drop-in 3D layers; `bar-depth-geometry.ts` `BAR_DEPTH_PERSPECTIVE_RATIO = 0.45` drives `depth`/`perspectiveRise`.
- `series-bar.tsx` (321) + `series-bar-layout.ts` (61): bklit's composed-series `<SeriesBar>` (migrated composed uses its own `seriesBarMark` — these control the bklit bar-widths + stacking negotiation).
- `scatter.tsx`/`candlestick.tsx`/`live-line.tsx`: the bklit **series** wrappers for those charts — migrated already has equivalent children carriers (`children.tsx` roles); audit confirms which props are still silently dropped.

### 2.7 Showcase shell + type-debt (initiative 12)

- `chart-defs.ts` (72): `getChartChildComponentName`, `isPatternDefComponent`, `isGradientDefComponent`, `isChartDefsComponent`, `partitionChartDefNodes`, `collectChartDefsChildren` — def-node extraction from children (migrated `gauge.tsx` handles a subset via `renderChartSvgWithResources`).
- `chart-child-passthrough.ts` (117): `CHART_CLIP_PASSTHROUGH` (:11), `isChartClipPassthrough` (:13), `resolveChartChildElement` (:22), `forEachChartChild` (:33), `isPostOverlayComponent` (:68), `isUnderlayComponent` (:93), `isClipExcludedComponent` (:103), `renderKeyedChartLayers` (:113) — the layering/ordering rules the projection + terminal-marker + dash-tail families depend on.
- `chart-center-typography.ts` (16) + `chart-stat-flow.tsx` (124, `ChartStatFlowFormat`, `defaultChartStatFlowFormat`) — center-stat typography/format; migrated islands (`center-stat.tsx`, `pie-center.tsx`, `ring-center.tsx`, `gauge-center.tsx`) partially cover (initiative 4 folds `chart-stat-flow` into the single tooltip/center-stat island).
- `motion-utils.ts` (`springOptionsFromTransition`, `transitionWithDelay`) — must NOT be ported as-is per stack-comparison §8.2; only the constant/transition→spring conversion logic survives inside the single spring module (05 family 1).
- `use-animated-series-path.ts` / `use-animated-y-domains.ts` — the two per-frame-React-render hot paths; explicitly **excluded** from migration (stack §8.2 / initiative 12 audit should only verify zero residual usage in migrated code).
- `decimate-time-series.ts` (`decimateTimeSeries`/`decimateOhlcData`/`maxRenderPointsForWidth`) — migrated `internal/decimate.ts` exists; initiative 12 verifies bklit parity of thresholds.
- Loading/skeleton (`loading-sweep`, `line-loading-pulse`, `line-loading-timing`, `area/bar/line-chart-loading`, `chart-loading-label`, `use-grid-shimmer`, `generate-chart-skeleton-data`) — initiative 3 owns the loading animation, initiative 12 owns the skeleton-data generators + showcase polish.

---

## 3. Cross-cutting layering dependencies (must be sequenced in plans)

1. **`chart-child-passthrough` layering** (family 7) is a prerequisite for the `__isPostOverlay` behaviors in **2.2 end-marker** and **2.5 dash-tail/terminal-marker** — its initiative (12) runs last, so initiatives 7/10 must either accept the current bklit layering contract as-is or negotiate a native equivalent inside their own plan.
2. **`pattern-preset`** (family 6) is consumed by **2.1 ReferenceArea `pattern`** and **2.3 Background** (initiative 3) — build the preset module in initiative 11 or pull it earlier into the design-tokens/defs layer; the plans must pick one owner to avoid a second fork.
3. **`y-domain registration`** (ReferenceArea extends the y-domain) interacts with initiative 1's `niceYDomain` consolidation and initiative 5's phase machine — initiative 6's plan must not re-touch gated utilities.
4. All magic values (FAN 160°, BRUSH 0.15, DEPTH 0.45, FADE 420, TICKER 60) route through the design-tokens module when their initiative runs — no inlining at call sites.