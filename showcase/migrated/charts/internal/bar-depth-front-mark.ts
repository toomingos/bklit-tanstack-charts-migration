import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MarkRenderContext, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { BarDepthGradientIds } from "./bar-depth-face-nodes";
import { groupBarDepthNodes, readBarDepthValuePos, resolveBackBarFrame } from "./bar-depth-face-nodes";
import { barDepthTopTrim } from "./bar-depth-geometry";
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
  readonly centerX: number;
  readonly datum: ChartDatum;
  readonly glassPosId: string;
  readonly id: string;
  readonly index: number;
  readonly innerWidth: number;
  readonly maxDepth: number;
  readonly nodes: SceneNode[];
  readonly opacity: number | undefined;
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly xValue: string;
  readonly yScale: ResolvedScale;
  readonly yValue: number;
}

const appendFrontBarGlass = (params: Readonly<AppendFrontBarGlassParams>): void => {
  const { bandWidth, bandX, baseline, centerX, datum, glassPosId, id, index, innerWidth, maxDepth, nodes, opacity, points, xValue, yScale, yValue } = params;
  const valuePos = readBarDepthValuePos({ datum, xValue, yScale, yValue });
  if (valuePos === undefined) { return; }
  // Glass length equals the bar length, so one length check covers both.
  const barLengthPx = baseline - valuePos;
  if (barLengthPx <= 0) { return; }
  // Trim like the front face so the glass never overhangs the lid lip.
  const cx = bandX + bandWidth / 2;
  const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
  const topYTrim = barDepthTopTrim(Math.min(1, Math.abs(offsetFromCenter)), barLengthPx, maxDepth);
  const topY = valuePos + topYTrim;
  const height = barLengthPx - topYTrim;
  if (height <= 0) { return; }
  // Glass ramp, not a flat opacity wash.
  const glassKey = `${id}:glass:${index}`;
  nodes.push({
    height,
    key: glassKey,
    kind: "rect",
    style: { fill: `url(#${glassPosId})`, opacity },
    width: bandWidth,
    x: bandX,
    y: topY,
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
    y: topY,
    yValue,
  });
}

const barDepthFrontMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarDepthFrontMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const { id, bandWidth, bandScale, bandPos, categoryAccessor, yAccessor, gradientIds, states, opacity } = options;
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
      render: ({ scales, chart }: Readonly<MarkRenderContext>) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, string, number>[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const frame = resolveBackBarFrame({ bandScale, bandWidth, chartWidth: chart.width, chartX: chart.x });
        for (let i = 0; i < data.length; i += 1) {
          appendFrontBarGlass({
            bandWidth,
            bandX: bandPos(xValues[i]),
            baseline,
            centerX: frame.centerX,
            datum: data[i],
            glassPosId,
            id,
            index: i,
            innerWidth: frame.innerWidth,
            maxDepth: frame.maxDepth,
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
