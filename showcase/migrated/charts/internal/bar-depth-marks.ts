import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, MarkRenderContext, SceneNode } from "@tanstack/charts";
import { appendBackBarFaces, extractBarDepthValues, groupBarDepthNodes, resolveBackBarFrame } from "./bar-depth-face-nodes";
import { resolveBandFrame } from "./bar-depth-geometry";
import { GLASS_TIP_OPACITY as GLASS_TIP } from "./bar-depth-back-nodes";
import type { BarDepthGradientIds } from "./bar-depth-face-nodes";
import type { ChartDatum } from "./types";

const DEFAULT_GROUND_SHADOW = 0.26;
const BAR_FADED_OPACITY = 0.3;

// Per-bar glass gradient stops matching bklit exactly.
interface GlassGradientStop {
  readonly offset: string;
  readonly color: string;
  readonly opacity: string;
}

const buildPosBarStops = (groundShadow: number): GlassGradientStop[] => [
    { color: "white", offset: "0%", opacity: String(GLASS_TIP) },
    { color: "white", offset: "3%", opacity: "0.09" },
    { color: "white", offset: "8%", opacity: "0.02" },
    { color: "white", offset: "55%", opacity: "0" },
    { color: "black", offset: "100%", opacity: String(groundShadow) },
  ];


const buildNegBarStops = (groundShadow: number): GlassGradientStop[] => [
    { color: "black", offset: "0%", opacity: String(groundShadow) },
    { color: "white", offset: "45%", opacity: "0" },
    { color: "white", offset: "92%", opacity: "0.02" },
    { color: "white", offset: "97%", opacity: "0.09" },
    { color: "white", offset: "100%", opacity: String(GLASS_TIP) },
  ];


interface BarDepthBackMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly gradientIds: Readonly<BarDepthGradientIds>;
  readonly states?: readonly ChartMarkState<ChartDatum>[];
  readonly opacity?: number;
}

const barDepthBackMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarDepthBackMarkOptions>): ChartMark<ChartDatum, string, number> => {
  const { id, categoryAccessor, yAccessor, fill, gradientIds, states, opacity } = options;
  const { glassPosId, sideShadeRtlId, sideShadeLtrId, topShadeId } = gradientIds;
  return createMark(() => {
    const { xValues, yValues } = extractBarDepthValues(data, categoryAccessor, yAccessor);
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
        // Band geometry resolves at scene build from the package scale (V1.2/G6).
        const { bandPos, bandStep, bandWidth } = resolveBandFrame(scales.x);
        const frame = resolveBackBarFrame({ bandStep, bandWidth, chartWidth: chart.width, chartX: chart.x });
        for (let i = 0; i < data.length; i += 1) {
          appendBackBarFaces({
            bandPos,
            bandWidth,
            baseline,
            centerX: frame.centerX,
            datum: data[i],
            fill,
            glassPosId,
            id,
            index: i,
            innerWidth: frame.innerWidth,
            maxDepth: frame.maxDepth,
            nodes,
            opacity,
            points,
            sideShadeLtrId,
            sideShadeRtlId,
            topShadeId,
            xValue: xValues[i],
            yScale: scales.y,
            yValue: yValues[i],
          });
        }
        return groupBarDepthNodes({ className: "ts-chart__bar-depth-back", id, nodes, points });
      },
      states: states !== undefined && states.length > 0 ? { data, definitions: states } : undefined,
    };
  });
}

export { barDepthFrontMark } from "./bar-depth-front-mark";
export type { BarDepthFrontMarkOptions } from "./bar-depth-front-mark";
export type { BarDepthGradientIds } from "./bar-depth-face-nodes";
export { GLASS_TIP_OPACITY } from "./bar-depth-back-nodes";
export {
  BAR_FADED_OPACITY,
  barDepthBackMark,
  buildNegBarStops,
  buildPosBarStops,
  DEFAULT_GROUND_SHADOW,
};
export type {
  BarDepthBackMarkOptions,
  GlassGradientStop,
};
