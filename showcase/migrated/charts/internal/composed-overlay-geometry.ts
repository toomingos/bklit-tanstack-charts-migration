import type {
  ProjectionMarkerFallbacks,
  ProjectionStrokeFallbacks,
  TimeBounds,
} from "./composed-data-math";
import {
  resolveProjectionMarkerOptions,
  resolveProjectionStrokeOptions,
  resolveProjectionStrokeStyle,
} from "./composed-data-math";
import type { ChartMark } from "@tanstack/charts";
import { projectionLineMark, resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum } from "./types";

interface BuildProjectionGradientParams {
  readonly cfg: Readonly<ProjectionLineConfig> | undefined;
  readonly gradientBaseId: string;
  readonly rightEdge: number;
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly proj: Readonly<ChartDatum>;
  readonly projIndex: number;
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
}

interface OverlayFrame {
  readonly innerH: number;
  readonly innerW: number;
  readonly rightEdge: number;
  readonly xForDate: (date: Readonly<Date>) => number;
  readonly yForValue: (value: number) => number;
}

interface BuildProjectionMarkEntryParams {
  readonly cfg: Readonly<ProjectionLineConfig>;
  readonly gradientBaseId: string;
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly proj: Readonly<ChartDatum>;
  readonly projIndex: number;
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
}

interface AppendProjectionMarksParams {
  readonly markerFallbacks: Readonly<ProjectionMarkerFallbacks>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ChartDatum>[];
  readonly strokeFallbacks: Readonly<ProjectionStrokeFallbacks>;
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly width: number;
  readonly heightPx: number;
}

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
    showEndMarker: markerOpts.showEndMarker,
    stroke: strokeOpts.stroke,
    strokeDasharray: markerOpts.strokeDasharray,
    strokeOpacity: markerOpts.strokeOpacity,
    strokeStyle,
    strokeVisible: true,
    strokeWidth: strokeOpts.strokeWidth,
    yAxisId: params.cfg.yAxisId,
  });
};

const appendProjectionMarks = (
  marks: ChartMark<ChartDatum, Date, number>[],
  params: Readonly<AppendProjectionMarksParams>,
): void => {
  if (params.projectionConfigs.length === 0) {return;}
  if (params.width <= 0 || params.heightPx <= 0 || !params.timeExtent || !params.timeExtentRaw) {return;}
  for (let projIndex = 0; projIndex < params.projectionConfigs.length; projIndex += 1) {
    const mark = buildProjectionLineMarkEntry({
      cfg: params.projectionConfigs[projIndex],
      gradientBaseId: params.projectionGradientBaseId,
      markerFallbacks: params.markerFallbacks,
      proj: params.projectionLines[projIndex],
      projIndex,
      strokeFallbacks: params.strokeFallbacks,
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
    data: cfg.data,
    endpointRadius: markerOpts.endpointRadius,
    gradientEnd: strokeOpts.gradientEnd,
    gradientId: gid,
    gradientStart: strokeOpts.gradientStart,
    rightEdge: params.rightEdge,
    showEndMarker: markerOpts.showEndMarker,
    strokeStyle: "gradient",
    strokeWidth: strokeOpts.strokeWidth,
    xMap: params.xMap,
    yMap: params.yMap,
  });
};

export {
  appendProjectionMarks,
  buildComposedProjectionGradient,
};
export type {
  AppendProjectionMarksParams,
  BuildProjectionGradientParams,
  BuildProjectionMarkEntryParams,
  OverlayFrame,
};
