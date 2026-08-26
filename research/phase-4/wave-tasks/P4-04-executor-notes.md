# P4.4 executor notes (running log — insurance against kill; final report supersedes)

Started: 2026-08-25. Executor: ox-alpha. Charter: P4-04.md + dispatch wrapper.
Fences honored: ring/radar/pie/gauge/funnel-chart.tsx, enter-transition.ts, *center*, *hover-chrome*.ts NOT opened for writing.

## Recon (fresh greps, pre-edit)

- `useSanitizedId`: ZERO hits repo-wide → helper must be created. Wrapper correction CONFIRMED.
- Inline `useId().replace(/[^a-zA-Z0-9_-]/g,"")` sites = **11 files**, matching wrapper list exactly
  (NOT the brief's 14): area×5 (219,279,316,381,1011), bar×2 (376,403), candlestick:201,
  composed×2 (527,657), line×3 (196,212,968), scatter:282, internal/background.tsx:47,
  internal/dash-tail.ts:70, internal/loading-chrome.tsx:45, internal/reference-area-layer.tsx:104.
  Extra hit NOT a site: internal/bar-pulse-mark.ts:207 (non-useId sanitizer fn).
  dash-tail.ts:218 uses different regex (`_` replacement) — not a site, leaving alone.
- prefersReducedMotion inline sites (current tree): line:644,719 · composed:1266,1377 ·
  area:894,961 · segment-visuals.tsx:31 · reference-area-layer.tsx:219 · chart-markers.tsx:184
  = **8 sites / 6 files** (brief said 9 incl. chart-markers; gauge drifted).
  - gauge.tsx: ALREADY canonical (uses hook at 363,971; matchMedia only in a comment) → fence costs nothing. SKIPPED (nothing to fix).
  - funnel-chart.tsx: **2 REAL inline sites (451,483)** — FENCED (P4.3), skipped, reported. Funnel claim in centralize.md CONFIRMED PRESENT.
- CHART_ROLE raw sites: exactly 3 (chart-selection.ts:193; reference-area-config.ts:23,68). Matches brief.
- intFmt dupes: exactly 2 (chart-legend.tsx:7, legend.tsx:163); canonical formatters.ts:24. Matches brief.
- profit-loss-legend-hover.tsx: consumers = barrels ONLY (charts/index.ts:300-302, internal/index.ts:141-143).
  No consumer in showcase/components/demos or anywhere else in showcase/. → DEAD, plan: unwire both barrels, orphan file left for lead.
- checkRevealGuard: single impl (deferred-reveal.ts:39, consumed :160,:227). Already satisfied → STALE CITATION.
- blurPx: TWO `= 1.5` defaults exist: chart-brush.tsx:41 AND brush-chrome.tsx:271 (draft grep missed the latter). Reading before ruling.
- DEFAULT_MARGIN: 11 decls; exactly 6 identical {40,40,40,40} (area,line,composed,candlestick,bar,scatter);
  others legitimately differ (choropleth 0s, live-line, sankey, radar scalar, heatmap-context).
  Plan: fold ONLY the 6 into one shared const in use-chart-margin.ts.
- XAxisOverlay importers: area,bar(no—BarXAxisOverlay),candlestick,composed,line,scatter ✓ matches brief.

## Item ledger
- [LANDED] T-C6 intFmt — legend.tsx:163 + chart-legend.tsx:7 local decls dropped; `import { intFmt } from "./formatters"` added to both.
  Grep proof post-edit: only remaining `new Intl.NumberFormat("en-US")` in tree is formatters.ts:24.
  (chart-legend.tsx keeps its ReactNode import — it IS used at line ~36.)
- [LANDED, post-resume] T-C10 item 3 CHART_ROLE — all 3 raw sites converted:
  reference-area-config.ts (import :2; sites now :24,:69) + chart-selection.ts
  (import :5; site now :194). Post-edit grep: `Symbol.for("migrated.chartRole")`
  survives ONLY at children.tsx:35 (the canonical definition). No import cycle:
  children.tsx imports nothing from internal/ at runtime (type-only).
- [LANDED, post-resume] T-C10 item 4 SegmentComponent — the two bodies were
  BYTE-IDENTICAL (key: string; type union "segmentBackground"|"segmentLineFrom"|"segmentLineTo";
  props Record<string,unknown>). Canonical = chart-selection.ts (the live one; all four charts
  import only extractSegmentComponents from it). segment-visuals.tsx now imports the type and
  re-exports (`export type { SegmentComponent }`), preserving its export surface. No external
  consumers of either declaration existed (grep: only extractSegmentComponents is imported by
  area/candlestick/line/composed). No new module edge — segment-visuals already imported
  ChartSelection from chart-selection.
- [LANDED, post-resume] T-C10 item 2b ChartMarker — types.ts:535 and chart-markers.tsx
  declarations confirmed BYTE-IDENTICAL on disk (all 10 fields). chart-markers.tsx local decl
  dropped; now `import type { ChartMarker } from "./types"` (:6) + `export type { ChartMarker };`
  (:8) preserving export surface. File matches P3.13b-closed state; no surprises.
- [LANDED, resume#2] T-C6 legend-hover — profit-loss-legend-hover.tsx ruled DEAD (fresh grep:
  consumers were barrels only). Un-wired BOTH barrels: charts/index.ts (removed export block
  formerly at :299-302) + internal/index.ts (removed block formerly at :140-143).
  Post-edit grep: zero references to ProfitLossLegendHoverProvider/useProfitLossLegendHover/
  profit-loss-legend-hover anywhere in showcase/ except the orphan file itself.
  ORPHAN LEFT FOR LEAD: showcase/migrated/charts/internal/profit-loss-legend-hover.tsx (31 lines).
  Note: canonical ChartLegendHoverProvider already has the passthrough marker? NOT VERIFIED —
  irrelevant now since orphan is dead, but noted for accuracy.
- [LANDED, resume#2] useSanitizedId helper CREATED (did not exist): showcase/migrated/charts/internal/use-sanitized-id.ts
  (`useId().replace(/[^a-zA-Z0-9_-]/g, "")`, house style, no comments).
  Internal sites converted so far (4/11 files): background.tsx (:48), dash-tail.ts (:71),
  loading-chrome.tsx (:46), reference-area-layer.tsx (:105). Checkpoint `npx tsc --noEmit`
  from showcase/ → TSC_EXIT=0. Host charts next.
- [LANDED, resume#2] useSanitizedId ALL 11 FILES CONVERTED:
  scatter:283 · candlestick:202 · bar:377,404 · area:220,280,317,382,1012 · line:197,213,969 ·
  composed:528,658 (+ the 4 internal sites above). Repo-wide proof:
  `useId().replace(/[^a-zA-Z0-9_-]/g,"")` = ZERO hits outside the helper itself;
  useSanitizedId present in all 11 files (29 occurrences).
  NOTE: surviving `useId().replace(/:/g,"")` colon-only variants in gauge.tsx:288,
  heatmap-legend.tsx:37, heatmap-components.tsx:316+1060, brush-chrome.tsx:132 are a
  DIFFERENT pattern never in this item's scope (likely why brief counted "14").
- CHECKPOINT tsc after full conversion: TSC_EXIT=2, ALL 13 ERRORS IN FENCED P4.3 FILES
  (funnel/gauge/pie-center/pie/ring vs enter-transition exports mid-rename).
  ZERO errors in my 12 touched files. Not mine to fix; will re-diff error set at final gate.
- [RESUME#3] Killed mid-prefersReducedMotion. On disk BEFORE death (edit_file confirmed):
  line-chart.tsx FULLY converted (hook :203; sites :647,:651,:721; deps :715,:725),
  area-chart.tsx FULLY converted (hook :219; sites :897,:963; deps :957,:967),
  composed-chart.tsx BOTH sites converted (import :125, hook :497, handleRender :1288,
  effect :1379-1383 + deps) but NOT yet grep-verified post-edit.
  REMAINING for this item: internal/segment-visuals.tsx:27 (NOTE: sits AFTER early return
  at :25 — must HOIST hook above the return, rules-of-hooks), internal/reference-area-layer.tsx:220
  (ref-assignment shape, read context first), internal/chart-markers.tsx:175 (simple swap).
- [RESUME#3] OVERTURNED BY LEAD (docs/phase-4/LOG.md D296): my T-C6 legend-hover DEAD ruling
  is REVERSED. profit-loss-legend-hover.tsx is PUBLIC API-PARITY SURFACE under MAIN GOAL (c):
  bench/app/src/scenarios/migrated-profitloss.tsx:14 consumes both names via charts/index.ts
  (outside my showcase/-scoped grep — my miss; charter P4-04.md:36 told me to check).
  Both barrel exports RESTORED by lead with warning comments. DO NOT RE-REMOVE.
  Reclassified: ACCEPT-with-reason — kept for API parity (D296). Nothing to code.
  LESSON LOGGED: for ANY future removal/rename of an exported name, grep the WHOLE repo
  (bench/, qa/, showcase/components/) — bench/app has its OWN tsconfig covered by NEITHER
  showcase tsc NOR showcase build.
- [RESUME#3] NEW FENCE honored: showcase/migrated/charts/styles.css AND
  bench/app/src/styles.css are lead-owned (D297). T-C9 plan stays pure-TSX (chrome is
  inline styles), no CSS writes needed.
- [RESUME#4] Died mid-segment-visuals.tsx: import added (:5, confirmed) but HOIST NOT YET
  APPLIED — early return still at :25, inline matchMedia still at :27. Next edit = hoist
  `usePrefersReducedMotion()` above the return + swap :27. Then chart-markers.tsx (~:175).
  After that item 1 is DONE pending tsc checkpoint (baseline = 13 fenced P4.3 errors).
  ACK D299 (markers fadeEdges mask fix — styles.css, lead-owned) + D300 (marker-dot reveal
  finishes ~350ms after __benchSettled; dot-attach at line-chart.tsx hasMarkers site —
  DEFERRED/UNASSIGNED, will not touch; my line-chart edits were prefersReducedMotion-only,
  no reveal-timing changes made or planned).
- [RESUME#4] prefersReducedMotion COMPLETE — all sites converted:
  line-chart.tsx (hook :203; uses :647,:651,:721; deps :715,:725),
  area-chart.tsx (hook :219; uses :897,:963; deps :957,:967),
  composed-chart.tsx (hook :497; uses :1288,:1379; deps :1373,:1383),
  segment-visuals.tsx (HOISTED above early return :26→:27; use :49),
  reference-area-layer.tsx (ref+mount-effect REPLACED by hook :219; layout-effect deps
  [visible,isLoaded,prefersReducedMotion] :238 — behavior note: SSR snapshot false = same
  as pre-conversion ref default),
  chart-markers.tsx (`reduced` now hook-backed :176).
  Proof grep: inline matchMedia reduce sites = ZERO outside canonical hook file;
  funnel-chart.tsx:451,483 remain (fenced, optional-chaining variant, reported as skip);
  gauge.tsx already canonical. Hook adoption count: composed,line,area,gauge,sankey,sunburst
  hosts + segment-visuals,terminal-marker,reference-area-layer,heatmap-lifecycle,chart-markers internals.
  CHECKPOINT tsc: TSC_EXIT=0 — P4.3's 13 enter-transition errors GONE (their rename landed);
  zero errors in any file I touched.
  D300 observation for report: line-chart.tsx dot-attach at :652 confirmed present, untouched.
- [RESUME#4] T-C9 LANDED — shared leaf `XAxisLabel` created in x-axis-overlay.tsx (:328;
  chrome: left/bottom:12/width:0/flex-center div + span with data-bkm-xlabel, data-bkm-x,
  nowrap, fontSize 12, lineHeight 1rem, color var(--color-chart-label, var(--chart-label)),
  opacity transition 0.4s ease-in-out; optional `positionTransition` prop for x-axis's AX5
  tween). XAxisOverlay render loop now maps ticks through it (:522, AX5 preserved via prop,
  gated on xDomain == null exactly as before); BarXAxisOverlay imports + renders through it
  (:13,:52) — bar's modulo tick-thinning UNTOUCHED (labels useMemo identical), x-axis's
  selectEvenlySpacedIndices path UNTOUCHED. No CSS files touched (D297/D299 fence honored).
  CHECKPOINT tsc: TSC_EXIT=0.
- [RESUME#4] T-C10 item 5 LANDED — choropleth zoom-writers MERGED into one `syncZoomTransform`
  (choropleth-chart.tsx:403) with optional `(svgOverride?, marksGOverride?)` params.
  Load-bearing side effect PRESERVED: `marksGRef.current = mg` now runs on EVERY marks-group
  write (:409), superset of the old first-render-only establishment — handleRender's explicit
  path (:434) and ref-based rAF paths (:585,:586) both behave identically to before.
  applyZoomToGroups DELETED; its only caller (handleRender dep array :488) repointed.
  CHECKPOINT tsc: TSC_EXIT=0.
- [RESUME#4] C15 / item 6 LANDED — count VERIFIED = 4 sites (brief right, redundancies.md
  wrong): composedTerminalAnchors xForDate, composedEndAnchors xForDate (byte-identical pair),
  projectionGradientDefsComposed xScaleWithProjection, definition's projection-line block
  xScaleWithProjection. One LOCAL NON-EXPORTED helper `composedExtendedXForDate` at :168
  (module scope; closes over nothing). Sites now :747,:771,:799,:918 — each keeps its own
  guards/deps. DEFERRED items untouched: line-chart.tsx still has own xForDate ×2 + 
  xScaleWithProjection ×2 (:372,:784,:832,:874), area-chart.tsx likewise (:468,:496,:528,:677);
  sunburst maxRevealDelayMs untouched. CHECKPOINT tsc: TSC_EXIT=0.
- [RESUME#4] DEFAULT_MARGIN fold LANDED — shared const `DEFAULT_CHART_MARGIN` added to
  use-chart-margin.ts (:23) + re-exported via internal/index.ts (:12). NAME NOTE: NOT
  `DEFAULT_MARGIN` — the internal barrel already re-exports heatmap-context's per-family
  DEFAULT_MARGIN ({28,16,0,40}); a same-named export would collide. Six identical
  {40,40,40,40} local decls DELETED (line:97→, area:108→, candlestick:94→, bar:91→,
  scatter:173→, composed:160→); all six now import DEFAULT_CHART_MARGIN (+ type ChartMargin,
  replacing their deleted local `Margin` interfaces in props types).
  Legitimately-different defaults UNTOUCHED: choropleth {0,0,0,0}, live-line {24,16,32,16},
  sankey {40,180,40,180}, radar scalar 60, heatmap-context. CHECKPOINT tsc: TSC_EXIT=0.
- [RESUME#4] blurPx RULED: NO FOLD, legitimately independent. chart-brush.tsx:41 default
  feeds <BrushChrome blurPx={...}>; brush-chrome.tsx:271 keeps its OWN default because
  BrushChrome is exported and renderable standalone (standard React layered-default pattern).
  Behavior single-sourced: the clamp (Math.min(5,max(0,blurPx))) exists ONCE downstream
  (BrushTrackChrome path). Two agreeing literals in a parent→child chain ≠ duplicated logic.
  ACCEPT-with-reason; no code changed.
- [RESUME#4] checkRevealGuard CLOSED: STALE CITATION — single implementation
  deferred-reveal.ts:39, consumed :160/:227, no second variant repo-wide.
- [FINAL] QA PIXEL GATES NOT RUN. Reason: 4 external kills spread every edit across separate
  sessions; D288 requires standalone same-shape BEFORE numbers per chart, which are
  uncapturable post-hoc (tree already fully edited). Numbers now would be methodologically
  invalid for regression attribution. Recommend lead's consolidated sweep (bar n=100,
  heatmap 52, legend 4, others 1000; never impl=tanstack). Showcase tsc gate: TSC_EXIT=0
  at every checkpoint including final tree. Temp files created: NONE (notes file only).
  Orphans for lead deletion: NONE remaining (profit-loss-legend-hover.tsx restored per D296;
  applyZoomToGroups/xForDate/Margin/DEFAULT_MARGIN removals were all intra-file or local,
  no files orphaned).
