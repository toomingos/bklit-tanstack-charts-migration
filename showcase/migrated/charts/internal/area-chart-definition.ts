// Area chart definition builder: assembles the TanStack definition from resolved model state.
// Each branching ladder is a named helper; verbatim logic otherwise.
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import type { RefObject } from "react";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip as packageTooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import type {
  ChartAxisTickLabelContext,
  ChartControl,
  ChartMark,
  ChartMotionContext,
  ChartMotionTiming,
  ChartPositionScaleOptions,
  ChartScale,
  ChartScaleResolveContext,
  ChartTooltipInput,
  DomChartDefinition,
} from "@tanstack/charts";
import { toDate } from "./coerce-date";
import {
  buildPrecomputedXAxisOptions,
  buildXAxisTickValues,
  buildYAxisOptions,
  hiddenAxisOptions,
  tickLabelFadeOpacity,
} from "./axis-ticks";
import { CARTESIAN_MAX_FOCUS_DISTANCE_PX } from "./cartesian-focus-distance";
import { bezierEasing } from "./bezier-easing";
import { resolveGridGuide } from "./grid";
import { shortDateFmt } from "./formatters";
import {
  DISCRETE_INTERACTION_THRESHOLD,
  BOX_OFFSET,
  FADE_BUFFER,
  TICKER_HALF_WIDTH,
  TOOLTIP_BOX_SPRING,
} from "./design-tokens";
import { DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";
import type { MarkerSeriesConfig } from "./series-marker-mark";
import { projectionLineMark } from "./projection-line-mark";
import type {
  AreaConfig,
  ChartDatum,
  ExtractedChildren,
  ProjectionLineChildConfig,
} from "./types";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartMargin } from "./use-chart-margin";
import {
  DEFAULT_PROJECTION_STROKE_WIDTH_PX,
  DEFAULT_TERMINAL_MARKER_RADIUS_PX,
  DEFAULT_TICK_COUNT,
  PROJECTION_FALLBACK_STROKE,
} from "./area-chart-model";
import type {
  NativeAreaGradient,
  ReadonlyResolvedArea,
  ResolvedPatternArea,
  TimeExtentMs,
} from "./area-chart-model";
import {
  buildAreaHighlightMarks,
  buildAreaHoverDotMarks,
  buildAreaSeriesMarks,
  buildAreaIndicatorMarks,
  buildPatternAreaMarks,
} from "./area-chart-marks";

interface AreaLabelFade {
  readonly hoveredLabel: string | undefined;
  readonly primaryX: number;
}

interface AreaChartDefinitionParams {
  readonly areaMarkerConfigs: readonly Readonly<MarkerSeriesConfig>[];
  readonly areaMarkerGradientIdByKey: Readonly<Map<string, string>>;
  readonly areas: readonly Readonly<AreaConfig>[];
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly chartPhase: ChartPhase;
  readonly crosshairGradientId: string;
  readonly effectiveYDomainTweenDuration: number;
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly grid: ExtractedChildren["grid"];
  readonly heightPx: number;
  readonly hoveredIndex: number | undefined;
  readonly isDiscrete: boolean;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;
  readonly labelFade: Readonly<AreaLabelFade> | undefined;
  readonly legendHoveredIndex: number | null | undefined;
  readonly margin: Readonly<ChartMargin>;
  readonly nativeAreaGradients: readonly Readonly<NativeAreaGradient>[];
  readonly patternIdByKey: Readonly<Map<string, string>>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly resolvedPatternAreas: readonly Readonly<ResolvedPatternArea>[];
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly timeExtentRaw: Readonly<TimeExtentMs> | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
  readonly yAxis: ExtractedChildren["yAxis"];
  readonly yDomainChanged: boolean;
  readonly yDomainFinal: readonly [number, number];
}

interface AreaLoadingDefinitionParams {
  readonly grid: ExtractedChildren["grid"];
  readonly margin: Readonly<ChartMargin>;
  readonly yDomainFinal: readonly [number, number];
}

// Loading shell: empty marks over the loading grid guide (bklit shells its own gridlines).
const buildAreaLoadingDefinition = (params: Readonly<AreaLoadingDefinitionParams>): DomChartDefinition<ChartDatum, Date, number> => {
  const gridGuide = resolveGridGuide(params.grid);
  const emptyMarks: ChartMark<ChartDatum, Date, number>[] = [];
  return defineChart({
    focus: "group-x",
    // Bklit has no focus ring; the hover dot is the indicator.
    focusRing: false,
    margin: params.margin,
    marks: emptyMarks,
    maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
    scales: {
      x: {
        axis: { line: false, tickLabels: false, ticks: { count: gridGuide.columnTicks, size: 0 } },
        grid: gridGuide.vertical,
        scale: scaleUtc,
      },
      y: {
        axis: hiddenAxisOptions(gridGuide.ticks),
        grid: gridGuide.horizontal,
        scale: scaleLinear().domain(params.yDomainFinal),
      },
    },
    svgAnimation: false,
  });
};

// First matching legend key: null/undefined hover means no dim.
const resolveLegendHoveredKey = (
  areas: readonly Readonly<AreaConfig>[],
  legendHoveredIndex: number | null | undefined,
): string | undefined =>
  legendHoveredIndex === null || legendHoveredIndex === undefined
    ? undefined
    : (areas[legendHoveredIndex]?.dataKey ?? undefined);

interface AreaProjectionMarkFrame {
  readonly baseId: string;
  readonly config: Readonly<ProjectionLineConfig>;
  readonly index: number;
  readonly isLoading: boolean;
  readonly line: Readonly<ProjectionLineChildConfig> | undefined;
}

// One projection line mark; undefined when the line has fewer than two points.
// The index-alignment guard stays: configs and lines walk `children` via separate extractors.
const resolveAreaProjectionMark = (frame: Readonly<AreaProjectionMarkFrame>): ChartMark<ChartDatum, Date, number> | undefined => {
  const { line } = frame;
  const stroke = line?.stroke ?? PROJECTION_FALLBACK_STROKE;
  const gid = `${frame.baseId}-proj-${frame.index}`;
  if (!line || frame.config.data.length < 2) {return undefined;}
  return projectionLineMark({
    className: line.className ?? "chart-projection-line",
    curveKind: line.curveKind ?? "linear",
    data: frame.config.data,
    endpointRadius: line.endpointRadius ?? DEFAULT_TERMINAL_MARKER_RADIUS_PX,
    gradientEnd: line.gradientEnd ?? "var(--chart-5)",
    gradientId: gid,
    gradientStart: line.gradientStart ?? stroke,
    id: `projection-line-${frame.index}`,
    showEndMarker: line.showEndMarker ?? line.showEndpoints ?? true,
    stroke,
    strokeDasharray: line.strokeDasharray ?? "6,4",
    strokeOpacity: line.strokeOpacity ?? 1,
    strokeStyle: line.strokeStyle ?? "solid",
    strokeVisible: !frame.isLoading,
    strokeWidth: line.strokeWidth ?? DEFAULT_PROJECTION_STROKE_WIDTH_PX,
    yAxisId: frame.config.yAxisId,
    yFallbackZero: true,
  });
};

interface AreaProjectionMarksParams {
  readonly configs: readonly Readonly<ProjectionLineConfig>[];
  readonly heightPx: number;
  readonly isLoading: boolean;
  readonly lines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly projectionGradientBaseId: string;
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly timeExtentRaw: Readonly<TimeExtentMs> | undefined;
  readonly width: number;
}

// Projection tail marks clamp to the plot rect; skipped when the plot has no area.
const buildAreaProjectionMarks = (params: Readonly<AreaProjectionMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (params.configs.length === 0) {return [];}
  const { timeExtent, timeExtentRaw } = params;
  if (params.width <= 0 || params.heightPx <= 0 || !timeExtent || !timeExtentRaw) {return [];}
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const [index, config] of params.configs.entries()) {
    // Defensive runtime check: projectionConfigs and projectionLines walk `children` via separate
    // Extractors; nothing statically guarantees they stay index-aligned in length.
    const mark = resolveAreaProjectionMark({
      baseId: params.projectionGradientBaseId,
      config,
      index,
      isLoading: params.isLoading,
      line: params.lines.at(index),
    });
    if (mark) {marks.push(mark);}
  }
  return marks;
};

interface AreaXTickListParams {
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tickCount: number | undefined;
  readonly timeExtentMaxTime: number;
  readonly timeExtentMinTime: number;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
}

interface AreaXTickValue {
  readonly label: string;
  readonly value: Date;
}

// X tick ladder: configured axes precompute ticks; otherwise d3 ticks with ISO labels.
const resolveAreaXTickList = (params: Readonly<AreaXTickListParams>): readonly AreaXTickValue[] => {
  if (!params.xAxis) {
    return scaleUtc().domain([params.timeExtentMinTime, params.timeExtentMaxTime]).range([params.rangeStart, params.rangeEnd]).ticks(params.tickCount).map((value: Date) => ({ label: value.toISOString(), value }));
  }
  return buildXAxisTickValues({
    data: params.xDomain ? params.visibleData : params.renderData,
    domainMaxTime: params.timeExtentMaxTime,
    formatValue: params.xAxis.formatValue,
    numTicks: params.xAxis.numTicks ?? DEFAULT_TICK_COUNT,
    rangeEnd: params.rangeEnd,
    rangeStart: params.rangeStart,
    tickMode: params.xAxis.tickMode,
    xDataKey: params.xDataKey,
    xDomain: params.xDomain,
  });
};

interface AreaXScaleParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly timeExtentMaxTime: number | undefined;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly xScaleRef: RefObject<ScaleTime<number, number> | null>;
}

const buildAreaXScale = (params: Readonly<AreaXScaleParams>): ChartScale => ({
  id: "x",
  resolve(context: Readonly<ChartScaleResolveContext>) {
    const [r0, r1] = context.range;
    if (!params.timeExtent) {
      const base = scaleUtc().domain([0, 0]).range([r0, r1]);
      params.xScaleRef.current = base;
      return {
        bandwidth: 0,
        domain: base.domain(),
        id: context.id,
        map: (value) => {
          const date = toDate(value);
          if (date === null) {return Number.NaN;}
          return base(date);
        },
        ticks: [],
        type: "time" as const,
      };
    }
    const base = scaleUtc().domain([params.timeExtent.minTime, params.timeExtent.maxTime]).range([r0, r1]);
    params.xScaleRef.current = base;
    const tickList = resolveAreaXTickList({
      rangeEnd: r1,
      rangeStart: r0,
      renderData: params.renderData,
      tickCount: context.tickCount,
      timeExtentMaxTime: params.timeExtentMaxTime ?? params.timeExtent.maxTime,
      timeExtentMinTime: params.timeExtent.minTime,
      visibleData: params.visibleData,
      xAxis: params.xAxis,
      xDataKey: params.xDataKey,
      xDomain: params.xDomain,
    });
    return {
      bandwidth: 0,
      domain: base.domain(),
      id: context.id,
      map: (value) => {
        const date = toDate(value);
        if (date === null) {return Number.NaN;}
        return base(date);
      },
      ticks: tickList.map((tick) => ({
        label: tick.label,
        position: base(tick.value),
        value: tick.value,
      })),
      type: "time" as const,
    };
  },
});

type AreaTickLabelOpacity = number | ((context: ChartAxisTickLabelContext<Date>) => number);

interface AreaTickLabelOpacityParams {
  readonly labelFade: Readonly<AreaLabelFade> | undefined;
  readonly xAxis: ExtractedChildren["xAxis"];
}

// Hovered date fades neighbouring x labels; no hover means full opacity.
const resolveAreaXTickLabelOpacity = (params: Readonly<AreaTickLabelOpacityParams>): AreaTickLabelOpacity => {
  if (!params.labelFade) {return 1;}
  const { labelFade, xAxis } = params;
  return (ctx: ChartAxisTickLabelContext<Date>): number =>
    tickLabelFadeOpacity({
      fadeBuffer: FADE_BUFFER,
      hoveredLabel: labelFade.hoveredLabel ?? null,
      labelText: xAxis?.formatValue ? xAxis.formatValue(ctx.value) : shortDateFmt.format(ctx.value),
      labelX: ctx.position,
      primaryX: labelFade.primaryX,
      tickerHalfWidth: xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
    });
};

interface AreaMotionParams {
  readonly effectiveYDomainTweenDuration: number;
  readonly yDomainTweenGateActive: boolean;
}

type AreaMotionFn = (context: ChartMotionContext) => false | ChartMotionTiming | undefined;

// Enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
const buildAreaMotionFn = (params: Readonly<AreaMotionParams>): AreaMotionFn =>
  (context: ChartMotionContext): false | ChartMotionTiming | undefined => {
    if (context.role === "line" || context.role === "area" || context.role === "dot") {
      if (context.phase === "enter") {return false as const;}
      if (context.phase === "update") {
        return params.yDomainTweenGateActive
          ? {
              transition: {
                duration: params.effectiveYDomainTweenDuration,
                easing: bezierEasing,
                type: "tween" as const,
              },
            }
          : (false as const);
      }
    }
    return undefined;
  };

// Label position tween returns via tickLabels.motion (native text has no CSS left/top).
const buildAreaTickLabelMotionFn = (): AreaMotionFn =>
  (context: ChartMotionContext): false | ChartMotionTiming | undefined =>
    context.phase === "enter"
      ? (false as const)
      : {
          transition: {
            duration: DEFAULT_Y_DOMAIN_TWEEN_MS,
            easing: bezierEasing,
            type: "tween" as const,
          },
        };

interface AreaScaleOptionsParams {
  readonly grid: ExtractedChildren["grid"];
  readonly heightPx: number;
  readonly labelFade: Readonly<AreaLabelFade> | undefined;
  readonly margin: Readonly<ChartMargin>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly visibleData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xAccessor: (datum: Readonly<ChartDatum>) => Date;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly xScaleD3Ref: RefObject<ScaleTime<number, number> | null>;
  readonly yAxis: ExtractedChildren["yAxis"];
  readonly yDomainFinal: readonly [number, number];
}

interface AreaScaleOptions {
  readonly xScaleOptions: ChartPositionScaleOptions<Date>;
  readonly yScaleOptions: ChartPositionScaleOptions<number>;
}

// Native y ticks follow bklit's niced-domain clamp; the grid follows the label ticks.
const buildAreaScaleOptions = (params: Readonly<AreaScaleOptionsParams>): AreaScaleOptions => {
  const gridGuide = resolveGridGuide(params.grid);
  const tickLabelMotion = buildAreaTickLabelMotionFn();
  const xScaleOptions: ChartPositionScaleOptions<Date> = {
    axis: buildPrecomputedXAxisOptions({
      columnTicks: gridGuide.columnTicks,
      marginBottom: params.margin.bottom,
      tickLabelMotion,
      xAxis: params.xAxis ?? undefined,
      xTickLabelOpacity: resolveAreaXTickLabelOpacity({ labelFade: params.labelFade, xAxis: params.xAxis }),
    }),
    grid: gridGuide.vertical,
    scale: buildAreaXScale({
      renderData: params.renderData,
      timeExtent: params.timeExtent,
      timeExtentMaxTime: params.timeExtent?.maxTime,
      visibleData: params.visibleData,
      xAxis: params.xAxis,
      xDataKey: params.xDataKey,
      xDomain: params.xDomain,
      xScaleRef: params.xScaleD3Ref,
    }),
  };
  const yScaleOptions: ChartPositionScaleOptions<number> = params.yAxis
    ? buildYAxisOptions({
      gridHorizontal: gridGuide.horizontal,
      scale: scaleLinear().domain(params.yDomainFinal),
      tickLabelMotion,
      yAxis: params.yAxis,
      yDomainForTicks: params.yDomainFinal,
    })
    : {
        axis: hiddenAxisOptions(gridGuide.ticks),
        grid: gridGuide.horizontal,
        scale: scaleLinear().domain(params.yDomainFinal),
      };
  return { xScaleOptions, yScaleOptions };
};

interface AreaTooltipOptionParams {
  readonly discrete: boolean;
  readonly enabled: boolean;
}

// Panel top pins to the plot top; the x follows the primary focused point.
const buildAreaTooltipOption = ({ discrete, enabled }: Readonly<AreaTooltipOptionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  if (!enabled) {return false;}
  return {
    anchor: (_points, context) => ({
      x: context.focus.primary.x,
      y: context.plot.y - BOX_OFFSET,
    }),
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: TOOLTIP_BOX_SPRING.damping, stiffness: TOOLTIP_BOX_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: packageTooltip,
  };
};

const buildAreaChartDefinition = (params: Readonly<AreaChartDefinitionParams>): DomChartDefinition<ChartDatum, Date, number> | undefined => {
  if (params.isLoading) {
    return buildAreaLoadingDefinition({ grid: params.grid, margin: params.margin, yDomainFinal: params.yDomainFinal });
  }
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  const legendHoveredKey = resolveLegendHoveredKey(params.areas, params.legendHoveredIndex);
  const pointerHoverDimmed = params.tooltipEnabled && params.hoveredIndex !== undefined;
  marks.push(
    ...buildPatternAreaMarks({
      patternIdByKey: params.patternIdByKey,
      renderData: params.renderData,
      resolvedPatternAreas: params.resolvedPatternAreas,
      xAccessor: params.xAccessor,
    }),
    ...buildAreaSeriesMarks({
      areaMarkerConfigs: params.areaMarkerConfigs,
      areaMarkerGradientIdByKey: params.areaMarkerGradientIdByKey,
      gradientIdBySeries: params.gradientIdBySeries,
      legendHoveredKey,
      pointerHoverDimmed,
      projectorFor: params.projectorFor,
      renderData: params.renderData,
      resolvedAreas: params.resolvedAreas,
      xAccessor: params.xAccessor,
      xDataKey: params.xDataKey,
    }),
    ...buildAreaIndicatorMarks({
      crosshairGradientId: params.crosshairGradientId,
      hoveredIndex: params.hoveredIndex,
      isDiscrete: params.isDiscrete,
      projectorFor: params.projectorFor,
      renderData: params.renderData,
      resolvedAreas: params.resolvedAreas,
      tooltip: params.tooltip,
      tooltipEnabled: params.tooltipEnabled,
      xDataKey: params.xDataKey,
    }),
    ...buildAreaHoverDotMarks({
      isDiscrete: params.isDiscrete,
      projectorFor: params.projectorFor,
      renderData: params.renderData,
      resolvedAreas: params.resolvedAreas,
      tooltip: params.tooltip,
      tooltipEnabled: params.tooltipEnabled,
      xDataKey: params.xDataKey,
    }),
    ...buildAreaHighlightMarks({
      hoveredIndex: params.hoveredIndex,
      isDiscrete: params.isDiscrete,
      renderData: params.renderData,
      resolvedAreas: params.resolvedAreas,
      tooltipEnabled: params.tooltipEnabled,
      xDataKey: params.xDataKey,
    }),
    ...buildAreaProjectionMarks({
      configs: params.projectionConfigs,
      heightPx: params.heightPx,
      isLoading: params.isLoading,
      lines: params.projectionLines,
      projectionGradientBaseId: params.projectionGradientBaseId,
      timeExtent: params.timeExtent,
      timeExtentRaw: params.timeExtentRaw,
      width: params.width,
    }),
  );
  // Enter is false (RevealWipe owns it); update tweens only on y-domain change, else snaps.
  const yDomainTweenGateActive = isChartInteractionPhase(params.chartPhase) && params.isLoaded && params.yDomainChanged;
  const { xScaleOptions, yScaleOptions } = buildAreaScaleOptions({
    grid: params.grid,
    heightPx: params.heightPx,
    labelFade: params.labelFade,
    margin: params.margin,
    renderData: params.renderData,
    timeExtent: params.timeExtent,
    visibleData: params.visibleData,
    width: params.width,
    xAccessor: params.xAccessor,
    xAxis: params.xAxis,
    xDataKey: params.xDataKey,
    xDomain: params.xDomain,
    xScaleD3Ref: params.xScaleD3Ref,
    yAxis: params.yAxis,
    yDomainFinal: params.yDomainFinal,
  });
  return defineChart({
    controls: params.brushControls,
    focus: "group-x",
    focusRing: false,
    gradients: params.nativeAreaGradients,
    margin: params.margin,
    marks,
    // Hover works anywhere over the plot; TanStack defaults to 48px.
    maxFocusDistance: CARTESIAN_MAX_FOCUS_DISTANCE_PX,
    motion: buildAreaMotionFn({ effectiveYDomainTweenDuration: params.effectiveYDomainTweenDuration, yDomainTweenGateActive }),
    // Tick counts reach guides only via axis.ticks.count; a bare ticks: key is never read.
    scales: {
      x: xScaleOptions,
      y: yScaleOptions,
    },
    svgAnimation: yDomainTweenGateActive
      ? { duration: params.effectiveYDomainTweenDuration, easing: bezierEasing }
      : (false as const),
    theme: { muted: "var(--color-chart-label, var(--chart-label))" },
    tooltip: buildAreaTooltipOption({
      discrete: params.renderData.length > DISCRETE_INTERACTION_THRESHOLD,
      enabled: params.tooltip?.enabled ?? false,
    }),
  });
};


export { buildAreaChartDefinition };
export type { AreaChartDefinitionParams, AreaLabelFade };
