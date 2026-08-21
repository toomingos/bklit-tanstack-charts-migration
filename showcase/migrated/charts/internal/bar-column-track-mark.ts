import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import { computeSquareColumn } from "./bar-squares-layout";
import type { ChartDatum } from "./types";

export interface BarColumnTrackMarkOptions {
  id: string;
  data: ChartDatum[];
  seriesIndex: number;
  seriesCount: number;
  groupGap: number;
  bandWidth: number;
  bandPos: (categoryLabel: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  fill: string;
  opacity: number;
  squareGap: number;
  squareRadius: number;
  squareFit: boolean;
}

function bandWidthForSquares(bandWidth: number, seriesCount: number, groupGap: number): number {
  if (!bandWidth || seriesCount === 0) return 0;
  const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
  return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
}

export function barColumnTrackMark(
  data: ChartDatum[],
  options: BarColumnTrackMarkOptions,
): ChartMark<ChartDatum, string, number> {
  const {
    id,
    seriesIndex,
    seriesCount,
    groupGap,
    bandWidth,
    bandPos,
    categoryAccessor,
    yAccessor,
    fill,
    opacity,
    squareGap,
    squareRadius,
    squareFit,
  } = options;

  const squareSize = bandWidthForSquares(bandWidth, seriesCount, groupGap);
  const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
  const rx = squareSize * squareRadius;

  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const yValues = data.map((d) => yAccessor(d));

    return {
      id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter((v) => typeof v === "number" && Number.isFinite(v)),
          includeZero: true,
        },
      },
      render: ({ scales, chart }) => {
        const nodes: SceneNode[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const topY = chart.y;

        for (let i = 0; i < data.length; i++) {
          const xValue = xValues[i]!;
          const yValue = yValues[i];
          if (typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0) continue;

          const valuePos = yScale.map(yValue);
          if (!Number.isFinite(valuePos)) continue;
          const barLengthPx = baseline - valuePos;
          if (barLengthPx <= 0) continue;

          const layout = computeSquareColumn({ barLengthPx, squareSize, gap: squareGap, fit: squareFit });
          if (layout.count === 0) continue;
          const columnTop = baseline - layout.columnHeight;
          const trackHeight = Math.max(0, columnTop - topY);
          if (trackHeight <= 0) continue;

          const bandStart = bandPos(String(xValue));
          const x = bandStart + seriesIndex * (squareSize + effectiveGroupGap);
          const key = `${id}:track:${i}`;
          nodes.push({
            kind: "rect",
            key,
            x,
            y: topY,
            width: squareSize,
            height: trackHeight,
            radius: rx || undefined,
            style: { fill, opacity },
          });
        }

        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-y ts-chart__bar-column-track",
              ariaHidden: true,
              children: nodes,
            },
          ],
        };
      },
    };
  });
}
