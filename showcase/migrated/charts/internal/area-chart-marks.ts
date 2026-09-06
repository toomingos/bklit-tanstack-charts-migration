// Area mark builders: pattern fills, series fills/boundaries, tooltip chrome marks.
// Boundary ladder lives in resolveAreaBoundaryStyle; verbatim logic otherwise.
import { d3Curve } from "@tanstack/charts/d3/shape";
import { lineY } from "@tanstack/charts/line";
import type { ChartMark } from "@tanstack/charts";
import { areaFill } from "./area-fill-mark";
import { patternAreaMark } from "./pattern-area-mark";
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
import { resolveDashTailBounds } from "./dash-tail";
import { AREA_DIM_OPACITY, isString } from "./area-chart-model";
import type {
  ReadonlyResolvedArea,
  ResolvedPatternArea,
} from "./area-chart-model";
import type { ChartDatum, ChartTooltipConfig } from "./types";

type AreaXAccessor = (datum: Readonly<ChartDatum>) => Date;
type AreaProjector = (axisId?: string | number) => (value: number) => number;

interface PatternAreaMarksParams {
  readonly patternIdByKey: Readonly<Map<string, string>>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedPatternAreas: readonly Readonly<ResolvedPatternArea>[];
  readonly xAccessor: AreaXAccessor;
}

const buildPatternAreaMarks = (params: Readonly<PatternAreaMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const patternArea of params.resolvedPatternAreas) {
    const curve = d3Curve(patternArea.curve);
    const patternId = params.patternIdByKey.get(patternArea.dataKey);
    const fill = patternArea.fill ?? (patternId === undefined ? "var(--chart-1)" : `url(#${patternId})`);
    marks.push(
      patternAreaMark(params.renderData, {
        curve,
        fill,
        id: `pattern-area-${patternArea.dataKey}`,
        x: (datum: Readonly<ChartDatum>) => params.xAccessor(datum),
        y: (datum: Readonly<ChartDatum>) => Number(datum[patternArea.dataKey]),
      }),
    );
  }
  return marks;
};

interface AreaBoundaryStyle {
  readonly stroke: string;
  readonly strokeOpacity: number | undefined;
}

// Boundary visibility ladder: dash tails and showLine=false hide the stroke but keep
// The mark mounted (it carries focus geometry); legend dim is plain strokeOpacity.
const resolveAreaBoundaryStyle = (
  area: ReadonlyResolvedArea,
  legendHoveredKey: string | undefined,
  hasDashTail: boolean,
): AreaBoundaryStyle => {
  // ShowLine=false keeps the mark mounted with transparent stroke (carries focus geometry).
  const boundaryVisible = area.showLine && !hasDashTail;
  // Bklit parity: legend dim is plain strokeOpacity, not a focus state (single-owner slot).
  const legendDimmed = legendHoveredKey !== undefined && legendHoveredKey !== area.dataKey;
  const legendStrokeOpacity: number | undefined = legendDimmed ? AREA_DIM_OPACITY : undefined;
  return {
    stroke: boundaryVisible ? area.stroke : "transparent",
    strokeOpacity: boundaryVisible ? legendStrokeOpacity : 0,
  };
};

interface AreaSeriesMarksParams {
  readonly areaMarkerConfigs: readonly Readonly<MarkerSeriesConfig>[];
  readonly areaMarkerGradientIdByKey: Readonly<Map<string, string>>;
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly legendHoveredKey: string | undefined;
  readonly pointerHoverDimmed: boolean;
  readonly projectorFor: AreaProjector;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly xAccessor: AreaXAccessor;
  readonly xDataKey: string;
}

// AreaFill emits no ChartPoints, so legend + pointer dim ride reactive fillOpacity (0.6).
const buildAreaSeriesMarks = (params: Readonly<AreaSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const area of params.resolvedAreas) {
    const gradientId = params.gradientIdBySeries.get(area.dataKey);
    const curve = d3Curve(area.curve);
    const projectY = params.projectorFor(area.yAxisId);
    // Fill first, lineY second: area marks draw no boundary stroke (documented TanStack pattern).
    // Do not swap areaFill for areaY: duplicate focus geometry failed the heap gate at n=1000.
    marks.push(
      areaFill(params.renderData, {
        curve,
        fill: (gradientId?.length ?? 0) > 0 ? `url(#${gradientId})` : area.fill,
        fillOpacity:
          params.pointerHoverDimmed || !(params.legendHoveredKey === undefined || params.legendHoveredKey === area.dataKey)
            ? AREA_DIM_OPACITY
            : 1,
        id: `${area.dataKey}__fill`,
        x: (datum: Readonly<ChartDatum>) => params.xAccessor(datum),
        y: (datum: Readonly<ChartDatum>) => projectY(Number(datum[area.dataKey])),
      }),
    );
    // Boundary shares Line's mark id scheme so crosshair/dots/tooltip need no Area branch.
    const hasDashTail = resolveDashTailBounds(area.dashFromIndex, params.renderData.length);
    const boundary = resolveAreaBoundaryStyle(area, params.legendHoveredKey, hasDashTail);
    marks.push(
      lineY(params.renderData, {
        curve,
        id: area.dataKey,
        states: pointerSeriesDimStates<ChartDatum>(AREA_DIM_OPACITY),
        stroke: boundary.stroke,
        strokeOpacity: boundary.strokeOpacity,
        strokeWidth: area.strokeWidth,
        x: (datum: Readonly<ChartDatum>) => params.xAccessor(datum),
        y: (datum: Readonly<ChartDatum>) => projectY(Number(datum[area.dataKey])),
        // Z carries series identity; without it group-x focus dedupes to one series.
        z: () => area.dataKey,
      }),
    );
  }
  if (params.areaMarkerConfigs.some((config: Readonly<MarkerSeriesConfig>) => config.showMarkers ?? false)) {
    marks.push(...buildMarkerMarks({ gradientIdByKey: params.areaMarkerGradientIdByKey, renderData: params.renderData, series: params.areaMarkerConfigs, xDataKey: params.xDataKey }));
  }
  return marks;
};

interface AreaIndicatorMarksParams {
  readonly crosshairGradientId: string;
  readonly hoveredIndex: number | undefined;
  readonly isDiscrete: boolean;
  readonly projectorFor: AreaProjector;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

const buildAreaIndicatorMarks = (params: Readonly<AreaIndicatorMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  if (!(params.tooltipEnabled && (params.tooltip?.showCrosshair ?? true))) {
    return marks;
  }
  const indicatorColor = params.tooltip?.indicatorColor;
  marks.push(
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
  return marks;
};

interface AreaHoverDotMarksParams {
  readonly isDiscrete: boolean;
  readonly projectorFor: AreaProjector;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly tooltip: Readonly<ChartTooltipConfig> | null | undefined;
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

const buildAreaHoverDotMarks = (params: Readonly<AreaHoverDotMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!(params.tooltipEnabled && (params.tooltip?.showDots ?? true))) {
    return [];
  }
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const area of params.resolvedAreas) {
    // Hover dots reproject second-axis values into primary-domain space before the mark.
    const projectYForDot = params.projectorFor(area.yAxisId);
    const hoverDotData = params.renderData.map((datum: Readonly<ChartDatum>) => ({
      ...datum,
      [area.dataKey]: projectYForDot(Number(datum[area.dataKey])),
    }));
    marks.push(
      buildHoverDotMark(
        {
          fill: resolveHoverDotFill(area.stroke, params.tooltip?.dotColor),
          options: { discrete: params.isDiscrete, size: params.tooltip?.dotSize, strokeWidth: params.tooltip?.dotStrokeWidth },
          renderData: hoverDotData,
          series: { color: area.stroke, dataKey: area.dataKey },
          xDataKey: params.xDataKey,
        },
      ),
    );
  }
  return marks;
};

interface AreaHighlightMarksParams {
  readonly hoveredIndex: number | undefined;
  readonly isDiscrete: boolean;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly tooltipEnabled: boolean;
  readonly xDataKey: string;
}

const buildAreaHighlightMarks = (params: Readonly<AreaHighlightMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (!params.tooltipEnabled) {
    return [];
  }
  return buildHighlightBandMarks(
    {
      hoveredIndex: params.hoveredIndex ?? null,
      options: { discrete: params.isDiscrete },
      renderData: params.renderData,
      series: params.resolvedAreas.map((area: ReadonlyResolvedArea) => ({
        color: area.stroke,
        curve: d3Curve(area.curve),
        dataKey: area.dataKey,
        showHighlight: area.showHighlight,
        // Highlight band also gates on showLine; the dim state does not.
        showLine: area.showLine,
        strokeWidth: area.strokeWidth,
      })),
      xDataKey: params.xDataKey,
    },
  );
};

export {
  buildAreaHighlightMarks,
  buildAreaHoverDotMarks,
  buildAreaSeriesMarks,
  buildAreaIndicatorMarks,
  buildPatternAreaMarks,
  resolveAreaBoundaryStyle,
};
export type {
  AreaHighlightMarksParams,
  AreaHoverDotMarksParams,
  AreaSeriesMarksParams,
  AreaIndicatorMarksParams,
  PatternAreaMarksParams,
};
