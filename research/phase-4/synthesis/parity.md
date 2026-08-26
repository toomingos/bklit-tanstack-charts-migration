# Phase 4.2.1.1 — API Parity Synthesis: Migrated Parts vs Legacy (bklit)

> Lens: API parity of migrated chart parts vs the legacy bklit implementations.
> Sources: recovered phase-3 final row decisions (primary), phase-2 compile analysis, phase-1 reading verifications.
> FIX/ACCEPT entries are **leanings only** — final rulings happen in 4.3.1.

## Summary

**235 gaps** across 25 parts — **83 missing / 32 renamed / 21 extra / 99 behavior**; severity **8 high / 108 med / 119 low**.

Recurring family patterns (span many rows below, described once here): dropped default exports; `animationEasing` policy split (line consumes, area ignores, others absent); framer→structural `enterTransition` reshape; reveal-replay epoch (`revealSignature`/`playKey`) mostly unwired; multi-series `yAxisId` accepted-but-ignored; per-series loading controls cut; context/provider architecture (`*Provider`/`use*`) removed per family; mouse→pointer event modernization; added reduced-motion branches; measurement debounce dropped.

### Report corrections (verified claims superseding earlier reports)

1. internal-brush "orphan overlay stack" — **wrong**: ChartBrush/BrushLayout live via D228 children-element composition (line-chart.tsx:950–973) + public barrel + bench scenario.
2. area `showMarkers`/`markers` "missing" — **wrong**: runtime-consumed via casts; type-declaration gap only (A3).
3. composed `SeriesBar.stroke` "missing" — **wrong**: carried in types (types.ts:259), host resolves it, chrome consumes merged stroke; mark emits fill-only.
4. line loading skeleton "invented waveform" — **wrong**: formula bklit-verbatim per D213/D214 — not a gap.
5. Grid `horizontal` resolved against legacy source: component default `true` (grid.tsx:97); migrated resolver defaults false (grid.ts:33). Legacy shells never render `<Grid>` internally (consumer-supplied child), so prop-less `<Grid />` loses all horizontal lines — HIGH confirmed; bench/QA scenarios pass `<Grid horizontal />` explicitly so gates are blind.

Top 5 by severity/risk (recovered final ranking): composed `stacked` silently unstacked; sankey `labelOrientation` default flip; Grid `horizontal` default loss; choropleth palette sequential→categorical; multi-series `yAxisId` ignored.

## Main parity table

| ID | Part | prop/export | Gap | Legacy behavior | Migrated behavior | Sev | Suggested FIX or ACCEPT |
|---|---|---|---|---|---|---|---|
| L1 | line | `enterTransition` | missing | Prop drives entrance tween | Absent | med | FIX-stub — accept+ignore preserves swap signature; WAAPI path already fixed-tween |
| L2 | line | `revealSignature` | missing | Replay epoch input | Absent | med | FIX-stub — orchestrator already takes the field; wire through |
| L3 | line | default `export` | missing | Default export shipped | Named-only | low | FIX — one-liner |
| L4 | line | `Line`/`LineProps` re-export | renamed | Re-exported component+props | `LineConfig` carrier; null carrier in children.tsx | low | ACCEPT — documented carrier architecture |
| L5 | line | `<Line>` `loading`/`loadingPulseMode`/`onLoadingPulseCycleComplete`/`loadingStyle` | missing | Per-series pulse/sweep control | Chart-level pulse only | med | FIX or formal deprecation — see loading OQ |
| L9 | line | `loadingStroke`/`loadingStrokeOpacity` | behavior | Consumed by loading chrome | Typed, accepted-inert | med | FIX — forward to LineLoadingPulse or drop from type |
| **L10** | line | `yAxisId` per-series | behavior | Per-axis scales via `buildYScalesFromDomains` | Accepted (typed) but single niced domain for all series | **high** | OPEN — single-axis ACCEPT+strip-types vs implement; silent wrong renders today |
| L11 | line | `xDomainSlotCount` | behavior | Slot-count column-width stability under brush | Accepted, unused | low | FIX-trivial (pass to brush layout) or ACCEPT |
| L12 | line | `earlyRenderData` | behavior | n/a (internal) | Computed then voided (dead) | low | FIX — delete |
| L14 | line | reduced-motion read | behavior | Reactive hook (framer `useReducedMotion`) | One-shot matchMedia in render callback | low | FIX — use shared hook |
| A1 | area | default `export` | missing | Default export shipped | Named-only | low | FIX |
| A2 | area | `animationEasing` | behavior | Prop drives reveal easing | Accepts-and-ignores (fixed REVEAL_EASING) | med | FIX — consume like line does |
| A3 | area | `<Area>` `showMarkers`/`markers` on `AreaConfig` | missing (type-only) | Typed props | Runtime-consumed via untyped casts; absent from type | med | FIX — declare on type (report "missing" corrected: works at runtime) |
| A4 | area | `<Area>` `showLine` | missing | Boundary-line toggle | Always rendered | med | FIX — cheap conditional (or deprecate loudly) |
| A5 | area | `<Area>` `gradientToOpacity`/`gradientSpan` | missing | 2–3-stop gradient shaping | Fixed 2-stop | med | FIX (stop-list math) or ACCEPT-document |
| A6 | area | `<Area>` `animate` | missing | Deprecated no-op toggle | n/a | low | ACCEPT — neither impl morphs paths |
| A7 | area | `<Area>` loading ×5 (`loading`, `loadingPulseMode`, …) | missing | Pulse/sweep chrome | Empty grid + label | med | Fold into loading OQ ruling |
| A8 | area | `fadeEdges` `"left"`/`"right"` | behavior | Directional masks | Only all-true aggregate; directional unreachable | med | FIX — apply attr per-side; D13c partial precedent |
| A9 | area | `touchAction: none` | behavior | Set on container | Not reproduced | low | FIX — one style line |
| A10 | area | `AreaChartLoading` | missing | Skeleton preset export | Not migrated | med | FIX (compose from existing parts) or de-scope |
| A11+A12 | area | `PatternArea` `patternPreset`/`patternColor`; `patternAreaMark` | extra | Raw `url(#id)` fill | Convenience props + extra mark | low | ACCEPT — additive, ruled (plan §10) |
| B1 | bar | `animationEasing` | missing | Prop drives easing | Absent | med | FIX-stub |
| B2 | bar | `enterTransition` | missing | Framer transition passthrough | Absent | med | FIX-stub |
| B3 | bar | `revealSignature` | missing | Replay epoch input | Absent | med | FIX-stub |
| B4 | bar | `orientation` | missing | `vertical \| horizontal` bars | Documented vertical-only pilot | med | 4.3 ratify scope vs parity — largest pilot cut (final tally grades below initial HIGH) |
| B5 | bar | `stacked`/`stackGap`/`barWidth`/`squareSnap` | missing | Full prop surface | Grouped pilot cuts; hardcoded vertical-grouped | med | Ratify pilot scope or loud-fail on set |
| B6 | bar | `status` (loading skeleton branch) | missing | Skeleton state | Absent | med | Cross-ref loading OQ |
| B7 | bar | `<Bar>` `yAxisId` | missing | Per-series axis binding | Absent | med | Cross-ref multi-axis ruling (L10) |
| B8 | bar | `<Bar>` `animate`/`animationType`/`staggerDelay`/`stackGap`/`groupGap`/`perspective`/`minBarHeight` | missing | Tunables | Fixed behaviors (= bklit defaults: auto-stagger dur·0.4/n, GROUP_GAP 4, depth-auto trim) | med | ACCEPT-document (values equal defaults) or re-add staggerDelay/groupGap |
| B9 | bar | `BarProps`→`BarConfig` | renamed | `BarProps` | Renamed carrier | low | ACCEPT |
| B10 | bar | `BarSquares.yAxisId` | missing | Axis binding | Absent | med | Cross-ref multi-axis ruling |
| B11 | bar | `BarDepthProvider.segmentsAccessor`/`minBarHeight`; `BarDepthBack.colorAccessor` | behavior | Consumed by depth paths | Typed but ignored | med | FIX — wire or strip |
| B12 | bar | `BarXAxis.tickerHalfWidth` | behavior | Forwarded to ticker | Accepted-not-forwarded (token equal today) | low | FIX — forward |
| B13 | bar | `BarYAxis` | missing | Horizontal-label overlay axis | Absent | med | FIX (port) or de-scope with `orientation` |
| B14 | bar | `BarChartLoading` | missing | Skeleton preset | Absent | med | Cross-ref loading OQ |
| B15+B16 | bar | `useBarDepthEntries`; `BarOrientation`/`BarAnimationType`/`BarLineCap`/`BarDepthEntry`/`BarDepthSegment`/public `GradientStop`/`SquareColumn*` types; `computeSquareColumn`/`topSquareCenterY` demotion | missing/renamed | Exported helpers/types | Absent or demoted internal | low | FIX re-exports; ACCEPT demotions |
| B17 | bar | BarPulse wave | behavior | Infinite WAAPI translateY wave on silhouette | Static white silhouette; wave constants voided; animated overlay orphaned | med | FIX — port loop into mark or wire overlay |
| B18–20 | bar | phantom `(state as {bandWidth?})` read; `barTrimmedMark` dead voids; duplicated `dateLabelsForPill` | behavior | Single sources | Phantom never populated (ring sizing always gap-4); dead code; hand-rolled formatter | low | FIX — hygiene batch |
| B21+B22 | bar | frozen-key coupling (depth suffixes ↔ chrome regex); module-level `gradientCounter` | behavior | Single source | Deliberate coupling; module state | low | ACCEPT (documented contract); FIX counter scoping |
| C1 | composed | `displayName` | missing | Set for devtools | Unset | low | FIX |
| C2 | composed | default `export` | missing | Default export shipped | Named-only | low | FIX |
| C3 | composed | `animationEasing` | missing | Drives easing | Absent | med | FIX-stub |
| C4 | composed | `enterTransition`/`revealSignature` | missing | Transition + replay epoch | Absent | med | FIX-stub |
| **C5** | composed | `stacked` | behavior | Stacked-sum branch when set | ALWAYS renders unstacked (silent wrong encoding) | **high** | FIX or remove prop — silent wrong data render; 4.3 ruling |
| C6 | composed | `stackGap` | behavior | Accepted (default 0) | Absent from interface though header claims accepted | med | FIX — align header/types |
| C8 | composed | `SeriesBar.animate` | missing | Reveal toggle | Dropped | med | FIX-stub (gate reveal) |
| C9+C10 | composed | `fadedOpacity`→chrome state; `seriesBarMark` option renames | renamed | Per-series prop; option names | Chrome-state `bars[].fadedOpacity`; internal renames | low | ACCEPT — effect preserved via chrome |
| C11 | composed | `dimOpacity` | behavior | Per-series (area 0.6 / line 0.3) | Chart-wide 0.3 (areas under-dim) | med | FIX — thread per-series dim |
| C12 | composed | `<Area>` `fadeEdges` | behavior | Applied | Ignored | med | FIX |
| C13+C14 | composed | dead `computeSeriesBarRevealClipPadding`; per-entry `yAxisId` dropped | behavior | Used / stored | Dead / dropped (projections use separate role) | low | ACCEPT cleanup; yAxisId → L10 ruling |
| C15 | composed | terminal/end-anchor math | behavior | Shared | Duplicated ×3 | low | FIX — extract helper |
| S1 | scatter | `animationEasing` | missing | Drives easing | Absent | med | FIX-stub |
| S2 | scatter | `enterTransition` | missing | Transition passthrough | Absent | med | FIX-stub |
| S3 | scatter | `revealSignature` | missing | Replay epoch | Absent | med | FIX-stub |
| S4 | scatter | default `export` | missing | Shipped | Named-only | low | FIX |
| S5 | scatter | `ScatterProps`→`ScatterConfig` | renamed | `ScatterProps` | Renamed carrier | low | ACCEPT |
| S6 | scatter | `<Scatter>` `yAxisId` | missing | Per-axis binding | Absent | med | Cross-ref multi-axis ruling |
| S7 | scatter | `<Scatter>` `animate` | missing | Reveal toggle | Absent | med | FIX-stub |
| S8 | scatter | `<Scatter>` `yGradient` | missing | Vertical red→green per-point gradient | Not ported | med | FIX or waive (niche) — 4.3 call |
| S9 | scatter | `fadeOnHover`/`inactiveOpacity`/`inactiveBlur`/`enterBlur` | missing | Tunable hover/entrance blur | Fixed at bklit defaults | med | FIX (plumb constants) or ACCEPT-document |
| S10 | scatter | `showActiveHighlight`/`outlineWidth`/`outlineColor` | missing | Tunable active dot styling | Fixed at defaults | med | FIX — outline plumb cheap |
| S11 | scatter | drag-select / two-finger range selection | missing | Selection state + `clearSelection` + touch preventDefault | TanStack focus-only | med | FIX — `useChartSelection` exists; wire (or waive) |
| S12 | scatter | `_tooltipBoxSpring` | behavior | Honored override | Voided (option dead) | low | FIX |
| S13+S14 | scatter | hoveredIndex never set; duplicated yDomain/timeExtent memos; `gradientCounter` | behavior | n/a | Declared-but-unset; identical memos ×2 | low | FIX hygiene |
| K1 | candlestick | `xDomain`/`xDomainSlotCount` | missing | Brush shared-scale scenario support | Not migrated | med | ACCEPT per D227 deferral — cross-ref brush scope ruling |
| K2 | candlestick | `OHLCDataPoint`→`ChartDatum` | renamed | Typed OHLC union | Generic datum | low | ACCEPT — document type map |
| K3 | candlestick | default `export` | missing | Shipped | Named-only | low | FIX |
| K4 | candlestick | `enterTransition` narrowed | renamed | Full framer Transition | Spring-subset only (tween dropped) | med | FIX (sampled keyframes) or ACCEPT-document — 4.3 family ruling |
| K5-cluster | candlestick | revealSignature widened; `isolation:isolate`; solid-vs-gradient default fills; hover-dim restructure | behavior | Narrower epoch; no isolate; gradient fills; per-candle dim | Wider epoch; isolate added; solid fills; group dim + overlay rects (Q1-gated) | low | ACCEPT — pixel-gated / benign deltas |
| K7 | candlestick | `Candlestick.animate` | behavior | Gates reveal path | Reserved-for-parity, inert | med | FIX — gate reveal |
| K9 | candlestick | `bodyPatternPositive`/`bodyPatternNegative` | missing | Pattern-overlay body fill | Solid fills only | med | FIX — pattern-preset module exists (or de-scope loudly) |
| K10 | candlestick | `insideStrokeWidth` | behavior | Inner inset stroke on body | Resolved-not-consumed | med | FIX — render inset rect |
| K12+K13 | candlestick | dual reveal paths; scale math ×4; two pill date formats; `_tooltipBoxSpring` voided | behavior | Single sources | Deliberate ×4 + duplicates | low | FIX hygiene |
| V1 | live-line | `LiveYAxis` `position="right"` | behavior | Both sides rendered | Accepted; only "left" implemented (types carve-out) | med | FIX or document carve-out |
| V2 | live-line | `detectMomentum`/`Momentum` exports | missing | Public barrel exports | Internalized | med | FIX — re-export |
| V3-cluster | live-line | children optional; paused-commit pixel gate; stricter role matching; `ariaLabel`; CSS scrub-dim; dedupe path | extra/behavior | Children required; 32ms clock commits; aria-hidden; motion.g | Optional children; sub-quarter-px gate; demand re-arm; canvas snapshot; ariaLabel added | low | ACCEPT — disclosed perf workarounds |
| V4+V9 | live-line | wake-loop redundant branches; void `input.width`; undocumented arg | behavior | Single path | Redundant branches; dead param | low | FIX hygiene |
| P1 | pie | `style` prop | extra | Absent | Added | low | ACCEPT |
| P2 | pie | `enterTransition` reshaped | renamed | motion/react `Transition` passthrough | Structural `{tween\|spring}` alias (same fallback timing); framer-only fields dropped | med | 4.3 family ruling — structural accept + doc |
| P3 | pie | `DEFAULT_HOVER_OFFSET` | missing | Barrel-exported const | Module-local only (verified) | med | FIX — one-line barrel add |
| P4 | pie | `defaultPieColors`/`pieCssVars` | missing | Exported | Unexported | low | FIX |
| P5 | pie | `PieProvider`/`usePie`/`usePieStable`/`usePieHover`/`PieContextValue` | missing | Context architecture exposed | Removed | med | Barrel-policy tiering OQ — deep-import consumers break |
| P6 | pie | `PieCenterShell`(±Props) | missing | Center-content wrapper exported | Removed | med | FIX (thin wrapper) or de-scope |
| P7 | pie | `PieSlice.className` | behavior | Dead in legacy too | Dead in migrated | low | ACCEPT — dead-code parity (D49-class) |
| P8+P10 | pie | `pointerenter/leave` vs mouse events; container styling approach | behavior | `mouseenter`/`mouseleave`; cn/grid stacking | Pointer events; inline styles/absolute overlay | low | ACCEPT — global event-model ratify + disclosed styling |
| P9 | pie | resize measurement debounce | behavior | ParentSize debounceTime=10ms | Undebounced `useMeasuredRect` (0.5px ε) | low | ACCEPT — foundation consolidation; FIX-cheap note |
| P11+P12 | pie | stale D49 header comment; orphaned `.ts-bkm-pie-center` CSS | behavior | Accurate | Comment drift; dead rules | low | FIX comments/CSS |
| R1 | ring | `enterTransition` narrowed | renamed | Full framer Transition | Structural subset | med | 4.3 family ruling (as P2) |
| R2 | ring | `useRingStable` payload reduced | behavior | Payload incl. hoveredIndex/animationKey/isLoaded/containerRef | Geometry+data only | med | 4.3 — restore fields or version hook |
| R3 | ring | `useRingHover`→`useRingHoverCoordinator` | renamed | React-context hover pair | Imperative store get/request/set/subscribe | med | 4.3/doc — documented store contract; rename breaks consumers |
| R4 | ring | `useRing` | missing | Combiner hook exported | Absent | med | FIX — combiner over two hooks |
| R5 | ring | `RingProvider`/context types/cssVars/colors | missing | Exposed surface | Unexported | med | Barrel-policy OQ (tiering) |
| R6 | ring | default exports ×2 | missing | Shipped | Named-only | low | FIX |
| R7 | ring | `RingCenter` orphan displayName coupling | behavior | n/a | Orphan check relies on displayName string match | med | FIX — import module for symbolic check |
| R8 | ring | deprecated `groupEl` shim | behavior | Present | Kept shim | low | FIX — delete after caller audit |
| R9-cluster | ring | `style` extra; fake-Animation seeding; scrub mode exits TanStack to plain SVG; dead fade/glow parity ports | extra/behavior | n/a | Documented in-file workarounds; observed-pixels ports | low | ACCEPT — D19/D49 precedents, deliberate |
| G1+G2 | gauge | `GaugeEnterTransition` extra; `formatOptions` type renamed | renamed/extra | Absent / ChartStatFlowFormat | Added / CenterStatFormat alias | low | ACCEPT |
| G2 | gauge | children-as-defs honored linear-only | behavior | Caller `<linearGradient>`/`<pattern>` JSX works both orientations | Arc discards defsChildren (TanStack gradients = stop lists) | med | FIX — mount defsChildren into overlay svg on arc (flagged for Fable) |
| G3 | gauge | fixed-size arc routing | behavior | Fixed-size arc = bare inline-flex, no cap | Forced through aspect-[21/16] wrapper with max-w-560 | med | FIX — bypass wrapper when width && height given |
| G4 | gauge | `geometryScrubbing` Omit on arc | renamed | Accepted-but-ignored | Honest typing (omitted from arc props) | low | ACCEPT — honest typing |
| G5 | gauge | measurement debounce | behavior | Debounced ~10ms | Undebounced | med | ✅ **DONE 2026-08-25 — row was stale, verified closed.** `gauge.tsx:388` calls `useDebouncedContainerSize(containerRef)` (imported `:157`); the hook is `internal/use-container-size.ts:108`. Note the file is `gauge.tsx`, **not** `gauge-chart.tsx` — that name does not exist and a grep for it returns nothing, which is how this row stayed "open" on paper. Five charts now measure through the shared hook: gauge, line, pie, radar, ring (P9/P4.3). |
| G6 | gauge | stale headers | behavior | Accurate | focus-disabled claim wrong; gauge-arc-mark CSS refs dead | low | FIX — comments |
| G7-cluster | gauge | left/right overflow quirk preserved; reduced-motion idiom; positional reveal keys; D82 taper approximation | extra/behavior | Same quirks in legacy | Preserved verbatim / equivalent DOM-order keys | low | ACCEPT — quirks verbatim; D82 already ruled |
| RD1 | radar | `RadarEnterTransition` renamed subset | renamed | Full framer Transition | Structural subset | med | 4.3 family ruling |
| RD2 | radar | default exports ×6 | missing | Shipped | Named-only | low | FIX |
| RD3 | radar | `radarCssVars`/`defaultRadarColors` | missing | Exported | Unexported | low | FIX |
| RD4 | radar | `RadarProvider`/`useRadar*`/context types | missing | Exposed context architecture | Removed | med | Barrel-policy tiering OQ |
| RD5 | radar | area campaign base delay | behavior | `(levels·gridStagger + 0.2)·factor` | `(5·gridStagger·0.5 + 200)·factor` — starts ~200ms early at defaults | med | FIX — restore bklit formula |
| RD6 | radar | axis-label entrance spring | behavior | Springs x/y outward (80/15) + 0.5s fade | Opacity-only (labels placed statically) | med | FIX if cheap (transform tween); else ACCEPT-document |
| RD7 | radar | grid ring strokeLinecap | missing | LineRadial round caps | Butt caps | low | FIX — one attr |
| RD8-cluster | radar | stagger knob superset; `ariaLabel` a11y; pointer events | extra/behavior | Raw i-based knobs ignored by legacy; aria-hidden; mouse | staggerScale·durationFactor applied (equal at defaults); ariaLabel; pointer | low | ACCEPT — superset at defaults; modernization |
| RD9 | radar | dot-radius hover spring→instant | behavior | r=6 spring | Instant setAttribute + CSS opacity | low | ACCEPT (FIX-cheap note) |
| SK1 | sankey | `labelOrientation` default | behavior | Unset ⇒ `"horizontal"` (sankey-node.tsx:314) | Unset ⇒ `"vertical"` (sankey-chart.tsx:386) | **high** | FIX — one-line default restore (verified) |
| SK2 | sankey | `hoveredNodeIndex`/`onNodeHoverChange` | missing | Controlled node hover (legend-driven highlight) | Dropped | **high** | FIX — coordinator supports controlled mode |
| SK3 | sankey | `SankeyLink.getNodeColor`/`getLinkColor`/`patterns`/`getLinkPattern` | missing | Gradient/solid overrides + visx patterns | Node-level getNodeColor/default palette only | med | FIX or de-scope loudly |
| SK4 | sankey | `SankeyTooltip.nodeContent`/`linkContent` | missing | Custom renderer escape hatch | Fixed hand-rolled layout | med | FIX or de-scope |
| SK5 | sankey | `SankeyProvider`/`useSankey`/`SankeyContextValue`/`SankeyTooltipData`/`sankeyCssVars` | missing | Exposed surface | Removed | med | Barrel-policy tiering OQ |
| SK6 | sankey | reveal replay trigger | behavior | Epoch keyed [duration, revealSignature] | Adds data identity → new arrays replay reveal | med | FIX — key on signature+duration only (D226 nuance) |
| SK7 | sankey | tooltip dot colors | behavior | node `--chart-line-primary`, link `--chart-foreground-muted` | Both `var(--chart-1,#7c3aed)` | med | FIX — restore legacy tokens |
| SK8 | sankey | node tooltip value source | behavior | d3-computed `node.value` | Recomputed category sum (equal well-formed) | med | FIX — prefer node.value |
| SK9 | sankey | `enterTransition` reshaped | renamed | Framer Transition | Structural subset | med | 4.3 family ruling |
| SK10 | sankey | label entrance slide | behavior | ±8px slide-in | Fade-in-place | low | FIX-cheap or ACCEPT |
| SK11-cluster | sankey | reduced-motion skip; palette hex fallbacks; normalized dash technique; imperative hover wiring | extra/behavior | Bare vars; getTotalLength dash; localPoint | Hardened vars; pathLength dash; client coords | low | ACCEPT — output-parity gated |
| SB1 | sunburst | `playKey` | behavior | Replays reveal on change | Ignored (reveals once/mount) | med | FIX — wire playKey to reveal epoch |
| SB2 | sunburst | `enterTransition`/`enterStaggerScale` | missing | Tuned entrance | Dropped | med | FIX-stub/plumb |
| SB3+SB16 | sunburst | `onPhaseChange` callback; center button semantics | extra | Absent / div button | Added / real `<button>` semantics | low | ACCEPT — additive improvements |
| SB4 | sunburst | `Hint` render-prop + `SunburstHintContext` | missing | Caller-controlled hint text/context | Fixed internal strings | med | FIX — small passthrough surface |
| SB5 | sunburst | `ArcGeometry` type | missing | Exported type | Unexported | low | FIX — re-export |
| SB6 | sunburst | `SunburstProvider`/hooks/context types | missing | Exposed surface | Removed | med | Barrel-policy tiering OQ |
| SB7 | sunburst | `sunburstCssVars`/colors/`opacityForRelativeDepth` | missing | Exported helpers | Unexported | low | FIX |
| SB8 | sunburst | `SunburstBreadcrumb` family | missing | Breadcrumb component/hook/items | Absent | med | Scope ruling — port or cut formally |
| SB9 | sunburst | geometry util block internalized | renamed | Deep-importable utils | Internal-only | med | FIX — re-export shims (deep-import breakage) |
| SB10+SB11 | sunburst | `buildSunburstEnterTiming`→`buildRevealTiming`; deprecated timing fns dropped | renamed | Old names + deprecated fns | Renamed; dropped | low | ACCEPT — documented renames |
| SB12 | sunburst | labels on hover | behavior | Unrelated arcs culled | All kept, dimmed 0.25 (header claims cull — mismatch) | med | FIX cull + header |
| SB13 | sunburst | center radius at commit | behavior | Interpolates | Snaps at commit | low | FIX (interpolate) |
| SB14 | sunburst | zoom commit timing | behavior | Commits immediately | Commits after animation completes | med | FIX — commit immediately (midpoint-snapshot nuance) |
| SB15 | sunburst | svg fade-in; svg-level pointerleave | behavior | 350ms fade; hover clears on svg exit | Neither reproduced | low | FIX cheap |
| SB17+SB18 | sunburst | generator accessor stubs; `maxRevealDelayMs` recompute dup | behavior | Real accessors; single | Stubs; duplicated | low | FIX/ACCEPT hygiene |
| HM1+HM3 | heatmap | `colorScale` signature; `columnSeparators` type | renamed | Wider signature; `HeatmapSeparatorParsedConfig` | Narrowed; `HeatmapColumnSeparatorsConfig` | low | ACCEPT — documented renames |
| HM2 | heatmap | `enterTransition` renamed subset | renamed | Framer Transition | Structural subset | med | 4.3 family ruling |
| HM4 | heatmap | `HeatmapCells.colorScale` | behavior | Consumed | Typed, unread | low | FIX — strip or honor |
| HM6 | heatmap | separator stroke default | behavior | `var(--border)` | `var(--chart-grid-line, currentColor)` (diverges only if var undefined) | low | FIX — restore `var(--border)` |
| HM7 | heatmap | separator gradient id | behavior | useId-derived unique | Static string — collides across instances | med | FIX — useId one-liner |
| HM8 | heatmap | `HeatmapInteractionBoundary` classes; `Root` nesting | behavior | cn base classes; conditional provider | Dropped; always nests | low | FIX — restore classes |
| HM9+HM12 | heatmap | `HeatmapProvider` unexported; `levelColorsFromStyles`/`levelStylesFromColors` missing | missing | Public surface | Absent | med | FIX re-export wrappers / barrel-policy OQ |
| HM10 | heatmap | `heatmapCssVars` | missing | Deprecated legacy export | Dropped | low | ACCEPT — deprecated in legacy |
| HM11 | heatmap | helper/util block (~44 fns + 10 consts) not re-exported | renamed | Deep-importable surface | Internalized | med | FIX — barrel shims (biggest single surface) |
| HM13 | heatmap | loading shimmer pulse | behavior | Random per-cell opacity loop | Static skeleton; constants retained inert | med | 4.3 ruling — port or declare cut |
| **HM14** | heatmap | pattern fills; `pattern*` props | behavior | HeatmapPatternDefs/renderPatternPreset fills | Always solid; props typed-but-unread; fillOpacity forced 1 | **high** | FIX — wire pattern-preset module or strip props (props currently lie) |
| HM-cluster | heatmap | YAxis positioning (`right:4` span); ghost bins kept; binSize param optional | behavior | Flex boxes; ghosts removed | Different positioning; invisible ghosts kept | low | ACCEPT — pixel-gated |
| HM16 | heatmap | highlight ring on hovered cell | extra | Scale/dim only | +1.5px outline ring (strokeOpacity .5) | low | ACCEPT w/ Fable sign-off note — visible migrated-only addition |
| HM17 | heatmap | tooltip reimplemented | behavior | Shared TooltipBox (flip+spring) | Local panel; instant clamps via 180×80 estimates; dup JSX | low | FIX estimates via measured box; dedupe |
| HM18+HM19 | heatmap | binSize param handling; levelStyles ×3 duplication | behavior | Single source | Optional param; triplicated | low | FIX hygiene |
| F1 | funnel | `FunnelEnterTransition` renamed | renamed | Full framer Transition | Structural subset | med | 4.3 family ruling |
| F2 | funnel | no defineChart/Chart wrapper | behavior | Standard chart architecture | Plain SVG (D30 GAP-chart escape clause) | med | Fable ruling; leaning ACCEPT per D30 |
| F3 | funnel | `hoverInputsRef` dead ref | behavior | n/a | Computed then unused | low | FIX — delete |
| F4 | funnel | reduced-motion guards inline | extra | Always tween | matchMedia skips fades | low | ACCEPT behavior; FIX hygiene — use shared hook |
| F5–F8 | funnel | pointer events; segment mechanism simplification; typography CSS; ring keys | extra/behavior | Mouse events; motion variants; NumberFlow-ish; positional | Pointer; CSS tweens; CSS text; DOM keys | low | ACCEPT — disclosed deltas |
| CH2 | children | `CHART_CLIP_PASSTHROUGH`→`CHART_CHILD_PASSTHROUGH` | renamed | Old symbol name | Renamed symbol | low | FIX alias or ACCEPT-document (internal contract) |
| CH3 | children | `<Grid>` `numTicksRows`→`numTicks` | renamed | Row-density knob | Renamed (single-axis reality) | med | FIX — accept both names |
| CH4 | children | `<Grid>` `numTicksColumns` | missing | Column-density knob | Absent (vertical density unplumbed) | med | FIX — plumb vertical density |
| CH5 | children | `XAxis.tickerHalfWidth`/`tickMode` | missing | Hover-fade radius + data/domain tick modes | Fixed data-mode | med | FIX (tickMode domain) or de-scope |
| CH6 | children | `XAxis.formatValue` | extra | Absent | Added formatter | low | ACCEPT — additive |
| CH7 | children | `YAxis`/`LiveYAxis` orientation right | behavior | Both sides rendered | Accepted, "right" unimplemented | med | Cross-ref V1 + multi-axis ruling |
| CH13 | children | `<Background>` child | missing | Wired background module | Orphan module unwired | med | FIX — wire background.tsx or de-scope |
| CH14+CH16 | children | legend children slot absent; `CurveFactory` narrowing | missing/renamed | Slot accepted; wide factory type | Absent; narrower curve type | low | ACCEPT |
| CH17 | children | export drift block | missing | Aligned re-exports | Drifted set | low | FIX — audit re-exports (barrel-policy fold) |
| CH18 | children | role strings | behavior | Single source | Triple-synced across files | low | FIX hygiene |
| CH-accept | children | architecture extras: ChartTooltip props, `__isPostOverlay`, `maxFanned`, enabled:true injection, passthrough extras | extra | Absent | Added internal affordances | low | ACCEPT — additive internals |
| SG1+SG2 | segment | carrier inversion; exit-fade mechanism | behavior | Segment carriers inside overlay | Inverted carriers; different fade mechanism | low | ACCEPT — architecture (D220-class), output-gated |
| SG3–SG7 | segment | reduced-motion branches; stop-color attrs; deterministic ids; `ChartSelectionContext` export; SegmentComponent ×2 dup | extra/behavior | Always tween; computed ids; no context export | matchMedia skips; explicit attrs; stable ids; exported; dup component | low | ACCEPT deltas; FIX dup |
| RA1 | reference-area | `className` | behavior | Applied (`className ?? "chart-reference-area"`, styles existed) | Carrier captures; `ReferenceAreaLayers` never forwards; no CSS counterpart | med | FIX — forward className |
| RA2 | reference-area | `yAxisId` | behavior | Per-axis scale resolution | Single scaleLinear from one yDomain | med | Cross-ref multi-axis ruling |
| RA3 | reference-area | registration context | missing | In-tree registration | Internalized (no public break) | low | ACCEPT |
| RA4 | reference-area | `computeReferenceAreaRect`/`ReferenceAreaRect` | missing | Barrel-exported | Internal-only | med | FIX — re-export (API surface) |
| RA5+RA6 | reference-area | animation channel; zIndex:-1 underlay location | behavior | In-tree motion.g | Gated channel; underlay (0.0017% delta) | low | ACCEPT — D220 ruled |
| RA7–RA9 | reference-area | inline Symbol.for re-derivation; void `extractReferenceAreaConfigs` (composed); `String(v)` cast; dead bandWidth/_xDataKey | behavior | Imports / used | Inline/dropped/loose/dead | low | FIX hygiene batch |
| CP1 | choropleth | `enterTransition` typed unknown | behavior | Drove tween | Typed `unknown`, never read | med | FIX-stub |
| CP2 | choropleth | `revealSignature` | behavior | Replay epoch | Never read; fixed 1100ms reveal | med | FIX — wire epoch |
| CP3 | choropleth | `patterns` prop | behavior | defs passthrough mounted | Never mounted; getFeaturePattern urls dangling | med | FIX — render defs or strip props |
| CP4 | choropleth | default `formatValue`; fallback name; index arg | behavior | en-US ints; ``Feature ${i}``; real index to content/getFeatureName | Compact M/K; `"Feature"`; constant −1 | med | FIX — restore intFmt + real index |
| CP5 | choropleth | fallback name | behavior | Indexed fallback | Bare "Feature" | low | FIX trivial |
| CP6 | choropleth | `content`/`getFeatureName` index arg | behavior | Real feature index | Constant −1 | med | FIX — pass real index |
| CP7 | choropleth | tooltip mechanics | behavior | TooltipBox flip+spring; instant unmount | Fixed x+16 centered; +200ms exit fade | low | FIX flip if cheap; ACCEPT fade (improvement) |
| CP8 | choropleth | `ChoroplethProvider`/`ChoroplethTooltipData`/`choroplethCssVars`/`defaultChoroplethColors` | missing | Public surface | Removed | med | Barrel-policy tiering OQ |
| CP9 | choropleth | `useChoropleth()` contract | behavior | Full stable context | Collapsed to `{width,height}` | med | FIX — restore fields consumers need or version hook |
| CP10 | choropleth | `useChoroplethZoom` | behavior | + isDragging/transformMatrix | Narrowed subset | med | FIX — expose fields |
| **CP11** | choropleth | default palette tokens | behavior | Sequential `--chart-scale-01..05` cycle | Categorical `--chart-1..5` cycle (wrong character for magnitude maps) | **high** | FIX — restore scale vars |
| CP12–CP14 | choropleth | duplicate `name??id` key collisions; zoom fn near-dup; min-size gate relaxed (<10px→>0) | behavior | Unique assumed; <10px null | Collision risk; near-dup fns; >0 gate | low | FIX key guard; ACCEPT rest |
| IA1+IA2 | int-animation | createSpring/bezierEasing/reveal-family extras; DashTailOverlay + ProjectionMarkerOverlay merges | extra | framer infra; separate single-series comps | WAAPI replacement infra; unified multi-series self-measuring overlays | low | ACCEPT — superset infra |
| IA3 | int-animation | `LoadingStyle` type; `decimateOhlcData` | missing | Exported / dead code | Absent (D19 ruled) | low | FIX type re-export; ACCEPT D19 |
| IA4+IA5 | int-animation | `resolveVisibleEndX` showEndMarker gating (domain padding); framer clipReveal plumbing replaced; projection vector-effect CSS dependency | behavior | Always padded domain; legacy helpers | Padding only when marker shown; WAAPI replacement; CSS override required (D232/D233) | low | FIX pad-unconditionally verify; ACCEPT rest |
| IA6 | int-animation | reveal timing family consolidation | renamed | Per-part reveal helpers | Shared orchestrator family | low | ACCEPT — architectural intent (D218) |
| AX1 | int-axes-grid | resolver renames/consolidation; registration context absent | renamed | Component-level API | Internal resolvers consolidated | low | ACCEPT — internal |
| **AX2** | int-axes-grid | `resolveGridGuide` horizontal default | behavior | `<Grid>` component default horizontal=true (grid.tsx:97) | Resolver defaults false (grid.ts:33; candlestick/scatter/bar inline) — prop-less `<Grid />` loses all grid lines | **high** | FIX — default true; gates blind (scenarios pass explicit `horizontal`) — verified |
| AX3 | int-axes-grid | `resolveGridShimmer` | behavior | useGridShimmer rendered loading band | Zero consumers; Grid `shimmer*` props inert | med | FIX — wire into loading path or strip props |
| AX4 | int-axes-grid | `resolveTimeSeriesYDomain` yScaleDomainMax param | missing | Skeleton-domain short-circuit [0,max·1.1] | Param gone | med | FIX — re-add optional param |
| AX5 | int-axes-grid | axis label position tweens | behavior | left/top transitioned on brush/domain change | Static jump | low | FIX — CSS transitions |
| AX7 | int-axes-grid | `createTickColorResolver` per-axis filter | behavior | Filtered by normalized yAxisId | First matching band regardless of axis | low | ACCEPT single-axis reality (revisit with L10 ruling) |
| AX9 | int-axes-grid | background.tsx orphan | behavior | Background child wired | Orphan unwired | low | Cross-ref CH13 ruling |
| AX10 | int-axes-grid | stale comments | behavior | Accurate | Stale headers | low | FIX — comments |
| BR1-cluster | int-brush | ChartBrush.host DI; BrushChromePattern.color optional + dotFill forwarded; resolver renames | extra/renamed | Direct mount; required color | Host-context DI; optional color | low | ACCEPT — internal DI deltas |
| BR2 | int-brush | direction/selection/handleSize/renderBrushHandle/useWindowMoveEvents dropped | missing | visx options incl. direction/handles | Fixed horizontal-only; HANDLE_HIT_PX=8 | low | ACCEPT — D227 ruled narrowing; document loudly |
| BR3 | int-brush | `BrushSelectedBoxStyle` SVGProps→4-field subset | renamed | Full SVGRect props | Subset narrowing | low | FIX extend passthrough or ACCEPT |
| BR6 | int-brush | default export | missing | Shipped | Named-only | low | FIX — barrel policy |
| BR7 | int-brush | blurPx + extent-clamp duplication | behavior | Single source | Duplicated | low | FIX consolidate |
| FD-extras | int-foundation | PatternAreaConfig reshape; BrushChildConfig=ReactNode; coerce-date ISO fallback; parseAspectRatio glue; NumberFlow island; Tailwind→styles.css ports | renamed/extra | Raw prop shapes; original mechanisms | Ruled conveniences (plan §10/D228); disclosed equivalents (D52) | low | ACCEPT — already ruled |
| FD2 | int-foundation | coerce-date ISO fallback | extra | Parse errors throw | ISO fallback added | low | ACCEPT — lenient boundary |
| FD5 | int-foundation | LoadingLabel className dropped; motion/ShimmeringText → CSS + data-attr exit | renamed | className honored; motion components | Dropped; CSS-based exit | low | FIX className forward or ACCEPT |
| FD6 | int-foundation | `resolveLineLoadingPulseMode`/`LineLoadingPulseMode` | missing | Exported | Absent | low | FIX |
| FD7 | int-foundation | orphaned loading surface (Sweep/Skeleton/getSkeletonHeights/generateChartSkeletonData) | missing | Wired via loadingStyle/status | Exported but zero importers — unreachable | med | Ties to loading OQ — wire or delete |
| FD8 | int-foundation | CenterStat renames | renamed | ChartStatFlowFormat types | CenterStatFormat aliases | low | ACCEPT |
| FD9 | int-foundation | areaFill extra | extra | Absent | Added helper | low | ACCEPT |
| FD11 | int-foundation | pieArcPath consolidation | renamed | Multiple arc path fns | Consolidated | low | ACCEPT |
| **FD12** | int-foundation | PUBLIC BARREL missing block (~60 symbols) | missing | Barrel exports full surface | ~60 symbols absent (helpers/types/components across parts) | **high** | 4.3 tiering ruling — biggest single API-surface gap; drives many part-level missing rows |
| FD13 | int-foundation | barrel extras | extra | Absent | Added exports | low | ACCEPT |
| FD14 | int-foundation | styles.css loading block duplicated verbatim ×2 | behavior | Single | Duplicated (~846–984) | low | FIX dedupe |
| FD15+FD16 | int-foundation | dead-class ports; :has() unscoped | extra/behavior | No dead classes; scoped | Ported dead classes; unscoped selector | low | ACCEPT ruled precedents; FIX scoping |
| IN1 | int-interaction | attachHoverChrome consolidation | renamed | Per-chart hover wiring | Consolidated attach point | low | ACCEPT — D215/D218 architecture |
| IN2 | int-interaction | `tooltipBoxSpring` option | behavior | Honored override | Accepted-voided (hover-chrome.ts:170) | low | FIX thread through or remove |
| IN-hygiene | int-interaction | private bisectDateLeft dup; SegmentComponent ×2; `.bkm-marker-active-layer` no CSS rule | behavior | Single sources | Duplicates; dead class | low | FIX hygiene batch |
| IN-accept | int-interaction | window move events; scheduler render-free thunk; pie glow/fade dead-code port; growInitialized guard | extra/behavior | React state commits; dead at runtime (D49) | Render-free imperative commits; observed-pixels port | low | ACCEPT — D218/D49 precedents |
| IN8 | int-interaction | focusOutsideXDomain bisect scope | behavior | Visible-plot-data bisect | Full-data bisect + inclusive clamp (can resolve outside viewport) | low | KEEP — documented intentional; verify brush-edge UX |
| IN12 | int-interaction | BAR_DIM_TRANSITION 0.12s / MARKER_ACTIVE_SCALE 1.35 provenance | behavior | Exact legacy values unverified this pass | Constants in use | low | VERIFY against legacy in 4.3 |
| LM1+LM13 | int-legend-markers | compositional legend kit orphan status (barrel-only reachability); QA hook `__qaSetMarkerFan` in prod bundle | behavior | Same app-level usage in legacy | Exports live; QA hook shipped | low | ACCEPT parity holds at public surface; FIX QA-hook gating |
| LM2 | int-legend-markers | ChartLegend default export | missing | Shipped | Named-only | low | FIX |
| LM3+LM9 | int-legend-markers | barrel alias renames; rebuilt marks | renamed | Original names/mechanisms | Aliases + rebuilt | low | ACCEPT |
| LM4 | int-legend-markers | ChartMarkersOverlay renames; containerRef accepted-unused | renamed/behavior | Consumed | Renamed internally; unused prop | low | FIX strip or forward |
| LM5 | int-legend-markers | xScale inner-relative contract | renamed | Margin-aware outer scale | Inner-relative (documented D230) | med | ACCEPT — documented contract; add doc note |
| LM6 | int-legend-markers | `onMarkerHoverChange(markers\|null)` → boolean | behavior | Payload carried markers array | Boolean entered flag (crosshair-hide interplay lost) | med | FIX — restore payload or wire suppression |
| LM7 | int-legend-markers | `MarkerTooltipContent`/`useActiveMarkers` | missing | Marker tooltip rows w/ "+N more"; date→active lookup | Gone | med | Port or waive — open Q with CH5/FD1 |
| LM8 | int-legend-markers | `forceOpen`/`iconFill`/`isMuted`/`isActive` exposure | missing | MarkerGroup extras incl. isActive crosshair-hide | Folded private (D229 kept maxFanned only) | med | Partially ruled (D229); isActive crosshair-hide verify desired |
| LM10 | int-legend-markers | MARKER_* consts exported-unconsumed | behavior | Consumed | Exported but unread | low | FIX |
| LM11+LM12 | int-legend-markers | fan hover scale 1.15→1.12; shadow deltas; springs→CSS tweens; whileTap dropped | behavior | motion variants | CSS approximations | low | FIX scale to 1.15 (one value); ACCEPT rest |
| LM14+LM15 | int-legend-markers | ChartMarker defined ×2; intFmt inlined ×2; raw matchMedia per render | behavior | Single sources | Duplicated; per-render reads | low | FIX hygiene batch |

## D-number cross-reference

Already-accepted deviations touched by parity (rulings live in `docs/phase-3/LOG.md` and `docs/phase-4/LOG.md`; there is **no** `docs/LOG.md`):

| D# | Parity-relevant ruling |
|---|---|
| D10 | Zero-React-state imperative chrome doctrine |
| D12/D207 | vsync-floor waiver class (perf; G1 unreachable when B−T ceiling < 2 frames) |
| D13c | area fadeEdges directional gating (partial precedent for A8) |
| D14 | scatter fixed defaults = bklit defaults (S9/S10 precedent) |
| D16/D22 | TanStack focus owns hover; LiveLine new top-level component |
| D19 | `decimateOhlcData` dead code not ported |
| D30 | GAP-chart escape clause (funnel plain SVG — F2) |
| D31/D39 | heatmap discrete levels; funnel cell-center probe |
| D48/D52 | gauge trackRevealFactory backstop; center typography quirks preserved |
| D49 | glow/fade dead-code observed-pixels port (pie/ring/interaction) |
| D51 | discrete-d comment / spring rest tiers |
| D75–D77 | ring redo, polar bake, pie radialArc single-mark |
| D82 | gauge tapered arc approximation (G7 cross-ref) |
| D85.1 | candlestick link() revert |
| D110 | ChartScale.resolve escape hatch |
| D114/D208-4/D145 | choropleth ocean tooltip clear waived intentional |
| D208-3 | ring hover waiver |
| D210-2 | ChartProvider/useChartHover/static-chart-preview-context not exported (intentional) |
| D213/D214 | reveal replay guard dataset.bkmRevealed + loading chrome (line skeleton formula is bklit-verbatim) |
| D215/D218 | tooltip surgical fixes; phase orchestrator + render-free scheduler |
| D219/D220 | reference-area zIndex:-1 underlay + role-marker extraction (RA5+RA6, SG1) |
| D223–D226 | legend/profitloss rulings; colorLegend bypassed; series-hover-dim stub deleted; candlestick legend pairing closed |
| D227 | brush scope: horizontal-only, dead `selection` dropped, candlestick brush deferred (BR2, K1) |
| D228 | children-element composition (brush overlay liveness correction) |
| D229 | markers: forceOpen/isMuted dropped, maxFanned kept (LM8 partial ruling) |
| D230 | marker overlay margin-aware inner-relative xScale contract (LM5) |
| D231 | pattern-preset accent quirk preserved |
| D232/D233 | vector-effect CSS overrides (IA4+IA5 dependency) |
| D234 | hover-sync clock-time springs; z identity |
| D235/D236 | bardepth fidelity + barsquares keyframes; composed keyframe px fix |
| D237 | ring hover waiver; liveline m1c acceptance |
| D238 | v0.14 bump — **open regressions** (barsquares tooltip absent, bardepth offsets); NOT accepted |

## Open questions for 4.3

1. Grid `horizontal` default policy (AX2, HIGH): restore resolver default true vs document breaking change; all bench/QA gates pass it explicitly so gates are blind.
2. Composed `stacked` (C5, HIGH): implement sum branch or strip the prop — silent wrong data encoding today.
3. Multi-series `yAxisId` strategy (L10/B7/B10/S6/RA2/CH7): single-axis doctrine (strip types + document) vs per-axis scales.
4. Sankey defaults/hover (SK1/SK2, HIGH): restore `labelOrientation` default one-liner; controlled-hover via coordinator or waive.
5. Public barrel restoration tiering (FD12, HIGH, ~60 symbols): full re-export, selective tier, or formal deprecation notice; resolves most part-level missing rows.
6. Heatmap pattern props (HM14, HIGH): wire pattern-preset module or strip the typed-but-inert `pattern*` props.
7. Loading family parity: per-series controls (L5/A7), inert `loadingStroke*` (L9), orphaned sweep/skeleton surface (FD7), shimmer wiring (AX3), loading presets (B14/A10) — port or declare cuts as a package.
8. Choropleth defaults + hook contracts (CP4/CP9/CP10): restore intFmt/index/context fields vs publish breaking-change notes.
9. Radar timing drifts (RD5 base-delay ~200ms early; RD6 axis-label spring) + sunburst semantics (SB1 playKey, SB12 cull-vs-dim, SB14 zoom-commit timing).
10. `animationEasing` standard policy across parts (line consumes / area ignores / others absent).
11. Event model + reduced-motion global ratification: mouse→pointer (P8, RD8-cluster) and added matchMedia branches (XC-pattern rows).
12. Dead/inert surface cleanup list: wire-or-delete each of B11, B18–20, C13+C14, F3, HM4, IN2, LM4, LM10 (accepted-but-unread props and dead code).
13. Verify untraced constants against legacy source: BAR_DIM_TRANSITION 0.12s, MARKER_ACTIVE_SCALE 1.35 (IN12).
14. v0.14 bump regressions (D238): barsquares tooltip absent, bardepth offsets — parity blockers to resolve before any new FIX work lands.
