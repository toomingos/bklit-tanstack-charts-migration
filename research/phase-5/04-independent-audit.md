# Phase 5 / 04 — Independent Deviation Audit

> Unbiased re-audit of `showcase/migrated/charts/` vs the claim "based on TanStack Charts" (vendored clone @ ~2026-07-30 as ground truth). Agent steered only by the claim + known-deviations exclusion list. Findings below are NEW items beyond `00`'s list; file:line verified by the agent against clone APIs.

## New findings

| # | Finding | Confidence | Evidence |
|---|---|---|---|
| 1 | **Tooltip system 100% bypassed** — zero `renderTooltipBody` uses; imperative DOM chrome with **separate React roots via `createRoot`**, custom rAF commit scheduler, spring box motion. Applies to line/area/bar/scatter/composed/candlestick/live/sankey/heatmap | high | internal/tooltip-chrome.ts:3,309–352 · tooltip-scheduler.ts:40 · lib-native renderer.ts:66–85 |
| 2 | **Raw `pointermove` bisectors replace adapter focus pipeline** in composed (header admits it), live-line, sankey, heatmap-components | high | composed-chart.tsx:1053,1212 · live-line-chart.tsx:500 · sankey-chart.tsx:566 · heatmap-components.tsx:410 |
| 3 | **Polar family opts out of library interaction** — `focusDisabled` + raw pointerenter/leave/click on reconciler groups via querySelector; no onFocusChange anywhere | high | pie:54,614 · ring:42,722 · sunburst:44,703 · radar:14,736 |
| 4 | **Defs/gradients/clip managed outside scene pipeline** — no chart uses definition-level `gradients:` (idPrefix-scoped); instead 0×0 sibling `<svg>` defs hosts w/ document-wide url(#id), raw `createElementNS` defs/clipPath injection inside marks, `<defs>`+`<style>` injected into chart svg (sankey) | med-high | scatter:402 · pie:724 · gauge:854 · bar-pulse-mark.ts:221 · sankey-animation.ts:94–120 · lib-native types.ts:335 |
| 5 | **Renderer-DOM scraping/mutation as app state** — dataset flags written onto `.ts-chart__marks`, querySelector of `[data-ts-key]`/`.ts-chart__dot` internals across 8+ charts; choropleth dim-wrapper even roots at document.body fallback. These are renderer implementation details, not public API | medium | line:643 · composed:1221 · candlestick:832 · scatter:690 · choropleth:439,179–200 · deferred-reveal.ts:43 · dash-tail.ts:61 · hover-chrome.ts:404 |
| 6 | **Measurement duplicated** — all 14 Chart hosts self-measure via custom ResizeObserver hook (10ms debounce, 0.5px epsilon) instead of library fluid sizing (`width` undefined → 100% + aspectRatio is supported) | medium | use-container-size.ts:31–226 · adapter-shared.ts:32–45 |
| 7 | **Parallel reduced-motion plumbing** — ~12 independent matchMedia sites while runtime already honors the query; consequence of WAAPI layer sitting outside the library | low-med | use-prefers-reduced-motion.ts:4 + 11 call sites |
| 8 | **Imperative replay/update outside setState→definition** — sunburst `playKey` queries `svg.ts-chart`, deletes flags, hand-calls `handleRender` because definition unchanged; loading chrome pokes wipe rect via global unscoped getElementById | medium | sunburst-chart.tsx:956–986 · loading-chrome.tsx:71 |
| 9 | **Legend/a11y chrome fully custom** — library ships `colorLegend`/`colorGradientLegend`; unused. Four bespoke legend systems. `ariaLabel` hardcoded English per call site; `ariaDescription` never used | low-med | internal/legend.tsx · chart-legend.tsx · heatmap-legend.tsx · profit-loss-legend.tsx · line:1018 |
| 10 | **Text rendering split-brain** — sunburst labels in second hand-rolled `<svg>` driven by own rAF ticker (inside otherwise on-pipeline chart); axis/tick text in React overlays with duplicate d3-scale math | medium | sunburst-labels.tsx:56 · sunburst-chart.tsx:447 · y-axis-overlay.tsx:64 |
| 11 | **Direct window/layout reach-ins** — window.innerHeight as layout input; extra window resize listener beside RO; drag-select via window pointer capture (extension: library onSelect is single-point, no native brush) | low | sankey:203 · brush-drag.ts:118,342 · chart-selection.ts:149 |

## Reassessment of known deviations

- **#1 heatmap OVERSTATED**: the *file* bypasses, but exported `HeatmapCells` runs the full pipeline (`defineChart`+`cell`+`<Chart>`, heatmap-components.tsx:18–19,192–210). Family is hybrid, not zero-TanStack.
- **#3 WAAPI UNDERSTATED**: drags finding #5's dataset-flag/querySelector state machine with it — coupling, not just animation tech.
- #2 funnel / #4 visx / #5 overlays: confirmed accurate (overlays item should absorb defs-host siblings, finding #4).

## Compliance ranking & hidden bypasses

- **Most compliant:** bar, scatter, choropleth (stock marks, focus strategies via defineChart options, native geoShape). Line/area/candlestick close behind.
- **Third full bypass found:** **gauge linear orientation** — plain hand-rolled `<svg>`, NO TanStack container (gauge.tsx:10–32 admits it). Arc variant is on-pipeline.
- Off-pipeline fragments inside on-pipeline charts: sunburst labels (#10), tooltip chrome everywhere (#1).
- No bklit-ui source imports in migrated code; no dead pre-migration modules.
