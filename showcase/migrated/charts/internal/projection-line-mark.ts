import { createMark } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum } from "./types";
import { buildHorizontalTangentBezierPath } from "./projection-utils";
import { resolveVisibleEndX } from "./projection-config";
import type { ProjectionPoint } from "./projection-utils";

interface ProjectionLineMarkOptions {
  id: string;
  data: readonly Readonly<ProjectionPoint>[];
  yAxisId: string;
  stroke: string;
  strokeStyle: "solid" | "gradient";
  gradientStart: string;
  gradientEnd: string;
  gradientId: string;
  strokeWidth: number;
  curveKind: "linear" | "bezier";
  strokeDasharray: string;
  strokeOpacity: number;
  showEndMarker: boolean;
  endpointRadius: number;
  className: string;
  xScale: (value: Readonly<Date>) => number;
  yScale: (value: number) => number;
  innerWidth: number;
  strokeVisible: boolean;
  translateX: number;
  translateY: number;
}

interface ProjectionLineEndpoints {
  endY: number;
  startX: number;
  startY: number;
  visibleEndX: number;
}

// Shared by both exported helpers below: resolves the on-screen start/end coordinates for a projection line, or reports there is nothing to draw.
const resolveProjectionLineEndpoints = (
  options: Readonly<ProjectionLineMarkOptions>,
): ProjectionLineEndpoints | undefined => {
  const [startPoint] = options.data;
  const endPoint = options.data.at(-1);
  if (options.data.length < 2 || !endPoint) {return undefined;}
  const points = {
    end: { x: options.xScale(endPoint.date), y: options.yScale(endPoint.value) },
    start: { x: options.xScale(startPoint.date), y: options.yScale(startPoint.value) },
  };
  if (!Number.isFinite(points.start.x) || !Number.isFinite(points.start.y) || !Number.isFinite(points.end.x) || !Number.isFinite(points.end.y)) {return undefined;}
  const visibleEndX = resolveVisibleEndX({ endX: points.end.x, endpointRadius: options.endpointRadius, innerWidth: options.innerWidth, showEndMarker: options.showEndMarker, strokeWidth: options.strokeWidth });
  return { endY: points.end.y, startX: points.start.x, startY: points.start.y, visibleEndX };
};

const projectionLineMark = (options: Readonly<ProjectionLineMarkOptions>): ChartMark<ChartDatum, Date, number> | undefined => {
  const { strokeVisible, stroke, strokeStyle, gradientId, strokeWidth, curveKind, strokeDasharray, strokeOpacity, id, className } = options;
  const endpoints = resolveProjectionLineEndpoints(options);
  if (!endpoints) {return undefined;}
  const { startX, startY, endY, visibleEndX } = endpoints;

  const path = curveKind === "bezier"
    ? buildHorizontalTangentBezierPath(startX, startY, visibleEndX, endY)
    : `M ${startX},${startY} L ${visibleEndX},${endY}`;

  const resolvedStroke = strokeStyle === "gradient" ? `url(#${gradientId})` : stroke;

  return createMark(() => ({
    channels: {
      x: { scale: "x", values: [] },
      y: { scale: "y", values: [] },
    },
    id,
    render: () => ({
      nodes: [
        {
          children: [
            {
              key: `${id}:line`,
              kind: "polyline",
              path,
              points: [],
              style: {
                fill: "none",
                stroke: strokeVisible ? resolvedStroke : "transparent",
                // Renderer hardcodes vector-effect="non-scaling-stroke" on polylines (breaks dashing on hiDPI Chromium); styles.css overrides it back for .chart-projection-line.
                strokeDasharray,
                strokeOpacity,
                strokeWidth,
              },
            },
          ],
          className,
          key: id,
          kind: "group",
          translateX: options.translateX,
          translateY: options.translateY,
        },
      ],
    }),
  }));
};

interface ProjectionGradientDef {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  gradientStart: string;
  gradientEnd: string;
}

const resolveProjectionGradientDef = (options: Readonly<ProjectionLineMarkOptions>): ProjectionGradientDef | undefined => {
  if (options.strokeStyle !== "gradient") {return undefined;}
  const endpoints = resolveProjectionLineEndpoints(options);
  if (!endpoints) {return undefined;}
  const { startX, startY, endY, visibleEndX } = endpoints;
  return {
    endX: visibleEndX,
    endY,
    gradientEnd: options.gradientEnd,
    gradientStart: options.gradientStart,
    id: options.gradientId,
    startX,
    startY,
  };
};

export { projectionLineMark, resolveProjectionGradientDef };
export type { ProjectionGradientDef, ProjectionLineMarkOptions };
