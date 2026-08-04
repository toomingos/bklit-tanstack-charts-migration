// Radar scenario -- authored against the REAL typed `RadarChart` API
// (repos/bklit-ui/packages/ui/src/charts/radar-chart.tsx, radar-context.tsx,
// radar-area.tsx, radar-grid.tsx), mirroring the correctly-typed docs demo
// (repos/bklit-ui/apps/web/components/docs/radar-chart-demo.tsx's
// `RadarChartBasicDemo`): `<RadarChart data metrics size><RadarGrid/>
// <RadarAxis/><RadarLabels/>{data.map((_, i) => <RadarArea index={i}/>)}
// </RadarChart>`.
//
// NOT based on `repos/bklit-ui/packages/ui/registry/examples/radar-chart.tsx`
// -- docs/LOG.md D24 identifies that registry example as BROKEN (its data
// doesn't satisfy the real `RadarData` shape, and it passes nonexistent
// `fill`/`fillOpacity` props to `RadarArea`).
//
// Hover is intentionally left UNCONTROLLED (no `hoveredIndex`/
// `onHoverChange` passed to `RadarChart`): `RadarArea` already wires its own
// `onMouseEnter`/`onMouseLeave` into `RadarChart`'s internal uncontrolled
// hover state (radar-chart.tsx's `RadarChartInner`) -- D24 ruling (1): radar
// hover is native `pointerenter`/`pointerleave` hit-testing on the rendered
// polygon, not a bisect/tooltip/focus mechanism, so there is nothing external
// to wire up.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RadarChart,
  RadarGrid,
  RadarAxis,
  RadarLabels,
  RadarArea,
} from "@bklitui/ui/charts";
import {
  generateRadar,
  generateRadarUpdate,
  type SeededRadarSet,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Size ------------------------------------------------------------------
// `RadarChart`'s `size` prop (radar-chart.tsx) fixes width AND height to a
// square in px when provided (otherwise it's `ParentSize`-driven). The
// primary docs demo (`RadarChartDemo`, the legend-paired variant) uses
// `size={400}`; the bare `RadarChartBasicDemo`/`RadarChartMinimalDemo`
// variants use 350/300. `#chart-root` is 1100px wide (minus 24px padding
// each side = 1052px usable) in an 1200x800 bench viewport (bench/app/src/
// styles.css) -- 400x400 fits comfortably inside both with large margin, so
// this scenario uses the primary demo's size verbatim instead of shrinking
// it further.
const RADAR_SIZE = 400;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// Like `CandlestickChart` (see bklit-candlestick.tsx's settle comment),
// `RadarChart` exposes NO `onPhaseChange`/`status` prop -- there is no
// callback to observe when its staggered polygon reveal has actually
// finished. Unlike candlestick, there's also no single internal
// `setTimeout(enterDurationMs)` flip to reuse: the LAST thing to finish
// animating is the last series' filled+stroked polygon path, which starts
// only after a grid/label lead-in delay plus a per-series stagger.
//
// Computed directly from the read sources (not guessed), with none of
// `RadarChart`'s defaults overridden by this scenario (matching the docs
// demo): `enterDurationMs=1100`, `levels=5`, `staggerScale=1` ->
// `durationFactor = enterDurationMs / 1100 = 1`.
//
//   radar-grid.tsx / radar-area.tsx:
//     gridStagger       = 0.08 * staggerScale * durationFactor  = 0.08s
//     campaignBaseDelay = (levels * gridStagger + 0.2) * durationFactor
//                       = (5 * 0.08 + 0.2) * 1                  = 0.6s
//     campaignStagger   = 0.15 * staggerScale * durationFactor  = 0.15s
//     animationDelay(i) = campaignBaseDelay + i * campaignStagger
//   (i = 0-based series index; `RadarPoint`'s cx/cy ride the SAME
//   `mountProgress` MotionValue as the polygon path -- radar-area.tsx -- so
//   the per-metric dots finish exactly when the path does; no extra tail.)
//
//   The polygon path animates via `useMountProgress`, which -- since this
//   scenario doesn't thread an `enterTransition` prop through (matching the
//   docs demo) -- falls back to `DEFAULT_CHART_ENTER_TRANSITION`
//   (animation.ts): a plain TWEEN of duration `enterDurationMs / 1000`
//   seconds (1.1s), i.e. an exact, non-asymptotic end time. (RadarGrid's
//   rings and RadarAxis's spokes/RadarLabels instead use SPRINGS with no
//   fixed duration -- but per `campaignBaseDelay` above they all start, and
//   settle, well before the LAST series polygon even begins, so they never
//   gate the true end.)
//
//   Last-animation-end (series index n-1, 0-based) =
//     campaignBaseDelay + (n-1) * campaignStagger + enterDurationMs
//     = 600 + (n-1) * 150 + 1100 ms  =  1700 + (n-1) * 150 ms
//
//     n=1  (gate)       -> 1700ms      n=4  (gate)       -> 2150ms
//     n=20 (structural) -> 4550ms      n=50 (structural) -> 9050ms
//
// `armBklitTimerSettle` (bench/settle.ts, shared/protected) would race this
// computed timer against its own fixed 2500ms `FALLBACK_MS` safety net --
// fine for the two GATED sizes (n=1 -> 1700ms, n=4 -> 2150ms, both under
// the net) but for n=20/50 the net fires FIRST and `__benchSettled` would
// report "settled" seconds before the later series polygons even start
// revealing. That under-count is harmless for M1b (D24: no gate reads the
// structural rows) but NOT for QA: qa/screenshot.mjs gates every capture on
// `__benchSettled`, and probing hover targets mid-reveal makes the
// hovered-series latch race the still-growing polygons -- the
// nondeterministic QA n=20 hover-30 flake diagnosed in docs/LOG.md D47. So
// this scenario drives its own settle via `armManualSettle` (whose
// documented purpose is exactly this: sequences whose true end exceeds the
// shared net), replicating `armBklitTimerSettle`'s computed-timer +
// double-rAF resolve verbatim, with the wedge-guard fallback sized ABOVE
// the computed end instead of below it. Gated-size timing is unchanged:
// the computed timer fires first there under either arm.
function radarSettleMs(n: number): number {
  const levels = 5;
  const enterDurationMs = 1100;
  const staggerScale = 1;
  const durationFactor = enterDurationMs / 1100;
  const gridStagger = 0.08 * staggerScale * durationFactor;
  const campaignBaseDelayMs =
    (levels * gridStagger + 0.2) * durationFactor * 1000;
  const campaignStaggerMs = 0.15 * staggerScale * durationFactor * 1000;
  return (
    campaignBaseDelayMs + Math.max(0, n - 1) * campaignStaggerMs + enterDurationMs
  );
}

// The formula above counts from THIS scenario's render (when the settle is
// armed), but the chart's animation timeline starts a beat later: the
// component defers animation setup past commit+paint (framer-motion's
// effect-time start here; the migrated chart's double-rAF+setTimeout(0)
// WAAPI setup — measured ~80ms at n=4). Without a margin, `__benchSettled`
// resolves while the LAST series' reveal is still playing its final frames,
// mis-binning that tail into the post-settle idle window (M2a) — docs/
// LOG.md D48, the same settle-honesty principle as D47 one level deeper.
// Applied identically in both radar scenarios; M1b (not gated) absorbs the
// constant.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitRadar({ n }: { n: number }) {
  const [{ metrics, data }, setSet] = useState<SeededRadarSet>(() =>
    generateRadar("radar", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = radarSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setSet(generateRadarUpdate("radar", n, tickRef.current));
      });
    // Radar's `n` is SERIES COUNT at a fixed 5 metrics (D24), not a
    // time-series window -- there is no "append one live point" concept to
    // port here (unlike line/scatter/candlestick/composed's sliding-window
    // `appendLive*` helpers in bench/live.ts). `__benchLiveTick` is wired as
    // a documented no-op purely so the global exists for anything that
    // probes for its presence; nothing in the harness currently calls it
    // for this chart (bench/run.mjs's `CHARTS` sweep doesn't include radar
    // either).
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <RadarChart data={data} metrics={metrics} size={RADAR_SIZE}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      {data.map((series, index) => (
        <RadarArea index={index} key={series.label} />
      ))}
    </RadarChart>
  );
}
