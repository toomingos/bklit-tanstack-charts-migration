# Phase 5 / 00 — Nativeness Audit

> How TanStack-native are `showcase/migrated/charts/`? PRELIMINARY — ungated, unlogged.
> Companion files: `01` per-deviation native paths + upstream verdicts · `02` visx removals · `03` dependency/packaging plan.

## Verdict

**Claim:** migrated charts are "TanStack-based."
**Ruling:** Substantially true for the render core; false as a blanket claim. It is a **TanStack-backed hybrid** — TanStack-core rendering with a bklit-faithful imperative chrome/animation shell.

## Aligned with native architecture

| Signal | Finding |
|---|---|
| Core pipeline | 14/17 charts mount `<Chart>` (@tanstack/react-charts) fed memoized `defineChart` specs |
| Deep integration | Subpath imports: `/polar` ×10, `/focus/disabled`, `/geo`, `/mark/scale-values`, `/svg/resources`; custom marks registered into the flat marks array |
| Interactivity | Hover chrome (`internal/hover-chrome.ts` + variants) = imperative DOM driven by TanStack focus callbacks; no per-pointermove React renders |
| Updates | Data changes flow definition→`.update()`, not re-mounts |
| Math deps | Direct d3-scale/shape/geo/sankey — same family as charts-core internals |

## Deviations (consolidated D1–D17)

| # | Deviation | Scope | Source |
|---|---|---|---|
| D1 | Funnel: plain hand-rolled React SVG | Full bypass | Original |
| D2 | Heatmap *file wrapper*: pure React tree (internals `HeatmapCells` ARE on-pipeline — hybrid) | Partial | Original, corrected by `04` |
| D3 | Gauge linear orientation: no TanStack container at all | **Full bypass** | `04` |
| D4 | Animation: WAAPI `.animate()` + custom springs (~100 sites) **plus** dataset-flag/querySelector state machine coupled to renderer internals | Subsystem | Original, expanded |
| D5 | `@visx/zoom` (choropleth), `@visx/pattern` (heatmap/pie) | Deps | Original |
| D6 | React sibling overlays: axis pills, reference areas, segment dims, marker tooltips | Chrome | Original |
| D7 | Tooltip system 100% bypassed (`createRoot` siblings, own rAF scheduler; zero `renderTooltipBody`) | Subsystem | `04` |
| D8 | Raw `pointermove` bisectors replace focus pipeline (composed, live-line, sankey, heatmap) | Interaction | `04` |
| D9 | Polar family: `/focus/disabled` + raw listeners, zero onFocusChange | Interaction | `04` |
| D10 | Defs/gradients/clips outside scene pipeline (sibling defs hosts, createElementNS, `<style>` injection) | Paint resources | `04` |
| D11 | Renderer-DOM scraping/mutation as app state (`dataset.bkmRevealed`, `[data-ts-key]`/`.ts-chart__dot` queries, body-fallback roots) | Coupling | `04` |
| D12 | Measurement duplicated (custom ResizeObserver hook ×14 vs library fluid sizing) | Layout | `04` |
| D13 | Parallel reduced-motion plumbing (~12 matchMedia sites) | Consequence of D4 | `04` |
| D14 | Imperative replay outside setState→definition (sunburst `playKey` hand-calls handleRender; unscoped getElementById) | Update path | `04` |
| D15 | Custom legends (library ones unused); hardcoded English ariaLabels; `ariaDescription` unused | A11y/chrome | `04` |
| D16 | Text split-brain: sunburst second SVG + rAF ticker; overlay ticks duplicate scale math | Text | `04` |
| D17 | Window reach-ins (`innerHeight`, extra resize listener, window pointer-capture drag-select) | Minor | `04` |

Net re-phrasing of the claim: less "TanStack-core with a chrome shell" than first audited — TanStack marks/scales core with **parallel tooltip, legend, interaction, animation subsystems** built beside it.

## Method

Import census across `showcase/migrated/charts/**` (34 files import @tanstack; heatmap zero); per-chart state-hook/raw-JSX scan; source reads of line/funnel/heatmap/hover-chrome internals. Reference model: `research/phase-2/tanstack-native/`.
