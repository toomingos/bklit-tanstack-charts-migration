"use client";

// P5.7 Strand 1 (A10) — port of bklit `area-chart-loading.tsx`: a turnkey
// loading placeholder so a caller can render a skeleton area chart without
// wiring `status`/`loadingLabel`/skeleton data themselves.
//
// Composed from existing parts, per the `HeatmapChartLoading` precedent
// (`heatmap-chart.tsx:471-489`): it introduces NO new loading machinery, it
// just pre-configures `<AreaChart status="loading">` with the skeleton series
// and a grid. That precedent is followed closely — same prop-forwarding shape,
// same `label` default, same "generate the placeholder data in a `useMemo`"
// body — with one divergence, documented per prop below: bklit's version also
// forwards a family of shimmer/sweep options that migrated's loading chrome
// does not implement (DOC-10/FD7 accepts that surface as deleted). Those props
// are accepted-but-inert rather than dropped, so the public API still takes
// what bklit takes and a caller's code compiles unchanged.

import * as React from "react";
import { curveNatural } from "d3-shape";
import { AreaChart } from "./area-chart";
import { Area, Grid } from "./children";
import { buildLoadingSkeletonSeries } from "./internal/loading-chrome";
import type { ChartMargin } from "./internal";

// repos/bklit-ui/packages/ui/src/charts/area-chart-loading.tsx:16-22
const LOADING_DATA_KEY = "value";
const DEFAULT_LOADING_GRID_STROKE =
  "color-mix(in oklch, var(--chart-grid) 50%, transparent)";

export interface AreaChartLoadingProps {
  /** Chart margins */
  margin?: Partial<ChartMargin>;
  /** Stroke color for the skeleton line. Default: `var(--foreground)`. */
  stroke?: string;
  /**
   * DOC-9 accepted-but-inert. bklit applies this to the loading PULSE's
   * stroke; migrated's area chart draws no pulse (only line does — see
   * `internal/loading-chrome.tsx`), and `AreaConfig` exposes no stroke-opacity
   * seam, so there is nowhere for it to land. Accepted so bklit call sites
   * compile unchanged.
   */
  strokeOpacity?: number;
  /** Grid line stroke (color and opacity via color-mix or oklch alpha). */
  gridStroke?: string;
  /**
   * DOC-9 accepted-but-inert (DOC-10/FD7): the grid shimmer band is part of the
   * deleted sweep/skeleton surface. Accepted so bklit call sites compile.
   */
  gridShimmerStroke?: string;
  /** DOC-9 accepted-but-inert — see `gridShimmerStroke`. Default: true */
  gridShimmer?: boolean;
  /** DOC-9 accepted-but-inert — see `gridShimmerStroke`. Default: 140 */
  gridShimmerLength?: number;
  /** DOC-9 accepted-but-inert — see `gridShimmerStroke`. Default: 1 */
  gridShimmerSpeed?: number;
  /** DOC-9 accepted-but-inert — see `gridShimmerStroke`. */
  gridShimmerSync?: boolean;
  /**
   * DOC-9 accepted-but-inert. bklit takes `"pulse" | "sweep"`; the `"sweep"`
   * branch is `LineLoadingSweep`, deleted by DOC-10/FD7, so only the default
   * pulse behaviour exists here.
   */
  loadingStyle?: "pulse" | "sweep";
  /** Centered shimmer label text. Default: "Loading" */
  label?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Additional class name for the container */
  className?: string;
}

/**
 * Turnkey loading skeleton for area charts — a thin shortcut for
 * `<AreaChart status="loading">` over a placeholder series. Swap in a real
 * `<AreaChart>` once the data resolves.
 */
export function AreaChartLoading({
  margin,
  stroke = "var(--foreground)",
  gridStroke = DEFAULT_LOADING_GRID_STROKE,
  label = "Loading",
  aspectRatio = "2 / 1",
  className = "",
}: AreaChartLoadingProps) {
  const data = React.useMemo(
    () => buildLoadingSkeletonSeries(LOADING_DATA_KEY),
    [],
  );

  return (
    <AreaChart
      animationDuration={0}
      aspectRatio={aspectRatio}
      className={className}
      data={data}
      loadingLabel={label}
      margin={margin}
      status="loading"
    >
      <Grid horizontal stroke={gridStroke} />
      {/* bklit passes `stroke="transparent"` and lets the loading PULSE draw
          the visible line. Migrated's area chart has no pulse, so drawing a
          transparent stroke here would leave the placeholder as bare
          gridlines — the stroke goes on the series instead, which is the
          "compose from existing parts" reading of A10. */}
      <Area
        curve={curveNatural}
        dataKey={LOADING_DATA_KEY}
        fadeEdges={false}
        fill="transparent"
        fillOpacity={0}
        showHighlight={false}
        showLine
        stroke={stroke}
        strokeWidth={2}
      />
    </AreaChart>
  );
}

AreaChartLoading.displayName = "AreaChartLoading";

// Legacy parity: bklit `area-chart-loading.tsx:116` ships a default export.
export default AreaChartLoading;
