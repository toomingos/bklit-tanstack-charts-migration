"use client";

import { dot } from "@tanstack/charts";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";

export interface MarkerSeriesConfig {
  dataKey: string;
  stroke: string;
  showMarkers?: boolean;
  markers?: SeriesPointMarkerStyle;
}

export function getMarkerVisualExtent(style: Pick<SeriesPointMarkerStyle, "radius" | "strokeWidth" | "ringGap" | "outlineWidth" | "showActiveHighlight">): number {
  const radius = style.radius ?? 5;
  const strokeWidth = style.strokeWidth ?? 2;
  const ringGap = style.ringGap ?? 2;
  const outlineWidth = style.outlineWidth ?? 0;
  const showActiveHighlight = style.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = outlineWidth > 0 ? outlineWidth : 0;
  const highlightPad = showActiveHighlight ? radius * 0.35 : 0;
  return radius + ring + outline + highlightPad + 2;
}

export interface MarkerGradientDef {
  dataKey: string;
  id: string;
  fill: string;
  stroke: string;
  fillFadeStart: number;
  fillFadeEnd: number;
  gapFadeStart: number;
  gapFadeEnd: number;
  outerRadius: number;
}

export function buildMarkerGradientDefs(series: MarkerSeriesConfig[], baseId: string): MarkerGradientDef[] {
  const defs: MarkerGradientDef[] = [];
  let idx = 0;
  for (const s of series) {
    if (!s.showMarkers) continue;
    const radius = s.markers?.radius ?? 5;
    const strokeWidth = s.markers?.strokeWidth ?? 2;
    const ringGap = s.markers?.ringGap ?? 2;
    if (strokeWidth <= 0) continue;
    const fill = s.markers?.fill ?? s.stroke;
    const stroke = s.markers?.stroke ?? s.markers?.fill ?? s.stroke;
    const outerRadius = radius + ringGap + strokeWidth;
    const fillEnd = (radius / outerRadius) * 100;
    const gapEnd = ((radius + ringGap) / outerRadius) * 100;
    const halfPx = (0.5 / outerRadius) * 100;
    defs.push({
      dataKey: s.dataKey,
      id: `${baseId}-mgrad-${idx++}`,
      fill,
      stroke,
      fillFadeStart: Math.max(0, fillEnd - halfPx),
      fillFadeEnd: Math.min(100, fillEnd + halfPx),
      gapFadeStart: Math.max(0, gapEnd - halfPx),
      gapFadeEnd: Math.min(100, gapEnd + halfPx),
      outerRadius,
    });
  }
  return defs;
}

export function buildMarkerMarks(
  renderData: ChartDatum[],
  xDataKey: string,
  series: MarkerSeriesConfig[],
  gradientIdByKey: Map<string, string>
): ChartMark<ChartDatum, Date, number>[] {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const s of series) {
    if (!s.showMarkers) continue;
    const radius = s.markers?.radius ?? 5;
    const strokeWidth = s.markers?.strokeWidth ?? 2;
    const ringGap = s.markers?.ringGap ?? 2;
    const hasRing = strokeWidth > 0;
    const outerRadius = hasRing ? radius + ringGap + strokeWidth : radius;
    const fill = s.markers?.fill ?? s.stroke;
    const stroke = s.markers?.stroke ?? s.markers?.fill ?? s.stroke;
    const gradientId = hasRing ? gradientIdByKey.get(s.dataKey) : undefined;
    marks.push(
      dot(renderData, {
        id: `${s.dataKey}__marker`,
        x: (d: ChartDatum) => d[xDataKey] as Date,
        y: (d: ChartDatum) => d[s.dataKey] as number,
        r: outerRadius,
        fill: gradientId ? `url(#${gradientId})` : fill,
        stroke: "none",
      }) as unknown as ChartMark<ChartDatum, Date, number>,
    );
    void stroke;
  }
  return marks;
}

export function shouldShowMarkers(showMarkers: boolean | undefined, showSeriesContent?: boolean): boolean {
  if (!showMarkers) return false;
  if (showSeriesContent === undefined) return true;
  return showSeriesContent;
}

export const MARKER_DIM_OPACITY = "0.5";
export const MARKER_DIM_BLUR_PX = 2;
export const MARKER_DIM_TRANSITION = "opacity 0.15s ease-in-out, filter 0.15s ease-in-out";
export const MARKER_ACTIVE_SCALE = 1.35;
export const MARKER_ENTER_BLUR_PX = 2;
export const MARKER_ENTER_DURATION_MS = 500;
