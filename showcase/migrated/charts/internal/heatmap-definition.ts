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

/*
 * Bklit `positionBox` parity: 16px stand-off shared by the native tooltip offset and legacy call sites.
 */
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
    /*
     * Typed off `cellMarks` so both branches share `CellDatum`: the motion renderer's strict generic requires it.
     */
    color: { scale: colorScale },
    // C2: no marks to focus while loading; suppress the native focus
    // Ring for symmetry with the loaded branch below.
    focusRing: false,
    margin,
    // SAFETY: An empty array inhabits every array type, so the assertion only restores the CellDatum element type erased by the literal and both definition branches share TDatum.
    marks: [] as typeof cellMarks,
    scales: {
      x: { axis: false, guide: false, scale: xScale },
      y: { axis: false, guide: false, scale: yScale },
    },
    /*
     * Dead under `chartMotionRenderer` yet kept as `false`: removal is outside D5's edit scope.
     */
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
    /*
     * Native chrome is reset for this class; the panel chrome is the nested `.bkm-tooltip-panel` div.
     */
    className: "bkm-native-tooltip",
    // Legacy bklit tooltip has no spring/entrance in the legacy panel's
    // "Instant" mode and C5 owns real motion wiring — snap for now.
    motion: false,
    /*
     * Bklit parity: flip-when-clipped vertical-center placement at the shared 16px stand-off.
     */
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
      /*
       * Hover runs through app-owned focus, so suppress the default ring: bklit hover is states styling, not a ring.
       */
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
  /*
   * Hover lives in native mark `states` on engine focus rather than React state, so hovered-cell
   * changes never rebuild the definition.
   */
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
