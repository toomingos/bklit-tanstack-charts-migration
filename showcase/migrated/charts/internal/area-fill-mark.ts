// Skips per-datum ChartPoints (heap +19% at n=1000); keeps the `.ts-chart__area[data-ts-key]` DOM contract.
import { createMark } from "@tanstack/charts";
import type { ChartCurve, ChartMark, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

interface AreaFillOptions {
  // By convention `${dataKey}__fill`.
  readonly id: string;
  readonly x: (datum: Readonly<ChartDatum>) => Date;
  readonly y: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly curve: Readonly<ChartCurve>;
  // No ChartPoints, so mark states can't dim on hover.
  readonly fillOpacity?: number;
}

interface AreaDateScale {
  readonly map: (value: Readonly<Date>) => number;
}

interface AreaNumberScale {
  readonly map: (value: number) => number;
}

interface AreaChildrenParams {
  readonly baselineY: number;
  readonly curve: Readonly<ChartCurve>;
  readonly fill: string;
  readonly fillOpacity: number | undefined;
  readonly id: string;
  readonly xScale: AreaDateScale;
  readonly xValues: readonly Readonly<Date>[];
  readonly yScale: AreaNumberScale;
  readonly yValues: readonly number[];
}

interface AreaRunsParams {
  readonly xScale: AreaDateScale;
  readonly xValues: readonly Readonly<Date>[];
  readonly yScale: AreaNumberScale;
  readonly yValues: readonly number[];
}

// Scales is typed as a total Record, but scale ids resolve at runtime.
// A misconfigured chart can omit one, so the widened record keeps this check honest.
const hasScale = (scales: Readonly<Record<string, ResolvedScale | undefined>>, id: string): boolean =>
  scales[id] !== undefined;

// Pixel runs of consecutive finite points; non-finite values split runs.
// The sentinel iteration flushes the trailing run.
const collectAreaRuns = (params: Readonly<AreaRunsParams>): readonly (readonly (readonly [number, number])[])[] => {
  const { xScale, xValues, yScale, yValues } = params;
  const runs: (readonly (readonly [number, number])[])[] = [];
  let top: (readonly [number, number])[] = [];
  const flush = (): void => {
    if (top.length === 0) {return;}
    runs.push(top);
    top = [];
  };
  for (let datumIndex = 0; datumIndex <= xValues.length; datumIndex += 1) {
    const yValue = yValues[datumIndex];
    if (datumIndex === xValues.length || !Number.isFinite(yValue)) {
      flush();
    } else {
      top.push([xScale.map(xValues[datumIndex]), yScale.map(yValue)]);
    }
  }
  return runs;
}

// Gap-aware segments: one filled area path per run against the zero baseline.
const buildAreaChildren = (params: Readonly<AreaChildrenParams>): SceneNode[] => {
  const { baselineY, curve, fill, fillOpacity, id } = params;
  const runs = collectAreaRuns(params);
  return runs.map((top, segmentIndex): SceneNode => {
    const bottom: readonly (readonly [number, number])[] = top.map(([px]): readonly [number, number] => [px, baselineY]);
    return {
      key: `${id}:segment:${segmentIndex}`,
      kind: "area",
      path: curve.area(top, bottom),
      points: [],
      style: { fill, fillOpacity: fillOpacity ?? 1 },
    };
  });
}

const areaFill = (data: readonly Readonly<ChartDatum>[], options: Readonly<AreaFillOptions>): ChartMark<ChartDatum, Date, number> => createMark(() => {
    const xValues = data.map((datum) => options.x(datum));
    const yValues = data.map((datum) => options.y(datum));
    return {
      channels: {
        x: { scale: "x", values: xValues },
        // IncludeZero mirrors areaY's y1=0 baseline so scale inference matches.
        y: {
          includeZero: true,
          scale: "y",
          values: yValues.filter((value) => Number.isFinite(value)),
        },
      },
      id: options.id,
      render: ({ scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        const children: SceneNode[] = [];
        if (hasScale(scales, "x") && hasScale(scales, "y")) {
          children.push(...buildAreaChildren({
            baselineY: yScale.map(0),
            curve: options.curve,
            fill: options.fill,
            fillOpacity: options.fillOpacity,
            id: options.id,
            xScale,
            xValues,
            yScale,
            yValues,
          }));
        }
        return {
          nodes: [
            {
              ariaHidden: true,
              children,
              className: "ts-chart__area",
              key: options.id,
              kind: "group",
            },
          ],
        };
      },
    };
  });

export { areaFill };
export type { AreaFillOptions };

