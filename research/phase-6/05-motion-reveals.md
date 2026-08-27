# 05 — Motion / reveals / streaming

Orchestrator-ruled, 2026-08-27.

## Current implementation inventory

| File | LOC | Role |
|---|---|---|
| `internal/spring.ts` | 119 | rAF-sampled analytic spring (wraps `@tanstack/charts/spring`) — hover chrome only |
| `internal/candle-spring.ts` | 217 | duration/bounce → stiffness/damping solver + 60-sample WAAPI keyframes |
| `internal/enter-transition.ts` | 252 | shared reveal-timing engine → WAAPI keyframes (13 charts) |
| `internal/deferred-reveal.ts` | 295 | `onPostPaint` (2×rAF+macrotask), `data-bkm-revealed` guard, deadline timers |
| `internal/chart-reveal-clip.tsx` | — | **dead** (public barrel only) |
| `internal/sankey-animation.ts` | 330 | link dash-sweep draw-on (strokeDashoffset, pathLength=1) + node scaleY pops + CSS hover injection |
| `internal/sunburst-reveal.ts` | 166 | 64-sample `d` keyframes angular sweep + 30-sample zoom morph |
| `internal/bar-pulse-mark.ts` | 334 | native `createMark` silhouette + infinite WAAPI wave |
| `internal/dash-tail.ts` | 234 | static dashed-tail overlay re-measuring host path `getTotalLength` (decoration, line/area) |
| `internal/live-line-mark.ts` | 123 | native `createMark`; one lifetime rAF loop; asymmetric y-lerp (instant expand / 0.08 contract); 32ms throttled commits |
| `internal/native-stagger.ts`, `bezier-easing.ts`, `radar-spring.ts`, `use-prefers-reduced-motion.ts` | ~250 | bridges/util |

Reveal per chart: line/area/composed = WAAPI `clip-path: inset(0 100% 0 0) → inset(0)` wipe on
`.ts-chart__marks`; bar/candle = baseline scaleY growth; pie/ring/gauge = arc sweep; sankey =
dash sweep; sunburst = angular sweep; scatter = per-point opacity/scale stagger.

## Native mechanism

- `motion({initial: true|'always', transition, respectReducedMotion: true, resize: false})` — default transition **1,100ms tween + default entrance ease = bklit's exact constants** (`docs/reference/motion.md:41-44`).
- Initial choreography follows geometry: Cartesian bars/paths grow from semantic baseline; radial grows from polar center; **arcs sweep angle** (`motion.md:55-58`).
- Per-datum motion callbacks: `motion(ctx){ return {delay: ctx.phase==='enter' ? ctx.datumIndex*35 : 0} }`; `stagger({each, roles, by})`.
- Springs: interruptible, value+velocity carry-over; per-mark `{type:'spring', stiffness, damping}`.
- Streaming rolling path: `motion.path {update:'rolling', x:'shift', y:'reproject', fallback:'snap'}` + tween duration = sampleInterval, linear; `viewport.translate` 0 during rolls (`dynamic-data-and-animation.md:212-260`).
- Keyed updates morph geometry (sunburst zoom).
- `respectReducedMotion` default true.

## Mapping verdicts

| Piece | Verdict | How |
|---|---|---|
| Bar/candle baseline growth | **REPLACE** | native enter is exactly this; candle spring params via existing duration/bounce→stiffness/damping solver feeding native `{type:'spring'}` (keep solver as pure fn, delete WAAPI sampling) |
| Bar stagger | **REPLACE** | native `stagger()`; delete `native-stagger.ts` bridge |
| Pie/ring/gauge arc sweep + ring stagger | **REPLACE** | native arc-sweep enter + per-datum delay callbacks; per-frame `d` rewriting in pie grow dies |
| Pie hover-expand (grow/translate) | **REPLACE (reactive)** | focused slice `outerRadius`/centroid offset as definition params rebuilt on `onFocusChange`; native spring {stiffness 400, damping 25} with velocity carry-over replaces the custom interruptible spring |
| Sunburst angular sweep + zoom morph | **REPLACE** | enter = arc sweep; zoom = keyed geometry update under motion (delete 64/30-sample keyframe generators) |
| Scatter per-point stagger | **REPLACE** | per-datum enter delay + opacity/r from initial |
| **Line/area/composed wipe reveal** | **ACCEPT-WITH-LOG** | native enter grows from baseline — a left→right wipe is not expressible (`motion.md:55-58`; no enter-mode option in dist). Interim: one-shot clip animation using the `onRender`-provided `svg` handle (documented context, `dom-types.d.ts:167`), single site in shared code, excluded-by-name in the CI census guard. Upstream ask: `motion.enter:'wipe'` |
| **Sankey link dash-sweep** | **SANCTIONED-EXTENSION** | sankey mark is `createMark` with its own renderer — a custom-mark renderer legitimately owns its DOM; dash sweep moves inside the mark renderer (no external reach-in). Node pops → per-datum enter delays. CSS-injection hack dies |
| `deferred-reveal.ts` | **DELETE** | `motion({initial:true})` handles first-paint choreography; deadline/guard machinery unnecessary |
| `dash-tail.ts` (decoration) | **SANCTIONED-EXTENSION** | re-express as authored mark: dashed `lineY` over tail slice (pure data slice) — kills `getTotalLength` reach-in |
| `bar-pulse-mark.ts` | **KEEP (already createMark)** | `syncBarPulseGroups` external sync reviewed in census; wave stays inside mark renderer |
| Live streaming | **REPLACE (partial)** | rolling-path contract + committed `viewport.domain` replaces scroll machinery; data production loop + asymmetric y-lerp stay app-owned (data policy); hover via native focus (03); 32ms commit throttle stays |
| `spring.ts` / `bezier-easing.ts` / `radar-spring.ts` | **DELETE** | consumers all move to native transitions (01/03/05) |
| `use-prefers-reduced-motion.ts` | **DELETE (6.4)** | native `respectReducedMotion` default true; check for non-chart consumers first |
| Default enter timing | **REPLACE** | native defaults == bklit constants (1100ms/ease) — zero-config parity |

## Deletions

`spring.ts`, `candle-spring.ts` (keep solver fn), `enter-transition.ts`, `deferred-reveal.ts`,
`chart-reveal-clip.tsx` (dead), `sunburst-reveal.ts`, `native-stagger.ts`, `bezier-easing.ts`,
`radar-spring.ts`, sankey WAAPI/CSS-injection paths, live scroll machinery.

## Open questions — resolved

- Wipe alternatives exhausted: viewport-domain animation rescales (stretches) rather than
  clips; container-level CSS clip would wipe native SVG axes too (divergence from legacy, where
  labels stay visible during reveal) → ACCEPT-WITH-LOG is honest.
- WAAPI keyframe sampling (candle/sunburst) exists only because springs/arcs weren't
  interpolable in CSS — native motion interpolates semantically; delete.
