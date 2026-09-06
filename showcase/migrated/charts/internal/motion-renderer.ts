/*
 * Single animation owner: every mount renders through `motion()` with the same
 * entrance. No point-count gate, no latched regime switch, stable identity.
 */
import { motion } from "@tanstack/charts/motion";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";

/*
 * `initial: "always"` replays the entrance on adopted SSR markup; the renderer
 * enforces reduced motion so scene chrome needs no hand media query.
 */
const stillInstance = motion({ initial: "always", respectReducedMotion: true });
const resizeInstance = motion({ initial: "always", resize: true, respectReducedMotion: true });

// TanStack's UniversalChartRenderer is definition-agnostic by design, so each host
// Converts it with no assertion and stable shared identity.
const asRenderer = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
  renderer: typeof stillInstance,
): ChartRenderer<TDatum, TXValue, TYValue> => renderer;

interface ChartMotionRendererOptions {
  readonly resize?: boolean;
}

/*
 * One `motion()` factory. Resize defaults to false: no legacy family tweens
 * size-only updates, so no mount opts in today.
 */
const chartMotionRenderer = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  options?: Readonly<ChartMotionRendererOptions>,
): ChartRenderer<TDatum, TXValue, TYValue> =>
  asRenderer<TDatum, TXValue, TYValue>(options?.resize === true ? resizeInstance : stillInstance);

export { chartMotionRenderer };
export type { ChartMotionRendererOptions };
