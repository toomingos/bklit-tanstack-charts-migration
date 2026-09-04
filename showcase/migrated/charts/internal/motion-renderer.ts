/*
 * Shared motion renderer for every migrated chart; `motion()` is stateless until `mount()`, so one
 * module-level instance serves all charts. Its default 1,100ms tween matches bklit REVEAL_DURATION_MS.
 */
import { useRef } from "react";
import { motion } from "@tanstack/charts/motion";
import { renderChartSvg } from "@tanstack/charts/svg";
import { createSvgChartRenderer } from "@tanstack/charts/svg/renderer";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";
import { NATIVE_MOTION_MAX_POINTS } from "./design-tokens";

/*
 * `initial: "always"` is required: RendererChart injects prerender() markup before mount() adopts it,
 * so the renderer reads it as server-rendered and the default `initial: true` never plays the entrance.
 */
const instance = motion({ initial: "always" });
// D472: The static SVG renderer `<Chart>` itself uses; same gradient/tooltip/focus support, no
// Motion cascade, reads the definition's `svgAnimation` gate.
const staticInstance = createSvgChartRenderer(renderChartSvg);

// TanStack's UniversalChartRenderer is definition-agnostic by design, so each host
// Converts it with no assertion and stable shared identity.
const asRenderer = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
  renderer: typeof instance | typeof staticInstance,
): ChartRenderer<TDatum, TXValue, TYValue> => renderer;

/**
 * D472: cardinality-gated renderer for per-datum keyed marks (dots, bars, candles). Motion renderer
 * up to `NATIVE_MOTION_MAX_POINTS` datums, the static SVG renderer above it — see the token's
 * comment for the 0.15.0 O(elements x points) update-reconcile cost this sidesteps. Both instances
 * are module-level, so identity is stable within a cardinality regime.
 *
 * @param {number} pointCount - Datum count compared against `NATIVE_MOTION_MAX_POINTS` to pick the regime.
 * @returns {ChartRenderer<TDatum, TXValue, TYValue>} Shared motion renderer at or below the threshold, otherwise the shared static SVG renderer.
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

/*
 * RendererChart remounts on renderer identity change, replaying the entrance as a spurious
 * re-reveal; the first estimate therefore latches the regime for the chart's lifetime.
 */
const useChartRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  estimate: number,
): ChartRenderer<TDatum, TXValue, TYValue> => {
  const rendererRef = useRef<ChartRenderer<TDatum, TXValue, TYValue> | undefined>(undefined);
  rendererRef.current ??= chartRendererFor<TDatum, TXValue, TYValue>(estimate);
  return rendererRef.current;
};

const chartMotionRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(): ChartRenderer<TDatum, TXValue, TYValue> => asRenderer<TDatum, TXValue, TYValue>(instance);

export { chartMotionRenderer, chartRendererFor, useChartRenderer };
