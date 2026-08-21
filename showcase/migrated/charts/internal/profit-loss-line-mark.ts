import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import { line } from "d3-shape";
import type { ChartDatum } from "./types";
import { fadeGradientStops, resolveFadeSides } from "./fade-mask";
import { splitProfitLossSegments } from "./profit-loss-segments";
import type { ProfitLossLineConfig } from "./profit-loss-config";

export interface ProfitLossLineMarkOptions {
  id: string;
  config: ProfitLossLineConfig;
  data: ChartDatum[];
  xDataKey: string;
  xScale: (value: Date) => number;
  yScale: (value: number) => number;
  innerWidth: number;
  focusedIndex: number | null;
  translateX: number;
  translateY: number;
}

function segmentLegendIndex(isPositive: boolean): number {
  return isPositive ? 0 : 1;
}

function buildPath(points: Array<{ x: number; y: number }>, curve: ProfitLossLineConfig["curve"]): string | null {
  if (points.length < 2) return null;
  const generator = line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curve);
  return generator(points) ?? null;
}

export function profitLossLineMarks(
  options: ProfitLossLineMarkOptions
): ChartMark<ChartDatum, Date, number>[] {
  const { config, data, xDataKey, xScale, yScale, focusedIndex, id } = options;
  if (data.length === 0) return [];

  const xAccessor = (d: Record<string, unknown>) => {
    const v = d[xDataKey];
    return v instanceof Date ? v : new Date(v as string);
  };

  const segments = splitProfitLossSegments({
    data: data as Record<string, unknown>[],
    dataKey: config.dataKey,
    xDataKey: config.xDataKey,
    xAccessor,
  });

  if (segments.length === 0) return [];

  const fadeSides = resolveFadeSides(config.fadeEdges);
  const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : null;
  const positiveGradientId = `profit-loss-gradient-pos-${config.dataKey}-${id}`;
  const negativeGradientId = `profit-loss-gradient-neg-${config.dataKey}-${id}`;

  const marks: ChartMark<ChartDatum, Date, number>[] = [];

  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s]!;
    const isDimmed =
      focusedIndex !== null &&
      focusedIndex !== segmentLegendIndex(segment.isPositive);
    const opacity = isDimmed ? 0.25 : 1;
    const stroke = segment.isPositive ? config.positiveColor : config.negativeColor;
    const gradientId = segment.isPositive ? positiveGradientId : negativeGradientId;
    const resolvedStroke = fadeStops ? `url(#${gradientId})` : stroke;

    const points: Array<{ x: number; y: number }> = [];
    for (const row of segment.data) {
      const dateVal = xAccessor(row as Record<string, unknown>);
      const x = xScale(dateVal);
      const rawY = (row as Record<string, unknown>)[config.dataKey];
      const y = typeof rawY === "number" ? (yScale(rawY) ?? 0) : 0;
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
    if (points.length < 2) continue;

    const path = buildPath(points, config.curve);
    if (!path) continue;

    const firstPoint = segment.data[0];
    const lastPoint = segment.data.at(-1);
    const segmentKey = `${id}-seg-${s}-${segment.isPositive ? "pos" : "neg"}-${String(firstPoint?.[xDataKey])}-${String(lastPoint?.[xDataKey])}`;

    marks.push(
      createMark(() => ({
        id: segmentKey,
        channels: {
          x: { scale: "x", values: [] },
          y: { scale: "y", values: [] },
        },
        render: () => ({
          nodes: [
            {
              kind: "group",
              key: segmentKey,
              // The svg renderer only emits whitelisted `style` attributes
              // (charts-core-d3 renderStyle) — a top-level `opacity` field on
              // the node is dropped, so the dim MUST go through style.opacity.
              // The 0.2s dim transition (bklit profit-loss-line.tsx:171) rides
              // on the className via styles.css (renderStyle has no
              // `transition` attribute).
              translateX: options.translateX,
              translateY: options.translateY,
              className: "chart-profit-loss-segment",
              style: { opacity },
              children: [
                {
                  kind: "polyline",
                  key: `${segmentKey}:line`,
                  points: [],
                  path,
                  style: {
                    fill: "none",
                    stroke: resolvedStroke,
                    strokeWidth: config.strokeWidth,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  },
                } as SceneNode,
              ],
            },
          ],
        }),
      }))
    );
  }

  return marks;
}

export interface ProfitLossGradientDef {
  id: string;
  startX: number;
  endX: number;
  stops: Array<{ offset: string; opacity: number; color: string }>;
}

export function resolveProfitLossGradientDefs(
  configs: ProfitLossLineConfig[],
  innerWidth: number,
  baseId: string
): ProfitLossGradientDef[] {
  const defs: ProfitLossGradientDef[] = [];
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i]!;
    const sides = resolveFadeSides(cfg.fadeEdges);
    if (!sides.any) continue;
    const stops = fadeGradientStops(sides);
    const gidPos = `profit-loss-gradient-pos-${cfg.dataKey}-${baseId}-${i}`;
    const gidNeg = `profit-loss-gradient-neg-${cfg.dataKey}-${baseId}-${i}`;
    defs.push({
      id: gidPos,
      startX: 0,
      endX: innerWidth,
      stops: stops.map((s) => ({ ...s, color: cfg.positiveColor })),
    });
    defs.push({
      id: gidNeg,
      startX: 0,
      endX: innerWidth,
      stops: stops.map((s) => ({ ...s, color: cfg.negativeColor })),
    });
  }
  return defs;
}
