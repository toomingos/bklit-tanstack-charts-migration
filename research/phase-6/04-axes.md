# 04 — Axes

Orchestrator-ruled, 2026-08-27.

## Current implementation inventory

| File | LOC | Role |
|---|---|---|
| `internal/x-axis-overlay.tsx` | 536 | HTML div labels; `selectEvenlySpacedIndices` optimizer (MAX_GAP_LAYOUTS=400); data-aligned ticks deduped by label; `tickMode: data\|domain`; 12px `var(--chart-label)`; emits `data-bkm-xlabel` markers (consumed by tooltip-chrome proximity fade); projection tail ticks |
| `internal/y-axis-overlay.tsx` | 133 | own `scaleLinear().nice()`; `formatLargeNumbers` (≥1000 → "Nk") |
| `internal/bar-x-axis-overlay.tsx` | 67 | modulo thinning, maxLabels 12 |
| `internal/y-domain.ts` | 347 | `[0, max*1.1]` rule; `createAxisValueProjector` (secondary y projected onto primary — TanStack has one y scale) |
| `internal/use-animated-y-domains.ts` | 267 | EXPORTED BUT UNCONSUMED (legacy API parity) |
| duplicate d3 scales | ~25 sites | full enumeration in agent report: line 557/986; area 656/800/803/1065/1069; composed 1068/1490 + 5× `scaleLinear(yDomainFinal)`; scatter 489/980; candlestick 295/1030 + 330/575/714; bar 357/455/494/1239 (scaleBand); live 534/537/634/641 |

Legacy behavior: HTML portal labels, `text-xs` 12px, fade formula near ticker, **no rotation
anywhere in either tree**.

## Native mechanism

- `axis.ticks {count, spacing, values, size, padding, format, motion}`; `tickLabels {rotate, thin:{minGap, priority:'ends', keep}, fontSize, fontWeight, opacity, anchor, dx, dy, motion}` — all per-tick callables with `{value,index,position,bandwidth}` — `dist/types.d.ts:164-205`.
- Measured-bounds collision thinning; hard-kept labels via `thin.keep`; thinning independent of rotation (`layout-axes-and-coordinates.md:150-195`).
- Typography: SVG labels inherit container font; default fontSize 11 (`scene.js:1041`); theme `{foreground, muted, grid…}` via `defaultTheme`; automatic margins from measured text.
- **No per-tick color channel** — only fontSize/fontWeight/opacity/anchor/dx/dy.
- `axis.viewport {domain, translate}` — semantic window (used by 06/05).

## Mapping verdicts

| Concern | Verdict | How |
|---|---|---|
| X labels (line/area/composed/scatter/candle) | **REPLACE** | native x axis; keep `selectEvenlySpacedIndices` as a pure fn feeding `ticks.values` (preserves exact tick *choice* — parity-critical) rather than trusting native thinning to pick identical indices; `format` from existing formatters; dedupe-by-label preserved in the values fn |
| Bar x labels | **REPLACE** | modulo thinning → `ticks.values` (same modulo fn) |
| Y labels | **REPLACE** | `ticks.count` + `format: formatLargeNumbers`; domain `[0, max*1.1]` stays app policy via `y.domain` (sanctioned — domain policy is the app's per zoom/brush docs) |
| Typography parity | **REPLACE, gate-flagged** | `tickLabels.fontSize:12`, container inherits Geist; label color via CSS `fill` on axes text / `defaultTheme.muted = var(--chart-label)`. **Top pixel-gate risk: SVG vs HTML antialiasing.** Contingency: ACCEPT-WITH-LOG with side-by-side captures as evidence |
| Proximity fade near date pill | **REPLACE (reactive)** | per-tick `tickLabels.opacity` callback closed over focus-x state (same fade formula, tickerHalfWidth 50 + fadeBuffer 20, position-based); definition rebuild on focus change is the library's reactive model; `tickLabels.motion` tweens it. `data-bkm-xlabel` markers die |
| Secondary y axis (composed) | **KEEP (app policy)** | `createAxisValueProjector` stays — it is pure data reprojection, not a reach-in; right-side labels via second native axis with projected `format` |
| `use-animated-y-domains` | **DELETE (6.4)** | unconsumed |
| Duplicate scales | **DELETE** | axis overlays' scales die here; chrome scales die with 01/03; brush/selection scales die with 06 (`clientToScene` replaces `.invert`) |
| Margins | **REPLACE** | explicit margin retained where DEFAULT_CHART_MARGIN=40 is load-bearing; otherwise native auto-margins |
| Per-tick color | no action | legacy `resolveTickLabelColor` never ported; gap noted in 00 |

## Deletions

`x-axis-overlay.tsx`, `y-axis-overlay.tsx`, `bar-x-axis-overlay.tsx`, `y-axis-ticks.ts`, all
overlay-owned scale duplicates; `use-animated-y-domains.ts` (6.4). `y-domain.ts` survives
(domain policy + projector).

## Open questions — resolved

- Native thinning ≠ bklit's even-spacing optimizer in tick *choice* → feed `ticks.values`
  explicitly; native handles layout/collision only as backstop.
- Tick position tween under brush: native `ticks.motion`/`tickLabels.motion`.
- Projection tail ticks (dashed forecast region): extra `ticks.values` entries + per-tick
  `opacity`/`fontWeight` callables.
