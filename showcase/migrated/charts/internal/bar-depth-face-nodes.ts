import { barDepthAndRise, barDepthMaxDepth, barDepthTopTrim, BAR_DEPTH_MIN_PX } from "./bar-depth-geometry";
import { pushBackBarNodes, pushBackBarPoints } from "./bar-depth-back-nodes";
import type { ChartPoint, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

/** IDs of the shared `<linearGradient>` defs bar-chart.tsx builds once per chart. */
interface BarDepthGradientIds {
  readonly glassPosId: string;
  readonly glassNegId: string;
  readonly sideShadeRtlId: string;
  readonly sideShadeLtrId: string;
  readonly topShadeId: string;
}

interface BarDepthValues {
  readonly xValues: string[];
  readonly yValues: readonly number[];
}

const extractBarDepthValues = (
  data: readonly Readonly<ChartDatum>[],
  categoryAccessor: (datum: Readonly<ChartDatum>) => string,
  yAccessor: (datum: Readonly<ChartDatum>) => number,
): BarDepthValues => {
  const xValues = data.map((datum: Readonly<ChartDatum>) => categoryAccessor(datum));
  const yValues = data.map((datum: Readonly<ChartDatum>) => yAccessor(datum));
  return { xValues, yValues };
}

interface ReadBarDepthValuePosParams {
  readonly datum: ChartDatum | null | undefined;
  readonly xValue: string | undefined;
  readonly yScale: ResolvedScale;
  readonly yValue: number;
}

/*
 * Validation mirrors the original render loop: untyped callers can pass non-finite values
 * at runtime, so the checks stay despite the static types.
 */
const readBarDepthValuePos = (params: Readonly<ReadBarDepthValuePosParams>): number | undefined => {
  const { datum, xValue, yScale, yValue } = params;
  if (!datum || xValue === undefined) { return undefined; }
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue <= 0) { return undefined; }
  const valuePos = yScale.map(yValue);
  if (!Number.isFinite(valuePos)) { return undefined; }
  return valuePos;
}

interface MeasureBackBarDepthParams {
  readonly absOffset: number;
  readonly barLengthPx: number;
  readonly maxDepth: number;
}

const measureBackBarDepth = (params: Readonly<MeasureBackBarDepthParams>): { depth: number; perspectiveRise: number } | undefined => {
  const { absOffset, barLengthPx, maxDepth } = params;
  if (barLengthPx <= 0) { return undefined; }
  const { depth, perspectiveRise } = barDepthAndRise(absOffset, barLengthPx, maxDepth);
  if (depth < BAR_DEPTH_MIN_PX) { return undefined; }
  return { depth, perspectiveRise };
}

interface BackBarPlacement {
  readonly bottomY: number;
  readonly depth: number;
  readonly isRightOfCenter: boolean;
  readonly perspectiveRise: number;
  readonly sideShadeId: string;
  readonly topY: number;
}

interface ResolveBackBarPlacementParams {
  readonly bandWidth: number;
  readonly bandX: number;
  readonly baseline: number;
  readonly centerX: number;
  readonly innerWidth: number;
  readonly maxDepth: number;
  readonly sideShadeLtrId: string;
  readonly sideShadeRtlId: string;
  readonly valuePos: number;
}

const resolveBackBarPlacement = (params: Readonly<ResolveBackBarPlacementParams>): BackBarPlacement | undefined => {
  const { bandWidth, bandX, baseline, centerX, innerWidth, maxDepth, sideShadeLtrId, sideShadeRtlId, valuePos } = params;
  const cx = bandX + bandWidth / 2;
  const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
  const isRightOfCenter = offsetFromCenter > 0;
  const absOffset = Math.min(1, Math.abs(offsetFromCenter));
  const naturalHeight = baseline - valuePos;
  const measured = measureBackBarDepth({ absOffset, barLengthPx: naturalHeight, maxDepth });
  if (!measured) { return undefined; }
  // Trim the faces down so the lid back edge lands on the value position.
  const topYTrim = barDepthTopTrim(absOffset, naturalHeight, maxDepth);
  return {
    bottomY: baseline,
    depth: measured.depth,
    isRightOfCenter,
    perspectiveRise: measured.perspectiveRise,
    sideShadeId: isRightOfCenter ? sideShadeRtlId : sideShadeLtrId,
    topY: valuePos + topYTrim,
  };
}

interface BackBarFrame {
  readonly centerX: number;
  readonly innerWidth: number;
  readonly maxDepth: number;
}

interface ResolveBackBarFrameParams {
  readonly bandStep: number;
  readonly bandWidth: number;
  readonly chartX: number;
  readonly chartWidth: number;
}

const resolveBackBarFrame = (params: Readonly<ResolveBackBarFrameParams>): BackBarFrame => {
  const { bandStep, bandWidth, chartX, chartWidth } = params;
  const innerWidth = chartWidth;
  const centerX = chartX + innerWidth / 2;
  const step = bandStep;
  const maxDepth = barDepthMaxDepth(step, bandWidth);
  return { centerX, innerWidth, maxDepth };
}

interface AppendBackBarFacesParams {
  readonly bandPos: (label: string) => number;
  readonly bandWidth: number;
  readonly baseline: number;
  readonly centerX: number;
  readonly datum: ChartDatum;
  readonly fill: string;
  readonly glassPosId: string;
  readonly id: string;
  readonly index: number;
  readonly innerWidth: number;
  readonly maxDepth: number;
  readonly nodes: SceneNode[];
  readonly opacity: number | undefined;
  readonly points: ChartPoint<ChartDatum, string, number>[];
  readonly sideShadeLtrId: string;
  readonly sideShadeRtlId: string;
  readonly topShadeId: string;
  readonly xValue: string;
  readonly yScale: ResolvedScale;
  readonly yValue: number;
}

const appendBackBarFaces = (params: Readonly<AppendBackBarFacesParams>): void => {
  const { bandPos, bandWidth, baseline, centerX, datum, fill, glassPosId, id, index, innerWidth, maxDepth, nodes, opacity, points, sideShadeLtrId, sideShadeRtlId, topShadeId, xValue, yScale, yValue } = params;
  const valuePos = readBarDepthValuePos({ datum, xValue, yScale, yValue });
  if (valuePos === undefined) { return; }
  const bandX = bandPos(xValue);
  const placement = resolveBackBarPlacement({ bandWidth, bandX, baseline, centerX, innerWidth, maxDepth, sideShadeLtrId, sideShadeRtlId, valuePos });
  if (!placement) { return; }
  pushBackBarPoints({ bandWidth, bandX, bottomY: placement.bottomY, datum, fill, id, index, points, topY: placement.topY, xValue, yValue });
  pushBackBarNodes({
    bandWidth,
    bandX,
    bottomY: placement.bottomY,
    depth: placement.depth,
    fill,
    glassPosId,
    id,
    index,
    isRightOfCenter: placement.isRightOfCenter,
    nodes,
    opacity,
    perspectiveRise: placement.perspectiveRise,
    sideShadeId: placement.sideShadeId,
    topShadeId,
    topY: placement.topY,
  });
}

interface GroupBarDepthNodesParams {
  readonly className: string;
  readonly id: string;
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

interface GroupedBarDepthNodes {
  readonly nodes: SceneNode[];
  readonly points: ChartPoint<ChartDatum, string, number>[];
}

const groupBarDepthNodes = (params: Readonly<GroupBarDepthNodesParams>): GroupedBarDepthNodes => {
  const { className, id, nodes, points } = params;
  return {
    nodes: [
      {
        ariaHidden: true,
        children: nodes,
        className,
        key: id,
        kind: "group",
      },
    ],
    points,
  };
}

export {
  appendBackBarFaces,
  extractBarDepthValues,
  groupBarDepthNodes,
  measureBackBarDepth,
  readBarDepthValuePos,
  resolveBackBarFrame,
  resolveBackBarPlacement,
};
export type {
  AppendBackBarFacesParams,
  BackBarFrame,
  BackBarPlacement,
  BarDepthGradientIds,
  BarDepthValues,
  GroupBarDepthNodesParams,
  GroupedBarDepthNodes,
  MeasureBackBarDepthParams,
  ReadBarDepthValuePosParams,
  ResolveBackBarFrameParams,
  ResolveBackBarPlacementParams,
};
