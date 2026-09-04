// C5 (D432): the single shared motion renderer for every migrated chart.
//
// `motion()` is stateless until `mount()` — each mount call builds a fresh closure, so one
// module-level instance can serve every simultaneously mounted chart. Keep the instance identity
// STABLE: `RendererChart` passes `renderer` through `adapter.update`, and a new identity per
// render would churn the host.
//
// `initial: "always"` is REQUIRED, not a preference: `RendererChart` always injects `prerender()`
// markup via dangerouslySetInnerHTML before `mount()` adopts it, and the motion renderer treats an
// adopted `svg.ts-chart` root as server-rendered — with the default `initial: true` it would NEVER
// play entrance choreography in React. Legacy bklit replays its reveal on every mount (including
// post-hydration), so `always` is also the parity-correct setting.
//
// The renderer-wide default transition (1,100ms tween, default entrance ease) equals bklit's
// REVEAL_DURATION_MS / REVEAL_EASE_CSS constants (design-tokens.ts T-D1) — charts only declare
// definition-local `motion` where legacy timing differs from that default.
import { useRef } from "react";
import { motion } from "@tanstack/charts/motion";
import { renderChartSvg } from "@tanstack/charts/svg";
import { createSvgChartRenderer } from "@tanstack/charts/svg/renderer";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";
import { NATIVE_MOTION_MAX_POINTS } from "./design-tokens";

const instance = motion({ initial: "always" });
// D472: the static SVG renderer `<Chart>` itself uses; same gradient/tooltip/focus support, no
// motion cascade, reads the definition's `svgAnimation` gate.
const staticInstance = createSvgChartRenderer(renderChartSvg);

// Both renderers are datum-agnostic at runtime: they read points through the definition's
// accessors and never inspect TDatum, so one shared instance genuinely serves every chart. The
// generics exist only to satisfy `RendererChart`'s `renderer` prop at each call site, which is why
// this cast cannot be avoided by typing the instances differently — the invariant is guaranteed by
// the renderers being closed over nothing but the definition passed to `mount()`.
// SAFETY: both renderers read points through the definition's accessors and never inspect
// TDatum at runtime, so retyping the shared instances for each host is sound.
const asRenderer = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
  renderer: typeof instance | typeof staticInstance,
): ChartRenderer<TDatum, TXValue, TYValue> =>
  renderer as ChartRenderer<TDatum, TXValue, TYValue>;

/**
 * D472: cardinality-gated renderer for per-datum keyed marks (dots, bars, candles). Motion renderer
 * up to `NATIVE_MOTION_MAX_POINTS` datums, the static SVG renderer above it — see the token's
 * comment for the 0.15.0 O(elements x points) update-reconcile cost this sidesteps. Both instances
 * are module-level, so identity is stable within a cardinality regime.
 */
const chartRendererFor = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  pointCount: number,
): ChartRenderer<TDatum, TXValue, TYValue> =>
  asRenderer<TDatum, TXValue, TYValue>(
    pointCount > NATIVE_MOTION_MAX_POINTS ? staticInstance : instance,
  );

// D-pending (D1): renderer choice must be mount-stable AND prop-independent. `chartRendererFor`
// alone re-evaluates `pointCount > NATIVE_MOTION_MAX_POINTS` on every render, so a datum count
// (or, in bar-chart, a primitive estimate) that crosses the threshold across the chart's lifetime
// — e.g. a live-data chart growing past 200 rows, or a depth toggle that changes the primitive
// count — swaps the renderer instance mid-mount. `RendererChart` treats a changed `renderer`
// identity as a surface remount and replays the mount entrance, which reads as a spurious
// re-reveal to anything watching the DOM (QA capture included). This hook latches the renderer
// choice to whatever `estimate` the FIRST render passes — a `useRef` seeded once and never
// reassigned — so the regime a chart mounts into is the regime it keeps for its whole lifetime,
// regardless of later prop/data changes. `chartRendererFor` stays exported for the rare non-hook
// (non-component) caller.
const useChartRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  estimate: number,
): ChartRenderer<TDatum, TXValue, TYValue> => {
  const rendererRef = useRef<ChartRenderer<TDatum, TXValue, TYValue> | undefined>(undefined);
  if (rendererRef.current === undefined) {
    rendererRef.current = chartRendererFor<TDatum, TXValue, TYValue>(estimate);
  }
  return rendererRef.current;
};

const chartMotionRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(): ChartRenderer<TDatum, TXValue, TYValue> => asRenderer<TDatum, TXValue, TYValue>(instance);

export { chartMotionRenderer, chartRendererFor, useChartRenderer };
