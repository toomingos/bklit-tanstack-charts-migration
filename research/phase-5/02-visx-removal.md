# Phase 5 / 02 — visx Removal Research

> Full spec for removing `@visx/pattern` + `@visx/zoom` from migrated code. Sources: 5 dispatches (canvas safety, gesture/a11y spec, consumer inventory, gates/versions, upstream stability). See `03-dependencies-and-packaging.md` for the staged dependency plan.

## ⚠️ Constraint: packages must STAY installed

Vendored bklit-ui (`repos/bklit-ui/packages/ui`) itself imports both (`src/charts/visx-pattern.tsx:8`, `src/charts/choropleth/*`) and compiles as **source into host apps** via `transpilePackages`, resolving against **host** `node_modules`. Removing from host package.jsons breaks the bklit-twin builds. Scope: **remove from migrated code only**; uninstall deferred to legacy-bklit sunset.

## Pattern removal

**Inventory:** ONE visx import site — `internal/visx-pattern-bridge.tsx` (17 lines: `PatternCircles`, `PatternLines`). Definitions in `internal/pattern-preset.tsx` (179 LOC, presets: none/dots/circles/diagonal/horizontal/vertical/cross/accent; default color `var(--chart-1)`).
**Call sites (8):** background.tsx:56 · reference-area-layer.tsx:201 · brush-chrome.tsx:141 · heatmap-components.tsx:253 + heatmap-legend.tsx:50 (phase-offset aliasing pattern) · area-chart.tsx:288 · bar-chart.tsx:1061 (gradient-stroked pattern) · candlestick-chart.tsx:1036/1041.
Type-only consumers (no change needed): reference-area.tsx, internal/types.ts, bar-squares-mark.ts, heatmap-colors.ts, internal/index.ts:166. Funnel/pie/gauge use displayName sniffing — visx-free already.
Port: inline plain `<pattern>` JSX per preset shape; consumers untouched.

**Canvas/export exposure:** NONE today (zero canvas/toDataURL/renderChartImage hits in showcase/bench/qa/packages). Latent risks confirmed:
(a) `@tanstack/react-charts/canvas` = drop-in `<Chart>` swap → canvas resolvePaint nulls unknown url(#id) (canvas.ts:840–851) → silent invisible fills;
(b) `renderChartImage` rasterizes ONLY the `svg.ts-chart` subtree → defs mounted outside it drop from PNG exports.

**Guards (all inside migrated/, no harness changes):**
1. Inject defs INSIDE chart SVG via public **`renderSvg` prop**: wrap `renderChartSvg(scene, options)`, splice `<defs>` after opening `<svg>` tag, respect idPrefix → closes export hole structurally.
2. Dev-mode assertion: every registered pattern id present in rendered SVG; degrade to solid fill when surface/renderer ≠ svg.
3. Static test: grep specs for `url(#` against central registry; assert renders + serializes. Home: bklit-style `node --test` + tsx (`internal/__tests__/pattern-preset.test.tsx`, renderToStaticMarkup) or house-style Playwright probe `qa/pattern-probe.mjs`.

## Zoom removal

**Parity baseline (verified, repos/bklit-ui/.../choropleth-chart.tsx:437–451):** visx `<Zoom>` 4.0.1-alpha.0 w/ binary ±5% wheelDelta (sign of deltaY), scale extent [0.5,4], `touchAction:'none'`, grab/grabbing cursor, CSS `transition: transform .18s ease-out` idle-only, container `aria-hidden` — NO keyboard/dblclick/rotation/inertia. visx delegates to `@use-gesture/react@10.3.1`; default pinch = quantized ±10%/event at gesture origin.

**Minimum replacement (~140 LOC core; ~190 w/ optionals):**

| Gesture | Behavior | Status |
|---|---|---|
| Matrix core | `{scaleX,scaleY,translateX,translateY}`; apply/invert/`matrix(a,b,c,d,e,f)` toString; clamp [0.5,4] | REQUIRED |
| Wheel | preventDefault passive:false; `deltaY>0?0.95:1.05`; pointer-anchored | REQUIRED (bklit-exact) |
| Drag pan | startTranslate+Δ; button 0 only | REQUIRED |
| Pinch | continuous `k·sqrt(distRatio)`, live-centroid anchor (d3-zoom formula: re-invert anchor each frame; one op folds zoom+pan+anchor) | REQUIRED — smoothness upgrade over ±10% steps (log as justified deviation) |
| Pointer add/remove mid-gesture | promote/demote pinch↔pan; re-anchor on demotion | REQUIRED |
| Gesture enders | `pointercancel` (= pointerup; fires NO pointerup after!) · `lostpointercapture` · window blur; setPointerCapture in try/catch (NotFoundError race) | REQUIRED |
| touch-action | `none` declarative (decision fixed at gesture start); wheel `{passive:false}` or preventDefault silently fails | REQUIRED |
| Double-click ×2 at point | absent in bklit | OPTIONAL |
| Keyboard + zoom buttons | WCAG 2.1.1/2.5.1/2.5.7 (pinch needs single-pointer alternative; buttons > keyboard-only). Inherited gap — parity first, fast-follow ticket | OPTIONAL |

References: MDN pinch gestures + touch-action + pointercancel/setPointerCapture · d3-zoom src (wheelDelta `-ΔY·(mode?0.05…0.002)·(ctrl?10:1)`, dblclick ×2/×0.5 @cursor 250ms, tapDistance 10px/touchDelay 500ms) · maplibre KeyboardHandler (arrows pan 100px, +/- zoom) · Leaflet keyboardPanDelta 80.

**Type-surface swap:** `choropleth-chart.tsx` L27–29 imports; public prop `initialZoom?: TransformMatrix` (L77); re-export (L147); `DEFAULT_INITIAL_ZOOM=identityMatrix()` (L151); `ChoroplethZoomContextValue{zoom}`+hook (L113–121); barrel `index.ts:184–192`.
Downstream compat verified: bench ZoomQaBridge calls `zoom.reset()` / `zoom.setTransformMatrix({literal})`; qa/api-compat passes literal matrices — satisfied by structural local type + reset/setTransformMatrix methods. Hover chrome takes plain fn type (no visx types).
Build config: prune `bench/app/vite.config.ts:89–91` aliases + `tsconfig.json:344–352` paths (files not protected).
Precedent to crib: archived phase-1/2 manual matrix engine (~190 LOC, `archive/*/migrated/charts/choropleth-chart.tsx:245–262`).

## Upstream stability ruling (passthrough reliance)

- Pre-alpha ("not ready for production"); 24 releases in 16 days (0.7.0 Aug 7 → 0.14.0 Aug 15); breaking renames inside minors (v0.7.0 callback reshape, v0.8.0 "Harmonize").
- Forensics: svg.ts/svg-resources.ts have 2 commits ever; `: value` passthrough byte-identical since init commit (Jul 28) through v0.7 consolidation = intent, not accident. **Zero upstream tests pin foreign passthrough** → deletable silently with green CI.
- Sanctioned escape hatch exists regardless: `renderSvg` prop / `createSvgChartRenderer` / custom-renderer boundary (documented).
- Prior art: Observable Plot documents foreign refs officially; visx first-class ("Definition Caveat" section); Recharts documented `<defs><pattern>` workflow — TanStack's own case-84 recharts reference renders a real stripe pattern.
- **Ruling:** build on passthrough NOW with guards above + ready renderSvg fallback + file feature request (drafted: first-class paint-server resources OR documented passthrough contract + canvas warn; docs-contract half is small).

## Gates & verification plan

Current QA state (qa/results/<chart>/ latest): area PASS · bar PASS · candlestick PASS · **heatmap FAIL** (hover ≈0.506–0.583%) · **pie FAIL** (hover ≈3.18%) · **choropleth FAIL** (hover-30 1.53%, tooltip absent) — all three deterministic pre-existing drift (docs/phase-4/PROGRESS.md:25) → post-removal diffs go vs these baselines.

Required runs:
```bash
pnpm qa -- --chart patternarea --n 1000          # THE direct pattern gate (8 preset captures)
pnpm qa -- --chart area --n 1000
pnpm qa -- --chart refarea --n 1000
pnpm qa -- --chart brush --n 1000
pnpm qa -- --charts candlestick,profitloss --n 1000
pnpm qa -- --charts bar,barsquares,bardepth --n 100   # D238a density rule
pnpm qa -- --chart heatmap --n 52                # vs baseline FAIL
pnpm qa -- --chart choropleth --n 1000           # vs baseline hover-30 FAIL
```
Zoom-state check MANUAL (no automated gate consumes `__benchZoomTo`; G2 has no tanstack zoom leg per D34): scripted screenshots at named states, bklit vs migrated.
Bench smoke only: `pnpm bench -- --chart area --impl migrated --n 1000` + `--chart bar --impl migrated --n 100`. Skip pie/heatmap/candlestick bench until Wave-1 fixes land. One pass `node qa/console-errors.mjs`.
Skip QA: pie/ring/radar/gauge*/funnel*/sunburst/scatter/composed/liveline/legend (no pattern/zoom exposure — re-grep Background `pattern` props before finalizing).
