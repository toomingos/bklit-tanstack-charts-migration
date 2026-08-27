# 07 — Legend coupling

Orchestrator-ruled, 2026-08-27. Legend *UI* stays custom (inherited scope, #95) — only the
legend→chart coupling is refitted.

## Current implementation inventory

| File | LOC | Role |
|---|---|---|
| `internal/chart-legend-hover.tsx` | 44 | context `{hoveredIndex, setHoveredIndex}` — consumed by bar/area/candlestick/composed/line |
| coupling path | — | hover → mutable `chromeStateRef` → effect → `chromeRef.current.syncDim()` → DOM mutation (`bar-hover-chrome.ts:216-272`, `hover-chrome.ts:638-716`, `candlestick-hover-chrome.ts:120-126,178-192`); candlestick also has a parallel props path (`isWickDimmed`/`isBodyDimmed` :395/:455) |
| `internal/chart-legend.tsx` / `legend.tsx` / `legend-context.tsx` / `profit-loss-legend-hover.tsx` | 574 | public exports, largely unwired |
| heatmap | — | broadcast-store → React props (no DOM) |

**Confirmed: no click-to-toggle series show/hide exists anywhere** (legacy or migrated).
Legend interactivity = hover-only: highlight hovered series, dim others (legacy
`series-hover-dim.tsx`: dimOpacity 0.5 default, 0.4s easeInOut; per-chart overrides in 01).

## Native mechanism

- No legend-hover primitive; `interactive-legend` is toggle-only → not applicable.
- Sanctioned injection path: capture controller from React `<Chart onRender={(ctx)=>…}>`
  (`ChartRenderContext.interaction`, `dist/dom-types.d.ts:167-172`) →
  `setControlledFocus(pointOfSeries, {source:'programmatic'})` / `setControlledFocus(null)` on
  leave (`dom-types.d.ts:31-38`).
- Marks style themselves via 01's states scoped `when:{focus:'unmatched', source:'programmatic'}`
  — pointer-driven and legend-driven dim can carry different styles/transitions via the `source`
  discriminator (`ChartFocusSource`, `dist/types.d.ts:999`).

## Mapping verdicts

| Piece | Verdict | How |
|---|---|---|
| Legend hover → dim (line/area/bar/candle/composed) | **REPLACE** | `hoveredIndex` change → `setControlledFocus` targeting any point of that series (`{focus:'series'}` match semantics); dim styling lives entirely in 01's mark states. Deletes `chromeStateRef` + `syncDim` effects + all three DOM mutation sites |
| Candlestick dual path | **REPLACE** | both imperative and props dim paths converge on the single states path |
| Heatmap | **KEEP** | already props-driven, no reach-in; optionally route through `setControlledFocus` in 6.4 only if it deletes code |
| `chart-legend-hover.tsx` context | **KEEP** | public API; its consumer effect body becomes a 3-line focus injection |
| Unwired legend exports (`legend.tsx`, `profit-loss-legend-hover.tsx`, …) | **KEEP exports, 6.4 dead-code review** | component-API parity; flag internals for pruning if provably unreachable |
| Cross-chart hover sync (`broadcast-store`) | **REPLACE mechanism, keep store** | broadcast fan-out now calls `setControlledFocus` on sibling hosts instead of DOM mirroring |

## Open questions — resolved

- Series-level focus from a programmatic point: `ChartFocusMatch` includes `'series'`
  (`dist/types.d.ts:1121`) — unmatched-series dim keys off series identity, not exact datum, so
  any representative point suffices.
- Leave/clear: `setControlledFocus(null, …)` restores default pointer behavior (dom-host.md
  controller semantics).
- No toggle feature to preserve → `interactive-legend` explicitly not adopted (would add
  behavior legacy doesn't have).
