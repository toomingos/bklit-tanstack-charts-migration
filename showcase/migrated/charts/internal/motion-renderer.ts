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
import { motion } from "@tanstack/charts/motion";
import type { ChartRenderer, ChartValue } from "@tanstack/charts";

const instance = motion({ initial: "always" });

/** Typed view of the shared instance for a `RendererChart` `renderer` prop. */
export function chartMotionRenderer<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(): ChartRenderer<TDatum, TXValue, TYValue> {
  return instance as unknown as ChartRenderer<TDatum, TXValue, TYValue>;
}
