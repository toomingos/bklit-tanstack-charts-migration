import { createMark } from "@tanstack/charts";
import type { ChartCurve, ChartMark, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

export interface PatternAreaMarkOptions {
  id: string;
  x: (d: ChartDatum) => Date;
  y: (d: ChartDatum) => number;
  fill: string;
  curve: ChartCurve;
}

export function patternAreaMark(
  data: ChartDatum[],
  options: PatternAreaMarkOptions,
): ChartMark<ChartDatum, Date, number> {
  return createMark(() => {
    const xValues = data.map(options.x);
    const yValues = data.map(options.y);
    return {
      id: options.id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter(Number.isFinite),
          includeZero: true,
        },
      },
      render: ({ scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        const children: SceneNode[] = [];
        if (xScale && yScale) {
          const baselineY = yScale.map(0);
          let top: Array<readonly [number, number]> = [];
          let segmentIndex = 0;
          const flush = () => {
            if (top.length === 0) return;
            const bottom = top.map(
              ([px]) => [px, baselineY] as readonly [number, number],
            );
            children.push({
              kind: "area",
              key: `${options.id}:segment:${segmentIndex}`,
              points: [],
              path: options.curve.area(top, bottom),
              style: { fill: options.fill, fillOpacity: 1 },
            });
            top = [];
            segmentIndex += 1;
          };
          for (let i = 0; i < data.length; i++) {
            const yValue = yValues[i];
            if (!Number.isFinite(yValue)) {
              flush();
              continue;
            }
            top.push([xScale.map(xValues[i]), yScale.map(yValue)]);
          }
          flush();
        }
        return {
          nodes: [
            {
              kind: "group",
              key: options.id,
              className: "ts-chart__area",
              ariaHidden: true,
              children,
            },
          ],
        };
      },
    };
  });
}
