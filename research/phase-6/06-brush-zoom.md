# 06 — Brush + zoom + range selection

Orchestrator-ruled, 2026-08-27.

## Current implementation inventory

| File | LOC | Role |
|---|---|---|
| `internal/brush-drag.ts` | 387 | headless pixel-space drag, 8px handle hit, window listeners; **no keyboard, no snapping**; carries the v0.14 NON-VIABLE ruling (:1-36, 2026-08-24) |
| `internal/brush-chrome.tsx` | 300 | 4 portal chrome pieces: track dim/blur + 15% fade mask, pattern, border, 4×24px pill handles — portals into app container, positioned from state (no renderer reach-in) |
| `internal/brush-selection.ts` | 175 | `filterDataByXDomain`; reset-on-dataset-swap; `xDomainSlotCount` always full length |
| `internal/chart-brush.tsx` | 65 | `role="brush"` child |
| `internal/brush-layout.tsx` | 88 | unused at chart level |
| `internal/chart-selection.ts` | 205 | separate range-select system (2-finger touch), 5 consumer charts — own scale duplicates for `.invert` |
| `internal/zoom-engine.tsx` | 663 | visx-zoom port; **only choropleth**; @use-gesture input; applies raw SVG `transform` attr to `g.ts-chart__marks` + graticule (`choropleth-chart.tsx:536-558`), 0.18s ease-out except during drag; inverse matrix hit-testing |

Brush consumers: line/area only.

## Native mechanism

- `controls: [brushX({range: controlledSignal(range, (next,{reason})=>…), values, format, ariaLabel, …})]` — in-definition; `values` = snapping + keyboard steps; selection preserved across updates — `interactions-and-selections.md:455-575`.
- Independent full-extent track: the library's own overview+detail pattern = **two chart hosts** (conformance case 83) — strip host with full extent + brushX; main host narrows via `axis.viewport.domain` / data filter. This directly answers the NON-VIABLE ruling's third argument (brush binds to host's final x scale).
- `zoomX({window: controlledSignal, extent, scaleExtent})` — 1-D only.
- App-owned gesture is sanctioned: `pointer:false` keeps focus/marks/tooltips; "Import d3-zoom directly only when the application needs a different gesture policy".
- `host.interaction.clientToScene` — pixel→semantic without app-side scale duplicates.
- Native brush DOM stylable: `ts-chart__handle-x`, brush classes + CSS vars.

## Mapping verdicts

| Piece | Verdict | How |
|---|---|---|
| Brush mechanics (line/area) | **REPLACE** | two-host pattern: strip = small `<Chart>` (mini series + `brushX`, `values` = x data for snapping); main chart consumes controlled range → `filterDataByXDomain` unchanged (keeps `xDomainSlotCount` column-width invariant). **Obsoletes the D-ruled NON-VIABLE verdict — re-stamped at 0.15.** Keyboard + snapping arrive free (improvement over legacy: D-log as intentional, legacy had neither) |
| Brush visuals (pill handles, dim/blur track) | **SANCTIONED-EXTENSION** | first choice: CSS-skin native handles/selection (`ts-chart__handle-x` is a documented styling surface); pieces that CSS can't reach (blur mask, pattern) stay app-portal chrome positioned from the controlled range (pure state math over track extent — already reach-in-free) |
| `brush-drag.ts` | **DELETE** | replaced by brushX; ruling text preserved in LOG with version stamps |
| `brush-layout.tsx` | **DELETE (6.4)** | unused |
| Range selection (`chart-selection.ts`, 5 charts) | **SANCTIONED-EXTENSION** | not native (native selection is point-select). Keep app gesture; replace its duplicate scales/`.invert` with `host.interaction.clientToScene` — deletes the last scale duplicates |
| Choropleth 2-D zoom | **REPLACE (application path), KEEP (input path)** | gesture input stays @use-gesture (sanctioned); the `setAttribute('transform')` on `.ts-chart__marks` dies → scale/translate become projection params in the definition, rebuilt per gesture frame (throttled), motion disabled during drag / 0.18s ease-out on release. **Spike first in 6.3** (world-map reprojection per frame); fallback if <30fps: ACCEPT-WITH-LOG keeping one transform write via the `onRender` svg handle, census-excluded by name |
| 1-D `zoomX` | no consumer | no chart has 1-D zoom; note only |

## Deletions

`brush-drag.ts`, `chart-brush.tsx` internals (public `role="brush"` API preserved as a thin
config mapper), `brush-layout.tsx`; `zoom-engine.tsx` transform-application half + inverse-matrix
hit-testing (native `clientToScene` + projection invert); scale duplicates in
`chart-selection.ts` consumers.

## Open questions — resolved

- `xDomainSlotCount` invariant survives because data-filter path is kept (viewport.domain
  narrowing rejected for bar-width stability reasons — decided, not deferred).
- Selection reset on dataset swap: reproduce in the controlled-signal owner (app state).
- v0.14 ruling's three arguments each answered at 0.15: host-in-ancestry (strip host is a real
  host), headless resolver (`clientToScene`), independent track extent (two-host pattern).
