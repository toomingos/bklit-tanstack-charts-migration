// Scatter Y-gradient disc/ring node builders extracted from scatter-y-gradient-mark.ts.
// The disc paints the per-point vertical color; the ring reuses the series stroke width.
import type { ChartPoint, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";
import type { ResolvedSeries } from "./scatter-marks";

interface BuildYGradientPointParams {
  readonly datum: Readonly<ChartDatum>;
  readonly datumIndex: number;
  readonly dateValue: Readonly<Date>;
  readonly fillUrl: string;
  readonly projectedY: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildYGradientPoint = ({
  datum,
  datumIndex,
  dateValue,
  fillUrl,
  projectedY,
  series,
  x,
  y,
}: Readonly<BuildYGradientPointParams>): ChartPoint<ChartDatum, Date, number> => ({
  color: fillUrl,
  datum,
  datumIndex,
  group: null,
  groupLabel: series.dataKey,
  key: `${series.dataKey}:${datumIndex}`,
  markId: series.dataKey,
  x,
  xValue: dateValue,
  y,
  yValue: projectedY,
});

interface BuildYGradientNodesParams {
  readonly datumIndex: number;
  readonly discRadius: number;
  readonly fillUrl: string;
  readonly hasRing: boolean;
  readonly point: Readonly<ChartPoint<ChartDatum, Date, number>>;
  readonly ringRadius: number;
  readonly series: Readonly<ResolvedSeries>;
  readonly x: number;
  readonly y: number;
}

const buildYGradientNodes = ({
  datumIndex,
  discRadius,
  fillUrl,
  hasRing,
  point,
  ringRadius,
  series,
  x,
  y,
}: Readonly<BuildYGradientNodesParams>): readonly SceneNode[] => {
  const disc: SceneNode = {
    key: `${series.dataKey}:null:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: discRadius,
    style: { fill: fillUrl, stroke: "none" },
    x,
    y,
  };
  if (!hasRing) {return [disc];}
  const ring: SceneNode = {
    key: `${series.dataKey}:ring:${datumIndex}`,
    kind: "dot",
    pointOwner: point,
    radius: ringRadius,
    style: { fill: "none", stroke: fillUrl, strokeWidth: series.strokeWidth },
    x,
    y,
  };
  return [disc, ring];
};

export { buildYGradientNodes, buildYGradientPoint };
export type { BuildYGradientNodesParams, BuildYGradientPointParams };
