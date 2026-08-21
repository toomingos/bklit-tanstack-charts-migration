import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartPoint, SceneNode } from "@tanstack/charts";
import type { ScaleBand } from "d3-scale";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

export interface BarTrimmedMarkOptions {
  id: string;
  data: ChartDatum[];
  groupBandwidth: number;
  groupScale: ScaleBand<string>;
  fill: string;
  radius: number;
  bandWidth: number;
  bandScale?: { step?: () => number };
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  innerWidth: number;
  chartX: number;
  centerX: number;
  maxDepth: number;
}

export function barTrimmedMark(data: ChartDatum[], options: BarTrimmedMarkOptions): ChartMark<ChartDatum, string, number> {
  const { id, groupScale, fill, radius, bandWidth, bandScale, categoryAccessor, yAccessor, innerWidth, chartX, centerX: _centerX, maxDepth: _maxDepth } = options;
  void bandScale;
  void innerWidth;
  void chartX;
  void _centerX;
  void _maxDepth;
  void barDepthAndRise;
  void barDepthMaxDepth;
  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const rawY = data.map((d) => yAccessor(d));
    return {
      id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: rawY.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
          includeZero: true,
        },
      },
      render: ({ scales, chart }) => {
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, string, number>[] = [];
        const innerW = chart.width;
        const cx0 = chart.x + innerW / 2;
        const step = (bandScale as unknown as { step?: () => number })?.step?.() ?? bandWidth;
        const maxD = barDepthMaxDepth(step, bandWidth);
        const totalBandwidth = scales.x.bandwidth || bandWidth;
        // The raw d3 group scale carries no pixel range until ranged to the
        // category band (charts-core resolveGroupScale does the same before
        // reading positions); copy() keeps the shared instance unmutated.
        const gs = groupScale.copy().range([0, totalBandwidth]);
        const width = gs.bandwidth();
        for (let i = 0; i < data.length; i++) {
          const datum = data[i]!;
          const xValue = xValues[i]!;
          const yValue = rawY[i];
          if (typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0) continue;
          const valuePos = yScale.map(yValue);
          if (!Number.isFinite(valuePos)) continue;
          const naturalHeight = baseline - valuePos;
          if (naturalHeight <= 0) continue;
          const groupOffset = gs(id) ?? 0;
          const center = scales.x.map(xValue);
          const x = center - totalBandwidth / 2 + groupOffset;
          const bandCenter = x + width / 2;
          const offsetFromCenter = innerW > 0 ? (bandCenter - cx0) / (innerW / 2) : 0;
          const absOffset = Math.min(1, Math.abs(offsetFromCenter));
          const { perspectiveRise } = barDepthAndRise(absOffset, naturalHeight, maxD);
          const trim = Math.min(perspectiveRise, Math.max(0, naturalHeight - 1));
          const y = valuePos + trim;
          const height = naturalHeight - trim;
          if (height <= 0) continue;
          nodes.push({
            kind: "rect",
            key: `${id}:${String(xValue)}:${i}`,
            x,
            y,
            width,
            height,
            radius: radius || undefined,
            style: { fill },
          });
          points.push({
            key: `${id}:pt:${i}`,
            markId: id,
            group: id,
            groupLabel: id,
            datum,
            datumIndex: i,
            xValue,
            yValue,
            x: x + width / 2,
            y: valuePos,
            color: fill,
          });
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-y",
              ariaHidden: true,
              children: nodes,
            },
          ],
          points,
        };
      },
    };
  });
}
