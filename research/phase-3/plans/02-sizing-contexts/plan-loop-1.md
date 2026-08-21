# Initiative 2 — Plan Loop 1: sizing + contexts host (FINAL — initiative 1 approved D207)

Synthesized from `research/phase-3/audits/02-sizing-contexts.md` + inventory 05 families 12–14, re-verified against the working tree on 2026-08-18 (post-D205), re-verified again post-initiative-1 (D207: design tokens landed in `internal/design-tokens.ts`; ChartScale dedup explicitly deferred here per D207 ruling b).

## Verified current state

- Sizing is ALREADY consolidated: `new ResizeObserver` has exactly one definition module, `internal/use-container-size.ts` (4 hooks: `useContainerWidth`, `useDebouncedContainerWidth` 10ms ParentSize parity, `useMeasuredRect`, `usePositiveChartSize`). Inventory family 13's "14 files" count is stale (pre-D205).
- Standalone exceptions confirmed and preserved per audit: sunburst uses its bklit-parity `size` prop (fixed square); sankey sizes via CSS `aspectRatio` and uses one `getBoundingClientRect` only for tooltip positioning; heatmap zero-size behavior lives in `usePositiveChartSize`.
- Contexts: migrated package exports NO `ChartProvider`/`ChartConfigProvider`; bklit exports both publicly (`charts/index.ts:106/117`). No showcase demo or app route consumes either. bklit `ChartConfigValue = { tooltipSpring {300,30}, tooltipBoxSpring {100,20}, highlightSpring {180,28} }`.
- `ChartScale` stashes remain in exactly 5 files (re-grepped post-initiative-1): `bar/scatter/candlestick/composed` via the `resolveConfiguredScale` helper, plus `line-chart.tsx:153–156` via a raw `ChartScale.resolve` stash (C1 time-scale). Inventory family 12's area/live-line/radar entries are STALE — those charts no longer stash.

## Deliverables

### D1. `internal/chart-config-context.tsx` — bklit `ChartConfigProvider` 1:1

Port bklit `chart-config-context.tsx` semantics verbatim: `SpringConfig`, `ChartConfigValue`, `DEFAULT_CHART_CONFIG` (values imported from `internal/design-tokens.ts` — same objects, no re-inlined literals), `ChartConfigProvider` (shallow merge over defaults), `useChartConfig` (null → defaults), `resolveTooltipBoxMotion` (damping-slider mapping, verbatim formula). Export `ChartConfigProvider`/`ChartConfigProviderProps`/`useChartConfig` from `@showcase/migrated-charts` index.

Propagation: every hover-chrome module that today hardcodes `TOOLTIP_SPRING`/`TOOLTIP_BOX_SPRING`/`HIGHLIGHT_SPRING` values reads them via `useChartConfig()` at the chart component level and passes them into the chrome (chrome modules are plain TS, not React — thread the resolved config through their existing options/params). Default path must be bit-identical to today (defaults === design tokens).

### D2. `ChartProvider` ruling — do NOT rebuild (lead ruling to log)

bklit's `ChartProvider` is a React hover-state context; the layer contract + audit prohibit rebuilding React hover contexts (TanStack `focus` owns hover). No showcase consumer exists. Ruling to record in `LOG.md`: migrated package intentionally does not export `ChartProvider`/`useChartHover`; hover state parity is delivered through TanStack focus + the initiative-4 tooltip. Same ruling covers `static-chart-preview-context` unless a consumer is found at implementation time.

### D3. Sizing verification + doc normalization (no behavior change)

- Sweep: every chart consumes exactly one `use-container-size` hook OR one documented exception (sunburst `size`, sankey `aspectRatio`, funnel/gauge-linear plain-SVG D30 escape). Fix any stragglers found by the sweep; no new sizing code.
- Confirm debounce parity: charts that map to bklit `ParentSize debounceTime={10}` consumers use `useDebouncedContainerWidth`.

### D4. `ChartScale` stash normalization

For each of the 5 stash sites (bar/scatter/candlestick/composed via `resolveConfiguredScale`; line via raw `ChartScale.resolve`): (a) verify a real overlay/chrome consumer of the resolved scale exists — if none, delete the stash and use plain scale config; (b) migrate line-chart's raw stash onto the shared `resolveConfiguredScale` helper so there is ONE stash idiom; (c) normalize the escape-hatch comment to one canonical wording referencing D110. No stash removal where a consumer exists — that is initiative 4/5 territory (hover chrome replacement may obsolete some stashes; re-audit then).

## Gate plan

Affected charts: only those whose chart files change (D1 threading + D4 deletions). Pure-refactor expectations: Q1 ~0%, Q3/type/Q2 clean; G1–G4 re-run only for charts with code changes on the render path.

Sequencing constraint (D208 item 1): bar-chart Q1 evidence is only meaningful after the standalone bar grouped-layout fix lands and re-passes `qa/screenshot.mjs --chart bar` at ≤0.5%. Initiative 2 must gate against the FIXED bar baseline; if the fix is still pending at gate time, bar's Q1 row is blocked, not waivable.
