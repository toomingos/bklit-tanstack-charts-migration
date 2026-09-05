// Bklit ScatterChart on TanStack Charts. One disc+ring dot mark per series; no decimation.
import type { ReactElement } from "react";
import { useScatterSeriesSetup } from "./internal/scatter-series-setup";
import { useScatterDomains } from "./internal/scatter-domains-setup";
import { useScatterScales } from "./internal/scatter-scale-setup";
import { useScatterDefinitionModel } from "./internal/scatter-definition-setup";
import { useScatterPhaseModel, useScatterTimingModel } from "./internal/scatter-reveal-setup";
import { useScatterPillModel } from "./internal/scatter-pill-setup";
import { useScatterSelectionModel } from "./internal/scatter-selection-setup";
import { buildScatterChartTree } from "./internal/scatter-chart-view";
import type { ScatterChartProps } from "./internal/scatter-chart-props";

const ScatterChart = ({
  data,
  xDataKey = "date",
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
}: Readonly<ScatterChartProps>): ReactElement => {
  const series = useScatterSeriesSetup({ children });
  const domains = useScatterDomains({ data, resolvedSeries: series.resolvedSeries });
  const scales = useScatterScales({
    renderData: data, xAxis: series.xAxis, xDataKey,
    xRangePadding: series.xRangePadding, yDomain: domains.yDomain,
  });
  const phase = useScatterPhaseModel({ onPhaseChange });
  const timing = useScatterTimingModel({
    animationDuration, animationEasing, enterTransition, phase, revealSignature,
  });
  const marks = useScatterDefinitionModel({
    data, domains, marginProp, scales, scatterFocusStrategy: phase.scatterFocusStrategy,
    series, timing, xDataKey,
  });
  const pill = useScatterPillModel({
    renderData: data, setLabelFade: marks.setLabelFade,
    setPointerFocusActive: marks.setPointerFocusActive,
    tickerHalfWidth: series.xAxis?.tickerHalfWidth, tooltip: series.tooltip,
    tooltipSpring: marks.tooltipSpring, width: series.width, xDataKey,
  });
  const selection = useScatterSelectionModel({
    aspectRatio, children, data, domains, marks,
    pill, scales, series, timing, xDataKey,
  });
  return (
    <>
      {buildScatterChartTree({
        className, marks, pill, refAreas: selection,
        selection, series, timing,
      })}
    </>
  );
};

export { DEFAULT_SCATTER_COLORS } from "./internal/scatter-series-setup";
export type { ScatterChartProps } from "./internal/scatter-chart-props";
export { ScatterChart };
