import { createMark } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum } from "./types";
import { buildHorizontalTangentBezierPath } from "./projection-utils";
import { resolveVisibleEndX } from "./projection-config";
import type { ProjectionPoint } from "./projection-utils";

interface ProjectionLineMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ProjectionPoint>[];
  yAxisId: string;
  stroke: string;
  readonly strokeStyle: "solid" | "gradient";
  readonly gradientStart: string;
  readonly gradientEnd: string;
  readonly gradientId: string;
  strokeWidth: number;
  readonly curveKind: "linear" | "bezier";
  readonly strokeDasharray: string;
  readonly strokeOpacity: number;
  readonly showEndMarker: boolean;
  readonly endpointRadius: number;
  readonly className: string;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
  readonly innerWidth: number;
  readonly strokeVisible: boolean;
  readonly translateX: number;
  readonly translateY: number;
}

interface ProjectionLineEndpoints {
  readonly endY: number;
  readonly startX: number;
  readonly startY: number;
  readonly visibleEndX: number;
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
    ? buildHorizontalTangentBezierPath({ x0: startX, x1: visibleEndX, y0: startY, y1: endY })
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
  readonly id: string;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly gradientStart: string;
  readonly gradientEnd: string;
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
