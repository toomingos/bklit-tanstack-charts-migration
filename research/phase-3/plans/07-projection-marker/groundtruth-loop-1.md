# Initiative 7 — ProjectionLine + TerminalMarker — GROUND TRUTH (pre-plan)

Status: Explore-agent survey persisted 2026-08-19 (lead not yet synthesized into plan-loop-1.md; do that at the initiative 7 boundary). All claims file:line-verified by the survey agent.

## Audit premise checks (`research/phase-3/audits/07-projection-marker.md`)

- Confirmed: absence in migrated (zero grep hits); auto/target/manual modes; linear/bezier geometry; gradient/dash styling; x+y domain extension; affected charts Line/Area/Composed only (the three `time-series-chart-shell.tsx` consumers).
- CORRECTIONS:
  1. bklit ships TWO distinct marker components: `LineSeriesTerminalMarker` (anchors at last DATA point; the one every demo uses) and `ProjectionLineEndMarker` (projection horizon dot; exported but used in ZERO demos). Not one "horizon marker".
  2. `ProjectionLine.showEndMarker` NEVER draws a dot — it only affects `resolveVisibleEndX` clamp padding. The dot code lives in the unused `ProjectionLineEndMarker`. bklit inconsistency; scope-reduction candidate (port type surface only?) — lead ruling needed.
  3. bklit uses hand-rolled `M…L` / `M…C…` path strings, not visx link/rule — the audit's "native link + custom mark" is a plan choice, fine, but `ScenePolyline.path` accepts the precomputed string directly.
  4. Brush/projection integration (x-axis tail ticks `x-axis.tsx:494-557,585-624`, brush track extent `chart-brush-layout.tsx:26` + `filter-data-by-x-domain.ts:46-59`) exists in bklit but migrated has NO brush at all, and bklit docs state "Projections and brush zoom are not supported together" (`chart-examples.tsx:3093`) → defer.

## ProjectionLine (`repos/bklit-ui/packages/ui/src/charts/projection-line.tsx`)

Props (:18-48, defaults at cited lines): `data: ProjectionPoint[]` (required, ≥2 else null render :187-189); `yAxisId` (→"left"); `stroke` = `"var(--chart-3)"` (:105); `strokeStyle: "solid"|"gradient"` = "solid" (:106); `gradientStart` = stroke (:123); `gradientEnd` = `"var(--chart-5)"` (:108); `strokeWidth` = 2; `curveKind: "linear"|"bezier"` = "linear"; `curve` (d3 CurveFactory, practically dead branch — only reachable via TS cast, falls to visx LinePath); `strokeDasharray` = `"6,4"`; `strokeOpacity` = 1; `showEndMarker` = true (resolved `showEndMarker ?? showEndpoints ?? true`, `showEndpoints` @deprecated); `endpointRadius` = 5; `className` → `"chart-projection-line"`.

Geometry: `resolveVisibleEndX(endX, innerWidth, endpointRadius, strokeWidth)` — `edgePadding = endpointRadius + strokeWidth*0.5 + 1` (endpointRadius counted only when showEndMarker), `visibleEndX = min(endX, max(0, innerWidth - edgePadding))`. Linear: `M startX,startY L visibleEndX,endY` (:179). Bezier: `buildHorizontalTangentBezierPath` (`projection-utils.ts:226-242`) — horizontal tangents both ends, `t = clamp(tension,0.05,0.5)` default 0.45, `c1x = x0+dx*t`, `c2x = x1-dx*t`, degenerates to line when |dx|<1e-6.

DOM (:201-229): `<g class>` + (gradient only) inline per-instance `<defs><linearGradient gradientUnits="userSpaceOnUse" x1=startX y1=startY x2=visibleEndX y2=endY>` 0%/100% stops, id = `useId()` sans colons + one `<path fill=none strokeLinecap="round" …>`.

Animation: NO motion/react. `showStroke = chartPhase ∈ {revealing, ready, exitingReady}`; when false the STROKE COLOR is swapped to `"transparent"` (not opacity). Reveal growth comes from the shell's clip-reveal: ProjectionLine is a plain child → `preOverlayChildren` INSIDE the reveal clip. No reduced-motion code.

## ProjectionLineEndMarker (`projection-line-end-marker.tsx`)

Props: `data` (required), `yAxisId`, `stroke` = var(--chart-3), `strokeOpacity` = 1 (used as FILL opacity), `radius` = 5. DOM: one `<circle r={radius*0.85} fill={stroke}>` at last projection point, edge-clamped (`edgePadding = radius+1`). Phase-gated same as ProjectionLine. `__isPostOverlay = true` (:65-67) → outside reveal clip. Used in ZERO demos.

## LineSeriesTerminalMarker (`line-series-terminal-marker.tsx`)

Props (:8-16): `dataKey` (required; last row value must be number else null render); `yAxisId`; `fill` = "transparent"; `stroke` = `"var(--chart-1)"`; `radius` = 5; `ringGap` = 0; `strokeWidth` = 1.5.

DOM (:61-85): `motion.g key={revealEpoch ?? 0}` (remount → replay on reveal), `initial {opacity:0, scale:0.55}` → `animate {opacity: visible?1:0, scale: visible?1:0.55}`, `transformBox:"fill-box"`, origin at (cx,cy); wraps `StaticSeriesPointMarker` (`series-point-marker.tsx:95-120` → `MarkerCircles` :48-87 = optional outline circle (off by default) + fill circle r=radius + stroke ring r=radius+ringGap+strokeWidth/2; default look = hollow ring).

Animation: real motion/react. `visible = chartPhase ∈ {ready, exitingReady}` — NARROWER than ProjectionLine (excludes revealing). `fadeTransition` = chart `enterTransition` if caller-supplied object, else HARDCODED `{duration:0.28, ease:[0.22,1,0.36,1]}` (≠ DEFAULT_CHART_ENTER_TRANSITION 1.1s [0.85,0,0.15,1]). No reduced-motion code. `__isPostOverlay = true` (:90-92).

## projection-utils.ts (full export surface)

- Types: `ProjectionMode "auto"|"target"|"manual"`, `ProjectionAutoMethod "linearRegression"|"lastSegment"`, `ProjectionCurveKind`, `ProjectionPathDensity "stepped"|"endpoints"` (@deprecated but "stepped" still live in code :168-188), `ProjectionPoint {date: Date; value: number}`.
- `buildProjectionPath(opts)` (:261-335): opts = `{sourceData, seriesKey, xDataKey="date", mode, autoMethod="linearRegression", pathDensity="endpoints", startIndex(=last), horizonPoints=6, endValue, points}`. manual → points verbatim (dates coerced). target → 2 points, `endTime = anchorTime + intervalMs*horizonPoints` at endValue (:244-258). auto → slope via least-squares over history (`linearRegressionSlope` :114-134) or last-segment delta; project `anchor + slope*intervalMs*i`. `intervalMs`: adjacent-rows delta → series-span average → 86_400_000 fallback (:65-112).
- `computeProjectionAnchorTangentSlope` (:190-223) standalone export.
- `buildHorizontalTangentBezierPath` (:226-242).
- `projectionValueExtents(paths)` (:338-360), `projectionDateExtents(paths)` (:363-386).

## projection-config.ts + shell wiring (domain extension)

- `ProjectionLineConfig {yAxisId: string; data: ProjectionPoint[]}` (:16-19); `extractProjectionLineConfigs(children)` (:50-92) — recursive walker (Fragment + clip-passthrough unwrap), matches by displayName string `"ProjectionLine"`, normalizes dates, requires data.length ≥ 2.
- `mergeProjectionYDomain` (:94-117) — widens [min,max] with the same 0-floor/10%-headroom/5%-padding logic as `resolveTimeSeriesYDomain`; `mergeProjectionXDomainMax` (:119-129).
- `time-series-chart-shell.tsx`: `projectionConfigs = useMemo(extract, [children])` (:279-282); xScale memo (:284-301) extends maxTime ONLY when no brush xDomain (comment :291-292); yDomainTargetByAxis (:337-371) widens per axis AND fabricates a [0,100]-based domain for a yAxisId referenced only by a projection.
- **This IS a y-domain extension — unlike ReferenceArea (init 6), projections DO widen x and y domains.** Migrated `internal/y-domain.ts` (`resolveTimeSeriesYDomain(data, series)`) will need a merge step; x-scale max likewise.

## Threading

All generic via `time-series-chart-shell.tsx` child bucketing (:433-454) — predicate-driven, not per-chart lists: `isPostOverlayComponent` (`chart-child-passthrough.ts:68-90`, checks `__isPostOverlay`/`__isChartMarkers` flags or displayName ∈ {ChartMarkers, MarkerGroup, ChartBrush}) → postOverlayChildren rendered AFTER overlay, OUTSIDE clip (:672-693); ProjectionLine → default preOverlayChildren INSIDE clip (:451-452, :687-691). Line/Area/Composed get identical support for free. `line-chart.tsx:71-80` `LINE_DOMAIN_EXCLUDED_NAMES` excludes "LineSeriesTerminalMarker" by name so its dataKey doesn't register as a series. LiveLine/Bar/Scatter/Candlestick: ZERO support in bklit (confirmed) — parity by omission.

## Demo API surface (parity gate)

`projection-line-demo.tsx` (2 demos) + `chart-examples.tsx:3041-3095`: LineChart + Grid + Line + `<LineSeriesTerminalMarker dataKey="value" ringGap={6} stroke="var(--chart-1)"/>` + two `<ProjectionLine curveKind="bezier" data={…} gradientStart/gradientEnd showEndMarker stroke strokeDasharray="1,4" strokeStyle="gradient" strokeWidth={2}/>` + XAxis + ChartTooltip. Data via `buildProjectionPath` target-mode (endValue 301, horizonPoints 6, pathDensity "endpoints") and auto-mode (autoMethod "lastSegment"). Second demo uses `showEndMarker={false}` variant + default ringGap.

## Migrated today

- Zero projection/terminal code (grep-confirmed). `children.tsx:24-33` role symbols (`Symbol.for("migrated.chartRole")`); extractChildren (:125-163) silently skips unknown roles; live-line extract (:292-316) would drop these (bklit parity — fine).
- Modules to consume: `internal/chart-phase.ts` (phase vocabulary byte-identical to bklit — predicates port directly); `internal/enter-transition.ts` (WAAPI keyframe pipeline — the vehicle for the terminal marker's 0.28s opacity/scale fade; NOT motion/react); `internal/area-fill-mark.ts` `areaFill()` = the createMark precedent for a precomputed-path mark; `internal/types.ts` `SeriesPointMarkerStyle` (:18-33, verbatim bklit port — type the marker props with it) and NOTE `LineConfig.dashFromIndex/dashArray` (:50-53) declared but UNCONSUMED (that's the init-10 dash-tail stub, not projection); `internal/fade-mask.ts` pattern of gradient stops as plain data.
- Gradient stroke: TanStack `SceneStyle` has no defs/gradients — use the established sibling-`<svg width=0 height=0><defs>` pattern from `area-chart.tsx:446-487` with per-instance id + userSpaceOnUse coords.
- TanStack natives: `ScenePolyline.path?: string` (types.ts:1222-1226) takes the precomputed M…L/M…C string directly; `SceneStyle.strokeDasharray` native (:1088-1098); `SceneDot` (:1242-1247) + `SceneGroup` (:1182-1212) compose the marker's fill-circle + ring-circle; no native gradient defs, no native motion.

## Open lead rulings for plan-loop-1

1. `ProjectionLineEndMarker`: port fully vs export-type-only (zero demo usage) — scope reduction candidate.
2. Post-overlay placement: marker renders outside the reveal clip, after overlay — decide whether migrated hosts render it in the hover/overlay chrome layer or a dedicated post-overlay SVG sibling.
3. Terminal marker fade excludes "revealing" phase (appears only at ready) + remounts on revealEpoch — must replay on reveal replay (WAAPI keyed on revealEpoch like the radar/sankey reveal fixes).
4. Domain extension goes into the migrated x-scale + `resolveTimeSeriesYDomain` merge step (REAL this time — contrast init 6 premise correction).
5. x-axis projection tail ticks + brush-track extent: defer (no brush in migrated; bklit says projections+brush unsupported together).
