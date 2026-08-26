"use client";

// P5.7 Strand 1 (B14) — port of bklit `bar-chart-loading.tsx`.
//
// ⚠ The mechanism DIVERGES, deliberately, and this is the interesting part of
// the strand. bklit's version is one line — `<BarChart status="loading"
// data={[]} />` — because `bar-chart.tsx:653-659` branches on that status and
// renders `<BarLoadingSkeleton barCount={data.length || 12} />`. That component
// is one of the seven symbols DOC-10/FD7 accepts as DELETED, and migrated's
// `BarChart` accordingly has no `status` prop at all (D257 §7 recorded the
// symmetry from the other direction: the QA `state="loading"` scenario is
// inert for bar on BOTH sides). So the literal port would render nothing.
//
// Composed from the parts migrated actually has, per the go-to-plan text
// ("composed from existing parts") and the `HeatmapChartLoading` precedent
// (`heatmap-chart.tsx:471-489`): placeholder bars from the same skeleton
// series the loading y-domain uses, with `<BarPulse>` sweeping across them —
// `internal/bar-pulse-mark.ts` is migrated's real shimmer, and D257 §7's
// runner already verified it drives the visible pulse. Same end state as
// bklit's "shimmer-swept placeholder bars", reached through the surviving
// implementation rather than the deleted one.

import * as React from "react";
import { BarChart } from "./bar-chart";
import { Bar, BarPulse, Grid } from "./children";
import {
  buildLoadingSkeletonSeries,
  loadingSkeletonBarHeights,
} from "./internal/loading-chrome";
import type { ChartMargin } from "./internal";

const LOADING_DATA_KEY = "value";
/** bklit `bar-chart.tsx:55` — `FALLBACK_LOADING_BARS`, the bar count used when
    the caller has no data to mirror. Also `loading-sweep.tsx:43`'s
    `DEFAULT_BAR_COUNT`, so the two sides agree on 12 either way. */
const FALLBACK_LOADING_BARS = 12;
/** bklit `loading-sweep.tsx:44-45` paints `fill="var(--foreground)"` at
    `fillOpacity={0.45}`. `BarConfig` has no fill-opacity seam, so the alpha is
    folded into the color — `color-mix(… 45%, transparent)` composites
    identically over any ground. */
const DEFAULT_LOADING_BAR_FILL =
  "color-mix(in oklch, var(--foreground) 45%, transparent)";
/** bklit `loading-sweep.tsx:46` — `DEFAULT_BAR_FRACTION = 0.7`, i.e. each bar
    occupies 70% of its band. `BarChart`'s `barGap` is the complement. */
const LOADING_BAR_GAP = 0.3;
/** bklit `loading-sweep.tsx:42` — `BAR_CORNER_RADIUS = 2`. Passed explicitly
    because `<Bar>`'s default is the bandwidth-derived "round" (capped at 8),
    which at this bar width rounds the tops far harder than legacy's `rx=2`. */
const LOADING_BAR_CORNER_RADIUS = 2;

export interface BarChartLoadingProps {
  /** Chart margins. */
  margin?: Partial<ChartMargin>;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Additional class name for the container. */
  className?: string;
  /** Placeholder bar count. Default: 12 (bklit `FALLBACK_LOADING_BARS`). */
  barCount?: number;
  /** Placeholder bar fill. */
  fill?: string;
  /**
   * Pause the shimmer sweep. Default: false. Exposed because the QA harness
   * pins the sweep to capture deterministic frames
   * (`__qaSetBarPulsePaused`, `bench/app/src/scenarios/migrated-bardepth.tsx`);
   * bklit has no equivalent knob on its own preset.
   */
  pulsePaused?: boolean;
}

/**
 * Turnkey loading skeleton for bar charts — a thin shortcut for a
 * shimmer-swept placeholder `<BarChart>`. Swap in a real `<BarChart>` once the
 * data resolves.
 */
export function BarChartLoading({
  margin,
  aspectRatio = "2 / 1",
  className = "",
  barCount = FALLBACK_LOADING_BARS,
  fill = DEFAULT_LOADING_BAR_FILL,
  pulsePaused = false,
}: BarChartLoadingProps) {
  // The x sequence comes from the shared skeleton builder (same base date, so
  // the loading tick labels never leak "today"); the VALUES are replaced with
  // bklit's own placeholder bar heights — see `loadingSkeletonBarHeights`.
  const data = React.useMemo(() => {
    const heights = loadingSkeletonBarHeights(barCount);
    return buildLoadingSkeletonSeries(LOADING_DATA_KEY, barCount).map(
      (row, index) => ({ ...row, [LOADING_DATA_KEY]: heights[index] }),
    );
  }, [barCount]);

  return (
    <BarChart
      aspectRatio={aspectRatio}
      barGap={LOADING_BAR_GAP}
      className={className}
      data={data}
      margin={margin}
      xDataKey="date"
    >
      {/* bklit's `BarLoadingSkeleton` (`loading-sweep.tsx:355+`) draws bars and
          nothing else, so the grid has to be turned OFF explicitly — dropping
          the `<Grid>` child is not enough, because `resolveGridGuide`
          (`internal/grid.ts:39`) defaults `horizontal` to true when no child is
          present. Worth noting how this was caught: the QA gate did not see
          those stray gridlines at all (D337 — `pixelmatch` runs
          `includeAA: false` and discards hairlines), only opening the PNGs
          did. */}
      <Grid horizontal={false} />

      <Bar
        dataKey={LOADING_DATA_KEY}
        fill={fill}
        lineCap={LOADING_BAR_CORNER_RADIUS}
      />
      <BarPulse dataKey={LOADING_DATA_KEY} pulsePaused={pulsePaused} />
    </BarChart>
  );
}

BarChartLoading.displayName = "BarChartLoading";

// Legacy parity: bklit `bar-chart-loading.tsx:38` ships a default export.
export default BarChartLoading;
