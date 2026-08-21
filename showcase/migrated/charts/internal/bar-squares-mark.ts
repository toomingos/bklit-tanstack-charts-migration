import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartPoint, SceneNode } from "@tanstack/charts";
import { computeSquareColumn } from "./bar-squares-layout";
import type { ChartDatum, GradientStop } from "./types";
import type { PatternPresetId } from "./pattern-preset";

export interface BarSquaresMarkOptions {
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
  squareGap: number;
  squareRadius: number;
  squareFit: boolean;
  useGradient: boolean;
  gradientStops: GradientStop[];
  patternPreset?: PatternPresetId;
  gradientId: string;
  patternId: string;
}

function bandWidthForSquares(bandWidth: number, seriesCount: number, groupGap: number): number {
  if (!bandWidth || seriesCount === 0) return 0;
  const effectiveGroupGap = seriesCount > 1 ? groupGap : 0;
  return (bandWidth - effectiveGroupGap * (seriesCount - 1)) / seriesCount;
}

export function barSquaresMark(
  data: ChartDatum[],
  options: BarSquaresMarkOptions,
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
    squareGap,
    squareRadius,
    squareFit,
    useGradient,
    patternPreset,
    gradientId,
    patternId,
  } = options;

  const isPatternFill = fill.startsWith("url(");
  const hasNestedPattern = !!(useGradient && isPatternFill && patternPreset && patternPreset !== "none");
  const effectiveFill = useGradient
    ? hasNestedPattern
      ? `url(#${patternId})`
      : `url(#${gradientId})`
    : fill;

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
      render: ({ scales }) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, string, number>[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;

        for (let i = 0; i < data.length; i++) {
          const datum = data[i]!;
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
          const bandStart = bandPos(String(xValue));
          const x = bandStart + seriesIndex * (squareSize + effectiveGroupGap);

          for (let s = 0; s < layout.count; s++) {
            const relY = layout.positions[s]!;
            const y = columnTop + relY;
            const key = `${id}:sq:${i}:${s}`;
            nodes.push({
              kind: "rect",
              key,
              x,
              y,
              width: squareSize,
              height: squareSize,
              radius: rx || undefined,
              style: { fill: effectiveFill },
            });
            if (s === 0) {
              const xCenter = x + squareSize / 2;
              const yCenter = y + squareSize / 2;
              points.push({
                key: `${id}:pt:${i}`,
                markId: id,
                group: id,
                groupLabel: id,
                datum,
                datumIndex: i,
                xValue,
                yValue,
                x: xCenter,
                y: yCenter,
                color: fill,
              });
            }
          }
        }

        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-y ts-chart__bar-squares",
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
