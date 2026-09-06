// Bklit ScatterChart on TanStack Charts. One disc+ring dot mark per series; no decimation.
import { useCallback } from "react";
import type { ReactElement } from "react";
import { useScatterSeriesSetup } from "./internal/scatter-series-setup";
import { useScatterDomains } from "./internal/scatter-domains-setup";
import { useScatterScales } from "./internal/scatter-scale-setup";
import { useScatterDefinitionModel } from "./internal/scatter-definition-setup";
import { useScatterPhaseModel, useScatterTimingModel } from "./internal/scatter-reveal-setup";
import { useScatterFocusModel } from "./internal/scatter-label-fade";
import { useScatterSelectionModel } from "./internal/scatter-selection-setup";
import { buildScatterChartTree } from "./internal/scatter-chart-view";
import type { ScatterChartProps } from "./internal/scatter-chart-props";
import "./styles.css";

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
  ariaLabel,
  ariaDescription,
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
  const focus = useScatterFocusModel({
    setLabelFade: marks.setLabelFade,
    setPointerFocusActive: marks.setPointerFocusActive,
    tooltip: series.tooltip,
    xDataKey,
  });
  const selection = useScatterSelectionModel({
    aspectRatio, children, data, domains, focus, marks,
    scales, series, timing, xDataKey,
  });
  // Host-owned sizing: the host adopts the measured width through this render callback.
  const { handleRender: timingHandleRender } = timing;
  const { adoptWidth: adoptSeriesWidth } = series;
  const handleHostRender = useCallback((context: Parameters<typeof timingHandleRender>[0]): void => {
    timingHandleRender(context);
    adoptSeriesWidth(context.scene.width);
  }, [timingHandleRender, adoptSeriesWidth]);
  return (
    <>
      {buildScatterChartTree({
        ariaDescription, ariaLabel, className, focus, marks, refAreas: selection,
        selection, series, timing: { handleRender: handleHostRender },
      })}
    </>
  );
};

export { DEFAULT_SCATTER_COLORS } from "./internal/scatter-series-setup";
export type { ScatterChartProps } from "./internal/scatter-chart-props";
export { ScatterChart };
