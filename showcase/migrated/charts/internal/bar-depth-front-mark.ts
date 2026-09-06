import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MarkRenderContext, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { BarDepthGradientIds } from "./bar-depth-face-nodes";
import { groupBarDepthNodes, readBarDepthValuePos, resolveBackBarFrame } from "./bar-depth-face-nodes";
import { resolveBandFrame, resolveBarDepthTopGeometry, resolveVisibleBarDepthSegments } from "./bar-depth-geometry";
import type { BarDepthSegmentsAccessor } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

interface BarDepthFrontMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly gradientIds: Readonly<Pick<BarDepthGradientIds, "glassPosId" | "glassNegId">>;
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly opacity?: number;
  readonly minBarHeight?: number;
  readonly segmentsAccessor?: BarDepthSegmentsAccessor;
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
  readonly minBarHeight?: number;
  readonly segmentsAccessor?: BarDepthSegmentsAccessor;
}

interface FrontCenterOffsetParams {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly centerX: number;
  readonly innerWidth: number;
}

const frontCenterOffset = (params: Readonly<FrontCenterOffsetParams>): number => {
  const cx = params.bandX + params.bandWidth / 2;
  const offsetFromCenter = params.innerWidth > 0 ? (cx - params.centerX) / (params.innerWidth / 2) : 0;
  return Math.min(1, Math.abs(offsetFromCenter));
}

const appendFrontBarGlass = (params: Readonly<AppendFrontBarGlassParams>): void => {
  const { bandWidth, bandX, baseline, centerX, datum, glassPosId, id, index, innerWidth, maxDepth, nodes, opacity, points, xValue, yScale, yValue, minBarHeight, segmentsAccessor } = params;
  const valuePos = readBarDepthValuePos({ datum, minBarHeight, xValue, yScale, yValue });
  if (valuePos === undefined) { return; }
  // Glass length equals the bar length, so one length check covers both.
  const rawHeight = baseline - valuePos;
  const visibleSegments = segmentsAccessor ? resolveVisibleBarDepthSegments(datum, segmentsAccessor) : null;
  const topGeometry = resolveBarDepthTopGeometry({ absOffset: frontCenterOffset({ bandWidth, bandX, centerX, innerWidth }), maxDepth, minBarHeight, rawHeight, visibleSegments });
  if (!topGeometry) { return; }
  // Trim like the front face so the glass never overhangs the lid lip.
  // Floored bars grow up from the baseline with no trim (legacy parity).
  const topY = topGeometry.isFloored ? baseline - topGeometry.naturalHeight : valuePos + topGeometry.topYTrim;
  const height = topGeometry.naturalHeight - topGeometry.topYTrim;
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
  const { id, categoryAccessor, yAccessor, gradientIds, states, opacity, minBarHeight, segmentsAccessor } = options;
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
        // Band geometry resolves at scene build from the package scale (V1.2/G6).
        const { bandPos, bandStep, bandWidth } = resolveBandFrame(scales.x);
        const frame = resolveBackBarFrame({ bandStep, bandWidth, chartWidth: chart.width, chartX: chart.x });
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
            minBarHeight,
            nodes,
            opacity,
            points,
            segmentsAccessor,
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
