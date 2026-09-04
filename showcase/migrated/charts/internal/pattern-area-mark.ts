import { createMark } from "@tanstack/charts";
import type { ChartCurve, ChartMark, ResolvedScale, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

interface PatternAreaMarkOptions {
  readonly id: string;
  readonly x: (datum: Readonly<ChartDatum>) => Date;
  readonly y: (datum: Readonly<ChartDatum>) => number;
  readonly fill: string;
  readonly curve: ChartCurve;
}

interface PatternAreaSegmentsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly Readonly<Date>[];
  readonly yValues: readonly number[];
  readonly xScale: { readonly map: (value: Readonly<Date>) => number };
  readonly yScale: { readonly map: (value: number) => number };
  readonly id: string;
  readonly fill: string;
  readonly curve: ChartCurve;
}

// Scales is typed as a total Record, but scale ids resolve at runtime.
// A misconfigured chart can omit one, so the widened record keeps this check honest.
const hasScale = (scales: Readonly<Record<string, ResolvedScale | undefined>>, id: string): boolean =>
  scales[id] !== undefined;

// Contiguous index run of finite points; gaps in the series (non-finite y)
// Split the area into separately keyed segments.
interface AreaRun {
  readonly start: number;
  readonly end: number;
}

const splitFiniteRuns = (yValues: readonly number[]): AreaRun[] => {
  const runs: AreaRun[] = [];
  let runStart = -1;
  for (let i = 0; i <= yValues.length; i += 1) {
    const finite = i < yValues.length && Number.isFinite(yValues[i]);
    if (finite && runStart < 0) {runStart = i;}
    if (!finite && runStart >= 0) {
      runs.push({ end: i, start: runStart });
      runStart = -1;
    }
  }
  return runs;
};

// Builds one area node for a contiguous run of finite points.
const buildAreaSegmentNode = (
  params: Readonly<PatternAreaSegmentsParams> & { readonly run: AreaRun; readonly baselineY: number; readonly segmentIndex: number },
): SceneNode => {
  const top: (readonly [number, number])[] = [];
  for (let i = params.run.start; i < params.run.end; i += 1) {
    top.push([params.xScale.map(params.xValues[i]), params.yScale.map(params.yValues[i])]);
  }
  const bottom: (readonly [number, number])[] = [];
  for (const [px] of top) {
    bottom.push([px, params.baselineY]);
  }
  return {
    key: `${params.id}:segment:${params.segmentIndex}`,
    kind: "area",
    path: params.curve.area(top, bottom),
    points: [],
    style: { fill: params.fill, fillOpacity: 1 },
  };
};

const buildAreaChildren = (params: Readonly<PatternAreaSegmentsParams>): SceneNode[] => {
  const baselineY = params.yScale.map(0);
  return splitFiniteRuns(params.yValues).map((run, segmentIndex) => buildAreaSegmentNode({ ...params, baselineY, run, segmentIndex }));
};

const patternAreaMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<PatternAreaMarkOptions>): ChartMark<ChartDatum, Date, number> => createMark(() => {
    const xValues = data.map((datum) => options.x(datum));
    const yValues = data.map((datum) => options.y(datum));
    return {
      channels: {
        x: { scale: "x", values: xValues },
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
        const children = hasScale(scales, "x") && hasScale(scales, "y")
          ? buildAreaChildren({ curve: options.curve, data, fill: options.fill, id: options.id, xScale, xValues, yScale, yValues })
          : [];
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

export { patternAreaMark };
export type { PatternAreaMarkOptions };
