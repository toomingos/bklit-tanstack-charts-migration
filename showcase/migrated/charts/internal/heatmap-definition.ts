import { useMemo } from "react";
import type { ScaleBand, ScaleOrdinal } from "d3-scale";
import type { DomChartDefinition } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { useHeatmap } from "./heatmap-context";
import type { HeatmapMargin } from "./heatmap-context";
import { isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyle, HeatmapLevelStyles } from "./heatmap-colors";
import type { HeatmapEnterTransition } from "./heatmap-animation";
import { useHeatmapColorScale, useHeatmapCellMotion, useHeatmapCellScales } from "./heatmap-cell-motion";
import { useHeatmapCellMarks } from "./heatmap-cell-marks";
import type { HeatmapCellMark, HeatmapCellMarksParams, HeatmapHoverStateList, HeatmapRowOpacity } from "./heatmap-cell-marks";
import type { CellDatum } from "./heatmap-cell-data";
import { HEATMAP_CELL_INSET, heatmapHoverStates } from "./heatmap-hover-states";

// Bklit `positionBox`/`HeatmapTooltipPanel` parity: 16px stand-off between
// The hovered cell and the tooltip edge, shared by the native tooltip's
// `offset` option (below) and by legacy-offset call sites elsewhere.
const HEATMAP_TOOLTIP_DEFAULT_OFFSET = 16;

interface HeatmapDefinitionParams {
  readonly cellMarks: readonly Readonly<HeatmapCellMark>[];
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
  readonly colorScale: ScaleOrdinal<number, string>;
  readonly margin: Readonly<HeatmapMargin>;
  readonly chartStatus: ReturnType<typeof useHeatmap>["chartStatus"];
  readonly tooltipEnabled: boolean;
}

interface LoadingHeatmapDefinitionParams {
  readonly cellMarks: readonly Readonly<HeatmapCellMark>[];
  readonly colorScale: ScaleOrdinal<number, string>;
  readonly margin: Readonly<HeatmapMargin>;
  readonly xScale: ScaleBand<string>;
  readonly yScale: ScaleBand<string>;
}

const buildLoadingHeatmapDefinition = ({
  cellMarks,
  colorScale,
  margin,
  xScale,
  yScale,
}: Readonly<LoadingHeatmapDefinitionParams>): DomChartDefinition<Readonly<CellDatum>, string, string> =>
  defineChart({
    // D1: typed off `cellMarks` (not the generic-erased `ReturnType<typeof
    // Cell>[]` this used pre-C5) so this branch's `TDatum` matches the
    // Loaded branch below exactly — `RendererChart`'s strict generic
    // Inference against the full `chartMotionRenderer<CellDatum, string, string>()`
    // Signature (unlike legacy `Chart`) requires both branches' marks
    // Arrays to share the same concrete `CellDatum` element type.
    color: { scale: colorScale },
    // C2: no marks to focus while loading; suppress the native focus
    // Ring for symmetry with the loaded branch below.
    focusRing: false,
    margin,
    marks: [] as typeof cellMarks,
    scales: {
      x: { axis: false, guide: false, scale: xScale },
      y: { axis: false, guide: false, scale: yScale },
    },
    // D1/D5: `svgAnimation` (dist/types.d.ts `ChartDefinitionOptions`) is
    // Only consumed by the static SVG renderer (dist/renderer.js:125,
    // `hasRendered ? resolveAnimation(options.definition.svgAnimation,
    // ...) : void 0`) — dead/inert once this chart is switched to
    // `chartMotionRenderer()` below. Left as `false` (harmless,
    // Unchanged) rather than removed, since it isn't in D5's edit scope.
    svgAnimation: false,
  });

const buildHeatmapTooltipOption = (
  tooltipEnabled: boolean,
): false | {
  className: string;
  motion: false;
  offset: number;
  placement: readonly ["right", "left"];
  sticky: boolean;
  use: typeof tooltip;
} => {
  if (!tooltipEnabled) {return false;}
  const placement: readonly ["right", "left"] = ["right", "left"];
  return {
    // Native tooltip's own default chrome is reset to nothing for
    // This class (styles.css, added alongside this change); the
    // Actual panel chrome is the nested `.bkm-tooltip-panel` div
    // Rendered by `renderTooltipBody` below (bklit parity).
    className: "bkm-native-tooltip",
    // Legacy bklit tooltip has no spring/entrance in the legacy panel's
    // "Instant" mode and C5 owns real motion wiring — snap for now.
    motion: false,
    // Reproduces `HeatmapTooltipPanel`'s flip-when-clipped +
    // Vertical-center placement (right of the cell, flipping left
    // Near the right edge) at the same 16px stand-off.
    offset: HEATMAP_TOOLTIP_DEFAULT_OFFSET,
    placement,
    sticky: false,
    use: tooltip,
  };
};

const useHeatmapDefinition = ({
  cellMarks,
  xScale,
  yScale,
  colorScale,
  margin,
  chartStatus,
  tooltipEnabled,
}: Readonly<HeatmapDefinitionParams>): DomChartDefinition<Readonly<CellDatum>, string, string> => {
  const definition = useMemo(() => {
    if (chartStatus === "loading") {
      return buildLoadingHeatmapDefinition({ cellMarks, colorScale, margin, xScale, yScale });
    }
    return defineChart({
      color: { scale: colorScale },
      // C2: hover is driven by app-owned pointermove -> setControlledFocus
      // (Below), which now actually engages the native focus/tooltip
      // Engine. Suppress the default focus-ring mark — bklit's cell hover
      // Affordance is the scale/opacity/fillOpacity `states` styling above,
      // Not a ring — matching every other migrated chart's
      // `focusRing: false` convention (styles.css:271-280).
      focusRing: false,
      margin,
      marks: cellMarks,
      scales: {
        x: { axis: false, guide: false, scale: xScale },
        y: { axis: false, guide: false, scale: yScale },
      },
      svgAnimation: false,
      tooltip: buildHeatmapTooltipOption(tooltipEnabled),
    });
  }, [cellMarks, xScale, yScale, colorScale, margin, chartStatus, tooltipEnabled]);
  return definition;
};

interface HeatmapHoverStatesHookParams {
  readonly xScale: ScaleBand<string>;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

const useHeatmapHoverStates = ({
  xScale,
  inactiveOpacity,
  inactiveScale,
  activeScale,
}: Readonly<HeatmapHoverStatesHookParams>): HeatmapHoverStateList =>
  // C3: hover highlight/dim as native mark `states`, keyed on the engine's
  // OWN focus resolution (driven by `scheduleFocus` -> `setControlledFocus`
  // Below) rather than React state — the chart definition never needs to
  // Rebuild when the hovered cell changes, only when these style PROPS
  // Change (bandwidth/inactiveOpacity/inactiveScale/activeScale), which is
  // The "cheaper channel-level route" flagged in the mission's performance
  // Note: zero definition rebuilds per hovered cell.
  useMemo(
    () =>
      heatmapHoverStates({
        activeScale,
        bandwidth: xScale.bandwidth(),
        baseInset: HEATMAP_CELL_INSET,
        inactiveOpacity,
        inactiveScale,
      }),
    [xScale, inactiveOpacity, inactiveScale, activeScale],
  );

interface HeatmapChartDefinitionParams {
  readonly cellData: HeatmapCellMarksParams["cellData"];
  readonly columnCount: number;
  readonly dayLabels: readonly string[];
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: Readonly<HeatmapMargin>;
  readonly cornerRadius: number;
  readonly resolvedLevelStyles: HeatmapLevelStyles;
  readonly patternIdPrefix: string | undefined;
  readonly tooltipEnabled: boolean;
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
  readonly rowOpacity: HeatmapRowOpacity;
  readonly revealEpoch: number;
  readonly animationDuration: number;
  readonly enterTransition: Readonly<HeatmapEnterTransition> | undefined;
  readonly enterStaggerScale: number;
  readonly animateCells: boolean;
}

const useHeatmapChartDefinition = ({
  cellData,
  columnCount,
  dayLabels,
  innerWidth,
  innerHeight,
  margin,
  cornerRadius,
  resolvedLevelStyles,
  patternIdPrefix,
  tooltipEnabled,
  inactiveOpacity,
  inactiveScale,
  activeScale,
  rowOpacity,
  revealEpoch,
  animationDuration,
  enterTransition,
  enterStaggerScale,
  animateCells,
}: Readonly<HeatmapChartDefinitionParams>): DomChartDefinition<Readonly<CellDatum>, string, string> => {
  const colorScale = useHeatmapColorScale({ patternIdPrefix, resolvedLevelStyles });

  const { xScale, yScale } = useHeatmapCellScales({ columnCount, dayLabels, innerHeight, innerWidth, margin });

  const hoverStates = useHeatmapHoverStates({ activeScale, inactiveOpacity, inactiveScale, xScale });

  const cellMotion = useHeatmapCellMotion({ animateCells, animationDuration, enterStaggerScale, enterTransition, revealEpoch });

  const cellMarks = useHeatmapCellMarks({ cellData, cellMotion, cornerRadius, hoverStates, resolvedLevelStyles, revealEpoch, rowOpacity });

  return useHeatmapDefinition({ cellMarks, chartStatus: useHeatmap().chartStatus, colorScale, margin, tooltipEnabled, xScale, yScale });
};

const hasPatternLevelStyles = (levelStyles: HeatmapLevelStyles): boolean =>
  levelStyles.some((style: Readonly<HeatmapLevelStyle>) => isHeatmapLevelPattern(style));

export {
  HEATMAP_TOOLTIP_DEFAULT_OFFSET,
  buildHeatmapTooltipOption,
  buildLoadingHeatmapDefinition,
  hasPatternLevelStyles,
  useHeatmapChartDefinition,
  useHeatmapDefinition,
  useHeatmapHoverStates,
};
export type { HeatmapChartDefinitionParams, HeatmapDefinitionParams, HeatmapHoverStatesHookParams, LoadingHeatmapDefinitionParams };
