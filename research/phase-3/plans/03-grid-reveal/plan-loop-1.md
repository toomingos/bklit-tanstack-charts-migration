# Initiative 3 — Plan Loop 1: Grid + Background + FadeEdges/IndicatorFade + YAxis + Reveal/Animation/Loading (FINAL — initiative 2 approved D210)

Synthesized from `research/phase-3/audits/03-grid-reveal.md` (stub) + inventory `05-consolidated-internals.md` families 17–18 + `06-deferred-chrome.md` cross-cutting note 2, spot-verified against the working tree on 2026-08-18 (post-D209). Finalized 2026-08-19 after initiative 2 approval (D210): verify-at-finalize list executed — fade residuals re-confirmed (line/area/composed + `types.ts` + `hover-chrome.ts`), loading residuals re-confirmed (area/composed/heatmap/line/sunburst), pattern-preset ruling made (D211: pulled forward into this initiative), threading idiom locked to initiative 2's (chrome modules are plain TS taking optional options that default to token objects; charts read `useChartConfig()`/props at component level and pass resolved values in — D3's mask module and D1's shimmer must follow it), and `qa/screenshot.mjs` confirmed to have NO loading-state capture (gate decision recorded below).

## Verified current state (working-tree greps, 2026-08-18)

- Reveal/animation timing is DONE (initiative 1, D207): `REVEAL_DURATION_MS 1100` / `REVEAL_EASE_CSS cubic-bezier(0.85,0,0.15,1)` live in `internal/design-tokens.ts`; `ChartRevealClip` analog is `internal/deferred-reveal.ts`. Initiative 3 must NOT rebuild these — it consumes them.
- Grids render via TanStack guides on cartesian charts; `GridConfig` is a carrier subset (`internal/types.ts:112–119` — horizontal/vertical/stroke/strokeOpacity/strokeWidth/numTicks) consumed by `children.tsx`/`composed-chart.tsx`. bklit `grid.tsx` extras missing: `useGridShimmer`, `highlightRowValues`, `DEFAULT_SHIMMER_LENGTH_PX 140`.
- Axes: `internal/y-axis-overlay.tsx` / `internal/x-axis-overlay.tsx` are already single parameterized impls (inventory §2 — do not fork). bklit `y-axis.tsx` + `y-axis-ticks.ts` parity gaps to be audited per-prop at implementation time.
- FadeEdges/IndicatorFade: partial — `fadeEdges`-ish handling exists in `types.ts`, `hover-chrome.ts`, line/area/composed; bklit `fade-edges.ts` + `indicator-fade.ts` are the ground truth (mask-based).
- Background: NO migrated counterpart of bklit `background.tsx` (`BACKGROUND_ENTER_FADE_MS 420`, pattern fill support).
- Loading chrome: 1/10 — only `HeatmapChartLoading`; residual ad-hoc `loading` handling in `area/composed/line/sunburst/heatmap` chart files. bklit family: `loading-sweep.tsx`, `line-loading-pulse.tsx`, `line-loading-timing.ts`, `area/bar/line-chart-loading.tsx`, `chart-loading-label.tsx`, `use-grid-shimmer.ts`. Skeleton DATA generators are initiative 12's, not ours.

## Deliverables

### D1. Grid parity module — shimmer + row highlight on the guides path
Extend the single grid path (guides config + `GridConfig` carrier) with bklit `grid.tsx` parity: `highlightRowValues`, grid shimmer (`use-grid-shimmer` port as CSS `@keyframes` on stable nodes — stack §8.2 forbids per-frame React state; `DEFAULT_SHIMMER_LENGTH_PX 140` → design tokens). One module, all cartesian charts consume it; no per-chart grid forks.

### D2. `internal/background.tsx` — bklit Background 1:1
`BACKGROUND_ENTER_FADE_MS 420` → design tokens. Pattern-fill support: RULING MADE (D211, option a) — `pattern-preset.tsx` (186 lines, 8 preset ids, leaf module) is pulled FORWARD into this initiative as `internal/pattern-preset.tsx` (defs-layer module, bklit 1:1). Initiatives 6 (ReferenceArea) and 11 CONSUME it from this single module — no second fork. Initiative 11's scope note must be updated when its plan is synthesized.

### D3. FadeEdges + IndicatorFade — single mask module
Port `fade-edges.ts` + `indicator-fade.ts` semantics into one `internal/` mask module; migrate the partial fade handling in line/area/composed + `hover-chrome.ts` onto it (delete inline forks). Default rendering must be pixel-identical where bklit shows no fade.

### D4. YAxis parity pass
Per-prop diff of bklit `y-axis.tsx`/`y-axis-ticks.ts` vs `internal/y-axis-overlay.tsx`; close gaps INSIDE the existing single overlay (no new axis module). Same for `x-axis-overlay` only where initiative-3 features (shimmer/highlight) touch it.

### D5. Loading chrome consolidation (initiative-3 share)
One loading module family (sweep, pulse, label, per-family chart-loading composition) built as CSS keyframes on stable nodes; replace the 5 residual ad-hoc `loading` paths (area/composed/line/sunburst/heatmap — heatmap's existing `HeatmapChartLoading` migrates onto the shared module or is ruled a documented exception). Skeleton data generators stay in initiative 12.

## Gate plan

Affected charts: all cartesian (line/area/bar/scatter/candlestick/composed/liveline) for D1/D3/D4 + any chart with a loading path for D5. Q1 across ALL affected charts at baseline n; default rendering (no shimmer/highlight/background/fade props set) must be pixel-identical — any settled diff above the chart's pre-initiative baseline is a bug. **Loading-state gate decision — EXECUTED (D213)**: the lead extended `qa/screenshot.mjs` with `--state loading` (bench `?state=loading` → `status="loading"` in the line/area/heatmap scenario pairs; Playwright `reducedMotion: "reduce"` pins both impls' differently-engined loading animations to their static frame; fixed 1500ms post-paint wait, single frame, no hovers). RULING: the ≤0.5% pixel gate is necessary but NOT sufficient for loading states (line's structurally wrong render diffs only 0.195%) — D5 approval also requires lead visual inspection of the loading-a/b PNGs. Pre-D5 baselines: line 0.195% (migrated draws full series during loading), area 20.77% FAIL (full area, missing `loadingLabel` prop), heatmap 2.65% FAIL (full grid, label mis-positioned). D5 additions: loading chrome must honor `prefers-reduced-motion`; area gains `loadingLabel`. Animation dynamics remain on manual Chrome verification. G1–G4 re-run for charts whose render path changed. Q2 zero console errors (note pre-existing D208 item 8 bar/composed WAAPI height WARNINGS — not errors, not attributable to this initiative). Q3 greps: no `@keyframes`/shimmer/fade/pattern definitions outside the internal modules.

## Verify-at-finalize — EXECUTED 2026-08-19 (all four items, results in header)
