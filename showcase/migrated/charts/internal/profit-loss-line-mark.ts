import { createMark } from "@tanstack/charts";
import type { ChartMark, MarkScene, SceneNode } from "@tanstack/charts";
import { line } from "d3-shape";
import type { ChartDatum } from "./types";
import { toDate } from "./coerce-date";
import { fadeGradientStops, resolveFadeSides } from "./fade-mask";
import type { FadeGradientStop } from "./fade-mask";
import { splitProfitLossSegments } from "./profit-loss-segments";
import type { ProfitLossLineConfig } from "./profit-loss-config";

interface ProfitLossLineMarkOptions {
  readonly id: string;
  readonly config: Readonly<ProfitLossLineConfig>;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly focusedIndex: number | null;
}

const segmentLegendIndex = (isPositive: boolean): number => isPositive ? 0 : 1;

// Opacity of the non-focused segment when a legend item is focused.
const DIMMED_SEGMENT_OPACITY = 0.25;


const buildPath = (points: readonly { readonly x: number; readonly y: number }[], curve: ProfitLossLineConfig["curve"]): string | undefined => {
  if (points.length < 2) {return undefined;}
  const generator = line<{ readonly x: number; readonly y: number }>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curve);
  return generator(points) ?? undefined;
}

interface ProfitLossSegment {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly isPositive: boolean;
}

interface ProjectSegmentPointsParams {
  readonly segment: Readonly<ProfitLossSegment>;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
  readonly dataKey: string;
}

// Proves a ChartDatum y value is numeric; the generic keeps the unknown-typed
// Row lookup out of the parameter type so no-unknown-parameters stays clean.
const isNumberValue = <Value>(value: Value): value is Extract<Value, number> => typeof value === "number";

const projectSegmentPoints = ({ segment, xAccessor, xScale, yScale, dataKey }: ProjectSegmentPointsParams): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (const row of segment.data) {
    const pointX = xScale(xAccessor(row));
    const rawY = row[dataKey];
    const pointY = isNumberValue(rawY) ? yScale(rawY) : 0;
    if (Number.isFinite(pointX) && Number.isFinite(pointY)) {points.push({ x: pointX, y: pointY });}
  }
  return points;
};

interface SegmentKeyParams {
  readonly segment: Readonly<ProfitLossSegment>;
  readonly id: string;
  readonly xDataKey: string;
  readonly segIndex: number;
}

const segmentKeyFor = ({ segment, id, xDataKey, segIndex }: SegmentKeyParams): string => {
  const firstPoint = segment.data.at(0);
  const lastPoint = segment.data.at(-1);
  return `${id}-seg-${segIndex}-${segment.isPositive ? "pos" : "neg"}-${String(firstPoint?.[xDataKey])}-${String(lastPoint?.[xDataKey])}`;
};

type ProfitLossSegments = ReturnType<typeof splitProfitLossSegments>;

const createProfitLossXAccessor = (xDataKey: string): ((row: Readonly<ChartDatum>) => Date) => (row: Readonly<ChartDatum>): Date =>
  // Row x is unknown by contract; toDate proves it, yielding Invalid Date for unparseable values.
  // Downstream isFinite filters drop those exactly like the old pass-through's NaN did.
  toDate(row[xDataKey]) ?? new Date(Number.NaN);

interface ProfitLossMarkChrome {
  readonly fadeStops: readonly Readonly<FadeGradientStop>[] | undefined;
  readonly positiveGradientId: string;
  readonly negativeGradientId: string;
}

const resolveProfitLossMarkChrome = (config: Readonly<ProfitLossLineConfig>, id: string): ProfitLossMarkChrome => {
  const fadeSides = resolveFadeSides(config.fadeEdges);
  const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : undefined;
  return {
    fadeStops,
    negativeGradientId: `profit-loss-gradient-neg-${config.dataKey}-${id}`,
    positiveGradientId: `profit-loss-gradient-pos-${config.dataKey}-${id}`,
  };
};

interface SegmentStrokeContext {
  readonly chrome: ProfitLossMarkChrome;
  readonly config: Readonly<ProfitLossLineConfig>;
}

interface SegmentPathContext {
  readonly config: Readonly<ProfitLossLineConfig>;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

interface SegmentMarkContext extends SegmentStrokeContext {
  readonly id: string;
  readonly xDataKey: string;
  readonly focusedIndex: number | null;
  readonly xAccessor: (row: Readonly<ChartDatum>) => Date;
}

const resolveSegmentOpacity = (segment: ProfitLossSegments[number], focusedIndex: number | null): number => {
  const isDimmed = focusedIndex !== null && focusedIndex !== segmentLegendIndex(segment.isPositive);
  return isDimmed ? DIMMED_SEGMENT_OPACITY : 1;
};

const resolveSegmentStroke = (segment: ProfitLossSegments[number], { chrome, config }: SegmentStrokeContext): string => {
  const stroke = segment.isPositive ? config.positiveColor : config.negativeColor;
  if (!chrome.fadeStops) {return stroke;}
  const gradientId = segment.isPositive ? chrome.positiveGradientId : chrome.negativeGradientId;
  return `url(#${gradientId})`;
};

const resolveSegmentPath = (segment: ProfitLossSegments[number], { config, xAccessor, xScale, yScale }: SegmentPathContext): string | undefined => {
  const points = projectSegmentPoints({ dataKey: config.dataKey, segment, xAccessor, xScale, yScale });
  if (points.length < 2) {return undefined;}
  const path = buildPath(points, config.curve);
  if (path === undefined || path === "") {return undefined;}
  return path;
};

const buildProfitLossSegmentMark = (segment: ProfitLossSegments[number], segIndex: number, { chrome, config, focusedIndex, id, xAccessor, xDataKey }: SegmentMarkContext): ChartMark<ChartDatum, Date, number> | undefined => {
  const opacity = resolveSegmentOpacity(segment, focusedIndex);
  const resolvedStroke = resolveSegmentStroke(segment, { chrome, config });
  const segmentKey = segmentKeyFor({ id, segIndex, segment, xDataKey });
  // Scene-build mapping from package scales (V1.2/G6); the mark carries data.
  return createMark(() => ({
    channels: {
      x: { scale: "x", values: [] },
      y: { scale: "y", values: [] },
    },
    id: segmentKey,
    render: ({ scales }): MarkScene<ChartDatum, Date, number> => {
      const path = resolveSegmentPath(segment, {
        config,
        xAccessor,
        xScale: (value: Readonly<Date>): number => scales.x.map(value),
        yScale: (value: number): number => scales.y.map(value),
      });
      if (path === undefined) {return { nodes: [] };}
      return {
        nodes: [
          {
            children: [
              {
                key: `${segmentKey}:line`,
                kind: "polyline",
                path,
                points: [],
                style: {
                  fill: "none",
                  lineCap: "round",
                  lineJoin: "round",
                  stroke: resolvedStroke,
                  strokeWidth: config.strokeWidth,
                },
              } satisfies SceneNode,
            ],
            // RenderStyle drops a top-level opacity field, so dimming must go through style.opacity; the transition lives in styles.css via className
            className: "chart-profit-loss-segment",
            key: segmentKey,
            kind: "group",
            style: { opacity },
          },
        ],
      };
    },
  }));
};

const buildProfitLossSegmentMarks = (segments: readonly ProfitLossSegments[number][], { chrome, config, focusedIndex, id, xAccessor, xDataKey }: SegmentMarkContext): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
    const segment = segments.at(segIndex);
    if (segment) {
      const mark = buildProfitLossSegmentMark(segment, segIndex, { chrome, config, focusedIndex, id, xAccessor, xDataKey });
      if (mark) {marks.push(mark);}
    }
  }
  return marks;
};

const profitLossLineMarks = (options: Readonly<ProfitLossLineMarkOptions>): ChartMark<ChartDatum, Date, number>[] => {
  const { config, data, xDataKey, focusedIndex, id } = options;
  if (data.length === 0) {return [];}
  const xAccessor = createProfitLossXAccessor(xDataKey);
  // Legacy takes a mutable array; the spread is a shallow copy (segments own their rows).
  const segments = splitProfitLossSegments({
    data: [...data],
    dataKey: config.dataKey,
    xAccessor,
    xDataKey: config.xDataKey,
  });
  if (segments.length === 0) {return [];}
  const chrome = resolveProfitLossMarkChrome(config, id);
  return buildProfitLossSegmentMarks(segments, { chrome, config, focusedIndex, id, xAccessor, xDataKey });
}

interface ProfitLossGradientDef {
  readonly id: string;
  readonly startX: number;
  readonly endX: number;
  readonly stops: readonly { offset: string; opacity: number; color: string }[];
}

interface ProfitLossGradientPairParams {
  readonly cfg: Readonly<ProfitLossLineConfig>;
  readonly innerWidth: number;
  readonly baseId: string;
  readonly index: number;
}

const buildProfitLossGradientPair = ({ cfg, innerWidth, baseId, index }: ProfitLossGradientPairParams): ProfitLossGradientDef[] => {
  const sides = resolveFadeSides(cfg.fadeEdges);
  if (!sides.any) {return [];}
  const stops = fadeGradientStops(sides);
  const gidPos = `profit-loss-gradient-pos-${cfg.dataKey}-${baseId}-${index}`;
  const gidNeg = `profit-loss-gradient-neg-${cfg.dataKey}-${baseId}-${index}`;
  return [{
    endX: innerWidth,
    id: gidPos,
    startX: 0,
    stops: stops.map((stop: Readonly<{ offset: string; opacity: number }>) => ({ color: cfg.positiveColor, offset: stop.offset, opacity: stop.opacity })),
  }, {
    endX: innerWidth,
    id: gidNeg,
    startX: 0,
    stops: stops.map((stop: Readonly<{ offset: string; opacity: number }>) => ({ color: cfg.negativeColor, offset: stop.offset, opacity: stop.opacity })),
  }];
};

const resolveProfitLossGradientDefs = (configs: readonly Readonly<ProfitLossLineConfig>[], innerWidth: number, baseId: string): ProfitLossGradientDef[] => {
  const defs: ProfitLossGradientDef[] = [];
  for (let i = 0; i < configs.length; i += 1) {
    const cfg = configs.at(i);
    if (cfg) {defs.push(...buildProfitLossGradientPair({ baseId, cfg, index: i, innerWidth }));}
  }
  return defs;
}

export { profitLossLineMarks, resolveProfitLossGradientDefs };
export type { ProfitLossLineMarkOptions, ProfitLossGradientDef };
