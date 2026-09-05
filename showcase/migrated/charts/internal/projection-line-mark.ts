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
  readonly strokeVisible: boolean;
  readonly yFallbackZero?: boolean;
}

interface ProjectionLineEndpoints {
  readonly endY: number;
  readonly startX: number;
  readonly startY: number;
  readonly visibleEndX: number;
}

interface ProjectionLineEndpointInputs {
  readonly data: readonly Readonly<ProjectionPoint>[];
  readonly endpointRadius: number;
  readonly rightEdge: number;
  readonly showEndMarker: boolean;
  readonly strokeWidth: number;
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
}

// Shared by both exported helpers below: resolves the on-screen start/end coordinates for a projection line, or reports there is nothing to draw.
const resolveProjectionLineEndpoints = (
  options: Readonly<ProjectionLineEndpointInputs>,
): ProjectionLineEndpoints | undefined => {
  const [startPoint] = options.data;
  const endPoint = options.data.at(-1);
  if (options.data.length < 2 || !endPoint) {return undefined;}
  const points = {
    end: { x: options.xMap(endPoint.date), y: options.yMap(endPoint.value) },
    start: { x: options.xMap(startPoint.date), y: options.yMap(startPoint.value) },
  };
  if (!Number.isFinite(points.start.x) || !Number.isFinite(points.start.y) || !Number.isFinite(points.end.x) || !Number.isFinite(points.end.y)) {return undefined;}
  const visibleEndX = resolveVisibleEndX({ endX: points.end.x, endpointRadius: options.endpointRadius, rightEdge: options.rightEdge, showEndMarker: options.showEndMarker, strokeWidth: options.strokeWidth });
  return { endY: points.end.y, startX: points.start.x, startY: points.start.y, visibleEndX };
};

const projectionLineMark = (options: Readonly<ProjectionLineMarkOptions>): ChartMark<ChartDatum, Date, number> | undefined => {
  const { strokeVisible, stroke, strokeStyle, gradientId, strokeWidth, curveKind, strokeDasharray, strokeOpacity, id, className } = options;
  if (options.data.length < 2) {return undefined;}
  const resolvedStroke = strokeStyle === "gradient" ? `url(#${gradientId})` : stroke;

  // Pixel mapping resolves at scene build from the package scales (V1.2/G6);
  // The mark carries data, never a hand-built scale.
  return createMark(() => ({
    channels: {
      x: { scale: "x", values: [] },
      y: { scale: "y", values: [] },
    },
    id,
    render: ({ chart, scales }) => {
      const rightEdge = chart.x + chart.width;
      const yMap = options.yFallbackZero === true
        ? (value: number): number => {
          const mapped = scales.y.map(value);
          return Number.isFinite(mapped) ? mapped : 0;
        }
        : (value: number): number => scales.y.map(value);
      const endpoints = resolveProjectionLineEndpoints({
        data: options.data,
        endpointRadius: options.endpointRadius,
        rightEdge,
        showEndMarker: options.showEndMarker,
        strokeWidth: options.strokeWidth,
        xMap: (value: Readonly<Date>): number => scales.x.map(value),
        yMap,
      });
      if (!endpoints) {return { nodes: [] };}
      const { startX, startY, endY, visibleEndX } = endpoints;
      const path = curveKind === "bezier"
        ? buildHorizontalTangentBezierPath({ x0: startX, x1: visibleEndX, y0: startY, y1: endY })
        : `M ${startX},${startY} L ${visibleEndX},${endY}`;
      return {
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
          },
        ],
      };
    },
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

interface ProjectionGradientInputs {
  readonly data: readonly Readonly<ProjectionPoint>[];
  readonly endpointRadius: number;
  readonly rightEdge: number;
  readonly showEndMarker: boolean;
  readonly strokeWidth: number;
  readonly strokeStyle: "solid" | "gradient";
  readonly gradientStart: string;
  readonly gradientEnd: string;
  readonly gradientId: string;
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
}

const resolveProjectionGradientDef = (options: Readonly<ProjectionGradientInputs>): ProjectionGradientDef | undefined => {
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
export type { ProjectionGradientDef, ProjectionGradientInputs, ProjectionLineEndpointInputs, ProjectionLineMarkOptions };
