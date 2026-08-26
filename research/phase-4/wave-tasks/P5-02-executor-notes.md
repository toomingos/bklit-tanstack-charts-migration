# P5.2 Executor Notes (T-E1b barrel restore, port/wrapper tier)

Executor run started 2026-08-25. Charter: `P5-02.md` + lead brief (8 corrections in `⚠️ SUPERSEDED 2026-08-25` block).

## Run log

- [ ] Created this notes file (first action).
- [ ] Read charter in full (incl. SUPERSEDED block).
- [ ] Read P5-01 executor notes ("Major finding" scan = LEAD only).
- [ ] Read docs/phase-4/LOG.md D228 (ChartBrush* precedent).

## Plan (per lead §1 ordering)

1. Pattern* ×4 — export keywords in pattern-preset.tsx + 2 new wrappers + barrel lines
2. Gradient* ×11 — own module (likely internal/gradients.tsx), barrel lines
3. Sub-run (b) HOOK tier (22) — mostly barrel lines over existing hooks; BEFORE presentational ports
4. Background collision judgment call
5. Presentational ports one at a time, each written to disk before next

Gate: `npx tsc --noEmit` from showcase/ (TSC_EXIT=n), prod build after each sub-run,
QA spot-checks for new render paths. Bar family n=100 never n≥1000.

## Step 1: Pattern* ×4 — LANDED

- pattern-preset.tsx: added VisxPatternHexagons + VisxPatternWaves to import (:3-6);
  `export` keyword on PatternLines (:9) + PatternCircles (:14); NEW wrappers
  PatternHexagons (:21) + PatternWaves (:28), same shape as precedent.
- Barrel: new block at index.ts:494-500 (direct from "./internal/pattern-preset",
  matching existing direct-source precedent at :409/:484; NOT routed via
  internal/index.ts which only re-exports renderPatternPreset+PatternPresetId).
- @visx/pattern confirmed exporting all four (node_modules esm/index.js).
- Pixel-inert: no chart renders Hexagons/Waves (PATTERN_PRESETS use Lines/Circles
  only); wrappers are passthroughs. QA spot-check not warranted (no new render path).

## Step 2: Gradient* ×11 — LANDED

- New file internal/gradients.tsx (11 wrappers, pattern-preset shape, displayName set).
  Chose OWN MODULE over swelling pattern-preset.tsx (brief §1.2 offered either; separate
  module keeps the two visx families independently greppable, mirrors legacy's
  visx-pattern vs @visx/gradient source split).
- **Legacy evidence: bklit barrel :4-16 re-exported the eleven DIRECTLY from
  "@visx/gradient" — no wrapper module ever existed.** My 11-name list matches legacy
  exactly. NOTE: @visx/gradient@4 also ships `GradientPurpleRed` — NOT in bklit's public
  surface → excluded for API parity (charter list is correct as-is).
- Pixel-inert: no migrated chart renders these today (zero visx/gradient imports).
- Barrel: index.ts:502-515 new block from "./internal/gradients".

## Gate 1 (after Steps 1+2): PASS

TSC_EXIT=0 (npx tsc --noEmit from showcase/), prod build exit 0.

## Step 3: HOOK tier — LANDED (4 barrel lines) + 18 routed

### Exported (4)

| legacy worksheet name | backing site | contract check |
|---|---|---|
| useRingStable | ring-chart.tsx:125 | throws outside `<RingChart>` :128 |
| useRingHoverCoordinator | ring-chart.tsx:135 | throws outside `<RingChart>` :138 |
| usePieStable | internal/pie-center.tsx:41 | throws outside `<PieChart>` :43 |
| usePieHoverCoordinator | internal/pie-center.ts:47 | throws outside `<PieChart>` :49 |

Barrel lines at index.ts:516-519 (new P5.2 hook block, direct-source style).

### Routed NOT exported (evidence per correction-7 discipline)

- **useYScale / useAnimatedYDomains** — EXCLUDED per brief §2 (P6.2 post-T-F1).
  Confirmed exclusion. Zero migrated backing exists today.
- **useRing / useRingHover combiner** — NOT built (P5.6 owns naming work; §2 boundary).
  Only current-name exports landed.
- **useStaticChartPreview + Provider** — SKIPPED. P5.3 hasn't run; own call from
  evidence: no `StaticChartPreview*`/skeleton-preview provider exists in migrated
  (grep: only heatmap's local generateHeatmapSkeletonFromTarget, unrelated). No
  backing → nothing to wrap. Flag ordering risk for lead/P5.3 to confirm ACCEPT.
  Cite: charter note *** + go-to-plan.md:156 ACCEPT-per-DOC-10 candidate list.
- **useChart/useChartHover/useChartStable (generic family)** — NO MIGRATED BACKING.
  Legacy lived in chart-context.tsx providers (repos/.../chart-context.tsx); P4
  rewired children-dispatch imperative (children.tsx has zero use* exports).
  DOC-4 says context/provider removal is ACCEPTED; hooks get wrappers "where
  trivial" — there is no hook to wrap and no context fields survive to back one.
  → Route to **P5.3 ACCEPT ledger** (architecture retirement), not a port.
- **useRadar/useRadarHover/useRadarStable** — no backing. Radar state went
  controlled/internal useState (radar-chart.tsx:240-241) with `hoveredIndex`
  prop; zero context modules remain in radar-chart.tsx. → P5.3 ACCEPT ledger.
- **useSankey** — no backing. Sankey hover is ref-based (`hoveredNodeIndexRef`,
  sankey-chart.tsx:256-285) + props-controlled; no context module. → P5.3 ACCEPT.
- **useSunburstBreadcrumbItems / useSunburstHover / useSunburstStable** — no
  backing ("readcrumb" = zero hits repo-wide incl. comments). Sunburst state is
  component-local. → P5.3 ACCEPT ledger.
- **useBarDepthEntries** — no backing. Legacy bar-depth.tsx:380 returns BarDepthEntry[]
  computed from data+scale+margin; migrated bar depth marks are pure geometry fns
  (internal/bar-depth-marks.ts, bar-depth-geometry.ts) with no entries hook. → P53 ACCEPT.
- **useChartInteraction** — **RENAME FOUND (correction 7 pattern)**: legacy
  use-chart-interaction.ts:54 (tooltip+drag+touch mega-hook) → migrated
  `internal/chart-selection.ts:19 useChartSelection(params)` (drag-selection only;
  tooltip scheduling moved elsewhere). Its docstring cites bklit parity. Consumed by
  area/candlestick/composed/line/scatter (:981/:995/:1386/:934/:846). Context already
  public at barrel :317 (`ChartSelectionContext`). **Not exported under legacy name:
  shape reduction means a legacy-name wrapper would need invented tooltip plumbing —
  not trivial per DOC-4.** → P5.6 compat-rename decision (same bucket as CHART_CLIP_
  PASSTHROUGH precedent from P5.1 notes). Also `useChartSelectionContext` (:175,
  nullable variant) stays unexported pending same decision.

## Gate 2 (after Step 3): PASS

TSC_EXIT=0, build exit 0.

## Findings so far

- **Brief locator error (report item 7): D228 is in `docs/phase-3/LOG.md:53`, NOT phase-4.**
  Phase-4 LOG tops out at D316. D228 = Initiative 9 (ChartBrush+BrushLayout) closure:
  `ChartBrush` real component w/ role tag; `BrushChildConfig` re-typed ReactNode;
  selectionPattern via pattern-preset reuse (D227 r8); horizontal-only + dead `selection`
  prop narrowing stands (D227 r5); BrushHost/BrushLayout render-prop arch.
  → Implication: migrated brush RUNTIME is the D228-approved set. My three "real ports"
  (SelectionOverlay/TrackOverlay/Handle) must still be behaviour-grepped against
  internal/brush-* before writing net-new code (correction 7 discipline).
- Correction 2 VERIFIED: PatternLines `function` (no export) at pattern-preset.tsx:9,
  PatternCircles same at :14. Correction 3 VERIFIED: @visx/gradient pinned at
  showcase/package.json:22 alongside @visx/pattern :26.
- Precedent shape confirmed at pattern-preset.tsx:9-19 (named fn wrapper over aliased
  visx import + displayName).
- DEFAULT_ANIMATION_DURATION_MS re-grepped: SIX copies confirmed, all 1100 —
  area-chart.tsx:95, bar-chart.tsx:77, candlestick-chart.tsx:71, composed-chart.tsx:144,
  line-chart.tsx:86, scatter-chart.tsx:54. Matches brief count exactly.
- IndicatorWidth/TooltipRow dual defs confirmed: internal/types.ts:354/356 AND
  internal/tooltip-chrome.ts:92/111 (identical shapes).
- ChartBrushSelectionOverlay/TrackOverlay/Handle: ZERO hits in migrated → real ports.
- visx/gradient: zero code imports (pkg+lockfile only) → Gradient* x11 net-new.

## Step 4: Background collision — RULING

**Decision: keep marker as public `Background` (no rename), export real component
as `ChartBackground`, leave default-export binding for P5.4.**

Reasoning chain:
1. Legacy's real `Background` called `useChartStable()` (repos/.../background.tsx:5,71)
   → threw outside provider → **even in bklit it could not render standalone**. The
   migrated marker+config+BackgroundLayer architecture is a faithful port of that
   contract, not a gap.
2. Migrated's real component takes `BackgroundConfig` which already carries the full
   legacy prop surface (internal/types.ts:320 says exactly this). Exporting it
   publicly is safe — it takes the same shape legacy took.
3. Zero consumers import either symbol anywhere (bench/showcase/migrated greps).
   Naming is pure API-surface restoration; no consumer breakage possible.

Why NOT the alternatives:
- Swap names (real→`Background`, marker→`BackgroundMarker`): renaming children.tsx's
  symbol requires touching role-extraction code for zero consumer benefit. Rejected.
- Alias both under one name: impossible, one name binds one value.

What P5.4 gets:
- **Bind the legacy default-export slot to `ChartBackground`** (the real painter,
  internal/background.tsx:28), NOT the null marker — bklit's own default export was
  the real component (`export default Background`, legacy background.tsx tail;
  named export at legacy barrel :30).

LANDED: internal/background.tsx:142 `export { Background as ChartBackground }`;
barrel index.ts:366 `export { ChartBackground } from "./internal/background"`
(next to BackgroundProps :365). Marker `Background` untouched at :214. Gate 3 below.

## Step 5a: Tooltip* + DateTicker — LANDED

New file internal/tooltip-components.tsx (~800 lines): TooltipDot, TooltipIndicator,
TooltipBox, TooltipContent, DateTicker (+ all Props types + local TooltipRow).
Legacy sources (repos/bklit-ui/packages/ui/src/charts/tooltip/*.tsx):
- tooltip-dot.tsx:83 → TooltipDot (spring cx/cy or ring rect; dot|ring variants)
- tooltip-indicator.tsx:77 → TooltipIndicator (crosshair rect/line/dash/fade)
- tooltip-box.tsx:53 → TooltipBox (portal panel, flip detection, entrance spring)
- tooltip-content.tsx:19 → TooltipContent (title+rows+children)
- date-ticker.tsx:136 → DateTicker (compact >60, month/day stacks)

Building blocks REUSED vs written:
- REUSED: createSpring (internal/spring.ts), useChartConfig,
  resolveIndicatorPixelWidth + IndicatorWidth (internal/tooltip-chrome.ts),
  indicatorFadeGradientStops/resolveVerticalFadeSides/IndicatorFadeEdges
  (internal/fade-mask.ts), ENTRANCE_SPRING/TICKER_ITEM_HEIGHT (design-tokens),
  intFmt (formatters). bkm-tooltip-* CSS (styles.css:250-326) reused for Box;
  Tailwind utilities for Content/Ticker markup (showcase runs tailwind v4;
  migrated internals already use utilities — chart-legend.tsx:117 precedent).
- WRITTEN: the React adapter shells themselves.

Fidelity decisions (documented for lead review):
1. Spring-attribute OWNERSHIP: in animate mode React does NOT render x/cx/x1 —
   springs own them via setAttribute (framer MotionValue parity); initial pos
   written pre-paint in useLayoutEffect. Static/animate=false branches keep JSX attrs.
2. DateTicker uses .set() (animated) exactly like legacy framer useSpring(.set);
   month stack retargets only on month change (prevMonthRef mirrors legacy ref logic).
3. TooltipBox: left/top overrides accepted as plain numbers (legacy accepted
   MotionValue too — a MotionValue override is NOT portable across the imperative
   spring boundary; documented API narrowing). Entrance = 100ms opacity fade +
   translateX(±20)/scale(.85→1) entrance spring on flip change (positionBox/runEntrance
   parity). flipKey remount trick dropped — not needed without framer exit anims.
4. TooltipContent is a verbatim port (intFmt reuse).

QA spot-check PENDING (these render visibly when consumed; no migrated chart consumes
them yet — they are public-API restoration. Spot-check deferred until a consumer
exists OR via a transient mount probe; flagged to lead.)

## Gate 3 (after Step 4): PASS

TSC_EXIT=0 (ChartBackground export).

## Gate 4 (after Step 5a): PASS (after one fix)

TSC_EXIT=0. Build initially FAILED: I had added a second `export type { TooltipRow }`
from tooltip-components while P5.1's `:383` already exports TooltipRow from
tooltip-chrome — duplicate identifier, caught by build not tsc. Removed my line;
TooltipRow stays sourced from tooltip-chrome (P5.1 ruling stands; see Step 8 dedup).
Rebuild: BUILD_EXIT=0 (log captured to showcase/build-p52.log; could NOT delete it —
D216 hook blocks file deletion. **Orphan for lead: showcase/build-p52.log**).

## Step 5b recon — markers family: ALREADY PORTED (correction-7 hit #2)

Mapping (evidence):
- bklit series-point-marker.tsx SeriesPointMarkerStyle → internal/types.ts:19
  (comment at :17 says "bklit SeriesPointMarkerStyle (series-point-marker.tsx)"),
  public since P5.1 (barrel :368).
- getSeriesMarkerVisualExtent → internal/series-marker-mark.ts:14
  `getMarkerVisualExtent` — IDENTICAL math, line-for-line. Renamed.
- SeriesPointMarker/StaticSeriesPointMarker (motion enter + static circles) →
  reimplemented as TanStack-native `dot()` marks w/ radial-gradient ring
  (buildMarkerMarks/buildMarkerGradientDefs :68/:38). The per-dot motion.g blur/
  scale enter became the chart's native reveal; MarkerCircles geometry preserved via
  gradient stops (fillEnd/gapEnd math mirrors radius+ringGap+strokeWidth radii).
- ChartMarkers/MarkerGroup/SeriesMarkers (icon fan overlay) →
  internal/chart-markers.tsx MarkerGroupView (:141) + ChartMarkersOverlay (:307);
  comment :341 "matches bklit's ChartMarkers/MarkerGroup". Public already (:233).
  Fan/badge/hover/LM8 isActive all present.
→ **Markers block RESOLVED — mixed, no new ports:**
- ChartMarkers (icon fan) → migrated `ChartMarkers` marker ALREADY PUBLIC (:226) +
  runtime ChartMarkersOverlay public (:233). Legacy's MarkerGroup is the per-bucket
  view; migrated keeps it internal (MarkerGroupView). **Legacy-name alias for
  MarkerGroup/SeriesMarkers/SeriesPointMarker = P5.6 compat-rename decision**
  (same bucket as useChartSelection): the underlying components exist but under
  different names/shapes, and legacy SeriesMarkers consumed context hooks that no
  longer exist (it was a context child; migrated renders markers as TanStack dot
  marks driven by config instead). A wrapper would need invented plumbing → DOC-4
  not-trivial. Routed to P5.6.
- getSeriesMarkerVisualExtent: LEGACY DID export it (:526-533 barrel block).
  Migrated twin = getMarkerVisualExtent (identical math). **ACTION: add barrel
  alias export** (pure rename, trivially portable — unlike the components).

## RESUME 2026-08-25 (run killed at 233m, clean boundary)

Lead verified Gates 2/3/4 stand (tsc 0/build 0); build-p52.log deleted by lead.
Remaining scope ONLY: ChartRevealClip, ChartStatFlow, brush overlay trio (+HandleOverlay),
BarYAxis. Recon done pre-kill:
- Brush trio: correction-7 fired AGAIN — internal/brush-chrome.tsx implements all three
  (BrushTrackChrome :40, BrushSelectionPatternChrome :114, BrushHandleChrome :168,
  composed in BrushChrome :265, consumed by chart-brush.tsx:4,50). Plan: barrel-export
  BrushChrome; legacy-name wrappers need context host (useChartStable) that doesn't exist
  → P5.6 (DOC-4 not-trivial).
- ChartRevealClip: genuine port. Needs clipRevealTransition constants (reading now).
- ChartStatFlow: legacy uses @number-flow/react; checking dep + center-stat.tsx reuse first.
## Step 5b FINAL (2nd resume) — LANDED

- **ChartRevealClip: PORTED.** internal/chart-reveal-clip.tsx (written in prior run,
  126 lines, both branches + effect cleanup). Barrel :541-545 exports component +
  ChartRevealClipProps + ChartRevealClipMode. Built on shared WAAPI engine
  (resolveEnterTransition/revealTiming/buildProgressKeyframes from
  internal/enter-transition.ts) — framer-free, spring-faithful.
- **ChartStatFlow: correction-7 hit #4 — ALREADY PORTED as CenterStat**
  (internal/center-stat.tsx:161; docstring names bklit chart-stat-flow.tsx verbatim;
  CenterStatFormat = ChartStatFlowFormat verbatim :73; defaultCenterStatFormat =
  defaultChartStatFlowFormat verbatim :89; useNumberFlowElementReady verbatim :122).
  → barrel aliases only (:550-553): ChartStatFlow, ChartStatFlowProps,
  ChartStatFlowFormat, defaultChartStatFlowFormat. NO new component written.
- **Brush trio (+HandleOverlay): correction-7 hit #3 — already implemented inside
  internal/brush-chrome.tsx** (BrushTrackChrome :40 / BrushSelectionPatternChrome :114 /
  BrushHandleChrome :168, composed by BrushChrome :265; comments cite legacy line
  numbers; consumed by chart-brush.tsx). Legacy per-overlay public components took
  containerRef+margin from useChartStable() context — context no longer exists →
  wrappers would need invented plumbing (DOC-4 not-trivial) → **routed to P5.6**.
  Landed instead: `BrushChrome` + `BrushChromePattern` public (:558) so the composed
  runtime is reachable under its migrated name.
- **BarYAxis: type surface per DOC-9.** BarYAxisProps added to internal/types.ts:323
  (verbatim legacy shape); public at barrel :560. Component behavior routes to the
  post-pilot bar-orientation package — legacy read band geometry from removed contexts;
  porting it now would invent plumbing.

## Final gate

TSC_EXIT=0, BUILD_EXIT=0, zero "error" lines in build log.
Orphan: showcase/build-p52-final.log (build log from THIS resume; D216 blocks me
deleting it — lead please remove).

## Orphans for lead

- showcase/build-p52-final.log (this resume).
- No redundant internals were un-wired: every landed item reuses live code.

## Deliberately left for later packages

- P5.6: legacy-name compat wrappers for MarkerGroup/SeriesMarkers/SeriesPointMarker
  family, useChartSelection rename ruling, brush per-overlay components
  (ChartBrushSelectionOverlay/TrackOverlay/HandleOverlay need host-context decision).
- P5.3 ordering note: useStaticChartPreview skipped (no backing; ACCEPT-per-DOC-10
  pending their ruling).
- Post-pilot bar-orientation package: BarYAxis behavior (DOC-9 B13).
- P6-era: DEFAULT_ANIMATION_DURATION_MS hoist recommendation stands
  (six private copies confirmed identical at area:95/bar:77/candlestick:71/
  composed:144/line:86/scatter:54) — pure refactor, pixel-inert gates required,
  NOT executed here (out of remaining scope per lead's final brief).
