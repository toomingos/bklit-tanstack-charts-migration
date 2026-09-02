// C5 (D432): the single shared motion renderer for every migrated chart.
//
// `motion()` (dist/motion.js) is stateless until `mount()` — each mount call
// builds a fresh closure (`createMotionSvgChartRenderer(...).mount(...)`), so
// one module-level instance can serve every simultaneously mounted chart.
// Keep the instance identity STABLE: React's `RendererChart` passes `renderer`
// through `adapter.update`, and a new identity per render would churn the host.
//
// `initial: "always"` is REQUIRED, not a preference: React's `RendererChart`
// always injects `prerender()` markup via dangerouslySetInnerHTML before
// `mount()` adopts it (RendererChart.js), and the motion renderer treats an
// adopted `svg.ts-chart` root as server-rendered — with the default
// `initial: true` it would NEVER play entrance choreography in React. legacy
// bklit replays its reveal on every mount (including post-hydration), so
// `always` is also the parity-correct setting.
//
// The renderer-wide default transition (1,100ms tween, default entrance ease)
// equals bklit's REVEAL_DURATION_MS / REVEAL_EASE_CSS constants
// (design-tokens.ts T-D1) — charts only declare definition-local `motion`
// where legacy timing differs from that default.
import * as React from "react";
import { motion } from "@tanstack/charts/motion";
import { renderChartSvg } from "@tanstack/charts/svg";
import { createSvgChartRenderer } from "@tanstack/charts/svg/renderer";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";
import { NATIVE_MOTION_MAX_POINTS } from "./design-tokens";

const instance = motion({ initial: "always" });
// D472: the static SVG renderer `<Chart>` itself uses (react-charts Chart.js
// `createSvgChartRenderer(renderChartSvg)`); same gradient/tooltip/focus
// support, no motion cascade, reads the definition's `svgAnimation` gate.
const staticInstance = createSvgChartRenderer(renderChartSvg);

/** Typed view of the shared instance for a `RendererChart` `renderer` prop. */
/**
 * D472: cardinality-gated renderer for per-datum keyed marks (dots, bars,
 * candles). Motion renderer up to `NATIVE_MOTION_MAX_POINTS` datums, the
 * static SVG renderer above it — see the token's comment for the 0.15.0
 * O(elements x points) update-reconcile cost this sidesteps. Both instances
 * are module-level, so identity is stable within a cardinality regime.
 */
export function chartRendererFor<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(pointCount: number): ChartRenderer<TDatum, TXValue, TYValue> {
  return (pointCount > NATIVE_MOTION_MAX_POINTS ? staticInstance : instance) as unknown as ChartRenderer<
    TDatum,
    TXValue,
    TYValue
  >;
}

// D-pending (D1): renderer choice must be mount-stable AND prop-independent.
// `chartRendererFor` alone re-evaluates `pointCount > NATIVE_MOTION_MAX_POINTS`
// on every render, so a datum count (or, in bar-chart, a primitive estimate)
// that crosses the threshold across the chart's lifetime — e.g. a live-data
// chart growing past 200 rows, or a depth toggle that changes the primitive
// count — swaps the renderer instance mid-mount. `RendererChart` treats a
// changed `renderer` identity as a surface remount (dist/renderer.js:103-111)
// and replays the mount entrance (dist/motion.js:605-612), which reads as a
// spurious re-reveal to anything watching the DOM (QA capture included).
// This hook latches the renderer choice to whatever `estimate` the FIRST
// render passes — a `useRef` seeded once and never reassigned — so the
// regime a chart mounts into is the regime it keeps for its whole lifetime,
// regardless of later prop/data changes. `chartRendererFor` stays exported
// for the rare non-hook (non-component) caller.
export function useChartRenderer<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(estimate: number): ChartRenderer<TDatum, TXValue, TYValue> {
  const rendererRef = React.useRef<ChartRenderer<TDatum, TXValue, TYValue> | null>(null);
  if (rendererRef.current === null) {
    rendererRef.current = chartRendererFor<TDatum, TXValue, TYValue>(estimate);
  }
  return rendererRef.current;
}

export function chartMotionRenderer<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(): ChartRenderer<TDatum, TXValue, TYValue> {
  return instance as unknown as ChartRenderer<TDatum, TXValue, TYValue>;
}
