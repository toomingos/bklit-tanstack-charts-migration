import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

export const PULSE_WAVE_HEIGHT_RATIO = 0.55;
export const PULSE_WAVE_HEIGHT_MIN_PX = 36;
export const PULSE_WAVE_DURATION_S = 2.4;
export const PULSE_WAVE_PEAK_OPACITY = 0.85;

export function buildBarSilhouettePath(
  bandX: number,
  bandWidth: number,
  topY: number,
  bottomY: number,
  depth: number,
  perspectiveRise: number,
  isRightOfCenter: boolean,
): string {
  if (depth <= 0) {
    return [`M ${bandX} ${topY}`, `L ${bandX + bandWidth} ${topY}`, `L ${bandX + bandWidth} ${bottomY}`, `L ${bandX} ${bottomY}`, "Z"].join(" ");
  }
  if (isRightOfCenter) {
    return [
      `M ${bandX - depth} ${topY - perspectiveRise}`,
      `L ${bandX + bandWidth - depth} ${topY - perspectiveRise}`,
      `L ${bandX + bandWidth} ${topY}`,
      `L ${bandX + bandWidth} ${bottomY}`,
      `L ${bandX} ${bottomY}`,
      `L ${bandX - depth} ${bottomY - perspectiveRise}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${bandX} ${topY}`,
    `L ${bandX + depth} ${topY - perspectiveRise}`,
    `L ${bandX + bandWidth + depth} ${topY - perspectiveRise}`,
    `L ${bandX + bandWidth + depth} ${bottomY - perspectiveRise}`,
    `L ${bandX + bandWidth} ${bottomY}`,
    `L ${bandX} ${bottomY}`,
    "Z",
  ].join(" ");
}

export interface BarPulseMarkOptions {
  id: string;
  data: ChartDatum[];
  bandWidth: number;
  bandScale?: { step?: () => number };
  bandPos: (label: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  activeIndex?: number;
  pulsePaused?: boolean;
}

export function barPulseMark(
  data: ChartDatum[],
  options: BarPulseMarkOptions,
): ChartMark<ChartDatum, string, number> | null {
  const { id, bandWidth, bandScale, bandPos, categoryAccessor, yAccessor, activeIndex, pulsePaused } = options;
  if (pulsePaused) return null;
  if (activeIndex == null || !Number.isFinite(activeIndex)) return null;
  if (activeIndex < 0 || activeIndex >= data.length) return null;
  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const yValues = data.map((d) => yAccessor(d));
    return {
      id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
          includeZero: true,
        },
      },
      render: ({ scales, chart }) => {
        const nodes: SceneNode[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const innerWidth = chart.width;
        const centerX = chart.x + innerWidth / 2;
        const step = (bandScale as unknown as { step?: () => number })?.step?.() ?? bandWidth;
        const maxDepth = barDepthMaxDepth(step, bandWidth);
        const i = activeIndex;
        const datum = data[i];
        if (!datum) return { nodes: [], points: [] };
        const yValue = yValues[i];
        if (typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0) return { nodes: [], points: [] };
        const valuePos = yScale.map(yValue);
        if (!Number.isFinite(valuePos)) return { nodes: [], points: [] };
        const barLengthPx = baseline - valuePos;
        if (barLengthPx <= 0) return { nodes: [], points: [] };
        const xValue = xValues[i]!;
        const bandX = bandPos(String(xValue));
        const cx = bandX + bandWidth / 2;
        const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
        const isRightOfCenter = offsetFromCenter > 0;
        const absOffset = Math.min(1, Math.abs(offsetFromCenter));
        const { depth, perspectiveRise } = barDepthAndRise(absOffset, barLengthPx, maxDepth);
        const topY = valuePos;
        const bottomY = baseline;
        const barHeight = bottomY - topY;
        const silhouettePath = buildBarSilhouettePath(bandX, bandWidth, topY, bottomY, depth, perspectiveRise, isRightOfCenter);
        const waveHeight = Math.max(barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);
        void waveHeight;
        void PULSE_WAVE_DURATION_S;
        void PULSE_WAVE_PEAK_OPACITY;
        nodes.push({
          kind: "area",
          key: `${id}:pulse`,
          points: [],
          path: silhouettePath,
          style: { fill: "white", fillOpacity: PULSE_WAVE_PEAK_OPACITY },
        } as SceneNode);
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-pulse",
              ariaHidden: true,
              children: nodes,
            },
          ],
        };
      },
    };
  });
}
