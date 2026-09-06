# V3.8 Census — reach-in ledger, `createMark` gate, twelve-idiom checklist evidence

Committed tree measured: `6b2d014` (docs commit on top of `1c2d276` V3.9).
Every count below comes from `git grep … HEAD -- showcase/migrated/charts`
(the committed tree, not the working tree), unless the command says otherwise.
§6 = `research/phase-7/08-synthesis.md` §6. Targets are §6 verbatim.

## 1. §6 claim-1 counts

> Lead correction (wave-4 audit, D573): the raw-svg line-hit total in this
> section reads 89, and re-running the same command at the same commit
> (`6b2d014`) reads 90 — the table undercounts by one. At HEAD (`d724449`) it
> reads 93: the three extra lines are the D572 shimmer mask, gradient and band
> rect, all inside the R10 seam (`internal/resource-host.tsx:119,128,138`).
> Every other count in this file still reads as written.


Command stem (run from the repo root; `HEAD` = `6b2d014`):

```
git grep -E -c '<svg|<rect|<path|<circle|<g |<pattern|<radialGradient' HEAD -- showcase/migrated/charts
```

| # | Count (command) | Reads | §6 target | Verdict |
|---|---|---|---|---|
| raw svg | `git grep -E -c '<svg\|<rect\|<path\|<circle\|<g \|<pattern\|<radialGradient' HEAD -- showcase/migrated/charts` summed per file, minus `internal/resource-host.tsx` (1) | **89 line-hits in 36 files** (table 1a) | 0 outside the seam | **FAIL** — classes owned by D558/D559 rulings + V3.8 follow-ups, none unowned (table 1a, §6) |
| `createPortal` | `git grep -n 'createPortal' HEAD -- showcase/migrated/charts` | **13 call sites in 6 files**: 5 brush-chrome overlays ×2 lines (import + call: `brush-border/handle/selection-pattern/track-chrome.tsx`, `brush-overlays.tsx` ×2 calls) + tooltip `tooltip-components.tsx:471` | only for tooltips | **FAIL** — 1 tooltip + 5 brush overlay portals (D556 already read 6 files; brush portals are V3.4b overlays, owner: seam follow-up) |
| `setAttribute` | `git grep -n 'setAttribute' HEAD -- showcase/migrated/charts` | **3**: `chart-reveal-clip.tsx:41,42`, `sankey-reveal-specs.ts:25` | ≤ 4 | **PASS** |
| `createElementNS` | `git grep -n 'createElementNS' HEAD -- showcase/migrated/charts` | **0** | 0 | **PASS** (G14 closed by V3.9, D569) |
| d3-shape | `git grep -l "from ['\"]d3-shape['\"]" HEAD -- showcase/migrated/charts` | **21 files, 26 import lines** (list §2) | R4 set only | **FAIL** — named in §2 per module |
| d3-selection | `git grep -n "from ['\"]d3-selection['\"]" HEAD -- showcase/migrated/charts` | **1 file**: `internal/choropleth-zoom.ts:6,7` (`select`, `Selection` type) | R4 set only | **FAIL** — rides with the admitted `d3-zoom` gesture policy (D538); needs ruling or removal |
| d3-array | `git grep -n "from ['\"]d3-array['\"]" HEAD -- showcase/migrated/charts` | **1 file**: `live-line-chart.tsx:15` (`bisector`) | R4 set only | **FAIL** — needs ruling or removal |
| d3-path | `git grep -n 'd3-path' HEAD -- showcase/migrated/charts` | **0** | R4 set only | **PASS** (gone since D556) |
| d3-scale / d3-geo / d3-zoom | same stem | **admitted**: d3-scale 29, d3-geo 8 (4 files: `choropleth-chart.tsx:6,7`, `choropleth-focus.ts:1,2`, `choropleth-graticule.tsx:5,6`, `use-choropleth-paths.ts:2,3`), d3-zoom 2 (`choropleth-zoom.ts:8,9`) | admitted (R4) | **PASS** |
| d3-delaunay | `git grep -n 'd3-delaunay' HEAD -- showcase/migrated/charts` | **0** | admitted (R4) | **PASS (vacuous)** — V2.5 cartesian indexes go through the package `focus` option (D544); see G25 |
| d3-sankey / d3-shape layouts | `git grep -n 'd3-sankey' HEAD -- showcase/migrated/charts`; `showcase/migrated/package.json` | **0 imports** in charts | no sankey/shape/layout imports | **PASS** on imports |
| styles.css `animation:` | `git show HEAD:showcase/migrated/charts/styles.css \| grep -n 'animation:'` | **1** (`:695`, `ts-bkm-loading-pulse` on the loading root) | one (loading pulse) | **PASS** |
| styles.css `@keyframes` | `… \| grep -n '@keyframes'` | **1** (`:686`) | one | **PASS** |
| styles.css pre-hide | `… \| grep -n 'opacity: 0'` | **0** literal (`0.8/:308`, `0.55/:691`, `0.5/:701,748` only) | no pre-hide | **PASS** |
| styles.css transforms on package nodes | `… \| grep -nE 'transform:\|transform-origin\|transform-box'` | **0** | none | **PASS** |
| styles.css `transition:` | `… \| grep -n 'transition:'` | **3** (`:633`, `:704`, `:737`) | (V3.6 landed 3) | **PASS** (unchanged from D564) |
| `renderer={` | `git grep -n 'renderer={' HEAD -- showcase/migrated/charts` | **28 sites**: 20 chart mounts + host pass-throughs + loading entries (list §3) | 15 mounts, all `motion(` | **STAMP** — 20 mounts (D561), 6 on the `useChartRenderer` cardinality regime (D567), all through the one `motion()` factory; §6 "15" predates the loading definitions + gauge/radar second mounts |
| `svgAnimation` non-false | `git grep -n 'svgAnimation' HEAD -- showcase/migrated/charts \| grep -v false` | **0 non-false of 23 literals** | `svgAnimation: false` = 15 | **PASS** (23 literals cover all 16 families; §3) |
| `spatialIndex` | `git grep -n 'spatialIndex' HEAD -- showcase/migrated/charts` | **1** (`sankey-chart.tsx:476`) | ≥ 5 | **FAIL** — G25: cartesian indexes pass through the package `focus` option, the grep is the wrong probe (D544, D556) |
| `focusDisabled` | `git grep -n 'focusDisabled' HEAD -- showcase/migrated/charts` | **0 in code** (2 comment mentions: `styles.css:148`, `sunburst-architecture.md:144`) | 0 | **PASS** |
| `use-container-size` | `git grep -n 'use-container-size' HEAD -- showcase/migrated/charts` | **3 files**: `funnel-chart.tsx:8` (`usePositiveChartSize`), `line-chart-support.tsx:10` (`useDebouncedContainerSize`), `use-area-chart-setup.ts:7` (`useMeasuredRect`) | 0 in chart files | **FAIL (stamped)** — line/area read container *height* under the G16/D541 ruling; funnel keeps its hook (V3.1 did not remove the file) |
| `initialWidth` | `git grep -n 'initialWidth=' HEAD -- showcase/migrated/charts` | **28 `initialWidth=` sites**; 14/16 entry files + 4 internal views (table §3) | 15 | **PASS by mount** — G26: §6 means mounts, not entry files |
| `idPrefix` | `git grep -n 'idPrefix=' HEAD -- showcase/migrated/charts` | **53 `idPrefix=` sites**, every `ChartHost` mount (19/19 per D558, still true) | 15 | **PASS** |

### Table 1a — the 89 raw-svg line-hits per file (outside the seam)

Per-file `-c` counts from the stem command. The probe counts source
*lines*, not elements (comments and strings match too, e.g.
`heatmap-colors.ts:117`). Classes: **(O)** app-owned overlay svg beside the
chart svg (brush portals, background sibling, reference-area, marker/projection
overlay, live-line overlay, tooltip indicator) — the D558/D559 rulings keep
these out of the chart svg; **(P)** pattern/gradient builder modules emitting
bare nodes consumed through the seam or a visible overlay svg; **(L)** legend /
swatch / tip chrome (HTML-overlay svgs); **(C)** in-chart chrome still written
by migrated code — the V3.8 follow-up set.

| File | n | class | Note |
|---|---|---|---|
| `internal/reference-area-figure.tsx` | 7 | O | overlay svg + `<defs>` (:143,:206); app-owned reference-area figure, §6 |
| `internal/background.tsx` | 6 | O | sibling svg pinned behind marks (`background-layer.tsx:1` "sibling svg … behind marks"); `<defs>` (:147,:223) |
| `internal/live-tip-chrome.tsx` | 6 | O | live badge overlay (`<circle>`, `<g>`, `<rect>`) |
| `internal/heatmap-separator.tsx` | 5 | O | separator overlay groups/rects |
| `ring-chart.tsx` | 5 | C | hand `<g transform>` + `<path>` track/progress (`:474-478`) + `<svg :484` |
| `internal/live-line-overlay.tsx` | 4 | O | overlay svg + mask rects (`:162-170,:357`) |
| `funnel-chart.tsx` | 4 | O | grid-band overlay svgs (`:162,:173,:175,:196`) |
| `internal/terminal-marker.tsx` | 3 | O | projection overlay svg + `<defs>` (:81); D558 ruling |
| `internal/segment-visuals.tsx` | 3 | O | segment overlay + gradient `<defs>` (:86) |
| `internal/pattern-circles.tsx` | 3 | P | bare pattern builder (seam input) |
| `internal/tooltip-components.tsx` | 4 | O | indicator gradient `<defs>` (:239) + tooltip chrome |
| `internal/terminal-marker-node.tsx` | 4 | O | marker overlay nodes |
| `internal/brush-border-chrome.tsx` | 2 | O | portalled overlay |
| `internal/brush-overlays.tsx` | 2 | O | portalled overlay + `<defs>` (:105) |
| `internal/brush-selection-pattern-chrome.tsx` | 2 | O | portalled overlay + `<defs>` (:42) |
| `internal/chart-reveal-clip.tsx` | 2 | C | neutralised reveal shell (G31 → 7.4 deletes) |
| `internal/heatmap-chart-core.tsx` | 2 | O | heatmap overlay svg (`:318,:325`) |
| `internal/heatmap-legend.tsx` | 2 | L | swatch svg + rect (`:360,:362`); G30 |
| `internal/pattern-lines-impl.tsx` | 2 | P | bare pattern builder |
| `internal/pattern-path.tsx` | 2 | P | bare pattern builder |
| `internal/pattern.tsx` | 2 | P | seam comment (:4) + bare pattern |
| `area-chart.tsx` | 1 | P | `<pattern :309` (area pattern → seam resource, D558) |
| `choropleth-chart.tsx` | 1 | O | graticule/overlay svg (`:529`) |
| `internal/area-chart-model.ts` | 1 | ? | single hit, owner to confirm in follow-up |
| `internal/background-layer.tsx` | 1 | O | sibling-svg mount |
| `internal/choropleth-graticule.tsx` | 1 | O | graticule overlay |
| `internal/gradient-entries.tsx` | 1 | P | bare gradient entries (seam input) |
| `internal/heatmap-colors.ts` | 1 | — | comment (`:117`), not an element |
| `internal/heatmap-components.tsx` | 1 | P | `<pattern :53` (cell pattern → seam resource) |
| `internal/line-chart-support.tsx` | 1 | P | `<radialGradient :218` marker radial (seam resource) |
| `internal/pattern-lines.ts` | 1 | P | builder |
| `internal/sunburst-labels-overlay.tsx` | 1 | O | label overlay |
| `internal/tooltip-indicator-faded-rect.tsx` | 1 | O | indicator `<defs>` (:26) |
| `internal/tooltip-indicator-solid-rect.tsx` | 1 | O | indicator rect |
| `styles.css` | 2 | — | selector text, not elements |
| `sunburst-architecture.md` | 2 | — | doc, not code |
| seam `internal/resource-host.tsx` | 1 | seam | the one sanctioned `<defs>` (`:29`) |

No hit is an unowned element inside a chart `<svg>`: class C is
`ring-chart.tsx` track/progress paths + the neutralised `chart-reveal-clip`
shell (G31, 7.4 owns the deletion).

### Table 1b — `svgAnimation: false` by family (23 literals, 0 non-false)

`git grep -n 'svgAnimation' HEAD -- showcase/migrated/charts` (all read
`false` / `false as const`): candle `:269`, choropleth `:390`, composed `:278`,
funnel `:282`, gauge `:400,:901`, area-def `:155,:604`, bar-marks `:643,:728`,
heatmap-def `:487,:522`, loading-def `:22`, scatter-assemble `:67`,
line-spec `:166`, sunburst-def `:244`, live-line `:544`, pie `:334,:362`,
radar `:380`, ring `:221,:245`, sankey `:477`. 16/16 families.

### Table 1c — `renderer={` (28 sites)

`git grep -n 'renderer={' HEAD -- showcase/migrated/charts` (excluding the
`sunburst-architecture.md` doc line): chart mounts — area-loading `:116`,
bar `:344`, candle `:411`, choropleth `:806`, composed `:396`, funnel `:519`,
gauge `:523,:1016`, heatmap-components `:211`, live-line-overlay `:393`,
line-loading `:122`, line `:408`, pie `:595,:608`, radar `:833,:845`,
ring `:505`, sankey `:580`, sunburst `:687`, area-layers `:139`,
scatter-view `:119`, bar-loading-sweep `:84`, line-loading-pulse `:93`,
loading-entries `:125,:192,:259`; host pass-throughs `chart-host.tsx:366`
(+`:343,:360` are `initialWidth`/`idPrefix`).
`motion(` call sites: `motion-renderer.ts:16,17` (still + resize instances,
D567); `useChartRenderer` regime mounts: bar `:286`, candle `:370`,
composed `:384`, scatter (`scatter-selection-setup.ts:105`), area
(`use-area-layer-props.ts:42`), line (`line-chart.tsx:389`).

## 2. Reach-in ledger

Guard: `node scripts/reach-in-guard.mjs --json` (working tree; tree is clean
outside `.agents/`, so it reads HEAD).

Before (HEAD ledger, 19 entries): guard read **total 21, 12 files, failures
0**, notes 10 (3 lower-pin + 7 zero-site).

Per-entry measurement vs pin:

| Ledger entry | Pin | Measured | Delta |
|---|---|---|---|
| `charts/choropleth-chart.tsx` | 1 | 1 | hold |
| `charts/radar-chart.tsx` | 18 | 3 | **lower → 3** |
| `charts/ring-chart.tsx` | 2 | 1 | **lower → 1** |
| `internal/bar-chart-overlays.ts` | 1 | 1 | hold |
| `internal/bar-pulse-sync.ts` | 2 | 0 (module deleted, D569) | **remove** |
| `internal/choropleth-reveal.ts` | 4 | 0 (neutralised, G31) | **remove** |
| `internal/composed-reveal.ts` | 1 | 0 (neutralised, G31) | **remove** |
| `internal/dash-tail-measure.ts` | 3 | 3 | hold |
| `internal/deferred-reveal.ts` | 2 | 0 (deleted, D561) | **remove** |
| `internal/gauge-geometry.ts` | 1 | 1 | hold |
| `internal/line-loading-pulse.tsx` | 1 | 0 (V3.9 definitions) | **remove** |
| `internal/line-marker-reveal.ts` | 1 | 0 (deleted, D561/G20) | **remove** |
| `internal/reveal-root.ts` | 1 | 1 | hold |
| `internal/ring-chart-model.ts` | 4 | 2 | **lower → 2** |
| `internal/sankey-animation.ts` | 2 | 0 (neutralised, G31) | **remove** |
| `internal/sankey-reveal-specs.ts` | 3 | 3 | hold |
| `internal/scatter-reveal.ts` | 1 | 1 | hold |
| `internal/use-composed-reveal.ts` | 2 | 2 | hold |
| `internal/use-line-reveal.ts` | 2 | 2 | hold |

Ledger delta applied in `scripts/reach-in-ledger.json`: 7 entries removed, 3
pins lowered (19 → 12 entries). After:

```
{
  "total": 21,
  "files": 12,
  "counts": {
    "showcase/migrated/charts/choropleth-chart.tsx": 1,
    "showcase/migrated/charts/internal/bar-chart-overlays.ts": 1,
    "showcase/migrated/charts/internal/dash-tail-measure.ts": 3,
    "showcase/migrated/charts/internal/gauge-geometry.ts": 1,
    "showcase/migrated/charts/internal/reveal-root.ts": 1,
    "showcase/migrated/charts/internal/ring-chart-model.ts": 2,
    "showcase/migrated/charts/internal/sankey-reveal-specs.ts": 3,
    "showcase/migrated/charts/internal/scatter-reveal.ts": 1,
    "showcase/migrated/charts/internal/use-composed-reveal.ts": 2,
    "showcase/migrated/charts/internal/use-line-reveal.ts": 2,
    "showcase/migrated/charts/radar-chart.tsx": 3,
    "showcase/migrated/charts/ring-chart.tsx": 1
  },
  "failures": [],
  "notes": []
}
```

Entries still above zero (one-line reason + removal vector each):

| Entry (sites) | Why it stays | Vector that removes it |
|---|---|---|
| choropleth-chart.tsx (1) | geo group reveal readback | V3.5 follow-up / motion owner (G32 reduction) |
| radar-chart.tsx (3) | radar reveal subsystem (rings/spokes/labels WAAPI) | one animation owner (V3.5 motion on polar marks) |
| ring-chart.tsx (1) | ring track reveal class | package motion on the track mark (V3.5) |
| bar-chart-overlays.ts (1) | ex-bar-chart reveal stamp | V3.5 motion (bar band crosshair already native) |
| dash-tail-measure.ts (3) | dash-sweep needs the rendered path element | V3.6 kept `.bkm-dash-tail` deliberately (D565); overlay outside the scene, no mark expression |
| gauge-geometry.ts (1) | arc-mark class const for reveal | package motion on gauge marks (V3.5) |
| reveal-root.ts (1) | reveal-root querySelector helper | delete with the reveal shells (7.4, G31) |
| ring-chart-model.ts (2) | per-track WAAPI + revealing class | package motion on the track mark (V3.5) |
| sankey-reveal-specs.ts (3) | reveal specs (`pathLength` setAttribute) | package motion on link/rect/text (V3.5, D562b dropped the stagger) |
| scatter-reveal.ts (1) | ex-scatter reveal stamp | package motion on dots (V3.5) |
| use-composed-reveal.ts (2) | ex-composed reveal hook | package motion on composed marks (V3.5) |
| use-line-reveal.ts (2) | ex-line reveal hook | package motion on line marks (V3.5) |

## 3. `createMark` gate

`git grep -ln 'createMark' HEAD -- showcase/migrated/charts` → **19 files**,
`git grep -c … | awk -F: '{s+=$NF} END {print s}'` → **43 sites**
(V3.8 row said "18 files today"; +1 is V3.9 `internal/loading-definitions.ts`).
The count is gated, not zero: every site builds scene nodes the package has
no mark for. Closest package mark per row from
`bench/app/node_modules/@tanstack/charts/dist/` (`area(-x)`, `bar`, `rect`,
`dot`, `line`, `link`, `polar`, `text`, `geo`; **no `candle`/`ohlc`, no
`funnel`, no `radialText`-as-centre in definitions**).

| File | Mark built (scene nodes) | Why no package mark (gap) |
|---|---|---|
| `funnel-chart.tsx` (comment :2) + `internal/funnel-mark.ts` (`createMarkWithScaleValues`, `SceneArea` path/points :212) | one mark per orientation, corner-point morph areas | no funnel primitive (`funnel-chart.tsx:1` "no TanStack funnel primitive"); `area-x.d.ts` has no corner-morph option |
| `gauge.tsx:862` (`createMark`, group nodes) | linear-quad gauge notches (`buildLinearQuadMark`) | no gauge/notch mark in dist; polar() covers arcs, not quads |
| `internal/area-fill-mark.ts:91` (area + group) | area fill with hover-invariant split | package `area` has no invariant/hover-split wrapper form |
| `internal/bar-column-track-mark.ts:103` | column track behind bars | `rect.d.ts` has no track semantics |
| `internal/bar-depth-front-mark.ts:80` + `bar-depth-marks.ts:51` (rect/group) | 3-D depth faces | `rect.d.ts`/`bar.d.ts` have no depth/perspective options |
| `internal/bar-pulse-mark.ts:240` (area + group + rect) | loading pulse silhouette + wave readback | loading marks are V3.9 definitions; no pulse mark in dist |
| `internal/bar-squares-mark.ts:134` (group) | wafer squares with per-square gradients | `rect` has no userSpace-slice gradient span (D558: seam resources) |
| `internal/bar-trimmed-mark.ts:236` (group + rect) | trimmed bars | `rect.d.ts`/`bar.d.ts` have no trim option |
| `internal/candlestick-chart-marks.ts:205,264` (groups; wicks + bodies) | wick + body candle marks | **no candle/ohlc mark in dist at all** |
| `internal/highlight-band.ts:40` | focus-outside-x-domain wrapper | combinator, not a mark; wraps any mark |
| `internal/loading-definitions.ts:93,181,306` (`createMarkWithScaleValues`; area + polyline + rect ×2) | bar/line/heatmap skeleton placeholders | no skeleton/placeholder mark in dist (V3.9) |
| `internal/pattern-area-mark.ts:76` (area + group) | pattern-filled area | `area` has no pattern-fill channel (F-259, I4/I5; R10 seam) |
| `internal/profit-loss-line-mark.ts:142` (group + polyline) | profit-loss segments with per-segment opacity | `line` has no per-segment focus-opacity channel |
| `internal/projection-line-mark.ts:68` (group + polyline) | dashed projection tails | `line` has no projection-tail semantics |
| `internal/scatter-dot-mark.ts:276` (dot ×3 + group) | phased dots with y-gradient + ring | `dot.d.ts` has no phase/gradient-fill channel |
| `internal/series-bar-mark.ts:99` | composed series bars | `bar` has no composed-series role binding |
| `internal/series-marker-mark.ts:24` | series point markers | `dot` has no series-marker role binding |

## 4. Twelve-idiom checklist evidence (one line per tick)

Idioms (`08` §3): 1 `svgAnimation:false`+`motion()` · 2 `states`
`when:{focus}`+`transition` · 3 `decorative()` · 4 `radialText` · 5 second
decorative polar layer / `crosshair` band · 6 funnel `areaX`+`text` · 7
sparkline silence · 8 legend buttons + `aria-pressed` · 9
`initialWidth`+`aspectRatio` preview · 10 `idPrefix` · 11
`tooltip.content(points)` · 12 `--ts-chart-tooltip-*`+`theme.palette`.
`git grep -n 'decorative(' / 'radialText' HEAD -- showcase/migrated/charts`
→ **0 hits each** (package exports both: `mark-decorative.d.ts:3`,
`polar.d.ts:257`). `git grep -n 'aria-pressed'` → **0 in code**
(`heatmap-legend.tsx:521` comment only, D549: legacy has no click toggle).

| Tick | File:line |
|---|---|
| 1, all 16 | §1b (23 literals; e.g. area `area-chart-definition.ts:155`, bar `bar-chart-series-marks.ts:643`, line `use-line-chart-spec.ts:166`, scatter `scatter-definition-assemble.ts:67`, sunburst `use-sunburst-definition.ts:244`); renderer `motion-renderer.ts:16,17`, regime mounts bar `:286` candle `:370` composed `:384` scatter `scatter-selection-setup.ts:105` area `use-area-layer-props.ts:42` line `line-chart.tsx:389` (D567) |
| 2 area | `area-chart-marks.ts:120` (`states: pointerSeriesDimStates`, transition in `focus-marks.ts:127`) |
| 2 bar | `bar-chart-series-marks.ts:47,55,60` |
| 2 candle | `candlestick-chart-marks.ts:91` (+`whenFocused` `:395,:427`) |
| 2 choropleth | `choropleth-chart.tsx:312,326` |
| 2 composed | `composed-series-marks.ts:103,129` |
| 2 funnel | `funnel-mark.ts:258` |
| 2 heatmap | `heatmap-definition.ts:106,118,152` |
| 2 line | `line-series-marks.ts:59,63` |
| 2 pie | `pie-chart.tsx:206` (+`withStates` `:360`) |
| 2 radar | `radar-chart.tsx:286,296,304` |
| 2 sankey | `sankey-mark.ts:291,296,314` |
| 2 scatter | `scatter-y-gradient-mark.ts:209` (+ assemble fade `:209ff`) |
| 2 sunburst | `use-sunburst-definition.ts:109` |
| 5 radar | `radar-chart.tsx:347` guides polar + `:356` series polar |
| 5 bar | `focus-marks.ts:77,78` band form + `bar-chart-overlays.ts:369` |
| 5 area/line/composed/candle | rule-form crosshair + x label: `focus-marks.ts:86`, call sites `area-chart-marks.ts:156`, `line-series-marks.ts:182`, `composed-marks.ts:48`, `candlestick-chart-marks.ts:363` |
| 5 live-line/scatter | crosshair as spec gradient: `live-line-chart.tsx:341,369,371`, `scatter-definition-assemble.ts:49` |
| 8 mechanism (no tick) | buttons `legend-item.tsx:41`, `chart-legend-default-row.tsx:105`, `chart-legend-custom-row.tsx:51`; `aria-pressed` 0 (D549) |
| 9 all but funnel | `initialWidth=` §1 (§3 table); funnel `funnel-chart.tsx:517` measured `chartW` + container aspect `:135` |
| 10 all 16 | `idPrefix=` §1 (53 sites; every ChartHost mount) |
| 11 mechanism (no tick) | `renderTooltipBody` host escape (e.g. `bar-chart.tsx:231`, `area-chart.tsx:349`); package `use: packageTooltip` without `content` (`use-line-chart-spec.ts:107`); own singular renderer `tooltip-components.tsx:917` |
| 12 tooltip vars | `styles.css:183-189` (`--ts-chart-tooltip-*` on the shell) |
| 12 area/bar/candle/composed/line/live-line | `theme: { muted: … }` (`area-chart-definition.ts:605`, `bar-chart-series-marks.ts:644,729`, `candlestick-chart.tsx:270`, `composed-chart.tsx:279`, `use-line-chart-spec.ts:167`, `live-line-chart.tsx:545`) + scale vars `css-var-maps.ts:22` |
| 12 pie/scatter/sunburst | `theme: { palette: CHART_CATEGORY_PALETTE }` (`pie-chart.tsx:335`, `scatter-definition-assemble.ts:68`, `use-sunburst-definition.ts:248`) |
| 12 pie/ring/radar/sankey/choropleth/heatmap maps | `css-var-maps.ts:31-…` (`pieCssVars`, `ringCssVars`, `radarCssVars`, `sankeyCssVars`, `choroplethCssVars`, `heatmapCssVars` derive from `chartCssVars`) |
| G30 | `heatmap-legend.tsx:348` (`${patternId}-base`) vs `:363` (`url(#${patternId})`) |

Blank cells: 3+4 everywhere (0 package-idiom hits); 2 on gauge/live-line/ring
(0 `when:`/`states` in `gauge.tsx`, `live-line-chart.tsx`,
`ring-chart.tsx:239` comment only); 5 on pie/ring/gauge/sunburst (single polar
container, no active-ring layer), heatmap (no crosshair — band *scales* only),
choropleth/funnel n/a; 6 funnel (custom `createMarkWithScaleValues`, labels
stay HTML overlays `funnel-chart.tsx:2`); 7 n/a everywhere (no family ships a
sparkline mode; silence recorded in `loading-definitions.ts:1`); 8 everywhere
(buttons without `aria-pressed`, unimplementable — D549); 9 funnel (measured
width, not the preview branch); 11 everywhere (host `renderTooltipBody`
escape instead of `content(points)`); 12 choropleth/funnel/gauge/heatmap/
radar/ring/sankey (no `theme:` in definition).

## 5. G25 / G26 / G30 readings

- **G25** (`spatialIndex` grep reads 1, target ≥ 5): tree reads
  `sankey-chart.tsx:476` only; V2.5 cartesian indexes pass through the package
  `focus` option instead of the literal key (D544), so the §6 probe cannot
  pass by grep. **Not closed by the census**: the disposition needs a probe
  rewrite (qa/, not owned) or the literal key (chart code, not owned).
  Row stays open with this measurement.
- **G26** (`initialWidth` 12/16 entry files): tree reads **28 `initialWidth=`**
  sites (§1/§3 table): 14 entry files + area/heatmap/scatter/live-line
  internal views + loading entries + host pass-throughs. §6 "= 15" means
  mounts, and mounts read 28 ≥ 15. **Closed by the census** — mark
  `✅ closed by V3.8 (D<n>)`.
- **G30** (heatmap legend swatch `url(#id)` vs `#id-base`): **still true** —
  `heatmap-legend.tsx:348` renders the pattern as `${patternId}-base` while
  `:363` fills `url(#${patternId})`. Visible whenever a heatmap level uses a
  pattern style: the swatch `<rect>` references an undefined id, so the
  pattern never paints (fallback is not applied — the ternary already chose
  the url branch). **Not fixed** (owner file not owned); row stays open with
  this measurement.

## 6. Overlay `<defs>` question

`git grep -n '<defs' HEAD -- showcase/migrated/charts` (11 hits outside the
seam; seam `resource-host.tsx:29` is the sanctioned one):

| Site | Owner | Location | Recommendation |
|---|---|---|---|
| `background.tsx:147,223` | Background (chart family chrome) | sibling svg behind marks (`background-layer.tsx:1`), **not** the chart svg | stamp: app-owned overlay, keep |
| `brush-overlays.tsx:105` | brush selection overlay | portalled overlay svg | stamp: app-owned overlay, keep |
| `brush-selection-pattern-chrome.tsx:42` | brush selection pattern | portalled overlay svg | stamp: app-owned overlay, keep |
| `reference-area-figure.tsx:143,206` | reference-area figure | overlay svg | stamp: app-owned overlay, keep |
| `segment-visuals.tsx:86` | segment line overlay | segment overlay | stamp: app-owned overlay, keep |
| `terminal-marker.tsx:81` | projection/marker overlay | visible marker overlay svg (D558 ruling) | stamp: app-owned overlay, keep |
| `tooltip-components.tsx:239` | tooltip indicator | tooltip chrome `<g>` | stamp: tooltip chrome (package `content` gap, V2.6), keep |
| `tooltip-indicator-faded-rect.tsx:26` | tooltip indicator | indicator chrome | stamp: same, keep |
| `heatmap-separator.tsx:87`, `pattern.tsx:4` | — | comments only | no ruling needed |

No remaining `<defs>` sits inside a chart `<svg>`; none needs the R10 seam
(the seam holds only `pattern`/`radialGradient`/sweep/mask resources the
*definition* references as `url(#id)`). Recommended lead ruling for each
non-seam `<defs>`: **app-owned overlay — keep**, stamped per row above.

## 7. Verification

- `cd showcase && npx tsc --noEmit` → exit 0, no output.
- `cd showcase && npx oxlint --type-aware migrated packages/migrated-charts` → 3 errors (floor): `marker-group-content.tsx:34` `__qaSetMarkerFan` naming, `css-var-maps.ts:100` + `index.ts:114` `heatmapCssVars` deprecated.
- `pnpm test` (root) → pass 180 / fail 0 / todo 60.
- `node scripts/orphans.mjs` → 0.
- `node scripts/reach-in-guard.mjs --json` → failures 0 (paste §2).
- fixtures: `node showcase/migrated/fixtures/hoc.check.mjs` → exit 0 (registry union + legacy throw); `legacy-hooks.check.mjs` → exit 0 (`<svg` 6512 chars); `states.check.mjs` → exit 0 (focused arc keeps `#0ea5e9`).
- Not run (forbidden by the item): gate:probes, run-qa, preview servers. Not committed.
