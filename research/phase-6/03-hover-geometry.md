# 03 — Hover geometry (crosshair, dots, band, date pill)

Orchestrator-ruled, 2026-08-27.

## Current implementation inventory

The non-dim half of `hover-chrome.ts` (779 LOC total, shared by line/area/composed via
`use-hover-chrome.ts`) plus the geometry halves of bar/candle/scatter/live chromes:

| Piece | Behavior (legacy spec) |
|---|---|
| Crosshair indicator | vertical rect, width presets line=1 / thin=2 / medium=4 / thick=8 px; vertical linear-gradient fade at edges (`fadeEdges`, ~10% fade length) |
| Hover dots | one dot per series at focused x |
| Highlight band | brighter re-stroke of the series path clipped to a spring-driven x-window around focused index (±1) |
| Date pill | HTML pill at `bottom:4px` showing focused x label; odometer ticker below 60 labels (`DISCRETE_INTERACTION_THRESHOLD`) |
| Axis-label proximity fade | x tick labels fade near the pill (tickerHalfWidth 50 + fadeBuffer 20) — moves to 04 |
| Grid highlight | `grid-highlight-mark` — already a native mark, KEEP |
| Bar/candle row band | category band highlight behind hovered row |

Reach-ins: the bulk of hover-chrome's 18 `querySelector`s (path re-stroke, dot injection,
indicator insertion into `.ts-chart__*` groups).

## Native mechanism

- `crosshair({x: {rule|band, label, marker}})` — data-less guide; rule stroke accepts any SVG paint including `url(#gradient)`; band mode with inset/radius for categorical; label with halo (`ts-chart__crosshair-label-halo`, var `--ts-chart-crosshair-label-halo`) — `dist/crosshair.d.ts:1-62`.
- `whenFocused(mark, {match:'x'})` — presentation filter: authored mark rendered only at focused x — `dist/focus-mark.d.ts:2`; `focus-and-interaction.md:140-175`.
- `focusGuideX/Y` keyed, motion-animated guides.
- `onFocusGroupChange` delivers `ChartPoint[]` with pixel x/y + resolved colors (`react/Chart.d.ts`).
- Reactive definition rebuild on focus is the library's own pattern for focus-derived geometry (`docs/guides/tooltips-and-focus.md` controlled-focus examples).

## Mapping verdicts

| Piece | Verdict | How |
|---|---|---|
| Crosshair | **REPLACE** | native `crosshair`: width presets → `rule.width`/band inset; gradient fade edges → `stroke:'url(#bkm-crosshair-grad)'` referencing app-authored `<defs>` (gradients.tsx already renders defs) — pure SVG paint reference, no reach-in |
| Hover dots | **REPLACE** | `whenFocused(dot(series marks), {match:'x'})` — dots at focused x across all series, motion-animated |
| Bar/candle row band | **REPLACE** | `crosshair` band mode (categorical) or `whenFocused(bandX)` |
| Highlight band (windowed re-stroke) | **REPLACE (reactive definition)** | `onFocusChange` → React state idx → definition includes a second `lineY` over slice `[idx-1, idx+1]` with bright stroke; motion spring animates window shifts (interruptible, velocity carry-over — replaces the custom spring window). Zero DOM writes |
| Date pill + odometer | **SANCTIONED-EXTENSION (app UI)** | HTML pill positioned from `onFocusGroupChange` pixel x — app-owned element in app container, no renderer reach-in. Odometer ticker unchanged (<60 labels) |
| Grid highlight | **KEEP** | already native mark |
| Scatter active copy | covered in 01 (`r` state) | — |
| Live scrub geometry | **REPLACE** | native focus + `whenFocused` dot; live chrome's off-React hover resolution replaced by native pointer resolution (native resolves per pointer event without React roundtrip — same performance class) |

## Deletions

`hover-chrome.ts` + `use-hover-chrome.ts` die entirely once 01 (dim) + 03 (geometry) + 04
(label fade) land; geometry halves of `bar-hover-chrome.ts`, `candlestick-hover-chrome.ts`,
`scatter-hover-chrome.ts`, live chrome. `chart-focus-kit.ts`/`broadcast-store.ts` shrink to
whatever cross-chart sync remains (hover-sync across side-by-side charts stays: broadcast →
`setControlledFocus` on sibling hosts — sanctioned, replaces DOM mirroring).

## Open questions — resolved

- Gradient-faded crosshair: no native fade option, but `stroke` is an open paint string →
  `url(#…)` verified against `dist/crosshair-resolver.js:264-280` (paint passed through).
- Date pill is not the native crosshair label (pill sits under the plot, animated ticker) —
  keeping it app-owned HTML is not a deviation: it consumes only typed callbacks.
- Spring-driven band window: native per-state/motion transitions cover it; custom spring dies.
