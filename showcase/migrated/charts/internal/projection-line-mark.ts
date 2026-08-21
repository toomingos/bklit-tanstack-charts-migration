import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";
import { buildHorizontalTangentBezierPath } from "./projection-utils";
import { resolveVisibleEndX } from "./projection-config";
import type { ProjectionPoint } from "./projection-utils";

export interface ProjectionLineMarkOptions {
  id: string;
  data: ProjectionPoint[];
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
  xScale: (value: Date) => number;
  yScale: (value: number) => number;
  innerWidth: number;
  strokeVisible: boolean;
  translateX: number;
  translateY: number;
}

export function projectionLineMark(options: ProjectionLineMarkOptions): ChartMark<ChartDatum, Date, number> | null {
  const { data, xScale, yScale, innerWidth, strokeVisible, stroke, strokeStyle, gradientId, strokeWidth, curveKind, strokeDasharray, strokeOpacity, showEndMarker, endpointRadius, id, className } = options;
  if (data.length < 2) return null;

  const startPoint = data[0];
  const endPoint = data.at(-1);
  if (!startPoint || !endPoint) return null;

  const startX = xScale(startPoint.date);
  const startY = yScale(startPoint.value);
  const endX = xScale(endPoint.date);
  const endY = yScale(endPoint.value);
  if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) return null;

  const visibleEndX = resolveVisibleEndX(endX, innerWidth, endpointRadius, strokeWidth, showEndMarker);

  let path: string;
  if (curveKind === "bezier") {
    path = buildHorizontalTangentBezierPath(startX, startY, visibleEndX, endY);
  } else {
    path = `M ${startX},${startY} L ${visibleEndX},${endY}`;
  }

  const resolvedStroke = strokeStyle === "gradient" ? `url(#${gradientId})` : stroke;

  return createMark(() => ({
    id,
    channels: {
      x: { scale: "x", values: [] },
      y: { scale: "y", values: [] },
    },
    render: () => ({
      nodes: [
        {
          kind: "group",
          key: id,
          className,
          translateX: options.translateX,
          translateY: options.translateY,
          children: [
            {
              kind: "polyline",
              key: `${id}:line`,
              points: [],
              path,
              style: {
                fill: "none",
                stroke: strokeVisible ? resolvedStroke : "transparent",
                strokeWidth,
                // Dashed on hiDPI Chromium: renderer hardcodes vector-effect=
                // "non-scaling-stroke" on polyline paths. styles.css overrides
                // it (.chart-projection-line path { vector-effect: none }).
                strokeDasharray,
                strokeLinecap: "round",
                strokeOpacity,
              },
            } as SceneNode,
          ],
        },
      ],
    }),
  }));
}

export interface ProjectionGradientDef {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  gradientStart: string;
  gradientEnd: string;
}

export function resolveProjectionGradientDef(options: ProjectionLineMarkOptions): ProjectionGradientDef | null {
  if (options.strokeStyle !== "gradient") return null;
  if (options.data.length < 2) return null;
  const startPoint = options.data[0];
  const endPoint = options.data.at(-1);
  if (!startPoint || !endPoint) return null;
  const startX = options.xScale(startPoint.date);
  const startY = options.yScale(startPoint.value);
  const endX = options.xScale(endPoint.date);
  const endY = options.yScale(endPoint.value);
  if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) return null;
  const visibleEndX = resolveVisibleEndX(endX, options.innerWidth, options.endpointRadius, options.strokeWidth, options.showEndMarker);
  return {
    id: options.gradientId,
    startX,
    startY,
    endX: visibleEndX,
    endY,
    gradientStart: options.gradientStart,
    gradientEnd: options.gradientEnd,
  };
}
