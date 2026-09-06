import { useCallback, useMemo } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { ChartRenderer } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { useChartSelection } from "./chart-selection";
import { useChartRenderer } from "./motion-renderer";
import { useScatterTooltipBody } from "./scatter-tooltip-body";
import type { ScatterDomains } from "./scatter-domains-setup";
import type { ScatterScales } from "./scatter-scale-setup";
import type { ScatterSeriesSetup } from "./scatter-series-setup";
import type { ScatterDefinitionModel } from "./scatter-definition-setup";
import type { ScatterFocusModel, ScatterLabelFadeChrome } from "./scatter-label-fade";
import type { ScatterTimingModel } from "./scatter-reveal-setup";
import { extractReferenceAreaProps } from "./reference-area-config";
import { parseAspectRatio } from "./parse-aspect-ratio";
import { toIndicatorConfig } from "./tooltip-mappers";
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from "./fade-mask";
import type { IndicatorFadeGradientStop } from "./fade-mask";
import { isString } from "./scatter-datum-utils";
import type { ScatterTimeExtent, ScatterYGradientDef } from "./scatter-datum-utils";
import type { ResolvedSeries } from "./scatter-marks";
import type { FocusInjection } from "./focus-injection";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { ChartMargin } from "./use-chart-margin";

// Default crosshair edge-fade length when the indicator config omits it.
const SCATTER_FADE_LENGTH_DEFAULT = 10;

const buildScatterYGradientDefs = (
  resolvedSeries: readonly Readonly<ResolvedSeries>[],
): readonly ScatterYGradientDef[] =>
  resolvedSeries
    .filter((series): series is ResolvedSeries & { readonly yGradId: string } => series.useYGradient && series.yGradId !== undefined)
    .map((series) => ({ from: series.yGradFrom, id: series.yGradId, to: series.yGradTo }));

const buildCrosshairFadeGradient = (
  tooltip: ExtractedChildren["tooltip"],
  crosshairGradientId: string,
): { color: string; id: string; stops: IndicatorFadeGradientStop[] } | undefined => {
  if (!(tooltip?.enabled ?? false) || !(tooltip?.showCrosshair ?? true)) {return undefined;}
  const indicatorCfg = toIndicatorConfig(tooltip);
  if (indicatorCfg.dasharray !== undefined && indicatorCfg.dasharray !== "") {return undefined;}
  const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
  if (!fadeSides.any) {return undefined;}
  const colorValue = isString(indicatorCfg.color) ? indicatorCfg.color : "var(--chart-crosshair)";
  return {
    color: colorValue,
    id: crosshairGradientId,
    stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? SCATTER_FADE_LENGTH_DEFAULT),
  };
};

interface UseScatterChartSelectionParams {
  readonly clientToScene: FocusInjection<ChartDatum, Date, number>["clientToScene"];
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly dragSelectionActiveRef: RefObject<boolean>;
  readonly margin: ChartMargin;
  readonly labelFadeRef: RefObject<ScatterLabelFadeChrome | null>;
  readonly renderData: ChartDatum[];
  readonly sceneRef: FocusInjection<ChartDatum, Date, number>["sceneRef"];
  readonly width: number;
  readonly xDataKey: string;
}

interface ScatterChartSelection {
  readonly scatterChartRenderer: ChartRenderer<ChartDatum, Date, number>;
  readonly scatterSelection: ReturnType<typeof useChartSelection>["selection"];
}

const useScatterChartSelection = ({
  clientToScene,
  containerRef,
  dragSelectionActiveRef,
  margin,
  labelFadeRef,
  renderData,
  sceneRef,
  width,
  xDataKey,
}: Readonly<UseScatterChartSelectionParams>): ScatterChartSelection => {
  const innerWidthSelection = Math.max(0, width - margin.left - margin.right);

  const invertSceneXScatter = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );

  const { selection: scatterSelection } = useChartSelection({
    containerRef,
    data: renderData,
    enabled: true,
    innerWidth: innerWidthSelection,
    invertSceneX: invertSceneXScatter,
    marginLeft: margin.left,
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      labelFadeRef.current?.update([]);
    },
    resolveScenePos: clientToScene,
    xDataKey,
  });
  const scatterChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderData.length);
  return { scatterChartRenderer, scatterSelection };
};

interface UseScatterReferenceAreasParams {
  readonly aspectRatio: string;
  readonly children: ReactNode;
  readonly crosshairGradientId: string;
  readonly margin: ChartMargin;
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly nicedYDomain: [number, number];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly timeExtent: ScatterTimeExtent | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly width: number;
  readonly xRangePadding: number;
}

interface ScatterReferenceAreas {
  readonly containerStyle: CSSProperties;
  readonly crosshairFade: { color: string; id: string; stops: IndicatorFadeGradientStop[] } | undefined;
  readonly parsedAspectRatio: number;
  readonly refAreaChildren: ReturnType<typeof extractReferenceAreaProps>;
  readonly refAreaGeom: {
    readonly xDomain: [Date, Date] | undefined;
    readonly yDomain: [number, number];
    readonly yDomainsByAxis: Record<string, [number, number]>;
  };
  readonly xDomain: [Date, Date] | undefined;
  readonly yGradientDefs: readonly ScatterYGradientDef[];
}

const useScatterReferenceAreas = ({
  aspectRatio,
  children,
  crosshairGradientId,
  nicedDomainsByAxis,
  nicedYDomain,
  resolvedSeries,
  timeExtent,
  tooltip,
}: Readonly<UseScatterReferenceAreasParams>): ScatterReferenceAreas => {
  const refAreaChildren = useMemo(() => extractReferenceAreaProps(children), [children]);
  const yGradientDefs = useMemo<readonly ScatterYGradientDef[]>(
    () => buildScatterYGradientDefs(resolvedSeries),
    [resolvedSeries],
  );

  const crosshairFade = useMemo((): { color: string; id: string; stops: IndicatorFadeGradientStop[] } | undefined =>
    buildCrosshairFadeGradient(tooltip, crosshairGradientId), [tooltip, crosshairGradientId]);

  const containerStyle = useMemo<CSSProperties>(
    () => ({ aspectRatio, isolation: "isolate", position: "relative", touchAction: "none", width: "100%" }),
    [aspectRatio],
  );
  const parsedAspectRatio = parseAspectRatio(aspectRatio);

  const xDomain: [Date, Date] | undefined = useMemo(
    () => timeExtent ? [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)] : undefined,
    [timeExtent],
  );
  const refAreaGeom = useMemo(() => ({
    xDomain,
    // Reference areas read the NICED domain the dots paint in, not raw yDomain.
    yDomain: nicedYDomain,
    yDomainsByAxis: nicedDomainsByAxis,
  }), [nicedDomainsByAxis, nicedYDomain, xDomain]);
  return { containerStyle, crosshairFade, parsedAspectRatio, refAreaChildren, refAreaGeom, xDomain, yGradientDefs };
};

interface UseScatterSelectionModelParams {
  readonly aspectRatio: string;
  readonly children: ReactNode;
  readonly data: ChartDatum[];
  readonly domains: ScatterDomains;
  readonly marks: Pick<ScatterDefinitionModel, "margin">;
  readonly focus: Pick<ScatterFocusModel, "dragSelectionActiveRef" | "labelFadeRef">;
  readonly scales: Pick<ScatterScales, "timeExtent">;
  readonly series: Pick<ScatterSeriesSetup, "containerRef" | "crosshairGradientId" | "resolvedSeries" | "tooltip" | "width" | "xRangePadding">;
  readonly timing: Pick<ScatterTimingModel, "clientToScene" | "sceneRef">;
  readonly xDataKey: string;
}

interface ScatterSelectionModel extends ScatterChartSelection, ScatterReferenceAreas {
  readonly renderTooltipBody: (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>) => ReactNode;
  readonly tooltipEnabled: boolean;
}

const useScatterSelectionModel = ({
  aspectRatio,
  children,
  data,
  domains,
  marks,
  focus,
  scales,
  series,
  timing,
  xDataKey,
}: Readonly<UseScatterSelectionModelParams>): ScatterSelectionModel => {
  const chartSelection = useScatterChartSelection({
    clientToScene: timing.clientToScene,
    containerRef: series.containerRef,
    dragSelectionActiveRef: focus.dragSelectionActiveRef,
    labelFadeRef: focus.labelFadeRef,
    margin: marks.margin,
    renderData: data,
    sceneRef: timing.sceneRef,
    width: series.width,
    xDataKey,
  });
  const referenceAreas = useScatterReferenceAreas({
    aspectRatio,
    children,
    crosshairGradientId: series.crosshairGradientId,
    margin: marks.margin,
    nicedDomainsByAxis: domains.nicedDomainsByAxis,
    nicedYDomain: domains.nicedYDomain,
    resolvedSeries: series.resolvedSeries,
    timeExtent: scales.timeExtent,
    tooltip: series.tooltip,
    width: series.width,
    xRangePadding: series.xRangePadding,
  });
  const tooltipBody = useScatterTooltipBody({
    resolvedSeries: series.resolvedSeries,
    tooltip: series.tooltip,
    xDataKey,
  });
  return { ...chartSelection, ...referenceAreas, ...tooltipBody };
};

export { buildCrosshairFadeGradient, buildScatterYGradientDefs, useScatterChartSelection, useScatterReferenceAreas, useScatterSelectionModel };
export type { ScatterChartSelection, ScatterReferenceAreas, ScatterSelectionModel, UseScatterChartSelectionParams, UseScatterReferenceAreasParams, UseScatterSelectionModelParams };
