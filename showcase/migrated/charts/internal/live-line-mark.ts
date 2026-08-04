// The LiveLine always renders one fill and one stroke for each series.  Keep
// those sibling scene groups in one mark so TanStack initializes the streaming
// data and renders the scales once, while retaining the existing DOM contract.
// This uses the supported createMark API; it does not mutate the rendered SVG.
import { createMark } from "@tanstack/charts";
import type { ChartCurve, ChartMark, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

export interface LiveLineMarkOptions {
  id: string;
  fillId: string;
  x: (d: ChartDatum) => Date;
  y: (d: ChartDatum) => number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  curve: ChartCurve;
  baselineY: number;
  withFill: boolean;
}

export function liveLineMark(
  data: ChartDatum[],
  options: LiveLineMarkOptions,
): ChartMark<ChartDatum, Date, number> {
  return createMark(() => {
    const xValues: Date[] = [];
    const yValues: number[] = [];
    let allFinite = true;
    for (const datum of data) {
      const x = options.x(datum);
      const y = options.y(datum);
      xValues.push(x);
      yValues.push(y);
      allFinite &&= Number.isFinite(y);
    }

    return {
      id: options.id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          // The live chart normally contains only finite values. Avoid a
          // second array allocation on that hot path while preserving the
          // existing invalid-value segmentation behavior.
          values: allFinite ? yValues : yValues.filter(Number.isFinite),
        },
      },
      render: ({ scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        const areaChildren: SceneNode[] = [];
        const lineChildren: SceneNode[] = [];
        let segment: Array<readonly [number, number]> = [];
        let segmentIndex = 0;

        const flush = () => {
          if (segment.length === 0) return;
          const lineKey = `${options.id}:default:segment:${segmentIndex}`;
          lineChildren.push({
            kind: "polyline",
            key: lineKey,
            points: segment,
            path: options.curve.line(segment),
            style: {
              fill: "none",
              stroke: options.stroke,
              strokeWidth: options.strokeWidth,
              lineCap: "round",
              lineJoin: "round",
            },
          });
          if (options.withFill) {
            const bottom = segment.map(
              ([x]) => [x, options.baselineY] as readonly [number, number],
            );
            areaChildren.push({
              kind: "area",
              key: `${options.fillId}:segment:${segmentIndex}`,
              points: [],
              path: options.curve.area(segment, bottom),
              style: { fill: options.fill, fillOpacity: 1 },
            });
          }
          segment = [];
          segmentIndex += 1;
        };

        if (xScale && yScale) {
          for (let i = 0; i < data.length; i += 1) {
            const yValue = yValues[i];
            if (!Number.isFinite(yValue)) {
              flush();
              continue;
            }
            segment.push([xScale.map(xValues[i]), yScale.map(yValue)]);
          }
          flush();
        }

        const nodes: SceneNode[] = [];
        if (options.withFill) {
          nodes.push({
            kind: "group",
            key: options.fillId,
            className: "ts-chart__area",
            ariaHidden: true,
            children: areaChildren,
          });
        }
        nodes.push({
          kind: "group",
          key: `${options.id}:default`,
          className: "ts-chart__line",
          ariaHidden: true,
          children: lineChildren,
        });
        return { nodes };
      },
    };
  });
}
