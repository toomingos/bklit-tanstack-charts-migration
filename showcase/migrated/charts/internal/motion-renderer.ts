/*
 * Single animation owner: every mount renders through the package's own renderers,
 * `motion()` by default and the static SVG renderer above the cardinality gate.
 */
import { useRef } from "react";
import { motion } from "@tanstack/charts/motion";
import { renderChartSvg } from "@tanstack/charts/svg";
import { createSvgChartRenderer } from "@tanstack/charts/svg/renderer";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";
import { NATIVE_MOTION_MAX_POINTS } from "./design-tokens";

/*
 * `initial: "always"` replays the entrance on adopted SSR markup; the renderer
 * enforces reduced motion so scene chrome needs no hand media query.
 */
const stillInstance = motion({ initial: "always", respectReducedMotion: true });
const resizeInstance = motion({ initial: "always", resize: true, respectReducedMotion: true });
/*
 * The package's own static renderer, the one `<Chart>` uses when no renderer is
 * passed: same gradients, tooltips and focus, no motion reconcile (upstream I3).
 */
const staticInstance = createSvgChartRenderer(renderChartSvg);

// TanStack's UniversalChartRenderer is definition-agnostic by design, so each host
// Converts it with no assertion and stable shared identity.
const asRenderer = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
  renderer: typeof stillInstance | typeof staticInstance,
): ChartRenderer<TDatum, TXValue, TYValue> => renderer;

interface ChartMotionRendererOptions {
  readonly resize?: boolean;
}

/*
 * One factory. Resize defaults to false: no legacy family tweens size-only
 * updates, so no mount opts in today.
 */
const chartMotionRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  options?: Readonly<ChartMotionRendererOptions>,
): ChartRenderer<TDatum, TXValue, TYValue> =>
  asRenderer<TDatum, TXValue, TYValue>(options?.resize === true ? resizeInstance : stillInstance);

/**
 * Cardinality gate for per-datum keyed marks (dots, bars, candles): the motion
 * renderer at or below `NATIVE_MOTION_MAX_POINTS` primitives, the package's
 * static renderer above it. Both instances are module-level, so identity is
 * stable within a regime and `RendererChart` never remounts mid-life.
 *
 * @param {number} pointCount - Primitive estimate compared against the token.
 * @returns {ChartRenderer<TDatum, TXValue, TYValue>} The renderer for that regime.
 */
const chartRendererFor = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  pointCount: number,
): ChartRenderer<TDatum, TXValue, TYValue> =>
  pointCount > NATIVE_MOTION_MAX_POINTS
    ? asRenderer<TDatum, TXValue, TYValue>(staticInstance)
    : chartMotionRenderer<TDatum, TXValue, TYValue>();

/*
 * RendererChart remounts on renderer identity change, replaying the entrance as a
 * spurious re-reveal, so the first estimate latches the regime for the chart's life.
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

export { chartMotionRenderer, chartRendererFor, useChartRenderer };
export type { ChartMotionRendererOptions };
