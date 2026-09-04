"use client";

import { createMark } from "@tanstack/charts";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark, MarkInitializeContext, MarkRenderContext, SceneNode } from "@tanstack/charts";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";

const MARKER_ACTIVE_SCALE = 1.35;

// Bklit marker defaults: plain-dot radius and active-highlight padding factor.
const DEFAULT_MARKER_RADIUS = 5;
const ACTIVE_HIGHLIGHT_RADIUS_FACTOR = 0.35;
// Scale factor converting a 0–1 value ratio into a 0–100 gradient-stop percentage.
const PERCENT_SCALE = 100;
// Half-pixel feather around gradient stop boundaries (anti-aliasing).
const GRADIENT_EDGE_FEATHER_PX = 0.5;

const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

// Dim/blur via CSS className (states can't express filter); the active dot is a separate mark.
const withMarkerBaseClassName = (mark: Readonly<ChartMark<ChartDatum, Date, number>>, dimmed: boolean): ChartMark<ChartDatum, Date, number> => {
  const className = dimmed ? "bkm-marker-base bkm-marker-base--dim" : "bkm-marker-base";
  return createMark((ctx: Readonly<MarkInitializeContext>) => {
    const inner = mark.initialize(ctx);
    return {
      ...inner,
      render: (renderCtx: Readonly<MarkRenderContext>) => {
        const scene = inner.render(renderCtx);
        const nodes: SceneNode[] = [];
        for (const node of scene.nodes) {
          nodes.push({
            ...node,
            className: node.className !== undefined && node.className !== "" ? `${node.className} ${className}` : className,
          });
        }
        return {
          ...scene,
          nodes,
        };
      },
    };
  }, mark.motion, mark.renderer);
}

interface MarkerSeriesConfig {
  readonly dataKey: string;
  readonly stroke: string;
  readonly showMarkers?: boolean;
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
}

const getMarkerVisualExtent = (style: Readonly<Pick<SeriesPointMarkerStyle, "radius" | "strokeWidth" | "ringGap" | "outlineWidth" | "showActiveHighlight">>): number => {
  const radius = style.radius ?? DEFAULT_MARKER_RADIUS;
  const strokeWidth = style.strokeWidth ?? 2;
  const ringGap = style.ringGap ?? 2;
  const outlineWidth = style.outlineWidth ?? 0;
  const showActiveHighlight = style.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = Math.max(outlineWidth, 0);
  const highlightPad = showActiveHighlight ? radius * ACTIVE_HIGHLIGHT_RADIUS_FACTOR : 0;
  return radius + ring + outline + highlightPad + 2;
}

interface MarkerGradientDef {
  readonly dataKey: string;
  readonly id: string;
  readonly fill: string;
  stroke: string;
  readonly fillFadeStart: number;
  readonly fillFadeEnd: number;
  readonly gapFadeStart: number;
  readonly gapFadeEnd: number;
  readonly outerRadius: number;
}

interface MarkerRingGeometry {
  readonly radius: number;
  readonly strokeWidth: number;
  readonly ringGap: number;
  readonly hasRing: boolean;
  readonly outerRadius: number;
}

const resolveMarkerRingGeometry = (markers: Readonly<SeriesPointMarkerStyle> | undefined): MarkerRingGeometry => {
  const radius = markers?.radius ?? DEFAULT_MARKER_RADIUS;
  const strokeWidth = markers?.strokeWidth ?? 2;
  const ringGap = markers?.ringGap ?? 2;
  const hasRing = strokeWidth > 0;
  return { hasRing, outerRadius: hasRing ? radius + ringGap + strokeWidth : radius, radius, ringGap, strokeWidth };
}

interface MarkerGradientStops {
  readonly fillFadeStart: number;
  readonly fillFadeEnd: number;
  readonly gapFadeStart: number;
  readonly gapFadeEnd: number;
}

const resolveMarkerGradientStops = (radius: number, ringGap: number, outerRadius: number): MarkerGradientStops => {
  const fillEnd = (radius / outerRadius) * PERCENT_SCALE;
  const gapEnd = ((radius + ringGap) / outerRadius) * PERCENT_SCALE;
  const halfPx = (GRADIENT_EDGE_FEATHER_PX / outerRadius) * PERCENT_SCALE;
  return {
    fillFadeEnd: Math.min(PERCENT_SCALE, fillEnd + halfPx),
    fillFadeStart: Math.max(0, fillEnd - halfPx),
    gapFadeEnd: Math.min(PERCENT_SCALE, gapEnd + halfPx),
    gapFadeStart: Math.max(0, gapEnd - halfPx),
  };
}

const buildMarkerGradientForSeries = (seriesConfig: Readonly<MarkerSeriesConfig>, baseId: string, idx: number): MarkerGradientDef | undefined => {
  if (seriesConfig.showMarkers !== true) {return undefined;}
  const { radius, ringGap, hasRing, outerRadius } = resolveMarkerRingGeometry(seriesConfig.markers);
  if (!hasRing) {return undefined;}
  const fill = seriesConfig.markers?.fill ?? seriesConfig.stroke;
  const stroke = seriesConfig.markers?.stroke ?? seriesConfig.markers?.fill ?? seriesConfig.stroke;
  return {
    dataKey: seriesConfig.dataKey,
    fill,
    ...resolveMarkerGradientStops(radius, ringGap, outerRadius),
    id: `${baseId}-mgrad-${idx}`,
    outerRadius,
    stroke,
  };
}

const buildMarkerGradientDefs = (series: readonly Readonly<MarkerSeriesConfig>[], baseId: string): MarkerGradientDef[] => {
  const defs: MarkerGradientDef[] = [];
  let idx = 0;
  for (const seriesConfig of series) {
    const def = buildMarkerGradientForSeries(seriesConfig, baseId, idx);
    if (def !== undefined) {
      defs.push(def);
      idx += 1;
    }
  }
  return defs;
}

interface MarkerDotArgs {
  readonly fill: string;
  readonly id: string;
  readonly r: number;
  stroke: string;
  readonly x: (datum: Readonly<ChartDatum>) => Date | undefined;
  readonly y: (datum: Readonly<ChartDatum>) => number | undefined;
}

interface MarkerDotArgsParams {
  readonly seriesConfig: Readonly<MarkerSeriesConfig>;
  readonly xDataKey: string;
  readonly fill: string;
  readonly outerRadius: number;
  readonly id: string;
}

const markerDotArgs = ({ seriesConfig, xDataKey, fill, outerRadius, id }: Readonly<MarkerDotArgsParams>): MarkerDotArgs => ({
  fill,
  id,
  r: outerRadius,
  stroke: "none",
  x: (datum: Readonly<ChartDatum>): Date | undefined => {
    const value = datum[xDataKey];
    return value instanceof Date ? value : undefined;
  },
  y: (datum: Readonly<ChartDatum>): number | undefined => {
    const value = datum[seriesConfig.dataKey];
    return isNumber(value) ? value : undefined;
  },
});

const resolveMarkerDimmed = (legendHoveredKey: string | null | undefined, dataKey: string, pointerFocusActive: boolean | undefined = false): boolean => {
  if (pointerFocusActive) {return true;}
  if (legendHoveredKey === undefined || legendHoveredKey === null) {return false;}
  return legendHoveredKey !== dataKey;
};

interface MarkerMarksForSeriesParams {
  readonly seriesConfig: Readonly<MarkerSeriesConfig>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly gradientIdByKey: Readonly<Map<string, string>>;
  readonly legendHoveredKey?: string | null;
  readonly pointerFocusActive: boolean;
}

const resolveMarkerFill = (seriesConfig: Readonly<MarkerSeriesConfig>, hasRing: boolean, gradientIdByKey: Readonly<Map<string, string>>): string => {
  const fill = seriesConfig.markers?.fill ?? seriesConfig.stroke;
  const gradientId = hasRing ? gradientIdByKey.get(seriesConfig.dataKey) : undefined;
  return gradientId !== undefined && gradientId !== "" ? `url(#${gradientId})` : fill;
}

interface ActiveMarkerMarkParams {
  readonly seriesConfig: Readonly<MarkerSeriesConfig>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly resolvedFill: string;
  readonly outerRadius: number;
  readonly showActiveHighlight: boolean;
}

const maybeBuildActiveMarkerMark = ({ seriesConfig, renderData, xDataKey, resolvedFill, outerRadius, showActiveHighlight }: Readonly<ActiveMarkerMarkParams>): ChartMark<ChartDatum, Date, number> | undefined => {
  if (!showActiveHighlight) {return undefined;}
  const activeMark = dot(renderData, markerDotArgs({ fill: resolvedFill, id: `${seriesConfig.dataKey}__marker-active`, outerRadius: outerRadius * MARKER_ACTIVE_SCALE, seriesConfig, xDataKey }));
  return whenFocused(activeMark, { match: "x", retarget: true });
}

interface DimmedBaseMarkParams {
  readonly seriesConfig: Readonly<MarkerSeriesConfig>;
  readonly baseMark: ChartMark<ChartDatum, Date, number>;
  readonly legendHoveredKey?: string | null;
  readonly pointerFocusActive: boolean;
}

const buildDimmedBaseMark = ({ seriesConfig, baseMark, legendHoveredKey, pointerFocusActive }: Readonly<DimmedBaseMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const dimmed = resolveMarkerDimmed(legendHoveredKey, seriesConfig.dataKey, pointerFocusActive);
  return withMarkerBaseClassName(baseMark, dimmed);
}

const buildMarkerMarksForSeries = ({ seriesConfig, renderData, xDataKey, gradientIdByKey, legendHoveredKey, pointerFocusActive }: Readonly<MarkerMarksForSeriesParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (seriesConfig.showMarkers !== true) {return [];}
  const { hasRing, outerRadius } = resolveMarkerRingGeometry(seriesConfig.markers);
  const resolvedFill = resolveMarkerFill(seriesConfig, hasRing, gradientIdByKey);
  const baseMark = dot(renderData, markerDotArgs({ fill: resolvedFill, id: `${seriesConfig.dataKey}__marker`, outerRadius, seriesConfig, xDataKey }));
  const base = buildDimmedBaseMark({ baseMark, legendHoveredKey, pointerFocusActive, seriesConfig });
  const active = maybeBuildActiveMarkerMark({ outerRadius, renderData, resolvedFill, seriesConfig, showActiveHighlight: seriesConfig.markers?.showActiveHighlight ?? true, xDataKey });
  if (active === undefined) {return [base];}
  return [base, active];
}

interface BuildMarkerMarksParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly series: readonly Readonly<MarkerSeriesConfig>[];
  readonly gradientIdByKey: Readonly<Map<string, string>>;
  readonly legendHoveredKey?: string | null;
  readonly pointerFocusActive?: boolean;
}

const buildMarkerMarks = (params: Readonly<BuildMarkerMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const { renderData, xDataKey, series, gradientIdByKey, legendHoveredKey, pointerFocusActive = false } = params;
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const seriesConfig of series) {
    marks.push(...buildMarkerMarksForSeries({ gradientIdByKey, legendHoveredKey, pointerFocusActive, renderData, seriesConfig, xDataKey }));
  }
  return marks;
}

export {
  buildMarkerGradientDefs,
  buildMarkerMarks,
  getMarkerVisualExtent,
  withMarkerBaseClassName,
};
export type { MarkerGradientDef, MarkerSeriesConfig };
