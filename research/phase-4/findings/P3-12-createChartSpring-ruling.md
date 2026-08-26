# P3.12 — T-D10 `createChartSpring` + host-sizing audit — RULING

Executor: ox-alpha (P3.12) · 2026-08-24 · Gate: `TSC_EXIT=0` (see §6)

## 1. Part A ruling — outcome (c): VIABLE BROADLY. Landed as a single-file swap.

The wrapper ranked outcomes (a) non-viable / (b) narrow / (c) broad-only-if-curves-match.
The curves match — not approximately, **exactly** — because of a fact neither the
wrapper nor the brief had: **framer-motion (bklit's runtime, `motion@12.43.0`) is
already analytic**, and TanStack's `createChartSpring` implements the identical
closed-form solution.

### The decisive evidence

bklit's actual spring math is
`showcase/node_modules/.pnpm/motion-dom@12.43.0/.../animation/generators/spring.mjs`
(bklit declares `"motion": "^12.27.0"`, `repos/bklit-ui/packages/ui/package.json:74`;
showcase resolves 12.43.0):

- L213–219: `resolveSpring(t) = target − e^(−ζω₀t)(A·sin ω_d t + Δ·cos ω_d t)` — the
  closed-form damped harmonic oscillator sampled at clock time `t`. No integration.
- L184: `ω₀ = sqrt(stiffness/mass)` pre-scaled to rad/ms; generators take **ms**.
- L192–198: rest tiers picked per animation from `|initialDelta| < 5` —
  granular `{restDelta .005, restSpeed .01}` else `{.5, 2}`.
- L292–295: done = `|v| ≤ restSpeed && |Δ| ≤ restDelta`.

TanStack `sampleSpring` (`showcase/repos/tanstack-charts/packages/charts-core/src/spring.ts`,
exported subpath `"./spring"` at `charts-core/package.json:193`) is branch-for-branch
the same solution: underdamped L79–90, overdamped L91–101, critical L102–108,
same default rest tiers (L32–33), same done test (L113–115), same `|Δ0|<5` tier
selection implemented by the caller (us).

The incumbent `internal/spring.ts` was semi-implicit Euler @ 1/120 s substeps over
that same ODE — i.e. the incumbent was the *numerical approximation* of what both
bklit and the native sampler compute exactly. The brief's premise ("an analytic
oscillator and Euler produce different curves… tuned for bklit parity") is
**inverted**: Euler carried the parity error; the analytic sampler removes it.

### Three-way numeric proof (real installed framer-motion vs real TanStack source vs old Euler)

Unit step 0→1 (granular tier), v₀=0, sampled every 4 ms over the union horizon:

| config (k,c) | settle framer/native/euler (ms) | max\|framer − native\| | max\|framer − euler\| |
|---|---|---|---|
| TOOLTIP_SPRING (300,30) | 356 / 356 / 417 | **0.0000** @72ms | 0.2067 @60ms |
| HIGHLIGHT_SPRING (180,28) | 772 / 772 / 817 | **0.0000** @72ms | 0.1464 @76ms |
| HOVER pie/ring (400,25) | 571 / 571 / 400 | **0.0000** @28ms | **0.2842 @44ms** |
| LABEL_DIM funnel (300,24) | 491 / 491 / 500 | **0.0000** | 0.2369 @60ms |
| TICK live (180,24) | 501 / 501 / 583 | **0.0000** | 0.1625 @76ms |
| day/month stack (400,35) | 318 / 318 / 400 | **0.0000** | 0.2359 @44ms |
| heatmap tooltip (300,25) | 506 / 506 / 500 | **0.0000** | 0.2314 @60ms |
| ENTRANCE (260,22) | 522 / 522 / 517 | **0.0000** | 0.2244 @60ms |

Pixel step 0→600 (coarse tier): framer/native/Euler settle 591/591/583 @(400,25)
and 607/607/450 @(300,30); max|framer−native| = **0.00 px**; max|framer−Euler| =
**170.5 px** @(400,25), 124.0 px @(300,30).

Read-out: the native sampler reproduces framer bit-for-bit at every tested config,
both tiers, both amplitudes — including the `{400,25}` pair the brief flagged as a
coverage gap. The old Euler deviated from bklit by up to 28 % of travel on small
hover moves and ~170 px on pill travel, and settled 45–171 ms early or late
depending on config. Notably at `{400,25}` granular moves, bklit really settles at
~571 ms; our Euler stopped at ~400 ms — a pre-existing parity defect this swap
fixes, not introduces.

## 2. What was changed

**One file: `showcase/migrated/charts/internal/spring.ts`** (+1 tsconfig entry).

The wrapper's core worry — "~19 call sites must each grow their own rAF loop and
clock" — dissolves because this package owns `spring.ts` itself. The file keeps its
exact public push API (`createSpring(initial, stiffness, damping, onUpdate)`
returning `set/jump/stop`, owning one rAF loop, writing via `onUpdate`); only the
math underneath became `createChartSpring(...).sample(elapsedMs, state)`:

- Per-retarget re-seed `{from: current, to: target, velocity}` + `startedAt` clock —
  analytic restart from live position/velocity, matching framer's `useSpring`
  creating a fresh generator per retarget. Velocity carries across retargets
  (units/s, per `ChartSpringState.velocity`'s contract).
- Rest tiers picked per retarget from `|Δ| < 5`, fed explicitly into
  `createChartSpring({restDelta, restSpeed})` so both tiers behave exactly as
  framer's (native defaults are permanently-granular; explicit override preserves
  the coarse tier for pixel springs — the D51 lesson stays intact).
- `jump` snaps state + cancels rAF + fires `onUpdate`; `stop` cancels rAF;
  same-value-idle `set` remains a no-op. All byte-compatible with the old contract.

Mechanism greppable:

```
showcase/migrated/charts/internal/spring.ts:18: import { createChartSpring, type ChartSpring } from "@tanstack/charts/spring";
showcase/migrated/charts/internal/spring.ts:51:       ? createChartSpring({
showcase/migrated/charts/internal/spring.ts:57:       : createChartSpring({
```

tsconfig entry added (`showcase/tsconfig.json`, alphabetical between `rule` and
`runtime`) — required for tsc only; `next.config.mjs` already auto-aliases every
`charts-core` export subpath at runtime (`aliasesFromExports`, lines 6–29), which
is why the app builds without it.

## 3. Consumers touched / deliberately left

All 8 file-level consumers verified live this round — `candlestick-hover-chrome.ts`,
`funnel-hover-chrome.ts`, `heatmap-components.tsx`, `hover-chrome.ts`,
`live-hover-chrome.ts`, `pie-hover-chrome.ts`, `ring-hover-chrome.ts`,
`tooltip-chrome.ts` — **none edited; none needed editing**. Every call site keeps
its trigger/config logic and its `set/jump/stop` usage untouched; they now get
framer-exact trajectories through the same API. Pie confirmed a live consumer
(pie-hover-chrome.ts:147/:151/:168, local `HOVER_SPRING {400,25}` :37) — the brief
was right to pull it into scope. Distinct configs covered by the proof above:
{300,30}, {180,28}, {400,25}×(pie/ring + day/month 400,35), {300,24}, {180,24},
{300,25}, {260,22}. Untouched as chartered: `candle-spring.ts` (solver — native has
no duration/bounce derivation), `radar-spring.ts` + its `enter-transition.ts:37`
dependency (settle estimator), `gauge-reveal.ts` (verified declarative-only; routes
through enter-transition, not `./spring`).

## 4. Ring / D258 interaction — stated expectations, not a QA verdict

QA runs are fenced from this package (lead sweeps afterward). What the swap can and
cannot do to D258's oscillation:

- Cannot fix the mechanism: hover listeners still bind where they bound; the
  unscaled-wrapper prescription remains P-later work. Constraint 2 wiring-stamp
  behavior untouched (no edits near the effect).
- Does change the tail: hover-scale trajectories at `{400,25}` now match bklit's
  framer output exactly instead of Euler's shorter ~400 ms approximation. If
  bklit's own ring hover settles deterministically, migrated now follows the same
  deterministic curve — plausibly *better* for D258's "still cycling at 1 s"
  signature, but the lead's n=1000 hover capture must rule fix/unaffected/worsened.
- Non-conflation per constraints 1–2: this says nothing about the n=4 acquisition
  gap or the style-stamp issue.

## 5. Part B — host-sizing audit: CLOSED EMPTY under the §3 scope cut

Scope after cut: 11 parts (bar, choropleth, candlestick, scatter, composed, gauge,
line, area, live-line, heatmap, funnel); pie/radar/ring reserved to P4.3.

Per-part disposition (hook → consumers of the measured size):

| part | hook (site) | HTML overlay fed by size? | disposition |
|---|---|---|---|
| bar | `useContainerWidth` (:138) | yes — hover pill/box chrome positioned off band scales built from width | keep |
| choropleth | `useContainerWidth` (:639) | yes — projection/zoom + tooltip box | keep |
| candlestick | `useContainerWidth` (:145) | yes — indicator/pill/box chrome | keep |
| scatter | `useContainerWidth` (:220) | yes — indicator/pill/box chrome | keep |
| composed | `useDebouncedContainerWidth` (:403) | yes — shared hover chrome | keep |
| gauge (radial) | `useDebouncedContainerSize` (:383) | yes — center-stat overlay sized from `min(w,h)` | keep |
| gauge (linear) | `useDebouncedContainerWidth` (:990) | separate component/container; notch layout + overlay | keep |
| line | `useDebouncedContainerSize` (:140) | yes — heaviest overlay chrome in the repo | keep |
| area | `useMeasuredRect` (:169) | yes — hover chrome | keep |
| live-line | `useMeasuredRect` (:353) | yes — pill/tick chrome | keep |
| heatmap | `usePositiveChartSize` (:109) | yes — cell hit layer/tooltip | keep |
| funnel | `usePositiveChartSize` (:644) | yes — label stack overlays | keep |
| pie / radar / ring | — | — | out of scope → P4.3 |

Key negative result: `onRender` context is `{container, svg, scene, interaction}`
(`dom-types.ts:300–307`, wired in react-charts `Chart.tsx:84–100`) — no resolved
size, though `container.clientWidth/Height` is readable inside it. Even granting
an onRender-fed rect for free, the ≥2-hooks bar fails: the only file holding two
size hooks (gauge) holds them in **two different components measuring two different
containers** (radial :383 vs linear :990, each with its own `widthProp ??` fallback),
so folding removes 0 hooks. All 11 remaining parts feed width/height into scale
math that positions absolutely-placed HTML chrome, which native `<Chart>` host
sizing does not expose to sibling DOM. **Adopt nowhere. `use-container-size.ts`
stays fully load-bearing.**

13-vs-14 discrepancy (brief §Part B): fresh direct grep reproduces **14** consumer
files exactly as the brief's own verification; the stale "13" note stands corrected.

## 6. Gate + instructions to the lead

`tsc --noEmit` from `showcase/`: **TSC_EXIT=0** (captured directly, unpiped).
No build, no QA scripts run (concurrent siblings). Consolidated sweep instructions —
this change is invisible to settled screenshots by construction; **hover-phase
captures are the gate**:

- **ring, n=1000, hover capture mandatory** (D258): wrong-motion signatures —
  hover scale snapping instantly (= threshold regression), or still cycling
  transforms >1 s after pointer rest (= D258 worsened/unfixed); correct = scale
  eases out over ~0.55–0.6 s matching bklit frame-for-frame. Explicitly does not
  close the n=4 acquisition gap.
- **pie, n=1000**: slice translate/grow on hover — too-fast snap or overshoot
  beyond bklit's single ~8 % overshoot = fail; expect near-identical overshoot
  timing now.
- **tooltip-chrome hosts (line/area/scatter/bar)**: pill left/top glide, dot cx/cy,
  crosshair, entrance fade/slide, day/month stack flip — wrong = pill arrives
  noticeably earlier/later than bklit (~450→600 ms class differences were possible
  under Euler; now should match bklit exactly).
- **funnel** label dim ({300,24} + index-varying configs), **heatmap** tooltip
  slide ({300,25}), **live-line** tick translateY ({180,24}) and pill, **candlestick**
  dot follow ({300,30}).

## 7. Files touched / fences / orphans

- Modified: `showcase/migrated/charts/internal/spring.ts` (rewritten internals),
  `showcase/tsconfig.json` (+4-line paths entry). Nothing else.
- Barrel `internal/index.ts`: untouched (does not export `spring` — verified).
- Clones (`repos/`, `showcase/repos/`): untouched, read-only reference only.
- Orphans: none in migrated code — `internal/spring.ts` is fully converted, not
  orphaned; no consumer orphaned. Two evidence artifacts I created could not be
  deleted (D216 hook blocks deletion even of my own files):
  `temp-p312-spring-probe.mjs`, `temp-p312-framer-check.mjs` at repo root. All
  load-bearing numbers are transcribed above; safe for the lead to delete.

## 8. Contradictions with the wrapper/brief

1. Clone path: the wrapper cites `charts-core/src/spring.ts` without noting the
   clone root is `showcase/repos/tanstack-charts` — `repos/tanstack-charts` has no
   `src/spring.ts` (older revision). §2's relative tsconfig target is nonetheless
   correct as written.
2. The central premise ("analytic vs Euler produce different curves; ours were
   tuned for bklit") is inverted in the decisive respect: bklit's framer-motion
   *is* analytic, so the native sampler is strictly closer to bklit than the Euler
   integrator ever was. The falsifier resolved in favor of (c), via a narrower
   mechanism than either side anticipated (single-file swap, zero per-site loops).
3. Runtime aliasing already existed (`next.config.mjs` exports-driven), so the
   missing tsconfig entry was typecheck-only, as suspected but unconfirmed by the
   wrapper.
