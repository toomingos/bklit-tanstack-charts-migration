import { curveNatural } from "d3-shape";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { lineY } from "@tanstack/charts/line";
import type { ChartMark } from "@tanstack/charts";
import { resolveDashTailBounds } from "./dash-tail";
import {
  buildHoverDotMark,
  buildIndicatorMark,
  formatShortDateLabel,
  pointerSeriesDimStates,
  resolveHoverDotFill,
} from "./focus-marks";
import { buildHighlightBandMarks } from "./highlight-band";
import { buildMarkerMarks } from "./series-marker-mark";
import type { MarkerSeriesConfig } from "./series-marker-mark";
import type {
  ChartDatum,
  ChartTooltipConfig,
  LineConfig,
} from "./types";

// Bklit parity: legend/series dim opacity is a flat 0.3, not a focus-driven ramp.
const LEGEND_DIM_OPACITY = 0.3;

// I/O-boundary guards for untyped reads: row values are unknown by the
// ChartDatum contract, so these predicates are the parsers the check sites call.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value>(value: Value): value is Value & string => typeof value === "string";

// Legend-dimmed series render at flat opacity; dash tails hide the line entirely.
const resolveLineStrokeOpacity = (hasDashTail: boolean, legendDimmed: boolean): number | undefined => {
  if (hasDashTail) {
    return 0;
  }
  if (legendDimmed) {
    return LEGEND_DIM_OPACITY;
  }
  return undefined;
};

interface BaseSeriesMarksParams {
  readonly defaultStroke: string;
  readonly defaultStrokeWidth: number;
  readonly legendDimOpacity: number;
  readonly legendHoveredKey: string | undefined;
  readonly lines: readonly Readonly<LineConfig>[];
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

const buildBaseSeriesMarks = (params: Readonly<BaseSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => params.lines.map((line: Readonly<LineConfig>) => {
  const hasDashTail = resolveDashTailBounds(line.dashFromIndex, params.renderData.length);
  const legendDimmed = Boolean(params.legendHoveredKey) && params.legendHoveredKey !== line.dataKey;
  const projectY = params.projectorFor(line.yAxisId);
  const strokeOpacity = resolveLineStrokeOpacity(hasDashTail, legendDimmed);
  // Single opacity slot: legend dim already sets strokeOpacity, so the
  // Pointer state must stay off or the two compound (0.09, not 0.3).
  const states = legendDimmed ? [] : pointerSeriesDimStates<ChartDatum>(params.legendDimOpacity);
  return lineY(params.renderData, {
    curve: d3Curve(line.curve ?? curveNatural),
    id: line.dataKey,
    states,
    stroke: hasDashTail ? "transparent" : line.stroke,
    strokeOpacity,
    strokeWidth: line.strokeWidth ?? params.defaultStrokeWidth,
    x: (datum: Readonly<ChartDatum>): Date | null | undefined => {
      const rawX = datum[params.xDataKey];
      return rawX instanceof Date ? rawX : undefined;
    },
    y: (datum: Readonly<ChartDatum>): number | null | undefined => {
      const rawY = datum[line.dataKey];
      return isNumber(rawY) ? projectY(rawY) : undefined;
    },
    // Z carries series identity; without it group-x focus dedupes to one series.
    z: () => line.dataKey,
  });
});

interface MarkerDotMarksParams {
  readonly hasHover: boolean;
  readonly legendHoveredKey: string | undefined;
  readonly markerGradientIdByKey: Readonly<Map<string, string>>;
  readonly markerSeriesConfigs: readonly Readonly<MarkerSeriesConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
}

// Null y values produce no marker dot (bklit series-markers.tsx:107-120).
const buildMarkerDotMarks = (params: Readonly<MarkerDotMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!params.markerSeriesConfigs.some((seriesConfig) => seriesConfig.showMarkers ?? false)) {
    return [];
  }
  return buildMarkerMarks({ gradientIdByKey: params.markerGradientIdByKey, legendHoveredKey: params.legendHoveredKey, pointerFocusActive: params.hasHover, renderData: params.renderData, series: params.markerSeriesConfigs, xDataKey: params.xDataKey });
};

interface TooltipChromeMarksParams {
  readonly crosshairGradientId: string;
  readonly defaultStroke: string;
  readonly defaultStrokeWidth: number;
  readonly hoveredIndex: number | null;
  readonly isDiscrete: boolean;
  readonly lines: readonly Readonly<LineConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

interface HoverDotSeriesMarksParams {
  readonly defaultStroke: string;
  readonly isDiscrete: boolean;
  readonly lines: readonly Readonly<LineConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

const buildHoverDotSeriesMarks = (params: Readonly<HoverDotSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!(params.tooltipEnabled && (params.tooltip?.showDots ?? true))) {
    return [];
  }
  const dots: ChartMark<ChartDatum, Date, number>[] = [];
  for (const line of params.lines) {
    dots.push(
      buildHoverDotMark(
        {
          fill: resolveHoverDotFill(line.stroke ?? params.defaultStroke, params.tooltip?.dotColor),
          options: {
            discrete: params.isDiscrete,
            size: params.tooltip?.dotSize,
            strokeWidth: params.tooltip?.dotStrokeWidth,
          },
          renderData: params.renderData,
          series: { color: line.stroke ?? params.defaultStroke, dataKey: line.dataKey },
          xDataKey: params.xDataKey,
        },
      ),
    );
  }
  return dots;
};

interface HighlightBandSeriesMarksParams {
  readonly defaultStroke: string;
  readonly defaultStrokeWidth: number;
  readonly hoveredIndex: number | null;
  readonly isDiscrete: boolean;
  readonly lines: readonly Readonly<LineConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

const buildHighlightBandSeriesMarks = (params: Readonly<HighlightBandSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!params.tooltipEnabled) {
    return [];
  }
  return buildHighlightBandMarks(
    {
      hoveredIndex: params.hoveredIndex,
      options: { discrete: params.isDiscrete },
      renderData: params.renderData,
      series: params.lines.map((line: Readonly<LineConfig>) => ({
        color: line.stroke ?? params.defaultStroke,
        curve: d3Curve(line.curve ?? curveNatural),
        dataKey: line.dataKey,
        showHighlight: line.showHighlight ?? true,
        strokeWidth: line.strokeWidth ?? params.defaultStrokeWidth,
      })),
      xDataKey: params.xDataKey,
    },
  );
};

const buildTooltipChromeMarks = (params: Readonly<TooltipChromeMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const chrome: ChartMark<ChartDatum, Date, number>[] = [];
  const indicatorColor = params.tooltip?.indicatorColor;
  if (params.tooltipEnabled && (params.tooltip?.showCrosshair ?? true)) {
    chrome.push(
      buildIndicatorMark({
        color: isString(indicatorColor) ? indicatorColor : undefined,
        columnWidth: params.tooltip?.columnWidth,
        dasharray: params.tooltip?.indicatorDasharray,
        discrete: params.isDiscrete,
        gradientId: params.crosshairGradientId,
        span: params.tooltip?.indicatorSpan,
        width: params.tooltip?.indicatorWidth,
        xLabelFormat: (params.tooltip?.showDatePill ?? true) ? formatShortDateLabel : undefined,
      }),
    );
  }
  chrome.push(...buildHoverDotSeriesMarks(params), ...buildHighlightBandSeriesMarks(params));
  return chrome;
};

export {
  LEGEND_DIM_OPACITY,
  buildBaseSeriesMarks,
  buildMarkerDotMarks,
  buildTooltipChromeMarks,
  resolveLineStrokeOpacity,
};
export type { BaseSeriesMarksParams, MarkerDotMarksParams, TooltipChromeMarksParams };
