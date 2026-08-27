# 02 — Tooltip

Orchestrator-ruled, 2026-08-27.

## Current implementation inventory

| File | LOC | Role | Reach-ins |
|---|---|---|---|
| `internal/tooltip-chrome.ts` | 689 | rAF scheduler, imperative DOM panel builders, flip/clamp positioning | 2 `querySelector` (+ consumes `data-bkm-xlabel` markers from axis overlay) |
| `internal/tooltip-components.tsx` | 789 | React ports of panel rows — **public API surface** | none |
| `internal/marker-tooltip.tsx` | 162 | `ActiveMarkersStore` marker rows | none |
| `internal/tooltip-mappers.ts` | 60 | datum→row mapping | none |

Consumers: shared chrome (line/area/composed), bar, candlestick, scatter, live all funnel
through `tooltip-chrome.ts`; pie/ring/funnel, heatmap (120ms hideDelay debounce), sankey have
bespoke panels; radar `tooltip:false`; gauge/sunburst none.

## bklit behavioral requirement

- Panel body: exact `TooltipContent` row markup (series dot, label, value, marker rows).
- Position: anchored at focus-point pixels; flip left↔right when `x+width+offset > containerWidth`; clamp top; measured from its own `offsetWidth` only (no mark DOM queries).
- **No pinning anywhere** (legacy or migrated).
- `DISCRETE_INTERACTION_THRESHOLD = 60`: ≥60 points disables tooltip position animation.
- Heatmap: 120ms hide delay.

## Native mechanism

- `tooltip` extension: `{use, className, motion: false|transition, portal, items, sort, anchor, placement: 'auto'|8 placements|array, offset, content, format, formatGroup, sticky, visibility}` — `dist/types.d.ts:961-976`.
- `sticky:false` disables pinning — `docs/guides/tooltips-and-focus.md:257`. Matches bklit exactly.
- React body: `renderTooltipBody` from `@tanstack/charts/react/tooltip` — app owns body JSX; host owns anchoring/placement/portal/dismissal.
- Skin: `tooltip.className` + `--ts-chart-tooltip-*` CSS vars — sanctioned (`themes-and-styling.md:183-194`).

## Mapping verdicts

| Concern | Verdict | How |
|---|---|---|
| Panel body (all charts) | **REPLACE** | `renderTooltipBody` rendering the existing `TooltipContent`/`tooltip-mappers` components verbatim — public API components untouched, imperative DOM builders die |
| Positioning flip/clamp | **REPLACE** | `placement: ['right','left']` + `offset` + `sticky:false`; native flips on overflow and clamps to container. Any sub-pixel placement delta vs bklit math surfaces at the 6.5 hover captures; if >0.5% → tune `offset`/`anchor` before considering ACCEPT-WITH-LOG |
| Motion / discrete threshold | **REPLACE** | `motion:` spring matching current tooltipSpring; for ≥60-point datasets set `motion:false` (same conditional, now declarative) |
| Pinning | **REPLACE** | `sticky:false` everywhere |
| Marker rows | **REPLACE** | `ActiveMarkersStore` feeds the same React body via `renderTooltipBody` closure |
| Heatmap 120ms hideDelay | **SANCTIONED-EXTENSION** | tooltip visibility follows focus → debounce the *focus*, not the tooltip: heatmap keeps focus alive 120ms via `setControlledFocus` re-injection on leave (app-owned controller, `dom-types.d.ts:31-38`). If it fights pointer focus, fallback = accept native immediate-hide and D-log (visual QA rarely captures the delay) |
| Sankey / pie / ring bespoke panels | **REPLACE** | same native ext per chart; bespoke DOM builders die |
| `data-bkm-xlabel` proximity fade | moves to 04 (per-tick `tickLabels.opacity`) | — |

## Deletions

`tooltip-chrome.ts` entirely; bespoke panel builders in pie/ring/funnel*/sankey/heatmap chromes
(funnel: out of scope per D30/D54 — leave funnel's panel untouched, D-log the asymmetry).
`tooltip-components.tsx`, `tooltip-mappers.ts`, `marker-tooltip.tsx` survive as the body renderers
(public API).

## Open questions — resolved

- Pinning disable: confirmed (`sticky:false`).
- Portal: native `portal` option replicates current body-append behavior.
- The 2 querySelectors in tooltip-chrome die with the file.
