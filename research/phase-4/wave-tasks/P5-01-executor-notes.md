# P5.1 — T-E1a mechanical barrel tier (Wave 5) — Executor Notes

Started: 2026-08-25 session. Charter: `research/phase-4/wave-tasks/P5-01.md` + dispatch §0 correction.

## Status log

- [x] Charter read in full
- [x] §0 sunburst survivor set verified — **I count 13 exported / 1 private / 6 gone, not the dispatch's 13/1/5.**
      Dispatch's own charter text (P5-01.md:44 SUPERSEDED note) also says 6 gone, listing
      `buildSunburstEnterTiming` alongside buildRevealDelays/buildRevealSchedule/centroidAngle/
      localProgress/segmentRevealFromRingSweep. The 13 exported + `lerpGeometry`-private match exactly.
      Evidence: my scripted scan (`temp-p51/crosscheck.out` lines for sunburst names) shows zero hits
      repo-wide (showcase/migrated/charts/) for all six gone-names; grep confirms same.
- [x] buildSunburstEnterTiming stale comment fixed: internal/sunburst-reveal.ts:40-44 now says it was
      retired in P3.6's split outcome (LOG.md D276) and names `buildRevealTiming` (same module) as successor.
      Successor established by reading the block: comment sits directly on `buildRevealTiming`, which builds
      ring-staggered reveal delays — the exact role bklit's buildSunburstEnterTiming played.
- [x] CHART_CLIP_PASSTHROUGH ruled out of scope: renamed to CHART_CHILD_PASSTHROUGH per
      research/phase-4/children.md:17; already exported at charts/index.ts:309. Legacy-name alias is P5.6/T-E4's job.
- [x] Sub-run 1: TYPES — gate passed (tsc 0 / build 0 / spot-check pass, reverted)
- [x] Sub-run 2: CONSTS — gate passed (tsc 0 / build 0 / runtime-valued spot-check pass, reverted)
- [x] Sub-run 3: HELPER-FNs — gate passed (tsc 0 / build 0 / all-54 value-import spot-check + v2, reverted)

## Remaining closeout

- [x] bench/ + qa/ import grep for all names I touched
- [x] P4.6 fence audit — confirm none of my edits touched its six files
- [x] Final full-gate re-run (tsc 0 / build 0)
- [x] temp-p51/ scratch dir emptied (contents preserved in this file per D216)

## Closeout findings

**bench/ + qa/ import grep:** No consumer of mine breaks.
- `bench/app/src/scenarios/migrated-sunburst.tsx:28-31` imports `buildArcs`, `type ArcDatum`
  from **`@bklitui/ui/charts` (legacy clone)**, NOT from `@migrated/charts` — unaffected by my barrel.
- `bench/app/src/scenarios/migrated-patternarea.tsx:26` uses a local literal mirror of
  `PatternPresetId`; its comment says "not re-exported from the top-level @migrated/charts
  barrel -- see final report's disclosed barrel-export gap". **That gap is now closed**
  (PatternPresetId is exported); the scenario can switch to the real import in a later
  harness pass (I may not write to bench/).
- All other hits are comments or legacy-side imports. No runtime consumer imports any name
  I exported from `@migrated/charts` yet — these exports are pure API-surface restoration.
- Follow-on note for lead: D296 says bench/app is covered by NEITHER showcase tsc NOR the
  showcase build; since no bench file imports the new exports, nothing there needed
  re-verification, but the same blind spot applies to any future bench adoption of these names.

**P4.6 fence audit:** My session edited exactly these files:
charts/index.ts, live-line-chart.tsx, sankey-chart.tsx, pie-chart.tsx, ring-chart.tsx,
internal/sunburst-geometry.ts, internal/heatmap-colors.ts, internal/sunburst-reveal.ts (comment),
plus research/phase-4/wave-tasks/P5-01-executor-notes.md and temp-p51/ scratch.
NONE are in P4.6's fenced set {scatter-chart.tsx, bar-chart.tsx, candlestick-chart.tsx,
composed-chart.tsx, internal/use-hover-chrome.ts, funnel-chart.tsx}. Also verified from
PROGRESS.md line 87: **P4.6 CLOSED 2026-08-25 (D311)** before my HELPER-FN sub-run began;
its QA gates were deliberately deferred to the post-P5.1 quiet window, so the lead's sweep
will see my completed barrel.

**Fresh PROGRESS.md check (charter report item 3):** P3.6 confirmed landed as split outcome
(D276, PROGRESS.md:74). Wave 5 row (:93) confirms my dispatch and the measured survivor set
(13/1/6) — matching my independent count.

## Report back (charter §"Report back" + dispatch §4)

1. Per-sub-run counts, edit sites, gates: see the three LANDED sections below.
   Totals: TYPES 18/97, CONSTS 12/18, HELPER-FNs 46/91 = **76 of 206 exported**;
   8 definition-site export keywords added; the rest routed with evidence (below + sections).
2. Symbols with no surviving backing: full list per sub-run section. Routing summary:
   - **P5.3 ACCEPT ledger**: *Props/*Config rename families, cssVars family, context-value
     types, brush type family, sunburst retired six, y-domain-utils block,
     chartCenter*ClassName trio, comment ghosts (defaultChartStatFlowFormat,
     getSeriesMarkerVisualExtent), TooltipData and friends.
   - **P5.7 (loading family)**: LoadingStyle, LineLoadingPulseMode,
     resolveLineLoadingPulseMode, LineChartLoadingProps, LineLoadingPulseStrokeProps,
     BarChartLoadingProps, AreaChartLoadingProps, BarLoadingSkeletonProps,
     LineLoadingSweepProps, getSkeletonHeights, generateChartSkeletonData (+ options TYPE)
     — zero occurrences anywhere.
   - **P5.2 (port tier, only if a consumer needs them)**: DEFAULT_ANIMATION_DURATION_MS
     (six identical private copies — hoist to one canonical site),
     DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION, DEFAULT_Y_AXIS_ID,
     CHART_SCALE_VARS.
3. Sunburst block confirmation: NOT left untouched — it was RELEASED and landed this pass
   per §0 correction (13 exported + lerpGeometry keyword + barrel lines; 6 retired → P5.3).
   P3.6 status re-checked at finish: landed (D276).
4. Resolution spot-check: transient import blocks through "./index" — TYPES via
   `import type` (17 names + 2 direct), CONSTS via value import + literal assertions,
   HELPER-FNs via all-54 value imports (`typeof f() === "undefined"` guard catches the
   type-but-not-value failure mode) + v2 for late additions. Every spot-check passed
   tsc AND production build before revert; nothing left behind.
5. Contradictions with the brief, stated plainly:
   - Dispatch said 5 gone sunburst names; actual is 6 (buildSunburstEnterTiming included).
     The charter's own SUPERSEDED block agrees with me (it lists 6).
   - Charter examples implied most symbols survive ("usually defined in internal/*.ts").
     Actual: 99 of 206 fully absent from migrated code; ~30 alive-but-private or dual-defined;
     76 exportable as-is. The worksheet counts legacy API surface, not migrated modules;
     T-E1a's acceptance rule filtered far more than the charter anticipated.
   - IndicatorWidth/TooltipRow have DUPLICATE identical definitions in both
     internal/tooltip-chrome.ts (runtime owner) and internal/types.ts:354-356 — I exported
     from tooltip-chrome.ts; dedup decision belongs to the lead.
   - sankey's private TooltipContentProps has a completely different shape than bklit's
     tooltip-content TooltipContentProps; I exported it aliased as SankeyTooltipContentProps.
     If P5.3 prefers the bklit shape restored under that name, that's a P5.2 item.

## Sub-run 2: CONSTS — LANDED (12 of 18)

Barrel lines added at showcase/migrated/charts/index.ts:395-415.

| symbol | backing site |
|---|---|
| DEFAULT_CHART_CONFIG | internal/chart-config-context.tsx:27 |
| DEFAULT_CHART_LIFECYCLE | internal/chart-phase.ts:25 |
| DEFAULT_CHART_STATUS | internal/chart-phase.ts:13 |
| DEFAULT_Y_DOMAIN_TWEEN_MS | internal/chart-phase.ts:15 |
| HEATMAP_MONTHS_ONE_YEAR | internal/heatmap-utils.ts:44 |
| HEATMAP_MONTHS_SIX | internal/heatmap-utils.ts:47 |
| HEATMAP_WEEKS_ONE_YEAR | internal/heatmap-utils.ts:50 |
| PATTERN_PRESET_IDS | internal/pattern-preset.tsx:21 |
| DEFAULT_HOVER_OFFSET | pie-chart.tsx:87 |
| Y_AXIS_DEFAULT_TICK_COUNT | internal/y-axis-ticks.ts:6 |
| Y_AXIS_MAX_TICK_COUNT | internal/y-axis-ticks.ts:15 |
| Y_AXIS_MIN_TICK_COUNT | internal/y-axis-ticks.ts:9 |

CONSTS NOT EXPORTED (6):
- CHART_CLIP_PASSTHROUGH — renamed; current name already exported (index.ts:309). Legacy alias = P5.6.
- DEFAULT_ANIMATION_DURATION_MS — six identical private copies (1100) in
  area/bar/candlestick/composed/line/scatter chart.tsx. No canonical module → hoisting is new
  code = P5.2 (recommend internal/design-tokens.ts or new internal/animation.ts).
- DEFAULT_ANIMATION_EASING — zero occurrences anywhere in migrated code. P5.2 if a consumer needs it.
- DEFAULT_CHART_ENTER_TRANSITION — comment-only mentions (bar-chart.tsx:75,
  internal/enter-transition.ts:12,84). No value exists. P5.2.
- DEFAULT_Y_AXIS_ID — zero occurrences. P5.2.
- CHART_SCALE_VARS — no named constant; scale var strings are inline literals
  (choropleth-chart.tsx:136-140, internal/heatmap-colors.ts:16+). Hoist = new code = P5.2.

Spot-check: transient import block from "./index" asserting values (DEFAULT_HOVER_OFFSET===10,
tick counts 5/10/1, months 12/6, weeks 52, PATTERN_PRESET_IDS non-empty) + tsc/build exit 0, reverted.

## Sub-run 3: HELPER-FNs — LANDED (46 of 91)

Barrel lines added at showcase/migrated/charts/index.ts:417-492.

Definition-site `export` keyword additions (6 total, none in P4.6's fenced set):
- `export function lerpGeometry` — internal/sunburst-geometry.ts:314
- `export function detectMomentum` — live-line-chart.tsx:213
- `export const defaultPieColors` — pie-chart.tsx:93 (was private; value = CHART_CATEGORY_PALETTE)
- `export const defaultRingColors` — ring-chart.tsx:73 (was private)
- `export function levelStylesFromColors` — internal/heatmap-colors.ts:102 (was private;
  consumed in-module at :117,:124)
- (`Momentum` type + sankey TooltipContentProps were the TYPES-tier keyword adds)

Exported HELPER-FNs (46):
| symbol | backing site |
|---|---|
| sumValues | internal/sunburst-geometry.ts:35 |
| buildArcs | internal/sunburst-geometry.ts:124 |
| ringOptions | internal/sunburst-geometry.ts:158 |
| geometryFor | internal/sunburst-geometry.ts:182 |
| geomCentroidAngle | internal/sunburst-geometry.ts:217 |
| geomCentroidRadius | internal/sunburst-geometry.ts:221 |
| clockwiseFraction | internal/sunburst-geometry.ts:226 |
| arcPath | internal/sunburst-geometry.ts:238 |
| transitionGeometry | internal/sunburst-geometry.ts:343 |
| defaultSunburstGrowPadding | internal/sunburst-geometry.ts:439 |
| lerpGeometry | internal/sunburst-geometry.ts:314 (keyword added) |
| sunburstCssVars | internal/sunburst-colors.ts:7 |
| defaultSunburstColors | internal/sunburst-colors.ts:17 |
| opacityForRelativeDepth | internal/sunburst-colors.ts:23 |
| detectMomentum | live-line-chart.tsx:213 (keyword added) |
| defaultPieColors | pie-chart.tsx:93 (keyword added) |
| defaultRingColors | ring-chart.tsx:73 (keyword added) |
| computeSquareColumn | internal/bar-squares-layout.ts |
| topSquareCenterY | internal/bar-squares-layout.ts |
| computeReferenceAreaRect | internal/reference-area-geometry.ts:72 |
| resolveYAxisTickCount | internal/y-axis-ticks.ts:18 |
| buildHeatmapColorScale / …FromStyles / buildHeatmapFillScale / defaultHeatmapColorScale / defaultHeatmapFillScale / heatmapLevelPatternId / isHeatmapLevelPattern / levelStylesFromColors(keyword added) / resolveHeatmapLevelStyles | internal/heatmap-colors.ts |
| buildHeatmapLegendGradient, buildHeatmapRowOpacity, filterHeatmapColumns, formatHeatmapContributionLabel, formatHeatmapTooltipDate, formatHeatmapTooltipWeekday, formatHeatmapYAxisLabel, getHeatmapCalendarRangeStart, getHeatmapColumnMonthAnchor, getHeatmapDayLabels, getHeatmapSeparatorColumnIndices, getHeatmapTimeExtent, getHeatmapWeekCount, getHeatmapWeekStartAlignedToRange, getHeatmapWeekStartSunday, getHeatmapYearStartMonth, inferHeatmapCalendarRangeStart, resolveHeatmapWeekRange, shouldShowHeatmapYAxisTick | internal/heatmap-utils.ts |
| indicatorFadeGradientStops, resolveVerticalFadeSides | internal/fade-mask.ts |
| isCirclePattern, isCirclesPattern, patternPresetTileSize, renderPatternPreset | internal/pattern-preset.tsx |
| isChartInteractionPhase, resolveRestingChartPhase | internal/chart-phase.ts |
| resolveTooltipBoxMotion | internal/chart-config-context.tsx |

Gate: tsc 0 + build 0; spot-check v1 imported ALL 54 names as VALUES from "./index"
(catches type-but-not-value), tsc 0 + build 0 with block present, reverted.
Spot-check v2 covered the 4 late additions (defaultPieColors/defaultRingColors/
levelStylesFromColors), tsc 0 + build 0, reverted.

HELPER-FNs NOT EXPORTED (45 of 91):
→ P5.3 ACCEPT ledger — sunburst reveal-math retired by P3.6 split (D276):
buildRevealDelays, buildRevealSchedule, buildSunburstEnterTiming, centroidAngle,
localProgress, segmentRevealFromRingSweep. Zero occurrences verified.
→ P5.3 ACCEPT — renamed to migrated-native equivalents:
niceYDomain → internal/y-domain.ts resolveTimeSeriesYDomain/createNicedYScale;
levelColorsFromStyles folded into levelStylesFromColors family (no same-name fn);
chartCenterContainerClassName/LabelClassName/ValueClassName → centerStat*ClassName
in internal/center-stat.tsx (different values — CSS-class strategy changed);
choroplethCssVars/defaultChoroplethColors → inline literals (choropleth-chart.tsx:134+);
heatmapCssVars/pieCssVars/radarCssVars/ringCssVars/sankeyCssVars/chartScaleCssVars/chartCssVars →
contexts went imperative (P4); no var-bag objects exist anywhere;
defaultScatterColors → scatter uses palette internally (no named export).
→ P5.3 ACCEPT — comment-only mentions, code never ported:
defaultChartStatFlowFormat (internal/center-stat.tsx:88 doc-comment),
getSeriesMarkerVisualExtent (scatter-chart.tsx:751 doc-comment).
→ P5.3/P5.7 — loading family absent entirely: resolveLineLoadingPulseMode,
getSkeletonHeights, generateChartSkeletonData (+ GenerateChartSkeletonDataOptions TYPE).
→ P5.2 if a consumer materializes — y-domain-utils block never ported as such:
getPrimaryYScale, computeYDomainsByAxis, isLoadingChromePhase, isYDomainTweenPhase,
mergeYDomainRecords, shouldTweenYDomain (zero occurrences).

## Sub-run 1: TYPES — LANDED (18 names)

Barrel lines added at showcase/migrated/charts/index.ts:359-393 (one block).
Definition-site `export` keyword additions (2):
- `export type Momentum` — live-line-chart.tsx:208 (was module-private)
- `export interface TooltipContentProps` — sankey-chart.tsx:172 (was module-private;
  NOTE: exported under alias `SankeyTooltipContentProps` in the barrel to avoid
  colliding with bklit's different-shape TooltipContentProps; bklit's shape routes
  to P5.3 ledger since migrated has no {title, rows, children} equivalent).

Exported TYPES (18 total incl. the 2 keyword-adds):
| symbol | backing site |
|---|---|
| BackgroundProps | internal/background.tsx:13 |
| SeriesPointMarkerStyle | internal/types.ts:19 |
| GradientStop | internal/types.ts:227 |
| SquareColumnLayout | internal/bar-squares-layout.ts:7 |
| HeatmapWeekRange | internal/heatmap-utils.ts:112 |
| IndicatorFadeEdges | internal/fade-mask.ts:75 |
| ChartMarkersProps | internal/chart-markers.tsx:24 |
| MarkerTooltipContentProps | internal/marker-tooltip.tsx:19 |
| PatternPresetId | internal/pattern-preset.tsx:32 |
| PatternPresetOptions | internal/pattern-preset.tsx:34 |
| ReferenceAreaRect | internal/reference-area-geometry.ts:3 |
| IndicatorWidth | internal/tooltip-chrome.ts:92 |
| TooltipRow | internal/tooltip-chrome.ts:111 |
| ArcDatum / ArcGeometry / Focus | internal/sunburst-types.ts:14,43,33 |
| Momentum | live-line-chart.tsx:208 (keyword added) |
| SankeyTooltipContentProps | sankey-chart.tsx:172 (keyword added) |

Gate: tsc exit 0; build exit 0; resolution spot-check via transient
`import type {...} from "./index"` block (17 TYPE names) + Momentum +
SankeyTooltipContentProps direct imports — tsc exit 0 and build exit 0 with
block present, then reverted.

TYPES NOT EXPORTED (79 of 97) — full absence verified by scripted scan
(temp-p51/crosscheck.out + occurs.out), spot-verified by grep:
→ P5.3 ACCEPT ledger (intentional rename to *Config carriers or architecture
retirement): AreaChartLoadingProps, BarChartLoadingProps, LineChartLoadingProps,
LineLoadingPulseStrokeProps, BarLoadingSkeletonProps, LineLoadingSweepProps,
LoadingStyle, LineLoadingPulseMode, all Bar* prop types (BarAnimationType,
BarLineCap, BarProps, BarOrientation, BarDepthBackProps, BarDepthEntry,
BarDepthFrontProps, BarDepthProviderProps, BarDepthSegment, BarPulseProps,
BarColumnTrackProps, BarSquaresProps, BarXAxisProps, BarYAxisProps),
CandlestickProps, OHLCDataPoint, brush-family types (ChartBrushSelection,
ChartBrushLayoutProps, ChartBrushLayoutState, ChartBrushPatternPreset,
ChartBrushSelectionOverlayProps, ChartBrushSelectionPattern,
ChartBrushTrackOverlayProps, ChartBrushTrackOverlayStyle), context-value types
(ChartContextValue, ChartHoverContextValue, ChartStableContextValue,
PieContextValue, RadarContextValue, RingContextValue, SankeyContextValue),
TooltipData, ChartRevealClipProps, ChartScaleVars(type), ChartStatFlowFormat,
ChartStatFlowProps, ChoroplethTooltipData, GridProps, LineProps, LiveLineProps,
LiveXAxisProps, LiveYAxisProps, MarkerGroupProps, PatternAreaProps,
PieCenterShellProps(P5.6 owns wrapper), ProjectionStrokeStyle, ScatterProps,
SeriesMarkersProps, SeriesPointMarkerProps, SunburstEnterTiming,
SunburstRevealSchedule, SunburstSegmentEnterDelays, SunburstBreadcrumbItem,
SunburstBreadcrumbProps, SunburstCenterProps, SunburstHintContext,
SunburstHintProps, DateTickerProps, TooltipBoxProps, TooltipDotProps,
TooltipIndicatorProps, XAxisProps, YAxisProps, YAxisOrientation, YDomain,
SankeyTooltipData.
→ P5.2 port tier if a consumer materializes: none identified this pass beyond
the ledger items above (all absent names have zero occurrences in migrated code).

## Major finding — the worksheet's 206 is NOT "mostly present"

> **⚠ LEAD CAVEAT 2026-08-25 (D312) — added after this section was written. Do not quote the number without this.**
> The scan below is a **name-match**: it answers *"does this identifier string
> appear in migrated?"*, not *"does this functionality exist?"* Those diverge
> wherever Waves 1–4 renamed something, which was constant.
> **Proven wrong within this very list:** the y-domain block is reported as
> "no migrated module". `showcase/migrated/charts/internal/y-domain.ts` exists
> and exports `resolveTimeSeriesYDomain` (`:22`), `useNicedYDomainChanged`
> (`:55`) and `createNicedYScale` (`:70`) — renamed equivalents. This run
> **caught that itself later** and re-routed `niceYDomain` to the ACCEPT ledger
> as a rename, but this section still carries the original line.
> Spot-checks that came back ACCURATE: the `cssVars` family really is down to
> `sunburstCssVars`/`legendCssVars` (`chartCssVars` survives only as a doc
> comment, `internal/types.ts:449`), and the loading *type* names really are
> gone even though `internal/loading-chrome.tsx` still ships `LoadingLabel`
> and `LineLoadingPulse`.
> **Verdict: 99 is a sound UPPER BOUND and a good lead. It is not a port list.**
> Any package acting on it must grep for the renamed equivalent before porting
> a symbol — otherwise it rebuilds what already exists, which is the D309
> failure repeated at ninety-nine times the scale.


Scripted scan of all 206 worksheet names against showcase/migrated/charts/**:
**99 are fully absent** (zero occurrences anywhere). Breakdown of the absent set:
- bklit flat-prop component prop types renamed to config-carrier interfaces in migrated code
  (LineProps→LineConfig etc.; children.tsx consumes *Config from internal/types.ts).
- cssVars helper family (chartCssVars/heatmapCssVars/pieCssVars/radarCssVars/ringCssVars/sankeyCssVars/
  choroplethCssVars/chartScaleCssVars) — legacy lived in context modules that P4 rewired imperative;
  migrated has NO equivalent objects (grep: only sunburstCssVars + legendCssVars exist).
- y-domain-utils block (getPrimaryYScale, computeYDomainsByAxis, isLoadingChromePhase,
  isYDomainTweenPhase, mergeYDomainRecords, niceYDomain, shouldTweenYDomain, YDomain type,
  YAxisOrientation, DEFAULT_Y_AXIS_ID) — no migrated module.
- loading-family (LineLoadingPulseMode, resolveLineLoadingPulseMode, LoadingStyle, LineChartLoadingProps,
  LineLoadingPulseStrokeProps, BarChartLoadingProps, AreaChartLoadingProps, BarLoadingSkeletonProps,
  LineLoadingSweepProps, getSkeletonHeights, generateChartSkeletonData) — none.
- chart-center-typography trio (chartCenterContainerClassName/LabelClassName/ValueClassName) — migrated
  center-stat.tsx has its OWN classnames (centerStat*ClassName) with different values.
- ChartStatFlow types + defaultChartStatFlowFormat (only a doc-comment mention in center-stat.tsx:88).
- brush-family TYPES (ChartBrushSelection/LayoutProps/LayoutState/PatternPreset/SelectionOverlayProps/
  SelectionPattern/TrackOverlayProps/TrackOverlayStyle) — brush RUNTIME exists and is barrel-exported,
  but these exact type names don't exist.
- SunburstBreadcrumb family, TooltipBox/Content/Dot/Indicator Props, DateTickerProps, MarkerGroupProps,
  SeriesMarkersProps/SeriesPointMarkerProps, PieCenterShellProps, OHLCDataPoint, BarOrientation,
  BarAnimationType, BarLineCap, ScatterProps, PatternAreaProps, ProjectionStrokeStyle,
  ChoroplethTooltipData, GenerateChartSkeletonDataOptions,
  GridProps/XAxisProps/YAxisProps/YAxisOrientation/YDomain, context-value types
  (PieContextValue/RadarContextValue/RingContextValue/SankeyContextValue/ChartContextValue/
  ChartHoverContextValue/ChartStableContextValue), DEFAULT_ANIMATION_EASING,
  CHART_CLIP_PASSTHROUGH (renamed — see above), levelColorsFromStyles.

## Rulings / findings

- DEFAULT_ANIMATION_DURATION_MS exists as SIX private copies (1100 each) in
  area/bar/candlestick/composed(?)/line/scatter chart.tsx files — composed-chart.tsx also has one
  (from earlier grep list: area,bar,candlestick,composed,line,scatter). Exporting requires picking ONE
  canonical site or creating internal/animation.ts — that is new code → P5.2 territory, not mechanical T-E1a.
  I will NOT export it this pass; route to P5.2 with recommendation: hoist one copy into
  internal/design-tokens.ts or a new internal/animation.ts.
- defaultChartStatFlowFormat: only a doc-comment citation (internal/center-stat.tsx:88). No code. → P5.2/P5.3.
- IndicatorWidth + TooltipRow: dual definitions exist (internal/tooltip-chrome.ts:92,111 AND
  internal/types.ts:354,356). tooltip-chrome.ts is the real consumer-facing owner (applyBoxContent takes
  TooltipRow[]); internal/types.ts redefines identical shapes. For the barrel I export from
  tooltip-chrome.ts (runtime owner). Flag duplicate to lead.
- MomentumColors precedent shows the *Config pattern: bklit MomentumColors name kept verbatim where the
  contract survived; where bklit had *Props components and we made config-carrier children, the name
  became *Config. Those renames were accepted API decisions (children.tsx header comment) → route
  *Props families to P5.3 ACCEPT ledger (name intentionally retired), except where a live consumer needs
  the old name (then P5.2 alias).

## Edit sites log

(appended as sub-runs land)

