# Initiative 11 — PatternArea + Bar Pattern/Squares/Depth/Pulse (plan-loop-1)

Status: **DRAFT — ready for lead rulings (§10 empty).** Sonnet-drafted synthesis from (a) direct file:line reads this loop of the migrated tree and TanStack backend (`showcase/migrated/charts/{area-chart,bar-chart}.tsx`, `internal/{pattern-preset,visx-pattern-bridge,background,reference-area-layer,brush-chrome,series-bar-mark,series-bar-layout,types}.ts(x)`, `showcase/repos/tanstack-charts/packages/charts-core/src/{types,scene,svg,mark}.ts`, `docs/phase-3/{LOG,PROGRESS}.md`), and (b) a parallel cmd-executor's full bklit-source inventory (`repos/bklit-ui/packages/ui/src/charts/{pattern-area,pattern-preset,visx-pattern,bar-squares,bar-squares-layout,bar-depth,bar-depth-geometry,bar,bar-chart,chart-child-passthrough,chart-defs,chart-context,motion-utils,animation}.ts(x)` + consumer greps across `apps/web`, `packages/studio`, `showcase/`), integrated below. Structural template: `research/phase-3/plans/09-chart-brush/plan-loop-1.md`, `research/phase-3/plans/10-markers-chrome/plan-loop-1.md`. Audit stub read first: `research/phase-3/audits/11-pattern-bars.md` (5 lines) — see §1 for a scope-narrowing correction found this loop.

## 1. Scope + non-goals

**Audit-stub correction (major scope-narrowing finding, disclosed):** the audit stub's mandate "use ... ONE pattern resource owner; preserve eight pattern IDs" reads as if the pattern-fill system must be built from scratch. It does not need to be. `showcase/migrated/charts/internal/pattern-preset.tsx` (180 lines) **already exists and already implements exactly eight pattern-preset IDs**, deliberately pre-built in initiative 3 and reserved for initiatives 6 and 11 — confirmed by `docs/phase-3/PROGRESS.md:15`: "background/pattern-preset landed as unwired leaf modules for initiatives 6/11." Initiative 6 (ReferenceArea) and initiative 9 (D227 ruling 8, brush `selectionPattern`) have already wired it. **This loop's bklit-inventory cross-check confirms the migrated module is an exact 1:1 port** of bklit's own `pattern-preset.tsx:6-15` `PATTERN_PRESET_IDS` (`["none","diagonal","horizontal","vertical","cross","dots","circles","accent"]`, identical order, identical tile sizes at `:41-59`, identical `accent`-hardcodes-`#e879f9` behavior at `:174-182` ignoring the `color` option) — **no reconciliation work needed on the pattern-preset module itself.** This initiative's PatternArea work is to WIRE this existing module (or bklit's raw-URL-fill idiom, §2.1/§9 Q1) to Area's fill, and to build the Bar-family geometry marks that reuse it for their own pattern fills.

**Correction to the "ONE pattern resource owner" framing itself:** bklit has **no dedupe registry either**. Every one of its 6 pattern-consuming call sites (`bar-squares.tsx:197-223`, `background.tsx:73-97`, `heatmap/heatmap-pattern-defs.tsx:28-41`, `reference-area.tsx:157`, `chart-brush-selection-overlay.tsx:63`, plus hand-authored `<PatternLines>` in docs demos) owns its own local `<defs>` with a `useId()`/manually-namespaced id, no shared registry, no global collision-avoidance beyond per-instance unique ids. Migrated's `internal/pattern-preset.tsx` consumers (`background.tsx`, `reference-area-layer.tsx`, `brush-chrome.tsx`) already follow this exact same per-consumer-owned-defs shape. **"One pattern resource owner" is therefore already satisfied** — it means "one shared rendering FUNCTION," not "one shared defs registry," and migrated already has that one function.

Migrated `PATTERN_PRESET_IDS` (`internal/pattern-preset.tsx:4-13`) vs. bklit `pattern-preset.tsx:6-15` — confirmed identical, 8 entries each, verbatim match.

**In scope — genuinely missing, verified by grep + read, bklit inventory integrated:**

- **`PatternArea`** (bklit `pattern-area.tsx:10-49`) — no migrated equivalent (confirmed: no `pattern-area` file under `showcase/migrated/`, no `PatternArea` role in `children.tsx`, `area-chart.tsx` fill is a plain color/gradient channel with no pattern branch). Full spec in §2.1.
- **`BarSquares`** (bklit `bar-squares.tsx:27-417`, layout `bar-squares-layout.ts:13-72`) — no migrated equivalent (confirmed: `bar-chart.tsx` marks are stock `barY()` rects only, §3.4). Full spec + quantization formula in §2.3. **Vertical, non-stacked only** (`bar-squares.tsx:310-312`: `if(isHorizontal||stacked) return null`) — this matches `bar-chart.tsx:1-4`'s own pilot-scope restriction to "vertical, grouped (NOT stacked) bars only" exactly; no scope-widening required to support BarSquares within the current pilot's constraints.
- **`BarColumnTrack`** (bklit `bar-squares.tsx:51-61,419-633`) — no migrated equivalent. Confirmed underlay-classed (`chart-child-passthrough.ts:65`, `UNDERLAY_COMPONENT_NAMES = Set(["ReferenceArea","BarColumnTrack"])`) — same architectural slot as the already-migrated `ReferenceArea` (initiative 6). Full spec in §2.4.
- **`BarDepth`** (bklit `bar-depth.tsx:1-861` + `bar-depth-geometry.ts:1-44`, plus `bar.tsx:25-52,254,359-382` front-face trim) — no migrated equivalent. Verbatim constants and math in §2.5, including audit-mandated `PERSPECTIVE_RATIO = 0.45`.
- **`BarPulse`** (bklit `bar-depth.tsx:88-106,862-1074`, co-located with `BarDepth`) — no migrated equivalent. Full spec in §2.6.
- Prop plumbing: `internal/types.ts`'s `BarConfig` interface (`dataKey, fill?, stroke?, lineCap?, fadedOpacity?`) has **zero pre-stubbed fields** for pattern/squares/depth/pulse (unlike initiative 10's `LineConfig`/`AreaConfig`) — genuinely net-new prop surface, not a wiring-only job. `bar-chart.tsx:1-4`'s header comment (verbatim): "Pilot scope: vertical, grouped (NOT stacked) bars only — one `barY()` mark per `<Bar>` series (bar-chart.tsx bklit source's `stacked`/`orientation`/`perspective`/`minBarHeight`/`squareSnap` branches are all out of scope)." — direct, load-bearing evidence `perspective`/`squareSnap` were deliberately deferred to this initiative.

**Confirmed genuinely out-of-scope / already-done elsewhere (disclosed, not silently dropped):**
- `ReferenceArea`'s pattern fill (init 6), brush's `selectionPattern` (init 9, D227 ruling 8), `Background`'s pattern fill — all already wired to `internal/pattern-preset.tsx`. Reuse precedent only, not this initiative's work.
- Studio-only pattern/bar-depth tuning UI, registry manifests (`apps/web/public/r/bar-depth.json`, `bar-chart.json`), Studio's shape-variant picker (`packages/studio/src/lib/studio-components.ts:716`) — no migrated Studio exists; out of scope by standing architectural exclusion.
- **`composed-chart.tsx` — frozen (task constraint), and confirmed NOT needed for fidelity.** bklit's own `ComposedChart` does not support any of these five features either: `composed-chart.tsx:106-121` `tryAppendArea` matches only `Area` (not `PatternArea` — `pattern-area.tsx` cross-ref §2.1), and per the parallel inventory, bklit's `ComposedChart` bar-config extraction likewise does not recognize `BarSquares`/`BarDepth*`/`BarPulse` the way `bar-chart.tsx:103-143`'s `extractBarConfigs` does (that extraction function, and its `BarSquares`/`__isBarDepthLayer`-aware handling at `:110-116,126`, is BarChart-specific — ComposedChart has no equivalent recognition path). **Excluding `composed-chart.tsx` from this initiative is therefore not an artificial constraint imposed only by the frozen-file rule — it is faithful to bklit's own architecture**, which also never wired these bar-shape/area-pattern features into its composed-chart equivalent. Full analysis in §5.
- `scatter-chart.tsx` — no Area/Bar surface at all; no overlap found, frozen or not.

## 2. bklit behavior inventory (file:line cited, from the parallel cmd-executor's report)

### 2.1 `PatternArea` (`pattern-area.tsx:10-49`)

**Public props (`PatternAreaProps` :10-19):**
```ts
dataKey: string                  // :12
fill: string                     // :14 — "Fill color or pattern URL (e.g. `url(#pattern-id)`)"
curve?: CurveFactory              // :16 — default curveMonotoneX (:28)
animate?: boolean                 // :18 — "@deprecated Pattern fill is not clip-revealed; only the stroke `Area` animates."
```
No `fillOpacity`, `stroke`, `gradient*`, `fadeEdges` — intentionally minimal. **Critically: `PatternArea` itself does NOT call `renderPatternPreset` or own any `<defs>`.** `fill` is a plain string (color OR `url(#id)`); the CONSUMER is responsible for supplying a sibling `<PatternLines>`/`<PatternCircles>` (or `renderPatternPreset` output) with a matching id. This is a materially different shape than `ReferenceArea`/`brush-chrome.tsx`'s pattern integration, which DO call `renderPatternPreset` internally (§9 Q1).

**Geometry (:32-43):** thin `<AreaClosed curve data={renderData} fill x={xScale∘xAccessor} y={typeof v==="number"?yScale(v):0} yScale />`, reading `renderData,xScale,yScale,xAccessor` from `useChartStable()` (:30).

**Standard doc idiom** (`area-chart-pattern-demo.tsx:35-36`, `chart-examples.tsx:1786-1788`, `area-studio-preview.tsx:173-178`, verbatim):
```tsx
<PatternArea dataKey="desktop" fill="url(#area-example-pattern)" />
<Area dataKey="desktop" fillOpacity={0} strokeWidth={2} />
```
`PatternArea` renders the pattern-filled shape; a SEPARATE `<Area fillOpacity={0}>` sibling supplies the stroke-only line on top. **Two components, not one** — the pattern fill and the stroke line are architecturally decoupled in bklit.

**Layer/z + animation:** Series layer, `preOverlayChildren` (`time-series-chart-shell.tsx:427-454`) — `isPatternDefComponent` check (name-based, `chart-defs.ts:15-28`) does NOT classify `PatternArea` itself as a defs component (only the `PatternLines`/`PatternCircles` sibling is), so `PatternArea` renders inside the same clip-reveal `<g clipPath="url(#chart-*-grow-clip)">` as ordinary series content (`:687-691`). `PatternArea`'s own `animate` prop is deprecated/ignored; despite its doc comment claiming "not clip-revealed," in the current shell it IS clip-revealed via the same LTR reveal-clip group (`ChartRevealClip`, `DEFAULT_CHART_ENTER_TRANSITION: {type:"tween",duration:1.1,ease:[0.85,0,0.15,1]}`, `animation.ts:9-13`) as everything else in that slot — the doc comment is stale/inaccurate relative to current behavior. **No BarPulse-style continuous animation on PatternArea** — it participates in the same one-shot entrance reveal as any other series content.

**Cross-refs (host handling):**
- `area-chart.tsx:90-98` `extractAreaConfigs`: detects `isPatternArea` and excludes it from `LineConfig[]` (doesn't count toward y-domain).
- `line-chart.tsx:71-80` `LINE_DOMAIN_EXCLUDED_NAMES` includes `"PatternArea"` — `LineChart` silently ignores it if present.
- `composed-chart.tsx:106-121` `tryAppendArea` matches only `Area` — `PatternArea` is a no-op in `ComposedChart` (confirms §1's frozen-file analysis).
- `bar-chart.tsx:103-143` `extractBarConfigs` matches `Bar`/`BarSquares`, not `PatternArea` — irrelevant to BarChart.

### 2.2 Pattern preset family — 8 IDs (`pattern-preset.tsx:6-186`, `visx-pattern.tsx:11-32`)

Confirmed **exact 1:1 match** with migrated `internal/pattern-preset.tsx` (§1). Full per-preset table (verbatim from bklit):

| id | tile size (`patternPresetTileSize` :45-52) | rendered node |
|---|---|---|
| `none` | — | `return null` (:116-118) |
| `diagonal` | 6×6, strokeWidth 1 (×scale) | `<PatternLines orientation={["diagonal"]} stroke={color} .../>` (:138-146) |
| `horizontal` | 6×6×1 | `<PatternLines orientation={["horizontal"]} .../>` (:147-155) |
| `vertical` | 6×6×1 | `<PatternLines orientation={["vertical"]} .../>` (:156-164) |
| `cross` | 8×8×1 | `<PatternLines orientation={["diagonal","diagonalRightToLeft"]} .../>` (:165-173) |
| `dots` | 10×10, strokeWidth 0 | `<PatternCircles radius={radius??max(0.5,1.5*scale)} complement fill=.../>` (:80-95) |
| `circles` | 6×6×1 | `<PatternCircles radius={radius??2*scale} fill stroke={color}/>` (:97-108) |
| `accent` | 6×6×1 | `<PatternLines orientation={["diagonal"]} stroke="#e879f9" .../>` (:174-182) — **hardcoded fuchsia**, ignores `color` param, also ignores the design-token system (`chart-scale.ts:2-17`'s `CHART_SCALE_VARS` — `accent` deliberately bypasses tokens) |

Options (`PatternPresetOptions` :19-29): `color?, scale?, strokeWidth?, radius?, complement?, fill?, dotFill?, tileBackground?` — matches migrated `internal/pattern-preset.tsx:17-26` verbatim.

**Defs ownership (no registry, confirmed — see §1):** `bar-squares.tsx:197-223` `SquareColumn` calls `renderPatternPreset(patternPreset, patternId, {color: `url(#${gradientId})`})` — **note the nested composition: the pattern's stroke/fill "color" can itself be a gradient url**, ids `bar-squares-pattern-${index}-${revealEpoch}` (:178) / `bar-squares-gradient-${index}-${revealEpoch}` (:176), scoped per-column per-reveal-epoch (not just per-instance — regenerates on reveal replay, matching the reveal-epoch keying idiom initiative 9/10 already established for WAAPI replay).

### 2.3 `BarSquares` (`bar-squares.tsx:27-417`, layout `bar-squares-layout.ts:13-72`)

**Public props (`BarSquaresProps` :27-49):**
```ts
dataKey: string
yAxisId?: string | number
fill?: string              // :31 — fill color, gradient url, or pattern url. Default: var(--chart-line-primary)
stroke?: string            // :33 — tooltip dot/ring stroke when fill is gradient/pattern
squareGap?: number         // :35 — default 3 (:281)
squareRadius?: number      // :37 — corner radius as fraction of square size (0=flat, 0.5=circle). Default 0.25 (:282)
squareFit?: boolean        // :39 — redistribute gap to fit bar height exactly. Default false (:283)
useGradient?: boolean      // :41 — apply bar-spanning gradient from gradientStops. Default false (:284)
gradientStops?: GradientStop[]  // :42 — {offset:number, color:string} (:22-25)
patternPreset?: PatternPresetId  // :44 — pattern preset when fill is pattern
animate?: boolean          // :45 — default true (:287)
fadedOpacity?: number      // :46 — default 0.3 (:288)
staggerDelay?: number      // :47 — per-column stagger override
groupGap?: number          // :48 — default 4 (:290)
```

**Square-quantization formula — verbatim, MUST be ported exactly (`bar-squares-layout.ts:24-72`):**
```ts
export function computeSquareColumn({barLengthPx,squareSize,gap,fit=false}: SquareColumnInput): SquareColumnLayout {
  if (barLengthPx<=0 || squareSize<=0) return {count:0,positions:[],columnHeight:0,squareSize,gap};
  if (fit) {
    const count = Math.max(1, Math.floor((barLengthPx+gap)/(squareSize+gap)));            // :36-39
    const effectiveGap = count>1 ? Math.max(0,(barLengthPx-count*squareSize)/(count-1)) : 0; // :40-43
    const step = squareSize+effectiveGap;                                                  // :44
    const columnHeight = barLengthPx;                                                      // :45
    // positions bottom-first: :48-50
    for (let i=0;i<count;i++) positions.push(columnHeight-squareSize-i*step);
    return {count,positions,columnHeight,squareSize,gap:effectiveGap};
  }
  const step = squareSize+gap;                                                              // :61
  const count = Math.max(1, Math.round(barLengthPx/step));                                  // :62
  const columnHeight = count*squareSize + Math.max(0,count-1)*gap;                          // :63
  for (let i=0;i<count;i++) positions.push(columnHeight-squareSize-i*step);                 // :65-69
  return {count,positions,columnHeight,squareSize,gap};
}
```
`topSquareCenterY` (:74-99) = `baselineY - columnHeight + size/2`. Square size (`bar-squares.tsx:325-331`): `(bandWidth - effectiveGroupGap*(seriesCount-1)) / seriesCount` where `effectiveGroupGap = seriesCount>1 ? groupGap : 0`. Column x (:361-362): `bandPos + seriesIndex*(squareSize+effectiveGroupGap)`.

**Opacity/dim:** `squareOpacity = isFaded ? fadedOpacity : 1` where `isFaded = (hoveredBarIndex!==null && hoveredBarIndex!==i) || isLegendDimmed` (:367-368) — **confirms BarSquares IS hover-reactive** (resolves former §9 open question — see §3.5/§9).

**Unsupported guard (:310-312):** `if (isHorizontal || stacked) return null` — matches migrated `bar-chart.tsx`'s existing pilot-scope restriction exactly (§1).

**Layer/z:** normal `preOverlayChildren`, rendered AFTER `underlayChildren` (`:652-661`) — i.e. behind nothing else pre-overlay except an underlay like `BarColumnTrack` if present.

**Animation (verbatim, :95-140, :231-267):**
- `squareCascadeStepSeconds` (:96-111): `if (squareCount<=1) return 0; durationMs = tween ? duration*1000 : animationDurationMs; cascadeSpreadMs = durationMs*0.4; return cascadeSpreadMs/1000/(squareCount-1)`.
- `cascadeColumnTransition` (:113-140): wraps `transitionWithDelay(enterTransition, columnIndex*columnStaggerDelay)`, extends `duration += cascadeStep*(count-1)` if tween.
- Per-square (:248-263): `motion.rect animate={{attrY:y,height:squareSize,opacity:squareOpacity}} initial={{attrY:bottomY,height:0,opacity:1}} transition={{...transitionWithDelay(enterTransition, index*staggerDelay+squareIndex*cascadeStep), opacity:{duration:0.15}}}`. Static fallback (:232-244) is a plain `<rect>`.
- Column stagger (:333-336, shared with track :459-462): `totalAnimDuration = animationDuration||1100; staggerSpread=total*0.4; calculatedStaggerDelay = staggerDelay ?? (data.length>1 ? staggerSpread/1000/data.length : 0)`.

### 2.4 `BarColumnTrack` (`bar-squares.tsx:51-61,419-633`)

**Public props (`BarColumnTrackProps` :51-61):**
```ts
fill?: string        // :53 — fill color or pattern url. Default: var(--chart-grid)
opacity?: number      // :54 — default 0.3 (:421)
squareGap?: number    // :55 — default 3 (:422)
squareRadius?: number // :57 — default 0.25 (:423)
groupGap?: number     // :58 — default 4 (:425)
squareFit?: boolean   // :59 — default false (:424)
staggerDelay?: number // :60
```

**Geometry (`TrackColumn` :545-577, verbatim):**
```ts
const baselineY = valueScale(0) ?? innerHeight;              // :553
const valuePos  = valueScale(value) ?? 0;                     // :554
const barLengthPx = baselineY - valuePos;                     // :555
const layout = computeSquareColumn({barLengthPx,squareSize,gap:squareGap,fit:squareFit}); // :556-561
const columnTop = baselineY - layout.columnHeight;             // :562
const trackHeight = Math.max(0, columnTop);                    // :563 — "empty space ABOVE each square column (not behind the bars)"
if (trackHeight<=0 && !animate) return null;                   // :565
const x = bandPos + seriesIndex*(squareSize+effectiveGroupGap); // :569
const rx = squareSize*squareRadius;                             // :468
```
Track is a vertical rect (`x, y=0, width=squareSize, height=trackHeight`) spanning from the plot top down to the top of the (would-be) square column — reuses `computeSquareColumn` to know where that top is, so `BarColumnTrack` and `BarSquares` MUST share the same quantization function to stay visually aligned.

**Layer/z:** confirmed underlay-classed via `chart-child-passthrough.ts:65` `UNDERLAY_COMPONENT_NAMES = Set(["ReferenceArea","BarColumnTrack"])` → `bar-chart.tsx:571-572,653` renders `underlayChildren` BEFORE `preOverlayChildren`, excluded from grow-clip reveal, behind bars/squares but above grid/axes. Doc comment (verbatim, :179-181): "Optional underlay for Shape bars: patterned or solid fill in the empty space above each square column (not behind the bars). Place before `<BarSquares>`."

**Animation + hover (verbatim, :570-594):** same `cascadeColumnTransition` stagger as BarSquares. `motion.rect animate={{height:animatedHeight,y:0}} initial={{height:baselineY,y:0}}`. Wrapper opacity: `effectiveOpacity = hoveredBarIndex===null ? opacity : 0` (:469) with `style={{transition:"opacity 0.15s ease-in-out"}}` (:474) — **fades out entirely on ANY bar hover** (not per-bar dim like BarSquares — a binary all-or-nothing fade). Same `isHorizontal||stacked` unsupported guard (:447-448).

### 2.5 `BarDepth` — perspective ratio 0.45 (`bar-depth-geometry.ts:1-44`, `bar-depth.tsx:1-861`, `bar.tsx:25-52,254,359-382`)

**Constants — verbatim, audit-mandated, MUST be preserved exactly:**
```ts
BAR_DEPTH_MAX_PX = 7                    // bar-depth-geometry.ts:11 — hard ceiling on depth in px
BAR_DEPTH_PERSPECTIVE_RATIO = 0.45      // bar-depth-geometry.ts:14 — back edge lifts by depth*0.45
BAR_DEPTH_MIN_PX = 0.5                  // bar-depth.tsx:75 — below this, back surfaces don't render
BAR_FADED_OPACITY = 0.3                 // bar-depth.tsx:78
DEFAULT_GROUND_SHADOW = 0.26            // bar-depth.tsx:83 (configurable via BarDepthProvider groundShadow)
GLASS_TIP_OPACITY = 0.2                 // bar-depth.tsx:86
BAR_HOVER_TRANSITION = {duration:0.15, ease:"easeOut"}  // bar-depth.tsx:107
```

**Geometry math (verbatim, `bar-depth-geometry.ts:21-44`):**
```ts
export function barDepthMaxDepth(stepWidth: number, bandWidth: number): number {
  const gap = Math.max(0, stepWidth-bandWidth);                                    // :22
  return Math.min(bandWidth*0.22, Math.max(0,gap-1), BAR_DEPTH_MAX_PX);            // :23 — clamped so depth never spills into the next bar's slot
}
export function barDepthAndRise(absOffset: number, naturalHeight: number, maxDepth: number): {depth:number; perspectiveRise:number} {
  const offset = Math.min(1, Math.max(0, absOffset));                              // :40
  const cappedMaxDepth = Math.min(maxDepth, Math.max(0, naturalHeight));           // :41 — depth capped by the bar's own height
  const depth = offset * cappedMaxDepth;                                           // :42 — 0 at plot center, full at the horizontal edge
  return {depth, perspectiveRise: depth * BAR_DEPTH_PERSPECTIVE_RATIO};            // :43 — THIS is where 0.45 is applied
}
```
`maxDepth` uses `d3-scaleBand.step()` (:407-408, `(barScale as ...).step?.() ?? bandWidth`).

Per-bar derivation (`useBarDepthEntries :380-518`): `centerX = innerWidth/2; zeroY = yScale(0)??innerHeight` (:402-403); `absOffset = min(1, abs((cx-centerX)/centerX))` (:446) — **depth is a function of a bar's horizontal position relative to plot center, not its value** — bars near the edges of the plot area get more 3D depth than bars near the center (a genuine perspective illusion, not a per-value decoration); `isRightOfCenter = offsetFromCenter>0` (:445); `perspectiveRise = isNegative?0:rawRise` (:456, negative-value bars get zero rise — avoids an inverted-lid visual artifact); `naturalHeight = isNegative?rawHeight:Math.max(rawHeight,minBarHeight)` (:436-438, floored bars skip trim).

**Front-face trim — bklit's plain `<Bar>`/`bar.tsx` itself participates in BarDepth, not just the BarDepth* components:**
```ts
topYTrim = isValueBar ? min(perspectiveRise, max(0,trimClampReference-1)) : 0   // :474-476
// trimClampReference for stacked = (topmost.value/segTotal)*naturalHeight       // :470
```
matches `bar.tsx:378-381`'s OWN front-face trim (verbatim): `trim = min(rise, max(0,barHeight-1)); y += trim; barHeight -= trim`. **This is the critical architectural fact the coordinator flagged**: `bar.tsx` (bklit's base bar renderer) imports `bar-depth-geometry.ts` directly (`bar.tsx:7`) and trims its OWN top edge by `perspectiveRise` whenever depth context is active — the base bar shape is NOT independent of `BarDepth`; it visually recedes behind the lifted back-lid. **A migrated port cannot treat `BarDepth` as a pure additive overlay on top of an unmodified base bar** — whatever mark bar-chart.tsx uses for its plain `<Bar>`-equivalent series must itself read the shared depth-geometry function and apply the same top-trim when depth is active (§3.4/§6/§9).

**Props:**
- `BarDepthProviderProps` (:264-266) extends `BarDepthContextValue` (:251-260): `{segmentsAccessor?, groundShadow?, minBarHeight?}`, `children`.
- `BarDepthBackProps` (:530-537): `{dataKey, color?, colorAccessor?}`, default `color="var(--chart-line-primary)"` (:81).
- `BarDepthFrontProps` (:773-776): `{dataKey}`.
- `BarDepthEntry` (:110-148): `{depth, perspectiveRise, isRightOfCenter, topY, bottomY, barHeight, naturalHeight, topYTrim, baselineY, bandX, bandWidth, isNegative, isActive}`.

**Layer/z:** all three share the static marker `__isBarDepthLayer` (:771, :860, :1074) — `bar-chart.tsx:110-116` `extractBarConfigs` explicitly skips components carrying this flag so series counts stay correct (i.e. `BarDepthBack`/`BarDepthFront`/`BarPulse` are NOT independent series, they're decorations on an EXISTING `<Bar dataKey>` series). Documented intended order (verbatim, :23-26): `<BarDepthBack>` before `<Bar>`, `<BarDepthFront>` after `<Bar>`, `<BarPulse>` after `BarDepthFront`. `BarDepthBack` renders side+top faces via `<g clipPath>` + lid, returns `null` when `depth < BAR_DEPTH_MIN_PX` (:626-628); `BarDepthFront` renders a glass overlay `motion.rect` and always renders (no min-depth guard).

### 2.6 `BarPulse` (`bar-depth.tsx:88-106,862-1074`)

**Props (`BarPulseProps` :914-921):**
```ts
dataKey: string        // :916 — must match sibling <Bar dataKey>
activeIndex?: number   // :918 — index of the bar to pulse
pulsePaused?: boolean  // :920 — suppress the sweep while keeping the 3D/glass rendering
```

**Silhouette geometry (`buildBarSilhouettePath` :871-912, verbatim):**
```ts
function buildBarSilhouettePath(e: BarDepthEntry): string {
  if (depth<=0) return frontRect;
  if (isRightOfCenter) return `M ${bandX-depth} ${topY-rise} L ${bandX+bandWidth-depth} ... Z`; // :890-900
  return `M ${bandX} ${topY} L ${bandX+depth} ${topY-rise} ... Z`;                              // :903-911
}
```
The pulse is clipped to this exact silhouette path (a closed polygon following the 3D bar's outline, not just its front rect) via `clipPath={`url(#bar-pulse-clip-${id})`}` (:1045).

**Wave geometry + animation constants (verbatim, :92-105, :1022-1037):**
```ts
PULSE_WAVE_HEIGHT_RATIO = 0.55    // :94 — waveHeight = max(barHeight*0.55, 36); "puts bright band's peak in middle at mid-travel"
PULSE_WAVE_HEIGHT_MIN_PX = 36     // :98 — minimum wave height, "pulse on steady cadence"
PULSE_WAVE_DURATION_S = 2.4       // :101 — seconds per sweep (bottom → above lid); "reads as deliberate heartbeat"
PULSE_WAVE_PEAK_OPACITY = 0.85    // :105 — peak opacity of the wave's brightest gradient stop

waveHeight = Math.max(e.barHeight*PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);  // :1027-1030
yAboveLid = e.topY - e.perspectiveRise - waveHeight;                                    // :1034
yBelowFloor = e.bottomY;                                                                // :1035
yStart = e.isNegative ? yAboveLid : yBelowFloor;                                        // :1036
yEnd   = e.isNegative ? yBelowFloor : yAboveLid;                                        // :1037 — root→tip travel direction
```
Animation spec (verbatim, :1050-1060): `<motion.rect animate={{y:yEnd}} initial={{y:yStart}} transition={{duration:PULSE_WAVE_DURATION_S, ease:"easeInOut", repeat:Infinity, repeatType:"loop"}} />` — **continuous, infinite loop, 2.4s period.** Plus a hover-dim wrapper: `motion.g animate={{opacity:isFaded?0.3:1}} transition={BAR_HOVER_TRANSITION}` (:1042-1048, 0.15s easeOut — **confirms BarPulse IS hover-reactive too**). Gradient stops form a bell curve 0%→100% with peak opacity 0.85 at 50% (:978-1016). Guards: `if (activeEntries.length===0 || pulsePaused) return null` (:946); `if (!isLoaded) return null` (:952-954) — **the pulse sweep holds/doesn't start until the bar's own entrance grow-animation finishes.**

**Layer/z:** after `BarDepthFront`, one non-staggered looping rect per active bar (no per-bar entrance stagger — it just starts once `isLoaded`).

### 2.7 Variant selection / composition model

No single `<Bar variant="squares">`-style prop exists in bklit. `BarSquares`, `BarColumnTrack`, `BarDepthBack`/`BarDepthFront`/`BarPulse`, and plain `<Bar>` are **independently-composed sibling chart children** that a consumer combines directly (e.g. `<BarDepthProvider><BarDepthBack dataKey="x"/><Bar dataKey="x"/><BarDepthFront dataKey="x"/><BarPulse dataKey="x"/></BarDepthProvider>`, or `<BarColumnTrack/><BarSquares dataKey="x"/>`). `packages/studio/src/lib/studio-components.ts:716`'s `isShapeVariant ? "BarSquares" : "SeriesBar"` mapping is a **Studio-only UI convenience** (a picker choosing which child components to emit into generated code), not a runtime API — confirms the underlying component model is pure composition, not a variant enum, which is the shape a migrated port should mirror (independently-registered `CHART_ROLE`s combined by the consumer, not one polymorphic `<Bar>` prop).

### 2.8 Consumer/demo inventory (bklit, from the parallel executor's grep)

**Zero usages anywhere under `showcase/`** (confirmed: `showcase/app`, `showcase/components`, and a top-level grep across all of `showcase/` for `PatternArea|BarSquares|BarColumnTrack|BarDepth|BarPulse` all return no matches) — every one of these six is genuinely net-new to the migrated codebase, matching this loop's own earlier grep.

| bklit file | What it exercises |
|---|---|
| `packages/ui/src/charts/area-chart.tsx:26,90-98`; `index.ts:362`; `chart-context.tsx:93`; `line-chart.tsx:79` | `PatternArea` impl + host handling |
| `packages/studio/src/components/charts/area-studio-preview.tsx:9,103-108,173-178`; `codegen-helpers.ts:511,551` | Studio preview + codegen for `PatternArea` |
| `apps/web/components/docs/area-chart-pattern-demo.tsx:8,35`; `chart-examples.tsx:69,1771,1787`; `content/docs/components/area-chart.mdx:7,134-137` | `PatternArea` docs/gallery/demo |
| `packages/ui/src/charts/bar-squares.tsx:27,277-417`; `index.ts:61-63,67`; `bar-chart.tsx:126` | `BarSquares` impl + `extractBarConfigs` recognition |
| `packages/studio/src/lib/registry.tsx:8,364`; `studio-components.ts:716` | `BarSquares` studio registry + shape-variant picker |
| `apps/web/components/charts/chart-examples.tsx:15,2228-2402`; `content/docs/components/bar-chart.mdx:105,127-157` | `BarSquares` gallery (shape + gradient/pattern variants) + docs |
| `packages/ui/src/charts/bar-squares.tsx:51,419-633`; `index.ts:59-60`; `chart-child-passthrough.ts:65` | `BarColumnTrack` impl + underlay classification |
| `packages/studio/src/lib/studio-cartesian-layers.tsx:5,52`; `registry.tsx:7,452` | `BarColumnTrack` studio |
| `apps/web/components/charts/chart-examples.tsx:11,2213-2384`; `content/docs/components/bar-chart.mdx:179-190` | `BarColumnTrack` gallery + docs |
| `packages/ui/src/charts/bar-depth.tsx:24-860`; `bar-depth-geometry.ts:1-44`; `index.ts:46-53,56`; `bar.tsx:27,78,84,254,359-381`; `bar-chart.tsx:110-116` | `BarDepth` (Back/Front/Provider) impl + shared geometry + `bar.tsx` participation + series-count exclusion |
| `apps/web/components/charts/chart-examples.tsx:12-14,1996-2047`; `content/docs/components/bar-chart.mdx:124-353` | `BarDepth` gallery (incl. stacked/provider examples) + docs |
| `packages/ui/src/charts/bar-depth.tsx:34,88-106,914-1074`; `index.ts:54-55` | `BarPulse` impl |
| `content/docs/components/bar-chart.mdx:246-311` | `BarPulse` docs only — verbatim: "Highlight a live / in-progress bar with BarPulse … Render it after BarDepthFront" |

**Verdict:** all six are live, exported public API. Five have active gallery/Studio consumers. **`BarPulse` has NO active gallery/Studio consumer** — grep over `apps/web` for `BarPulse` hits only docs/mdx, confirmed via the executor's search — it is documented and exported but demo-only in practice. This does not change its in-scope status (the audit explicitly names it, and it's public API), but it is a lower-traffic feature and a candidate for lighter QA weighting if the lead wants to triage (§9).

Shared helper modules feeding these features (`bar-squares-layout.ts`, `bar-depth-geometry.ts`, `pattern-preset.tsx`, `visx-pattern.tsx`, `chart-context.tsx`, `chart-child-passthrough.ts`, `chart-defs.ts`, `motion-utils.ts`'s `transitionWithDelay`, `chart-legend-hover.tsx`, `animation.ts`'s `DEFAULT_ANIMATION_DURATION_MS=1100`) are all already-known migrated-tree analogues exist for most of these (design-tokens, hover-chrome, legend-hover, WAAPI stagger) — §3/§6 map each to its migrated counterpart.

## 3. Migrated-side seam analysis

### 3.1 Area fill seam — `area-chart.tsx`'s gradient-defs idiom is the mechanism PatternArea's defs must reuse, D228-safe pattern confirmed

`area-chart.tsx`'s per-series vertical gradient fill renders in a **sibling 0×0 `<svg>` placed AFTER `<Chart>`** (lines ~1037-1083), same `url(#id)`-resolves-document-wide technique scatter-chart.tsx uses for marker gradients. This defs block is **NOT nested inside the `{definition && (...)}` conditional** that wraps the axis/overlay/tooltip chrome (lines ~928-1036) — it is a structurally independent conditional. This independence **is** the fix for the D228 hazard (initiative 9, `docs/phase-3/LOG.md`): gating a fill-defs sibling-svg behind `definition`/`!definition` truthiness previously made an area's fill vanish entirely. **Any new PatternArea `<defs>` (whether the migrated port follows bklit's raw-URL-fill shape or a convenience-wrapped `patternPreset` prop, §9 Q1) must follow the SAME structurally-independent-conditional placement**, not nested inside `{definition && ...}}`, or it reintroduces the exact D228 defect class for pattern fills.

charts-core's native `definition.gradients` mechanism (`svg.ts`, confirmed linear-gradient-only) forces PatternArea onto this same manual sibling-svg technique — there is no first-class `<pattern>` support in charts-core.

### 3.2 `internal/pattern-preset.tsx` reuse precedent — confirmed real, three independent consumers, and now confirmed to be an exact bklit port

`renderPatternPreset`/`patternPresetTileSize`/`PATTERN_PRESET_IDS` is consumed by `internal/background.tsx` (in-scene local defs), `internal/reference-area-layer.tsx:180-268` (in-scene local defs, init 6), and `internal/brush-chrome.tsx:6,120-157` (init 9's D227 ruling 8). All three inline `<defs>` directly in-scene because they're plain React-rendered SVG layers, not TanStack marks. **PatternArea faces a genuinely new integration shape**: Area's fill is produced by a TanStack `createMark`, so its pattern defs must go through the sibling-svg-after-`<Chart>` route (§3.1), not in-scene `<defs>` — none of the three existing consumers is a direct template for this specific plumbing, though the rendering FUNCTION itself (`renderPatternPreset`) is identical and reusable regardless.

**Design-shape question surfaced by the bklit inventory (§2.1):** bklit's own `PatternArea` does NOT internally call `renderPatternPreset` — `fill` is a raw string, and the consumer/demo hand-authors the sibling `<PatternLines id=.../>`. A faithful 1:1 port would give migrated `PatternArea` the same shape (`fill: string`, consumer supplies defs) rather than a `patternPreset` convenience prop. But every other migrated pattern integration this initiative reused (`ReferenceArea`, `Brush`) DOES take a typed `patternPreset`/`selectionPattern` prop and internally call `renderPatternPreset`, matching the migrated tree's established `*Config`-object idiom (typed props threaded through, not raw children composition) rather than bklit's "hand-compose two sibling components" idiom. This is a real architectural choice, not a triviality — flagged as §9 Q1 with a recommendation.

### 3.3 `createMark` idiom precedent — `internal/series-bar-mark.ts` is the closest existing template, and its dependency `series-bar-layout.ts`'s `computeSeriesBarWidth`/`computeSeriesBarLayout` is a DIFFERENT function family from bklit's own `bar-squares-layout.ts`/`bar-depth-geometry.ts`

`internal/series-bar-mark.ts` (167 lines, ComposedChart-only, read in full) demonstrates the transferable `createMark` idiom: pure-function geometry math ported from a bklit layout module, emitting `SceneNode[]` (here `kind:"rect"` in a `kind:"group"` wrapper with a stable classname contract) + `ChartPoint[]` for hover/focus plumbing. **Important non-overlap**: `series-bar-mark.ts` ports bklit's `computeSeriesBarWidth`/`computeSeriesBarLayout` (unstacked-group bar-WIDTH math, `slot×0.88`) — a completely different formula family from what this initiative needs, which is `bar-squares-layout.ts`'s `computeSquareColumn` (square-quantization within a bar's HEIGHT) and `bar-depth-geometry.ts`'s `barDepthMaxDepth`/`barDepthAndRise` (perspective depth/rise). There is no existing migrated port of either of THOSE two formula families — they must be newly ported this loop, using `series-bar-mark.ts` only as the STRUCTURAL `createMark` template, not as a source of reusable geometry functions.

**Primitive availability** (`charts-core/src/types.ts:1182-1283` `SceneNode` union: `SceneGroup | SceneRule | ScenePolyline | SceneArea | SceneDot | SceneRect | SceneLabel`): `BarSquares` grid cells and `BarColumnTrack`'s background column are axis-aligned rects → `kind:"rect"`, straightforward. `BarDepth`'s side/top perspective faces and `BarPulse`'s silhouette-clipped sweep are **non-axis-aligned closed polygons** — bklit's own `buildBarSilhouettePath` (§2.6) literally constructs an SVG path string (`"M ... L ... Z"`). `SceneArea` (with `points`/`polygons`/`path` fields) is the only charts-core primitive resembling this, but it may be purpose-built for "fill under a line" area-chart shapes rather than arbitrary closed quads — **this is a genuine, unresolved technical-feasibility question requiring a dispatch-time spike** (§9 Q3), not assumed safe by analogy to `series-bar-mark.ts`'s plain-rect case.

### 3.4 `bar-chart.tsx`'s pilot-scope disclosure, current mark construction, and the front-face-trim coupling problem

`bar-chart.tsx:316-364`'s marks construction uses **stock `barY(renderData, {id,x,y,z,layout:group({scale:groupScale}),fill,radius})`** — no custom mark, unlike ComposedChart. `resolveCornerRadius` (`bar-chart.tsx:106-114`) computes bklit's `min(groupBandwidth/2,8)` formula, a precedent for "port bklit's exact per-feature pure function," matching the `series-bar-layout.ts` convention.

**The bklit-inventory's most architecturally significant finding (§2.5, flagged by the coordinator):** bklit's plain `<Bar>`/`bar.tsx` is NOT independent of `BarDepth` — `bar.tsx:7` imports `bar-depth-geometry.ts` directly and `bar.tsx:359-381` applies the SAME `topYTrim` formula BarDepth's own layer components use, trimming the base bar's top edge so it visually recedes behind the lifted 3D back-lid. **This means a migrated `<BarDepth>` cannot be built as a pure additive overlay sitting on top of an untouched stock `barY()` bar.** Whatever produces bar-chart.tsx's base rectangles must, when `BarDepth` is active for that series, ALSO apply the shared `barDepthAndRise`-derived `topYTrim` to its own geometry — meaning bar-chart.tsx likely needs to swap from stock `barY()` to a custom `createMark` (§3.3's `series-bar-mark.ts` idiom) for ANY series with `BarDepth` active, sharing the SAME `bar-depth-geometry.ts` port that the new `BarDepthBack`/`BarDepthFront`/`BarPulse` marks use, so the base-bar mark and the depth-layer marks never disagree about where the top edge sits.

`BarConfig` (`internal/types.ts`): `{dataKey, fill?, stroke?, lineCap?, fadedOpacity?}` — zero pre-stubbed fields; new prop surface required (§6).

### 3.5 Single-writer hover/dim-chrome doctrine — now confirmed load-bearing, not speculative

Per initiatives 8-10's doctrine (D225/D226): hover/dim DOM mutations go through ONE writer per chart, to avoid two writers racing on the same node's opacity/style. The bklit inventory RESOLVES the previously-open question of whether Bar-family features are hover-reactive: **yes, confirmed for three of the five.** `BarSquares` dims per-bar on hover (`isFaded = hoveredBarIndex!==null && hoveredBarIndex!==i || isLegendDimmed`, `bar-squares.tsx:367-368`, opacity → `fadedOpacity` default 0.3); `BarColumnTrack` fades out ENTIRELY (binary, not per-bar) on ANY hover (`effectiveOpacity = hoveredBarIndex===null?opacity:0`, `:469`, 0.15s transition); `BarPulse` dims its whole pulse group on hover (`isFaded?0.3:1`, `BAR_HOVER_TRANSITION` 0.15s easeOut, `bar-depth.tsx:1042-1048`). `PatternArea` and `BarDepth`'s Back/Front layers show no hover-dim logic in the inventoried source (not confirmed either way — `BarDepthBack`/`BarDepthFront` were not reported with hover-opacity code, treated as non-hover-reactive by default pending dispatch verification). Any new Bar-family mark's hover/dim behavior must integrate into the EXISTING `bar-hover-chrome.ts`/`bar-focus-strategy.ts` writer(s), not add a second independent writer — and must replicate the THREE different transition timings found (BarSquares uses opacity-only 0.15s per-square in its own animate block; BarColumnTrack 0.15s ease-in-out CSS transition; BarPulse 0.15s easeOut via `BAR_HOVER_TRANSITION`) faithfully rather than collapsing them to one shared constant.

## 4. TanStack backend seams

- **`createMark` signature** (`mark.ts:1-80`): `createMark<TDatum,TXValue,TYValue>(initialize, motion?)`, `initialize() => {id, channels, render}`, `render({scales,chart}) => {nodes: SceneNode[], points: ChartPoint[]}` — matches `series-bar-mark.ts`'s usage.
- **Coordinate-space model** (`scene.ts:670-715`, `compileSceneLayout`): `chart.x=margin.left`, `chart.y=margin.top`, scale ranges are `[chart.x, chart.x+chart.width]` — margins baked into scale ranges, no group transform on `.ts-chart__marks`. Any new mark (perspective quads, pulse sweep, square grid) computes absolute already-margin-offset coordinates via `scales.x.map(...)`/`scales.y.map(...)`, exactly as `series-bar-mark.ts` does.
- **defs injection**: confirmed linear-gradient-only in charts-core's native `scene.gradients`/`renderGradients` (`svg.ts`) — pattern fills on any Bar-family mark must use the manual sibling-svg technique (§3.1). `bar-chart.tsx` currently has NO defs sibling-svg (its marks are solid-fill only) — one must be added if any Bar-family feature needs pattern fills (BarSquares/BarColumnTrack both support pattern-url fills per §2.3/§2.4).
- **`SceneNode` primitive union** (`types.ts:1182-1283`): `SceneGroup | SceneRule | ScenePolyline | SceneArea | SceneDot | SceneRect | SceneLabel`. `SceneRect` fits BarSquares grid cells and BarColumnTrack's background column directly. `SceneArea` is the only candidate for BarDepth's perspective faces and BarPulse's silhouette-clip shape — feasibility unconfirmed, flagged §9 Q3 as a required pre-dispatch spike given bklit's own geometry (`buildBarSilhouettePath`) is an arbitrary multi-point closed path, not a simple quad.

## 5. Frozen-file constraint analysis — composed-chart.tsx / scatter-chart.tsx

Per the task brief, both are frozen for this initiative (no literal in-file marker, treated as authoritative per the coordinator's stated constraint, corroborated by D229 ruling 3's "an already-approved host's Q1 baselines are frozen" precedent).

**Composed-chart.tsx — confirmed no conflict, and confirmed faithful to bklit, not just constraint-compliant.** `composed-chart.tsx`'s bars use a separate custom mark (`internal/series-bar-mark.ts`, §3.3) untouched by anything in this plan. Per §1/§2.1's cross-ref, bklit's OWN `ComposedChart` equivalent does not support `PatternArea` (`tryAppendArea` matches only `Area`) and — per the parallel inventory — does not recognize `BarSquares`/`BarDepth*`/`BarPulse` in its bar-config extraction the way `bar-chart.tsx`'s `extractBarConfigs` does. **This means excluding `composed-chart.tsx` from this initiative isn't a compromise forced only by the frozen-file rule — it's the behaviorally correct scope**, since bklit itself never wired these features into its composed-chart equivalent. No divergence from bklit fidelity results from leaving `composed-chart.tsx` untouched.

**Scatter-chart.tsx** — no Area/Bar surface; no overlap, confirmed.

## 6. Component/file plan

New files under `showcase/migrated/charts/internal/`:

| New file | Mirrors (bklit) | Purpose |
|---|---|---|
| `internal/pattern-area-mark.ts` (or fill-channel extension of the existing area mark) | `pattern-area.tsx:10-49` | Pattern-filled area geometry (`AreaClosed`-equivalent), defs via a NEW sibling-svg-after-`<Chart>` block in `area-chart.tsx`, structurally independent per §3.1's D228-safe placement. Shape (raw URL vs. `patternPreset` convenience prop) — §9 Q1. |
| `internal/bar-squares-layout.ts` | `bar-squares-layout.ts:13-99` | Verbatim port of `computeSquareColumn`/`topSquareCenterY` (§2.3) — pure functions, shared by both `bar-squares-mark.ts` and `bar-column-track-mark.ts` (§2.4 requires they share this to stay aligned). |
| `internal/bar-squares-mark.ts` | `bar-squares.tsx:27-417` | `createMark` producing per-bar quantized-square grids (`kind:"rect"` children), per-square cascade stagger (§2.3), hover-dim integration (§3.5). |
| `internal/bar-column-track-mark.ts` (or plain layer reusing the `ReferenceArea`-class underlay routing) | `bar-squares.tsx:51-61,419-633` | Underlay background column, reusing `internal/bar-squares-layout.ts`'s `computeSquareColumn`, registered via the SAME `UNDERLAY_COMPONENT_NAMES`-class routing already built for `ReferenceArea` (init 6) — direct 1:1 architectural match (§2.4). Binary hover-fade (§3.5). |
| `internal/bar-depth-geometry.ts` | `bar-depth-geometry.ts:1-44` | Verbatim port of `BAR_DEPTH_MAX_PX=7`, `BAR_DEPTH_PERSPECTIVE_RATIO=0.45`, `barDepthMaxDepth`, `barDepthAndRise` (§2.5) — pure functions, shared by the base-bar mark (for front-face trim, §3.4) AND the new `BarDepthBack`/`BarDepthFront` marks. |
| `internal/bar-depth-marks.ts` (Back + Front, possibly two `createMark`s) | `bar-depth.tsx:1-861` | Perspective quad faces — likely via `SceneArea` polygons pending §9 Q3's spike, or a lower-level escape hatch if that doesn't generalize. `BarDepthBack` returns nothing when `depth<BAR_DEPTH_MIN_PX` (0.5px); `BarDepthFront` always renders. |
| `internal/bar-pulse-mark.ts` (or an imperative overlay module, given the CONTINUOUS infinite-loop animation, not a one-shot reveal) | `bar-depth.tsx:88-106,862-1074` | Silhouette-clipped sweep, `PULSE_WAVE_HEIGHT_RATIO=0.55`, `PULSE_WAVE_HEIGHT_MIN_PX=36`, `PULSE_WAVE_DURATION_S=2.4`, `PULSE_WAVE_PEAK_OPACITY=0.85` (§2.6) — likely an imperative WAAPI `animate(...,{iterations:Infinity})` overlay (mirrors `terminal-marker.tsx`'s standalone-module idiom) rather than a spec-time `createMark`, since the animation must hold until `isLoaded` and loop indefinitely, independent of any reveal-replay epoch. |

Edits to existing files:

| File | Edit |
|---|---|
| `showcase/migrated/charts/area-chart.tsx` | Add `AreaConfig` pattern field(s) (shape per §9 Q1); wire `PatternArea` fill via `internal/pattern-area-mark.ts`; add a NEW independent (D228-safe) sibling-svg defs block for pattern `<defs>`. |
| `showcase/migrated/charts/bar-chart.tsx` | Add `BarConfig` fields for squares/track/depth/pulse; swap `barY()` for a custom mark AT LEAST for any series with `BarDepth` active (front-face trim coupling, §3.4) — recommend conditional swap generally (§9 Q4, carried from this loop's earlier draft); add a defs sibling-svg for BarSquares/BarColumnTrack pattern fills. |
| `showcase/migrated/charts/internal/types.ts` | New fields on `BarConfig`/`AreaConfig` per the final prop shapes chosen in §9's rulings. |
| `showcase/migrated/charts/internal/bar-hover-chrome.ts` / `bar-focus-strategy.ts` | Extend (not duplicate) with the three confirmed hover-dim behaviors (§3.5: BarSquares per-bar 0.15s, BarColumnTrack binary 0.15s, BarPulse group-dim 0.15s easeOut). |
| `showcase/migrated/charts/children.tsx` | Register `PatternArea`, `BarSquares`, `BarColumnTrack` (underlay-class, §2.4/§6), `BarDepthBack`, `BarDepthFront`, `BarPulse`, and a `BarDepthProvider`-equivalent context wrapper as `CHART_ROLE` entries — matching bklit's confirmed pure-composition model (§2.7), NOT a single polymorphic `<Bar variant>` prop. |
| `showcase/migrated/charts/internal/index.ts` | Barrel-export new public surface. |

**Not touched this loop**: `composed-chart.tsx`, `scatter-chart.tsx` (frozen, §5, and confirmed non-conflicting).

## 7. Consumer propagation list

bklit consumers (§2.8's full table) map to:

| bklit file | Migrated action needed |
|---|---|
| `chart-examples.tsx` PatternArea demo (`:1771,1787`), BarSquares demos (`:2228-2402`), BarColumnTrack demos (`:2213-2384`), BarDepth demos (`:1996-2047`, incl. stacked/provider) | New showcase demo/bench-scenario coverage per feature, mirroring the exact prop combinations these demos exercise (gradient+pattern variants for BarSquares, provider/stacked variants for BarDepth). |
| `area-chart-pattern-demo.tsx` | Reference for the exact `PatternArea`+`Area fillOpacity=0` doc idiom (§2.1) to replicate in a migrated demo. |
| `content/docs/components/{area-chart,bar-chart}.mdx` prop tables | Docs-only, no code action, but a useful cross-check for the final prop-shape naming choice (§9 Q1). |
| `apps/web/public/r/*.json`, Studio files | Out of scope (no migrated registry/Studio). |
| `content/docs/components/bar-chart.mdx:246-311` (BarPulse, docs-only, no gallery consumer) | Lower-priority demo coverage — candidate for lighter QA weighting (§9 Q9, carried forward). |

Migrated-side propagation (net-new, zero existing migrated consumer confirmed both this loop's own grep and the executor's grep):
1. New bench scenario(s), LEAD-built (`bench/` executor-forbidden) — one for PatternArea (Area host), one or more for the Bar family (likely BarSquares+BarColumnTrack combined given their shared quantization dependency, and BarDepth+BarPulse combined given their shared context/layer-ordering).
2. `qa/screenshot.mjs` — no existing branches for any of these five (confirmed via grep: existing branches cover `legend`,`markers`,`candlelegend`/`legendhover`,`brush`,`sankey`,`heatmap`,`funnel`).
3. Showcase gallery demo — not confirmed required scope; §9 (mirrors init 9/10's identical recurring question).

## 8. QA / bench gate proposals

**Q1 (pixel)**: PatternArea — one scenario with an internal preset-cycling capture (8 IDs, avoiding an 8x scenario explosion, mirroring how existing scenarios cycle hover-fractions in one scenario). BarSquares/BarColumnTrack — one scenario combining both (shared quantization dependency, §2.4) at settled state PLUS a `hoveredBarIndex`-forced probe (reuses the existing hover-fraction-probe pattern, now confirmed necessary per §3.5's finding that both ARE hover-reactive) PLUS a legend-hover probe (BarSquares reads `useChartLegendHover`, `bar-squares.tsx:14`, confirmed). BarDepth+BarPulse — one scenario at settled state (BarDepth's static geometry) PLUS a `BarPulse`-animation-phase-freeze probe — needs a new deterministic hook, e.g. `window.__qaSetBarPulsePhase(t)`, mirroring the `__qaSetBrush`/`__qaSetLegendHover` precedent, since `PULSE_WAVE_DURATION_S=2.4`'s infinite loop is not reliably capturable via a plain settled-state screenshot. Eyeballed PNGs mandatory on first run (D213 doctrine).

**Q2 (console errors)**: add new scenario targets to `qa/console-errors.mjs`'s `targets` array.

**Q3 (boundary greps)**: (a) confirm `BAR_DEPTH_PERSPECTIVE_RATIO=0.45`, `BAR_DEPTH_MAX_PX=7`, `BAR_DEPTH_MIN_PX=0.5`, and the `computeSquareColumn` formula appear verbatim (not re-derived/approximated) in the new geometry modules; (b) confirm all pattern-fill consumers (PatternArea, BarSquares, BarColumnTrack) route through `internal/pattern-preset.tsx`'s single `renderPatternPreset` function; (c) confirm no new hover-chrome writer was introduced outside the existing `bar-hover-chrome.ts` single writer, and that the three DIFFERENT confirmed dim-timing values (§3.5) are each preserved distinctly, not collapsed to one constant; (d) confirm the base-bar mark and the `BarDepthBack`/`BarDepthFront` marks both import the SAME `internal/bar-depth-geometry.ts` module (no duplicate/divergent trim math per §3.4's coupling finding).

**Self-test**: standard `--self-test` determinism floor on all new scenarios, especially the `BarPulse` animation-phase-freeze scenario — infinite-loop CSS/WAAPI animations are exactly the class of feature most prone to screenshot non-determinism.

**Bench**: any NEW scenario needs full first-time G1-G4 characterization (no waiver available, no frozen baseline exists). If any feature is exercised as a new-prop VARIANT of an existing frozen `area`/`bar` pair with the feature defaulting off, a D210-class "render-path-neutral at rest" waiver may apply to the off-state only.

## 9. Open questions for lead ruling

1. **PatternArea prop shape — faithful raw-URL port vs. `patternPreset`-convenience wrapper** (§2.1, §3.2): bklit's `PatternArea` takes `fill: string` (raw color or `url(#id)`) and requires the consumer to hand-author the sibling pattern-defs component; migrated's other three pattern integrations (`ReferenceArea`, `Brush`, `Background`) all take a typed `patternPreset` prop and internally call `renderPatternPreset`. Which shape should migrated `PatternArea`/`AreaConfig` use? **Recommendation: the convenience-wrapped `patternPreset` shape, matching migrated's own established `*Config`-object idiom and its three existing pattern integrations — but ALSO keep a raw `fill: string` escape hatch (bklit parity) so a consumer can pass a hand-authored `url(#id)` if they want bklit's exact original flexibility.** Disclosed deviation from bklit's literal prop shape, not from its visual behavior.
2. **BarColumnTrack's binary vs. BarSquares' per-bar hover-dim** (§3.5): confirmed these are genuinely different mechanisms (binary all-or-nothing fade vs. per-bar-index dim) — should the migrated single-writer hover-chrome expose two distinct dim primitives, or can BarColumnTrack's binary fade be modeled as "dim all indices except none" within the same per-bar mechanism BarSquares uses? **Recommendation: keep them as two distinct, disclosed mechanisms — collapsing them risks silently changing BarColumnTrack's fidelity-mandated all-or-nothing behavior.**
3. **`SceneArea`/`SceneNode` feasibility spike for arbitrary closed-polygon fills** (§3.3, §4): does charts-core's SVG backend actually render an arbitrary filled closed polygon via `SceneArea`'s `points`/`polygons`/`path` fields, or is it purpose-built only for "fill under a line" area shapes? This blocks the entire `BarDepth`/`BarPulse` mark design in §6. **Recommendation: this MUST be spiked before any BarDepth/BarPulse dispatch is written in detail — if `SceneArea` doesn't generalize, identify a lower-level raw-SVG escape hatch (or propose one) before committing to a design.**
4. **`bar-chart.tsx` mark-construction strategy — conditional vs. unconditional custom-mark swap** (§3.4): swap `barY()` for a custom mark unconditionally (uniform code path) vs. only for series with `BarDepth` active (lower regression risk to the existing tested `barY()` path, D210-waiver-friendly for the untouched default case). **Recommendation: conditional — matches the "props default off, existing frozen baseline stays on the stock `barY()` path" shape §8's bench-waiver plan depends on.**
5. **Composed-chart / future-initiative bar-family consistency** (§5): confirmed no forcing function exists THIS loop, and confirmed bklit itself doesn't wire these features into ComposedChart either — but flag for the record that if a future initiative wants BarSquares/BarDepth on ComposedChart, `internal/series-bar-mark.ts` will need PARALLEL (not shared) treatment later, since it's frozen now. **Recommendation: accept the scope limit as-is (§5's finding); no action needed this loop beyond disclosure.**
6. **BarPulse's lighter QA/gallery priority given its docs-only bklit usage** (§2.8): bklit itself has no gallery/Studio consumer for BarPulse (docs-only). Should migrated give it the SAME full G1-G4 bench sweep + dedicated Q1 animation-freeze scenario as the other four (full fidelity, matches its public-API/audit-mandated status), or a lighter-weight QA pass given its low real-world usage? **Recommendation: full sweep — it's explicitly named in the audit mandate ("depth limits" includes BarPulse's wave constants per this loop's own §2.6 read), and "docs-only" in bklit doesn't mean untested; it means the feature is real but under-marketed, not lower-risk.**
7. **Pattern-ID enumeration for Q1 pixel coverage** (§8): one scenario with an internal preset-cycling capture loop, vs. 8 discrete scenarios (finer regression isolation, higher cost). **Recommendation: one scenario with cycling capture, avoiding an 8x scenario-count explosion for what is fundamentally the same geometry with different SVG defs — same reasoning as prior initiatives' hover-fraction-probe pattern.**
8. **Showcase gallery demo requirement**: mirrors init 9 §9 Q5 / init 10 §9 Q8's identical recurring question — required scope, or is the bench/QA scenario pair sufficient? **Recommendation: defer to a later initiative, matching both prior precedents.**
9. **`BarDepthBack`/`BarDepthFront` hover-reactivity — confirm absence, don't assume** (§3.5): unlike BarSquares/BarColumnTrack/BarPulse (all confirmed hover-reactive), no hover-opacity code was reported for `BarDepthBack`/`BarDepthFront` themselves. Should dispatch treat their absence-of-evidence as confirmed non-reactive (build them static), or re-verify against the full `bar-depth.tsx` source before committing? **Recommendation: re-verify at dispatch — this loop's source, while extensive, was inventoried by a parallel executor summarizing 861 lines; a targeted re-grep for hover-related code specifically in the `BarDepthBack`/`BarDepthFront` render functions (not just the sections quoted here) is cheap insurance before assuming no writer integration is needed there.**
10. **`BarSquares`' nested pattern-inside-gradient composition** (§2.2): `bar-squares.tsx:197-223` passes a gradient `url(#...)` AS the pattern's `color` option (pattern stroke/fill uses a gradient, not a flat color) — does migrated `internal/pattern-preset.tsx`'s `renderPatternPreset` already support a gradient-url string in its `color`/`fill` options (it's typed `string`, so likely yes structurally), and does the BarSquares mark need to construct BOTH a gradient defs entry AND a pattern defs entry that references it, in the correct defs-ordering (gradient defined before the pattern that references it)? **Recommendation: confirm `renderPatternPreset`'s `color` option accepts an arbitrary `url(#id)` string with no internal validation that would reject it (a quick read of `internal/pattern-preset.tsx`'s render functions suggests yes, `color` is just interpolated into `stroke`/`fill` props), and ensure defs ordering emits the gradient node before the pattern node that references it in the sibling-svg's `<defs>` block.**

## 10. Lead rulings — resolve §9 Q1–Q10

1. **PatternArea prop shape — RULED: convenience `patternPreset` prop + raw `fill: string` escape hatch** (drafter's recommendation adopted). Matches the migrated tree's established `*Config` idiom and all three existing pattern integrations (`ReferenceArea`, `Brush`, `Background`); the raw-URL escape hatch preserves bklit's literal flexibility. Disclosed as a prop-SHAPE deviation from bklit (visual behavior identical). The defs sibling-svg MUST be a structurally independent conditional (never nested inside `{definition && …}`) per §3.1's D228-safe placement — this is a Q3-gate grep item.
2. **Hover-dim mechanisms — RULED: two distinct primitives, one writer.** BarColumnTrack's binary all-or-nothing fade and BarSquares' per-bar-index dim are separate primitives EXPOSED BY the existing `bar-hover-chrome.ts` single writer — no second writer, no collapsing. The three distinct 0.15s timings (per-square opacity in animate block; track's ease-in-out CSS transition; pulse's easeOut) are each preserved verbatim — Q3-gate grep item (§8c).
3. **SceneArea feasibility — RESOLVED BY LEAD THIS LOOP, spike closed.** `svg-renderer.ts:106-113`: `case 'area'` renders `node.polygons !== undefined ? polygonsPath(node.polygons) : (node.path ?? pointsPath(node.points, true))` into a raw `<path d="…">` (evenodd when polygons). Arbitrary closed polygons AND raw path strings are first-class. RULING: BarDepth side/top faces use `points` (closed quads); BarPulse's silhouette clip may carry bklit's `buildBarSilhouettePath` string verbatim via the `path` field. No escape hatch needed; BarDepth/BarPulse dispatch design is unblocked.
4. **bar-chart mark strategy — RULED: conditional swap.** Custom mark only for series with BarDepth active (shared `internal/bar-depth-geometry.ts` for the front-face trim, §3.4); the stock `barY()` path stays byte-identical when the new props are off, preserving the frozen bar baselines and enabling the D210-class off-state waiver (§8 bench plan).
5. **Composed-chart consistency — RULED: accept scope limit, disclosure only.** §5's finding (bklit itself never wired these into its composed equivalent) makes the frozen-file exclusion behaviorally correct, not a compromise. Record in the close-out.
6. **BarPulse QA weight — RULED: full sweep.** Audit-mandated, public API; docs-only bklit usage does not reduce gate rigor.
7. **Pattern-ID Q1 coverage — RULED: one scenario, cycling capture across all 8 IDs** (hover-fraction-probe precedent). Self-test must cover the cycling captures too.
8. **Showcase gallery demo — RULED: defer to initiative 12** (matches init 9/10 precedent).
9. **BarDepthBack/Front hover-reactivity — RULED: re-verify at dispatch.** The BarDepth dispatch task MUST include a targeted grep of `bar-depth.tsx`'s Back/Front render functions for hover/opacity code and report the finding BEFORE building them static. Absence-of-evidence in a summarized inventory is not confirmation.
10. **Nested pattern-inside-gradient — RULED: support it, gate the ordering.** `renderPatternPreset`'s `color` is a plain interpolated string (no validation) — gradient `url(#id)` passes through structurally; the BarSquares mark emits BOTH defs with the gradient node BEFORE the pattern node referencing it, per-column per-reveal-epoch ids per bklit (§2.2). Defs ordering is a Q3-gate grep item.

**Dispatch decomposition (lead):** Dispatch A — `internal/pattern-area-mark.ts` + `area-chart.tsx` wiring + D228-safe defs sibling (Q1 shape per ruling 1). Dispatch B — `internal/bar-squares-layout.ts` (verbatim port) + `bar-squares-mark.ts` + `bar-column-track-mark.ts` + `bar-hover-chrome.ts` extension (rulings 2, 10). Dispatch C — `internal/bar-depth-geometry.ts` (verbatim port) + BarDepth Back/Front marks + BarPulse module + `bar-chart.tsx` conditional swap (rulings 3, 4, 9). Gate harness (bench scenarios + qa branches) — Sonnet-drafted under lead review, executors hard-blocked there. `children.tsx` role registrations land with each dispatch that introduces the component.

Status: plan-loop-1 **FINAL — all ten §9 questions ruled (§10), SceneArea spike resolved in-loop.** All prior `TODO(bklit-inventory)` placeholders were resolved with cited findings from the parallel cmd-executor's report.
