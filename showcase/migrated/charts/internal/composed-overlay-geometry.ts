import { scaleLinear } from "d3-scale";
import { timeToPixelX } from "./x-time-scale";
import type { TimeBounds } from "./composed-data-math";
import {
  resolveProjectionMarkerOptions,
  resolveProjectionStrokeOptions,
  resolveProjectionStrokeStyle,
} from "./composed-data-math";
import type {
  ProjectionMarkerFallbacks,
  ProjectionStrokeFallbacks,
} from "./composed-data-math";
import type { ChartMark } from "@tanstack/charts";
import { projectionLineMark } from "./projection-line-mark";
import { resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum } from "./types";

interface BuildProjectionGradientParams {
  readonly cfg: Readonly<ProjectionLineConfig> | undefined;
  readonly gradientBaseId: string;
  readonly innerWidth: number;
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly proj: Readonly<ChartDatum>;
  readonly projIndex: number;
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly translateX: number;
  readonly translateY: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

interface OverlayFrameMargin {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

interface OverlayFrameInput {
  readonly heightPx: number;
  readonly margin: Readonly<OverlayFrameMargin>;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly width: number;
  readonly yDomain: readonly [number, number];
}

interface OverlayFrame {
  readonly innerH: number;
  readonly innerW: number;
  readonly xForDate: (date: Readonly<Date>) => number;
  readonly yForValue: (value: number) => number;
}

const measureOverlayInnerSize = (
  input: Readonly<OverlayFrameInput>,
): { innerH: number; innerW: number } | undefined => {
  const innerW = Math.max(0, input.width - input.margin.left - input.margin.right);
  const innerH = Math.max(0, input.heightPx - input.margin.top - input.margin.bottom);
  if (innerW <= 0 || innerH <= 0) {
    return undefined;
  }
  return { innerH, innerW };
};

const resolveOverlayFrame = (input: Readonly<OverlayFrameInput>): OverlayFrame | undefined => {
  const size = measureOverlayInnerSize(input);
  const te = input.timeExtent;
  const teRaw = input.timeExtentRaw;
  if (!size || !te || !teRaw) {
    return undefined;
  }
  const yScale = scaleLinear().domain(input.yDomain).range([size.innerH, 0]);
  const xForDate = (date: Readonly<Date>): number => timeToPixelX(date, teRaw.minTime, te.maxTime, size.innerW);
  const yForValue = (value: number): number => yScale(value);
  return { innerH: size.innerH, innerW: size.innerW, xForDate, yForValue };
};

interface BuildProjectionMarkEntryParams {
  readonly cfg: Readonly<ProjectionLineConfig>;
  readonly gradientBaseId: string;
  readonly innerWidth: number;
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly proj: Readonly<ChartDatum>;
  readonly projIndex: number;
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly translateX: number;
  readonly translateY: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

interface ProjectionMarkFrame {
  readonly innerW: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

interface AppendProjectionMarksParams {
  readonly heightPx: number;
  readonly margin: Readonly<OverlayFrameMargin>;
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ChartDatum>[];
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly width: number;
  readonly yDomain: readonly [number, number];
}

const resolveProjectionFrame = (
  params: Readonly<AppendProjectionMarksParams>,
): ProjectionMarkFrame | undefined => {
  const innerW = Math.max(0, params.width - params.margin.left - params.margin.right);
  const innerH = Math.max(0, params.heightPx - params.margin.top - params.margin.bottom);
  const te = params.timeExtent;
  const teRaw = params.timeExtentRaw;
  if (innerW <= 0 || innerH <= 0 || !te || !teRaw) {
    return undefined;
  }
  const yScale = scaleLinear().domain(params.yDomain).range([innerH, 0]);
  return {
    innerW,
    xScale: (value: Readonly<Date>): number => timeToPixelX(value, teRaw.minTime, te.maxTime, innerW),
    yScale: (value: number): number => yScale(value),
  };
};

const buildProjectionLineMarkEntry = (
  params: Readonly<BuildProjectionMarkEntryParams>,
): ChartMark<ChartDatum, Date, number> | undefined => {
  const strokeStyle = resolveProjectionStrokeStyle(params.proj);
  const strokeOpts = resolveProjectionStrokeOptions(params.proj, params.strokeFallbacks);
  const markerOpts = resolveProjectionMarkerOptions(params.proj, params.markerFallbacks);
  return projectionLineMark({
    className: markerOpts.className,
    curveKind: markerOpts.curveKind,
    data: params.cfg.data,
    endpointRadius: markerOpts.endpointRadius,
    gradientEnd: strokeOpts.gradientEnd,
    gradientId: `${params.gradientBaseId}-proj-${params.projIndex}`,
    gradientStart: strokeOpts.gradientStart,
    id: `projection-line-${params.projIndex}`,
    innerWidth: params.innerWidth,
    showEndMarker: markerOpts.showEndMarker,
    stroke: strokeOpts.stroke,
    strokeDasharray: markerOpts.strokeDasharray,
    strokeOpacity: markerOpts.strokeOpacity,
    strokeStyle,
    strokeVisible: true,
    strokeWidth: strokeOpts.strokeWidth,
    translateX: params.translateX,
    translateY: params.translateY,
    xScale: params.xScale,
    yAxisId: params.cfg.yAxisId,
    yScale: params.yScale,
  });
};

const appendProjectionMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  params: Readonly<AppendProjectionMarksParams>,
): void => {
  if (params.projectionConfigs.length === 0) {return;}
  const frame = resolveProjectionFrame(params);
  if (!frame) {return;}
  for (let projIndex = 0; projIndex < params.projectionConfigs.length; projIndex += 1) {
    const mark = buildProjectionLineMarkEntry({
      cfg: params.projectionConfigs[projIndex],
      gradientBaseId: params.projectionGradientBaseId,
      innerWidth: frame.innerW,
      markerFallbacks: params.markerFallbacks,
      proj: params.projectionLines[projIndex],
      projIndex,
      strokeFallbacks: params.strokeFallbacks,
      translateX: params.margin.left,
      translateY: params.margin.top,
      xScale: frame.xScale,
      yScale: frame.yScale,
    });
    if (mark) {marks.push(mark);}
  }
};

const buildComposedProjectionGradient = (
  params: Readonly<BuildProjectionGradientParams>,
): ProjectionGradientDef | undefined => {
  // Only gradient-styled lines produce a def. The "solid" fallback the inline code
  // Used to normalize to is unobservable: the def call below always passes "gradient".
  const rawStrokeStyle: unknown = params.proj.strokeStyle;
  if (rawStrokeStyle !== "gradient") {
    return undefined;
  }
  const { cfg } = params;
  if (!cfg || cfg.data.length < 2) {
    return undefined;
  }
  const strokeOpts = resolveProjectionStrokeOptions(params.proj, params.strokeFallbacks);
  const markerOpts = resolveProjectionMarkerOptions(params.proj, params.markerFallbacks);
  const gid = `${params.gradientBaseId}-proj-${params.projIndex}`;
  return resolveProjectionGradientDef({
    className: markerOpts.className,
    curveKind: markerOpts.curveKind,
    data: cfg.data,
    endpointRadius: markerOpts.endpointRadius,
    gradientEnd: strokeOpts.gradientEnd,
    gradientId: gid,
    gradientStart: strokeOpts.gradientStart,
    id: `projection-line-${params.projIndex}`,
    innerWidth: params.innerWidth,
    showEndMarker: markerOpts.showEndMarker,
    stroke: strokeOpts.stroke,
    strokeDasharray: markerOpts.strokeDasharray,
    strokeOpacity: markerOpts.strokeOpacity,
    strokeStyle: "gradient",
    strokeVisible: true,
    strokeWidth: strokeOpts.strokeWidth,
    translateX: params.translateX,
    translateY: params.translateY,
    xScale: params.xScale,
    yAxisId: cfg.yAxisId,
    yScale: params.yScale,
  });
};

export {
  appendProjectionMarks,
  buildComposedProjectionGradient,
  resolveOverlayFrame,
};
export type {
  AppendProjectionMarksParams,
  BuildProjectionGradientParams,
  BuildProjectionMarkEntryParams,
  OverlayFrame,
  OverlayFrameInput,
  OverlayFrameMargin,
};
