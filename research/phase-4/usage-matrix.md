# Phase 4 Usage Matrix — internal/ module SHARED vs UNIQUE (4.1.4.2)

Date: 2026-08-21 · Verdict column redone 2026-08-21 (shareability semantics — see below)
Method: mechanical import-graph analysis (`scripts/tmp-usage-matrix.mjs`) — parsed all static imports and `export … from` re-exports (incl. `import type`, multiline clauses, comment-stripped) across the 143 files under `showcase/migrated/charts/`, resolved relative specifiers (`.ts`/`.tsx`/`/index.ts`), expanded named bindings through the two facade barrels (`charts/index.ts`, `internal/index.ts` — facades are never counted as importing parts), attributed every edge to its taxonomy part, and counted distinct importing parts per `internal/` module. Same-part edges do not count.

Verdict semantics (REDO 2026-08-21): the original pass classified strictly by mechanical import count. That is wrong for this deliverable's purpose, so the Verdict column now records **shareability**, layered over the unchanged import evidence:

- **SHARED** — logic already imported by 2+ taxonomy parts (`Count >= 2`). Trivially shared; no re-analysis.
- **SHARED (shareable)** — single-consumer or orphan module whose logic is already duplicated/parallel in OTHER parts' modules (or inline in their components) and CAN be refactored/centralized to serve them. Every upgrade names the counterpart parts and concrete counterpart modules/patterns, confirmed against source (not reports alone).
- **UNIQUE** — inherently part-specific logic/patterns; nothing similar exists or plausibly belongs in another part. "Could theoretically be generalized" without a named duplicate is NOT sufficient and stays UNIQUE.
- **ORPHAN** remains a dead-code signal (Count 0) shown in its own column; orphans also receive a shareability verdict, since an orphan may duplicate logic living elsewhere (relevant for later synthesis).

**⚠ Totals below are the 2026-08-21 snapshot and are now WRONG by at least 14** — see the staleness warning above; 14 of the modules counted here no longer exist.

Totals: **122 internal modules** → **49 SHARED** (already 2+ parts) · **37 SHARED (shareable)** upgrades (6 of them orphans) · **36 UNIQUE** (3 of them orphans) · **9 ORPHAN** overall (6 shareable / 3 unique).

> ## ⚠ STALENESS WARNING — READ BEFORE USING THIS FILE AS A WORK QUEUE (added 2026-08-25, D317)
>
> This matrix is a **snapshot of 2026-08-21**, taken before Waves 2-5 landed. Wave 6 is chartered to
> consume the `SHARED (shareable)` column as its centralization queue, so the decay direction that
> matters here is: **a row asserting that duplication EXISTS may describe work that has since been
> DONE.** That is the mirror image of D310 — a *positive* existence claim, and like D310's negative
> one it fails **silently**: an executor sent to "centralize X" finds nothing to centralize and burns
> a run discovering the row was already satisfied.
>
> A mechanical existence check on 2026-08-25 (does the file named in column 1 still exist under
> `showcase/migrated/charts/`?) found **14 of 142 rows naming a module that is GONE** — every one of
> them work an earlier wave already completed. They are annotated `✅ RESOLVED` in place below.
> `styles.css` is not among them (it exists; it is simply not a `.ts*` file).
>
> **4 modules have no reference left anywhere** — `bar-pulse-overlay`, `focus-disabled`,
> `pie-reveal`, `ring-reveal`. **5 survive only inside comments** of the module that absorbed them —
> `funnel-reveal` (-> `internal/radar-spring.ts`), `hover-reanchor` (-> `internal/hover-chrome.ts`,
> `line-chart.tsx`), `tooltip-scheduler` (-> `internal/tooltip-chrome.ts`), `visx-pattern-bridge`
> (-> `internal/pattern-preset.tsx`, the original D304 instance), `x-ticks` (->
> `internal/x-axis-overlay.tsx`, `internal/bar-x-axis-overlay.tsx`). A live import of any of them
> would have broken the build, and the build is green — which is why the comment references are
> proof of absorption, not of survival.
>
> **The 128 surviving rows were NOT re-verified**, only their filenames were. A row whose file still
> exists can still be stale in its *claim* — line 63's `gauge-center` row is the proven case: the
> file exists, but the "PieCenterShell double-rAF intro duplicated here verbatim" it alleges is now
> in exactly ONE place (`internal/center-stat.tsx:283-305`); `gauge-center.tsx` merely *mentions* it
> in a header comment at :10 and imports the shell. **Re-grep every row before acting on it.**
## Main table

| Module | Taxonomy part | Importing parts (distinct) | Count | Orphan | Verdict | Shareable with / evidence |
|---|---|---|---|---|---|---|
| `area-fill-mark` | internal-foundation | `area`, `composed` | 2 | — | SHARED | — |
| `background` | internal-axes-grid | — | 0 | ORPHAN | SHARED (shareable) | composes multi-part `pattern-preset` + `fade-mask`; drop-in backdrop for area/line/composed |
| `bar-column-track-mark` | bar | `bar` | 1 | — | SHARED (shareable) | bar — `bar-squares-mark`: duplicated `bandWidthForSquares()` + square-column layout |
| `bar-depth-geometry` | bar | `bar` | 1 | — | UNIQUE | — |
| `bar-depth-marks` | bar | `bar` | 1 | — | UNIQUE | — |
| `bar-focus-strategy` | bar | `bar` | 1 | — | SHARED (shareable) | candlestick/scatter/gauge — `candlestick-focus-strategy`, `scatter-focus-strategy`, `focus-disabled`: 4 parallel ChartFocusStrategy impls; `valueKey`/`collectPerGroup` duplicated verbatim |
| `bar-hover-chrome` | bar | `bar` | 1 | — | SHARED (shareable) | candlestick/scatter/live-line — `*-hover-chrome` family: same attach/hide/update indicator+dot+box+pill spring skeleton |
| `bar-pulse-mark` | bar | `bar` | 1 | — | SHARED (shareable) | bar — orphan `bar-pulse-overlay` imports its silhouette path + PULSE_* constants |
| `bar-pulse-overlay` | bar | — | 0 | ORPHAN | SHARED (shareable) | bar — `bar-pulse-mark` (shares path/constants); duplicates depth math of `bar-trimmed-mark`/`bar-depth-marks` — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, **no reference left anywhere**. This row is CLOSED; do not queue it for Wave 6.** |
| `bar-squares-layout` | bar | `bar` | 1 | — | UNIQUE | — |
| `bar-squares-mark` | bar | `bar` | 1 | — | SHARED (shareable) | bar — `bar-column-track-mark`: identical duplicated `bandWidthForSquares()` + `computeSquareColumn` render loop |
| `bar-trimmed-mark` | bar | `bar` | 1 | — | UNIQUE | — |
| `bar-x-axis-overlay` | bar | `bar` | 1 | — | SHARED (shareable) | line/area/scatter/composed/candlestick — `x-axis-overlay`: same HTML `bottom:12` label overlay + `data-bkm-xlabel` pill-fade contract (tick algorithms deliberately differ, per in-source note) |
| `bezier-easing` | internal-animation | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `bisect` | internal-interaction | `composed`, `internal-interaction` | 2 | — | SHARED | — |
| `brush-chrome` | internal-brush | `internal-brush` | 1 | — | UNIQUE | sole chrome layer of brush feature (serves area/line via `brush-drag`/`brush-selection`); no cross-part duplicate to merge with |
| `brush-drag` | internal-brush | `area`, `internal-brush`, `line` | 3 | — | SHARED | — |
| `brush-layout` | internal-brush | — | 0 | ORPHAN | UNIQUE | dead bklit-parity flex wrapper; no counterpart anywhere |
| `brush-selection` | internal-brush | `area`, `internal-brush`, `line` | 3 | — | SHARED | — |
| `candle-spring` | internal-animation | `candlestick`, `internal-animation` | 2 | — | SHARED | — |
| `candlestick-focus-strategy` | candlestick | `candlestick` | 1 | — | SHARED (shareable) | bar/scatter/gauge — `bar-focus-strategy`, `scatter-focus-strategy`, `focus-disabled`: same resolve/group/navigation strategy contract |
| `candlestick-hover-chrome` | candlestick | `candlestick` | 1 | — | SHARED (shareable) | scatter/bar/live-line — `*-hover-chrome`: `toIndicatorConfig`/`toBoxConfig` cloned verbatim; same box/pill/label-fade flow |
| `center-stat` | internal-foundation | `gauge`, `pie`, `ring` | 3 | — | SHARED | — |
| `chart-brush` | internal-brush | — | 0 | ORPHAN | UNIQUE | public brush entry composing `brush-chrome`+`brush-drag`; no cross-part twin |
| `chart-config-context` | internal-foundation | `bar`, `candlestick`, `composed`, `internal-interaction`, `live-line`, `scatter` | 6 | — | SHARED | — |
| `chart-legend` | internal-legend-markers | — | 0 | ORPHAN | SHARED (shareable) | line — `legend`, `profit-loss-legend`: third variant of the same item-list hovered-index legend |
| `chart-legend-hover` | internal-legend-markers | `area`, `bar`, `candlestick`, `composed`, `line` | 5 | — | SHARED | — |
| `chart-markers` | internal-legend-markers | `area`, `line` | 2 | — | SHARED | — |
| `chart-phase` | internal-animation | `area`, `bar`, `composed`, `heatmap`, `internal-animation`, `internal-interaction`, `line`, `scatter` | 8 | — | SHARED | — |
| `chart-selection` | internal-interaction | `area`, `candlestick`, `composed`, `internal-interaction`, `line` | 5 | — | SHARED | — |
| `choropleth-graticule` | choropleth | `choropleth` | 1 | — | UNIQUE | — |
| `choropleth-hover-chrome` | choropleth | `choropleth` | 1 | — | SHARED (shareable) | sankey/funnel/ring/pie — `sankey-hover-chrome` etc.: same per-item dim/highlight imperative-runtime pattern |
| `coerce-date` | internal-foundation | `area`, `composed`, `internal-axes-grid`, `line` | 4 | — | SHARED | — |
| `dash-tail` | internal-animation | `area`, `line` | 2 | — | SHARED | — |
| `decimate` | internal-animation | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `deferred-reveal` | internal-animation | `bar`, `candlestick`, `choropleth`, `composed`, `gauge`, `heatmap`, `pie`, `radar`, `ring`, `sankey`, `scatter`, `sunburst` | 12 | — | SHARED | — |
| `design-tokens` | internal-foundation | `bar`, `candlestick`, `internal-animation`, `internal-axes-grid`, `internal-foundation`, `internal-interaction`, `live-line`, `sankey`, `scatter` | 9 | — | SHARED | — |
| `enter-transition` | internal-animation | `funnel`, `gauge`, `internal-animation`, `pie`, `radar`, `ring` | 6 | — | SHARED | — |
| `fade-mask` | internal-animation | `internal-axes-grid`, `internal-foundation`, `internal-interaction`, `line` | 4 | — | SHARED | — |
| `focus-disabled` | gauge | `gauge` | 1 | — | SHARED (shareable) | radar — `radar-chart.tsx` imports identical `@tanstack/charts/focus/disabled`; consolidate on one constant — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, **no reference left anywhere**. This row is CLOSED; do not queue it for Wave 6.** |
| `formatters` | internal-foundation | `bar`, `candlestick`, `funnel`, `internal-axes-grid`, `internal-interaction`, `live-line`, `sankey`, `scatter` | 8 | — | SHARED | — |
| `funnel-geometry` | funnel | `funnel` | 1 | — | UNIQUE | — |
| `funnel-hover-chrome` | funnel | `funnel` | 1 | — | SHARED (shareable) | ring — `ring-hover-chrome`: near-identical per-item spring runtime (update/paint/stop); already reuses pie coordinator |
| `funnel-reveal` | funnel | `funnel` | 1 | — | SHARED (shareable) | pie/ring — `pie-reveal`, `ring-reveal`: byte-equivalent `enter-transition` re-export shims — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/radar-spring.ts` (comment-only trace). This row is CLOSED; do not queue it for Wave 6.** |
| `gauge-center` | gauge | `gauge` | 1 | — | SHARED (shareable) | pie/ring — `pie-center`/`ring-center` shells; PieCenterShell double-rAF intro duplicated here verbatim — **⚠ CORRECTED 2026-08-25 (D317): the duplication claim is STALE.** The double-rAF intro (`introStartedRef` + `setFlowValue`) now exists in exactly ONE place, `internal/center-stat.tsx:283-305`. `gauge-center.tsx` does NOT reimplement it — it imports `CenterShell`/`CenterStat` from `./center-stat` (:30-36) and only *describes* the trick in a header comment (:10). `pie-center.tsx` and `ring-center.tsx` contain zero `requestAnimationFrame` calls. The centralization this row asks for is DONE; what remains (if anything) is the shell-body similarity, not the intro machinery. |
| `gauge-notch` | gauge | `gauge` | 1 | — | UNIQUE | — |
| `gauge-reveal` | gauge | `gauge` | 1 | — | SHARED (shareable) | internal-animation — built on `enter-transition` + `radar-spring`; keyframe/pop-in machinery merges into shared engine |
| `grid` | internal-axes-grid | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `grid-highlight-mark` | line | `line` | 1 | — | UNIQUE | config resolution already lives in shared `grid.ts`; mark itself has no second consumer or twin |
| `heatmap-animation` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-colors` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-components` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-context` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-hover-chrome` | heatmap | `heatmap` | 1 | — | SHARED (shareable) | pie — `pie-hover-chrome`: same get/set/subscribe broadcast-coordinator store (contract generalized in `center-stat.tsx`) |
| `heatmap-interaction` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-legend` | heatmap | — | 0 | ORPHAN | UNIQUE | heatmap-only swatch/gradient legend; no cross-part twin |
| `heatmap-lifecycle` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `heatmap-utils` | heatmap | `heatmap` | 1 | — | UNIQUE | — |
| `hover-chrome` | internal-interaction | `composed`, `internal-interaction` | 2 | — | SHARED | — |
| `hover-reanchor` | internal-interaction | `internal-interaction` | 1 | — | SHARED (shareable) | composed/line/area (via `hover-chrome` stack) — fold into `hover-chrome.ts`, its only importer — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/hover-chrome.ts` (comment-only trace, also cited in `line-chart.tsx`). This row is CLOSED; do not queue it for Wave 6.** |
| `legend` | internal-legend-markers | `line` | 1 | — | SHARED (shareable) | line + orphan `chart-legend` — consolidate the two Legend variants (+ `profit-loss-legend` composition) |
| `legend-context` | internal-legend-markers | `internal-legend-markers` | 1 | — | SHARED (shareable) | line/orphans — `chart-legend-hover` + `ProfitLossLegendHoverContext`: three parallel hovered-index contexts |
| `live-hover-chrome` | live-line | `live-line` | 1 | — | SHARED (shareable) | scatter/bar/candlestick — `*-hover-chrome`: `toDotConfig`/`toIndicatorConfig`/`toBoxConfig` cloned verbatim; same skeleton |
| `live-line-mark` | live-line | `live-line` | 1 | — | UNIQUE | — |
| `loading-chrome` | internal-foundation | `area`, `line` | 2 | — | SHARED | — |
| `parse-aspect-ratio` | internal-foundation | `area`, `bar`, `candlestick`, `choropleth`, `composed`, `line`, `scatter` | 7 | — | SHARED | — |
| `pattern-area-mark` | area | `area` | 1 | — | UNIQUE | area-only fill variant of the line/area mark family |
| `pattern-preset` | internal-foundation | `area`, `bar`, `internal-axes-grid`, `internal-brush`, `reference-area` | 5 | — | SHARED | — |
| `pie-center` | pie | `pie` | 1 | — | SHARED (shareable) | ring — `ring-center` near-identical body; `gauge-center` shares the CenterStat shell |
| `pie-geometry` | internal-foundation | `internal-interaction`, `pie`, `ring` | 3 | — | SHARED | — |
| `pie-hover-chrome` | internal-interaction | `funnel`, `pie`, `ring` | 3 | — | SHARED | — |
| `pie-reveal` | pie | `pie` | 1 | — | SHARED (shareable) | ring/funnel — `ring-reveal`, `funnel-reveal`: byte-equivalent `enter-transition` re-export shims — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, **no reference left anywhere**. This row is CLOSED; do not queue it for Wave 6.** |
| `profit-loss-config` | line | `line` | 1 | — | UNIQUE | — |
| `profit-loss-legend` | line | — | 0 | ORPHAN | SHARED (shareable) | line/internal-legend-markers — thin composition of shared `Legend` primitives; merge with `chart-legend` |
| `profit-loss-legend-hover` | line | — | 0 | ORPHAN | SHARED (shareable) | internal-legend-markers — `chart-legend-hover`/`legend-context`: third hovered-index context clone |
| `profit-loss-line-mark` | line | `line` | 1 | — | UNIQUE | reuses `fade-mask` stops like area/line marks, but sign-split segment rendering is bespoke |
| `profit-loss-segments` | line | `line` | 1 | — | UNIQUE | — |
| `projection-config` | internal-animation | `area`, `composed`, `internal-animation`, `line` | 4 | — | SHARED | — |
| `projection-line-mark` | internal-animation | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `projection-utils` | internal-animation | `children`, `internal-animation` | 2 | — | SHARED | — |
| `radar-reveal` | radar | `radar` | 1 | — | SHARED (shareable) | pie/ring/funnel — `*-reveal`: same alias-shim set over `enter-transition` |
| `radar-spring` | internal-animation | `internal-animation` | 1 | — | SHARED (shareable) | internal-animation/candlestick — consumed by `enter-transition`, wraps `candle-spring`; generic spring sampling, "radar" name only |
| `reference-area-config` | internal-axes-grid | `area`, `bar`, `candlestick`, `composed`, `line`, `scatter` | 6 | — | SHARED | — |
| `reference-area-geometry` | internal-axes-grid | `area`, `internal-axes-grid`, `line`, `live-line`, `reference-area` | 5 | — | SHARED | — |
| `reference-area-layer` | internal-axes-grid | `area`, `bar`, `candlestick`, `composed`, `line`, `live-line`, `scatter` | 7 | — | SHARED | — |
| `ring-center` | ring | — | 0 | ORPHAN | SHARED (shareable) | pie — `pie-center`: near-identical component body (CenterStat + hovered-index swap) |
| `ring-hover-chrome` | ring | `ring` | 1 | — | SHARED (shareable) | funnel — `funnel-hover-chrome`: same per-item spring runtime; both wrap `createPieHoverCoordinator` |
| `ring-reveal` | ring | `ring` | 1 | — | SHARED (shareable) | pie/funnel — `pie-reveal`, `funnel-reveal`: byte-equivalent shims — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, **no reference left anywhere**. This row is CLOSED; do not queue it for Wave 6.** |
| `sankey-animation` | sankey | `sankey` | 1 | — | UNIQUE | mirrors `deferred-reveal`'s pre-hide/post-paint idea, but dash/stagger payload is sankey-specific |
| `sankey-hover-chrome` | sankey | `sankey` | 1 | — | UNIQUE | connectivity dimming is sankey-graph-specific (counterpart pattern too distant to merge) |
| `sankey-layout` | sankey | `sankey` | 1 | — | UNIQUE | — |
| `sankey-mark` | sankey | `sankey` | 1 | — | UNIQUE | — |
| `scatter-focus-strategy` | scatter | `scatter` | 1 | — | SHARED (shareable) | bar/candlestick — `bar-focus-strategy` (verbatim `valueKey`), `candlestick-focus-strategy`: same nearest-x + gate strategy |
| `scatter-hover-chrome` | scatter | `scatter` | 1 | — | SHARED (shareable) | bar/candlestick/live-line — `*-hover-chrome`: same hide/update/detach skeleton + cloned config mappers |
| `segment-visuals` | internal-interaction | `area`, `candlestick`, `composed`, `line` | 4 | — | SHARED | — |
| `series-bar-layout` | composed | `composed` | 1 | — | UNIQUE | — |
| `series-bar-mark` | composed | `composed` | 1 | — | UNIQUE | — |
| `series-marker-mark` | internal-legend-markers | `area`, `line` | 2 | — | SHARED | — |
| `spring` | internal-animation | `candlestick`, `funnel`, `heatmap`, `internal-interaction`, `live-line`, `ring` | 6 | — | SHARED | — |
| `styles.css` | internal-foundation | `area`, `bar`, `candlestick`, `choropleth`, `composed`, `funnel`, `gauge`, `heatmap`, `line`, `live-line`, `pie`, `radar`, `ring`, `sankey`, `scatter`, `sunburst` | 16 | — | SHARED | — |
| `sunburst-center` | sunburst | `sunburst` | 1 | — | UNIQUE | — |
| `sunburst-colors` | sunburst | `sunburst` | 1 | — | UNIQUE | — |
| `sunburst-geometry` | sunburst | `sunburst` | 1 | — | SHARED (shareable) | pie/funnel — `pie-geometry` (`pieArcPath` d3-arc builder), `funnel-geometry`: parallel pure geometry/path helpers |
| `sunburst-hint` | sunburst | `sunburst` | 1 | — | UNIQUE | — |
| `sunburst-labels` | sunburst | `sunburst` | 1 | — | UNIQUE | — |
| `sunburst-reveal` | sunburst | `sunburst` | 1 | — | UNIQUE | bespoke d-keyframe sweep/zoom; shares only `design-tokens` easing |
| `sunburst-types` | sunburst | `sunburst` | 1 | — | UNIQUE | — |
| `terminal-marker` | internal-animation | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `tooltip-chrome` | internal-interaction | `bar`, `candlestick`, `internal-interaction`, `live-line`, `scatter` | 5 | — | SHARED | — |
| `tooltip-scheduler` | internal-interaction | `internal-interaction` | 1 | — | SHARED (shareable) | bar/candlestick/live-line/scatter (via `tooltip-chrome`) — fold into `tooltip-chrome.ts`, its only importer — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/tooltip-chrome.ts` (comment-only trace). This row is CLOSED; do not queue it for Wave 6.** |
| `types` | internal-foundation | `area`, `bar`, `candlestick`, `children`, `composed`, `internal-animation`, `internal-axes-grid`, `internal-foundation`, `internal-interaction`, `internal-legend-markers`, `line`, `live-line`, `scatter` | 13 | — | SHARED | — |
| `use-chart-margin` | internal-axes-grid | `area`, `bar`, `candlestick`, `composed`, `internal-axes-grid`, `line`, `live-line`, `scatter` | 8 | — | SHARED | — |
| `use-chart-phase-orchestrator` | internal-animation | `area`, `composed`, `line` | 3 | — | SHARED | — |
| `use-container-size` | internal-foundation | `area`, `bar`, `candlestick`, `choropleth`, `composed`, `funnel`, `gauge`, `heatmap`, `line`, `live-line`, `pie`, `radar`, `ring`, `scatter` | 14 | — | SHARED | — |
| `use-hover-chrome` | internal-interaction | `area`, `line` | 2 | — | SHARED | — |
| `use-prefers-reduced-motion` | internal-foundation | `gauge`, `heatmap`, `internal-animation`, `sankey`, `sunburst` | 5 | — | SHARED | — |
| `visx-pattern-bridge` | internal-foundation | `internal-foundation` | 1 | — | SHARED (shareable) | area/bar/axes-grid/brush/reference-area (via `pattern-preset`) — fold into `pattern-preset.tsx`, its only importer — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/pattern-preset.tsx` (comment-only trace) — the original D304 instance. This row is CLOSED; do not queue it for Wave 6.** |
| `x-axis-overlay` | internal-axes-grid | `area`, `candlestick`, `composed`, `line`, `scatter` | 5 | — | SHARED | — |
| `x-ticks` | internal-axes-grid | `internal-axes-grid` | 1 | — | SHARED (shareable) | area/candlestick/composed/line/scatter (via `x-axis-overlay`) — fold into `x-axis-overlay.tsx`, its only importer — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/x-axis-overlay.tsx` + `internal/bar-x-axis-overlay.tsx` (comment-only trace). This row is CLOSED; do not queue it for Wave 6.** |
| `y-axis-overlay` | internal-axes-grid | `area`, `candlestick`, `line` | 3 | — | SHARED | — |
| `y-axis-ticks` | internal-axes-grid | `candlestick`, `internal-axes-grid` | 2 | — | SHARED | — |
| `y-domain` | internal-axes-grid | `area`, `bar`, `composed`, `line` | 4 | — | SHARED | — |

Notes on counting: `styles.css` is included as a module (taxonomy places it in internal-foundation); it is side-effect-imported by all 16 chart entrypoints. `internal/index.ts` and `charts/index.ts` are facades and excluded from both module rows and importer counts. Dynamic `import("./…")` type positions (7 files) were parsed as static edges; none changed any verdict. Import-evidence columns (Taxonomy part / Importing parts / Count) are preserved unmodified from the original mechanical run; only Orphan flag, Verdict, and the evidence column were added/redone.

## Verdict vs taxonomy grouping (updated for redo)

Under the original import-count semantics, shared-group modules with <2 importers read as "move/inline" candidates. Under shareability semantics most of them instead read as centralization targets INSIDE their group — the mechanical facts are unchanged, only the interpretation.

### Shared-group module imported by only 1 part (redo verdicts)

| Module | Taxonomy part | Actual importing parts | Redo verdict | Note |
|---|---|---|---|---|
| `brush-chrome` | internal-brush | `internal-brush` only | UNIQUE | imported only by `chart-brush`, which is itself an orphan; no cross-part duplicate to merge with |
| `hover-reanchor` | internal-interaction | `internal-interaction` only | SHARED (shareable) | imported only by `hover-chrome` (same group), which serves composed + internal-interaction consumers — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/hover-chrome.ts` (comment-only trace, also cited in `line-chart.tsx`). This row is CLOSED; do not queue it for Wave 6.** |
| `legend` | internal-legend-markers | `line` only | SHARED (shareable) | imported only by `profit-loss-legend` (line part); parallels orphan `chart-legend` |
| `legend-context` | internal-legend-markers | `internal-legend-markers` only | SHARED (shareable) | imported only by `legend`; parallels `chart-legend-hover` + `ProfitLossLegendHoverContext` |
| `radar-spring` | internal-animation | `internal-animation` only | SHARED (shareable) | imported only by `enter-transition`, which serves 6 parts; generic spring sampling |
| `tooltip-scheduler` | internal-interaction | `internal-interaction` only | SHARED (shareable) | imported only by `tooltip-chrome`, which serves 4 chart parts + the group — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/tooltip-chrome.ts` (comment-only trace). This row is CLOSED; do not queue it for Wave 6.** |
| `visx-pattern-bridge` | internal-foundation | `internal-foundation` only | SHARED (shareable) | imported only by `pattern-preset`, which serves 5 parts — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/pattern-preset.tsx` (comment-only trace) — the original D304 instance. This row is CLOSED; do not queue it for Wave 6.** |
| `x-ticks` | internal-axes-grid | `internal-axes-grid` only | SHARED (shareable) | imported only by `x-axis-overlay`, which serves 5 parts — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, absorbed into `internal/x-axis-overlay.tsx` + `internal/bar-x-axis-overlay.tsx` (comment-only trace). This row is CLOSED; do not queue it for Wave 6.** |

### Shared-group module with zero importers (orphan in a shared group)

| Module | Taxonomy part | Actual importing parts | Redo verdict | Detail |
|---|---|---|---|---|
| `background` | internal-axes-grid | none | SHARED (shareable) | matches taxonomy orphan flag; composes multi-part `pattern-preset` + `fade-mask` |
| `brush-layout` | internal-brush | none | UNIQUE | matches taxonomy orphan flag; dead parity wrapper |
| `chart-brush` | internal-brush | none | UNIQUE | matches taxonomy orphan flag; publicly re-exported by `charts/index.ts` but no internal consumer |

### Chart-specific module imported by 2+ parts (candidate to promote to shared)

None. Every chart-specific internal is imported only by its own chart (or is an orphan).

## Orphans

9 modules have zero importers anywhere in `showcase/migrated/charts/` (facades excluded as consumers; public barrel re-exports alone do not count). Each also carries its shareability verdict from the redo:

| Module | File path | In taxonomy's 11 flagged orphans? | Redo verdict |
|---|---|---|---|
| `background` | `showcase/migrated/charts/internal/background.tsx` | yes | SHARED (shareable) |
| `bar-pulse-overlay` | `showcase/migrated/charts/internal/bar-pulse-overlay.tsx` | yes | SHARED (shareable) — **✅ RESOLVED (verified 2026-08-25, D317): file GONE, **no reference left anywhere**. This row is CLOSED; do not queue it for Wave 6.** |
| `brush-layout` | `showcase/migrated/charts/internal/brush-layout.tsx` | yes | UNIQUE |
| `chart-brush` | `showcase/migrated/charts/internal/chart-brush.tsx` | yes | UNIQUE |
| `chart-legend` | `showcase/migrated/charts/internal/chart-legend.tsx` | yes | SHARED (shareable) |
| `heatmap-legend` | `showcase/migrated/charts/internal/heatmap-legend.tsx` | **no — taxonomy addition** | UNIQUE |
| `profit-loss-legend` | `showcase/migrated/charts/internal/profit-loss-legend.tsx` | yes | SHARED (shareable) |
| `profit-loss-legend-hover` | `showcase/migrated/charts/internal/profit-loss-legend-hover.tsx` | yes | SHARED (shareable) |
| `ring-center` | `showcase/migrated/charts/internal/ring-center.tsx` | yes | SHARED (shareable) |

Orphan-set reconciliation vs the taxonomy's 11 flagged orphans:

- **Addition (1):** `heatmap-legend` — imported by nothing internally. `heatmap-chart.tsx` only *re-exports* it (`export { HeatmapLegend, … } from "./internal/heatmap-legend"`), and `internal/index.ts` re-exports it; neither is a real consumer. The taxonomy did not flag it.
- **Removals (3):** `legend`, `legend-context`, `brush-chrome` — each has exactly one importer, so they are single-consumer modules, not orphans. `legend` ← `profit-loss-legend` (line); `legend-context` ← `legend`; `brush-chrome` ← `chart-brush`. The taxonomy appears to have counted these same-group/same-chart edges as "no importers".

Net: taxonomy 11 → measured 9 (−3 removals, +1 addition).

## Redo method notes

Every Count ≤ 1 module (64 UNIQUE + 9 ORPHAN under the old semantics) was re-judged against its actual source under `showcase/migrated/charts/internal/`. Cross-part duplication was confirmed by reading the counterpart modules directly (e.g. the four `ChartFocusStrategy` implementations, the five `attach*HoverChrome`/runtime chromes with their verbatim-cloned `toDotConfig`/`toIndicatorConfig`/`toBoxConfig` mappers, the four byte-equivalent `enter-transition` re-export shims, the three parallel hovered-index legend contexts, the duplicated `bandWidthForSquares()` in the bar marks, and the transitive-consumer chains `tooltip-scheduler ← tooltip-chrome ← 4 parts`, `hover-reanchor ← hover-chrome ← 2 parts`, `x-ticks ← x-axis-overlay ← 5 parts`, `visx-pattern-bridge ← pattern-preset ← 5 parts`, `radar-spring ← enter-transition ← 6 parts`). Modules kept UNIQUE had no namable counterpart: verbatim ports of a single bklit chart's bespoke math (bar depth, gauge notch, funnel segments, sankey graph, heatmap calendar/grid, sunburst tree) or single-chart mark/layout code.
