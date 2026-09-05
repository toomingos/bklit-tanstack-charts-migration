import type { ScaleLinear, ScaleTime } from "d3-scale";
import type { CurveFactory } from "d3-shape";
import type { RefObject } from "react";
import type {
  ProjectionMarkerFallbacks,
  ProjectionStrokeFallbacks,
  TimeBounds,
} from "./composed-data-math";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum, ChartTooltipConfig, GridConfig, XAxisConfig } from "./types";
import type { ChartMargin } from "./use-chart-margin";

interface ComposedSeriesEntry {
  readonly dataKey: string;
  stroke: string;
  strokeWidth: number;
  showHighlight: boolean;
  /** Area series dim to 0.6, Line series to 0.3 (bklit per-role SeriesHoverDim). */
  dimOpacity?: number;
  /** Carries each child's yAxisId through the upsert (bklit extractor parity). */
  yAxisId?: string | number;
}

interface ResolvedBar {
  readonly dataKey: string;
  readonly fill: string;
  readonly radius: number;
  readonly fadedOpacity: number;
  readonly animate: boolean;
}

interface ResolvedArea {
  readonly dataKey: string;
  readonly fill: string;
  stroke: string;
  strokeWidth: number;
  readonly fillOpacity: number;
  readonly curve: CurveFactory;
}

interface ResolvedLine {
  readonly dataKey: string;
  stroke: string;
  strokeWidth: number;
  readonly curve: CurveFactory;
}

interface ComposedMarksContext {
  readonly areaDimFallback: number;
  readonly barGap: number;
  readonly barSize: number | undefined;
  readonly composedSeries: readonly Readonly<ComposedSeriesEntry>[];
  readonly composedStackOffsets: Map<number, Map<string, number>> | undefined;
  readonly crosshairGradientId: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly gradientIdBySeries: ReadonlyMap<string, string>;
  readonly heightPx: number;
  readonly isDiscrete: boolean;
  readonly legendHoveredKey: string | undefined;
  readonly lineDimFallback: number;
  readonly margin: Readonly<ChartMargin>;
  readonly maxBarSize: number | undefined;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ChartDatum>[];
  readonly projectionMarkerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly projectionStrokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly Readonly<ResolvedArea>[];
  readonly resolvedBars: readonly Readonly<ResolvedBar>[];
  readonly resolvedLines: readonly Readonly<ResolvedLine>[];
  readonly stackGap: number;
  readonly stacked: boolean;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly tooltip: ChartTooltipConfig | undefined;
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomain: [number, number];
}

interface ComposedScalesContext {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly grid: GridConfig | null;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly tickCountFallback: number;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly xAxis: XAxisConfig | undefined;
  readonly xDataKey: string;
  readonly xScaleRef: RefObject<ScaleTime<number, number> | null>;
  readonly yDomain: [number, number];
  readonly yScaleRef: RefObject<ScaleLinear<number, number> | null>;
}

export type {
  ComposedMarksContext,
  ComposedScalesContext,
  ComposedSeriesEntry,
  ResolvedArea,
  ResolvedBar,
  ResolvedLine,
};
