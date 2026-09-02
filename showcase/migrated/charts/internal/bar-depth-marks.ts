import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartMarkState, ChartPoint, SceneNode } from "@tanstack/charts";
import { BAR_DEPTH_MIN_PX, barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import type { ChartDatum } from "./types";

export const DEFAULT_GROUND_SHADOW = 0.26;
export const GLASS_TIP_OPACITY = 0.2;
export const BAR_FADED_OPACITY = 0.3;

// bklit bar-depth.tsx buildPosBarStops/buildNegBarStops — per-bar
// (objectBoundingBox) glass gradient stop lists. 0% = the bar's tip (or
// baseline for negative bars), 100% = the opposite edge. Ported verbatim so
// the migrated gradient defs (built by bar-chart.tsx) match bklit exactly.
export interface GlassGradientStop {
  offset: string;
  color: string;
  opacity: string;
}

export function buildPosBarStops(groundShadow: number): GlassGradientStop[] {
  return [
    { offset: "0%", color: "white", opacity: String(GLASS_TIP_OPACITY) },
    { offset: "3%", color: "white", opacity: "0.09" },
    { offset: "8%", color: "white", opacity: "0.02" },
    { offset: "55%", color: "white", opacity: "0" },
    { offset: "100%", color: "black", opacity: String(groundShadow) },
  ];
}

export function buildNegBarStops(groundShadow: number): GlassGradientStop[] {
  return [
    { offset: "0%", color: "black", opacity: String(groundShadow) },
    { offset: "45%", color: "white", opacity: "0" },
    { offset: "92%", color: "white", opacity: "0.02" },
    { offset: "97%", color: "white", opacity: "0.09" },
    { offset: "100%", color: "white", opacity: String(GLASS_TIP_OPACITY) },
  ];
}

/** IDs of the shared `<linearGradient>` defs bar-chart.tsx builds once per
 * chart (mirrors bklit's per-layer `useId()`-scoped defs, but shared across
 * Back+Front since both need the identical per-bar glass ramp). */
export interface BarDepthGradientIds {
  glassPosId: string;
  glassNegId: string;
  sideShadeRtlId: string;
  sideShadeLtrId: string;
  topShadeId: string;
}

export interface BarDepthBackMarkOptions {
  id: string;
  data: ChartDatum[];
  bandWidth: number;
  bandScale?: { step?: () => number };
  bandPos: (label: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  fill: string;
  gradientIds: BarDepthGradientIds;
  /** Native mark-state definitions (pointer-row dim), passed through to the
      initialized mark unchanged. */
  states?: readonly ChartMarkState<ChartDatum>[];
  /** Blanket opacity (legend-hover dim, D480 — legacy dims depth chrome on
      ANY legend hover). Omitted = no attribute. */
  opacity?: number;
}

export interface BarDepthFrontMarkOptions {
  id: string;
  data: ChartDatum[];
  bandWidth: number;
  bandScale?: { step?: () => number };
  bandPos: (label: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  gradientIds: Pick<BarDepthGradientIds, "glassPosId" | "glassNegId">;
  /** Native mark-state definitions (pointer-row dim), passed through to the
      initialized mark unchanged. */
  states?: readonly ChartMarkState<ChartDatum>[];
  /** Blanket opacity (legend-hover dim, D480). Omitted = no attribute. */
  opacity?: number;
}

function sideFacePoints(
  bandX: number,
  bandWidth: number,
  depth: number,
  perspectiveRise: number,
  isRightOfCenter: boolean,
  topEdge: number,
  bottomEdge: number,
): [number, number][] {
  if (isRightOfCenter) {
    const x = bandX;
    return [
      [x, topEdge],
      [x - depth, topEdge - perspectiveRise],
      [x - depth, bottomEdge - perspectiveRise],
      [x, bottomEdge],
    ];
  }
  const x = bandX + bandWidth;
  return [
    [x, topEdge],
    [x + depth, topEdge - perspectiveRise],
    [x + depth, bottomEdge - perspectiveRise],
    [x, bottomEdge],
  ];
}

function lidFacePoints(
  bandX: number,
  bandWidth: number,
  depth: number,
  perspectiveRise: number,
  isRightOfCenter: boolean,
  topY: number,
): [number, number][] {
  const left = bandX;
  const right = bandX + bandWidth;
  if (isRightOfCenter) {
    return [
      [left, topY],
      [right, topY],
      [right - depth, topY - perspectiveRise],
      [left - depth, topY - perspectiveRise],
    ];
  }
  return [
    [left, topY],
    [right, topY],
    [right + depth, topY - perspectiveRise],
    [left + depth, topY - perspectiveRise],
  ];
}

export function barDepthBackMark(data: ChartDatum[], options: BarDepthBackMarkOptions): ChartMark<ChartDatum, string, number> {
  const { id, bandWidth, bandScale, bandPos, categoryAccessor, yAccessor, fill, gradientIds, states, opacity } = options;
  const { glassPosId, sideShadeRtlId, sideShadeLtrId, topShadeId } = gradientIds;
  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const yValues = data.map((d) => yAccessor(d));
    return {
      id,
      states: states?.length ? { data, definitions: states } : undefined,
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
        const points: ChartPoint<ChartDatum, string, number>[] = [];
        const baseline = scales.y.map(0);
        const yScale = scales.y;
        const innerWidth = chart.width;
        const centerX = chart.x + innerWidth / 2;
        const step = (bandScale as unknown as { step?: () => number })?.step?.() ?? bandWidth;
        const maxDepth = barDepthMaxDepth(step, bandWidth);
        for (let i = 0; i < data.length; i++) {
          const datum = data[i]!;
          const xValue = xValues[i]!;
          const yValue = yValues[i];
          if (typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0) continue;
          const valuePos = yScale.map(yValue);
          if (!Number.isFinite(valuePos)) continue;
          const barLengthPx = baseline - valuePos;
          if (barLengthPx <= 0) continue;
          const bandX = bandPos(String(xValue));
          const cx = bandX + bandWidth / 2;
          const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
          const isRightOfCenter = offsetFromCenter > 0;
          const absOffset = Math.min(1, Math.abs(offsetFromCenter));
          const { depth, perspectiveRise } = barDepthAndRise(absOffset, barLengthPx, maxDepth);
          if (depth < BAR_DEPTH_MIN_PX) continue;
          const topY = valuePos;
          const bottomY = baseline;
          const side = sideFacePoints(bandX, bandWidth, depth, perspectiveRise, isRightOfCenter, topY, bottomY);
          const lid = lidFacePoints(bandX, bandWidth, depth, perspectiveRise, isRightOfCenter, topY);
          // Side face — bklit BarDepthBack: solid color, then a directional
          // black shade (lit front edge -> dark back edge), then the same
          // per-bar Y-anchored glass ramp as the front face for continuity.
          const sideShadeId = isRightOfCenter ? sideShadeRtlId : sideShadeLtrId;
          // Two points per row (`:side:<i>` / `:lid:<i>`) — each is an exact
          // `:`-boundary prefix of its face's sub-node keys (`:side:<i>:shade`,
          // `:side:<i>:glass`, `:lid:<i>:tip`, `:lid:<i>:shade`), so the
          // library's prefix-based scene point-ownership matching attaches
          // both points to every pass of that face for per-row `states`
          // targeting (dist/scene-point-ownership-internal.js).
          const sideKey = `${id}:side:${i}`;
          const lidKey = `${id}:lid:${i}`;
          points.push({
            key: sideKey,
            markId: id,
            group: id,
            groupLabel: id,
            datum,
            datumIndex: i,
            xValue,
            yValue,
            x: bandX + bandWidth / 2,
            y: (topY + bottomY) / 2,
            color: fill,
          });
          points.push({
            key: lidKey,
            markId: id,
            group: id,
            groupLabel: id,
            datum,
            datumIndex: i,
            xValue,
            yValue,
            x: bandX + bandWidth / 2,
            y: topY,
            color: fill,
          });
          nodes.push({
            kind: "area",
            key: sideKey,
            points: side,
            style: { fill, opacity },
          });
          nodes.push({
            kind: "area",
            key: `${sideKey}:shade`,
            points: side,
            style: { fill: `url(#${sideShadeId})`, opacity },
          });
          nodes.push({
            kind: "area",
            key: `${sideKey}:glass`,
            points: side,
            style: { fill: `url(#${glassPosId})`, opacity },
          });
          // Lid (top face) — solid color, a flat tip-bright highlight, then a
          // directional 3D shade darkening the back edge (bklit BarDepthBack).
          nodes.push({
            kind: "area",
            key: lidKey,
            points: lid,
            style: { fill, opacity },
          });
          nodes.push({
            kind: "area",
            key: `${lidKey}:tip`,
            points: lid,
            style: { fill: "white", fillOpacity: GLASS_TIP_OPACITY, opacity },
          });
          nodes.push({
            kind: "area",
            key: `${lidKey}:shade`,
            points: lid,
            style: { fill: `url(#${topShadeId})`, opacity },
          });
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-depth-back",
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

export function barDepthFrontMark(data: ChartDatum[], options: BarDepthFrontMarkOptions): ChartMark<ChartDatum, string, number> {
  const { id, bandWidth, bandPos, categoryAccessor, yAccessor, gradientIds, states, opacity } = options;
  const { glassPosId } = gradientIds;
  return createMark(() => {
    const xValues = data.map((d) => categoryAccessor(d));
    const yValues = data.map((d) => yAccessor(d));
    return {
      id,
      states: states?.length ? { data, definitions: states } : undefined,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
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
          const bandX = bandPos(String(xValue));
          const topY = valuePos;
          const bottomY = baseline;
          const barHeight = bottomY - topY;
          if (barHeight <= 0) continue;
          // bklit BarDepthFront: a single per-bar (objectBoundingBox) glass
          // rect — sharp white reflection catch at the tip fading to
          // transparent, then a contact shadow at the baseline. NOT a flat
          // whole-bar opacity wash.
          const glassKey = `${id}:glass:${i}`;
          nodes.push({
            kind: "rect",
            key: glassKey,
            x: bandX,
            y: topY,
            width: bandWidth,
            height: barHeight,
            style: { fill: `url(#${glassPosId})`, opacity },
          });
          points.push({
            key: glassKey,
            markId: id,
            group: id,
            groupLabel: id,
            datum,
            datumIndex: i,
            xValue,
            yValue,
            x: bandX + bandWidth / 2,
            y: topY,
            color: `url(#${glassPosId})`,
          });
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar-depth-front",
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
