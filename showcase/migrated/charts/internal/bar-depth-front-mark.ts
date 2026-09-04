import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MarkRenderContext, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { BarDepthGradientIds } from "./bar-depth-face-nodes";
import { groupBarDepthNodes, readBarDepthValuePos } from "./bar-depth-face-nodes";
import type { ChartDatum } from "./types";

interface BarDepthFrontMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly bandWidth: number;
  readonly bandScale?: Readonly<{ step?: () => number }>;
  readonly bandPos: (label: string) => number;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly gradientIds: Readonly<Pick<BarDepthGradientIds, "glassPosId" | "glassNegId">>;
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly opacity?: number;
}

interface AppendFrontBarGlassParams {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly baseline: number;
  readonly datum: ChartDatum;
  readonly glassPosId: string;
  readonly id: string;
  readonly index: number;
  readonly nodes: SceneNode[];
  readonly opacity: number | undefined;
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly xValue: string;
  readonly yScale: ResolvedScale;
  readonly yValue: number;
}

const appendFrontBarGlass = (params: Readonly<AppendFrontBarGlassParams>): void => {
  const { bandWidth, bandX, baseline, datum, glassPosId, id, index, nodes, opacity, points, xValue, yScale, yValue } = params;
  const valuePos = readBarDepthValuePos({ datum, xValue, yScale, yValue });
  if (valuePos === undefined) { return; }
  // Glass length equals the bar length, so one length check covers both.
  const barLengthPx = baseline - valuePos;
  if (barLengthPx <= 0) { return; }
  // Glass ramp, not a flat opacity wash.
  const glassKey = `${id}:glass:${index}`;
  nodes.push({
    height: barLengthPx,
    key: glassKey,
    kind: "rect",
    style: { fill: `url(#${glassPosId})`, opacity },
    width: bandWidth,
    x: bandX,
    y: valuePos,
  });
  points.push({
    color: `url(#${glassPosId})`,
    datum,
    datumIndex: index,
    group: id,
    groupLabel: id,
    key: glassKey,
    markId: id,
    x: bandX + bandWidth / 2,
    xValue,
    y: valuePos,
    yValue,
  });
}

const barDepthFrontMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarDepthFrontMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const { id, bandWidth, bandPos, categoryAccessor, yAccessor, gradientIds, states, opacity } = options;
  const { glassPosId } = gradientIds;
  return createMark(() => {
    const xValues = data.map((datum: Readonly<ChartDatum>) => categoryAccessor(datum));
    const yValues = data.map((datum: Readonly<ChartDatum>) => yAccessor(datum));
    return {
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          includeZero: true,
          scale: "y",
          values: yValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
        },
      },
      id,
      render: ({ scales }: Readonly<MarkRenderContext>) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, string, number>[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        for (let i = 0; i < data.length; i += 1) {
          appendFrontBarGlass({
            bandWidth,
            bandX: bandPos(xValues[i]),
            baseline,
            datum: data[i],
            glassPosId,
            id,
            index: i,
            nodes,
            opacity,
            points,
            xValue: xValues[i],
            yScale,
            yValue: yValues[i],
          });
        }
        return groupBarDepthNodes({ className: "ts-chart__bar-depth-front", id, nodes, points });
      },
      states: states !== undefined && states.length > 0 ? { data, definitions: states } : undefined,
    };
  });
}

export { appendFrontBarGlass, barDepthFrontMark };
export type { AppendFrontBarGlassParams, BarDepthFrontMarkOptions };
