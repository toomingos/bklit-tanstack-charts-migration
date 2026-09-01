"use client";

import { dot } from "@tanstack/charts/dot";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";

// C3: bklit's marker active-scale (×1.35 at the hovered x) + inactive-dim
// (opacity 0.5 elsewhere, on ANY pointer hover) ported from hover-chrome.ts's
// imperative `ensureMarkerActiveGroup` / `dimmedMarkerGroups` writers into
// this mark's own `states`, per data/props (no DOM reach-in). The old
// mechanism used TWO overlapping layers (dim the base marker + draw a
// separate bigger/brighter duplicate on top); this collapses that into ONE
// reactive marker whose own circle scales up and stays full-opacity when
// matched, and dims (no scale change) otherwise — same net visual result
// (bigger+bright at the hovered index, dim elsewhere) with no duplicate DOM.
//
// Dropped: the 2px blur hover-chrome applied to dimmed markers
// (MARKER_DIM_BLUR_PX). `ChartDotStateStyle` (dist/types.d.ts) is a Pick of
// `fill|fillOpacity|stroke|strokeOpacity|strokeWidth|opacity|r` — there is no
// blur/filter field, so a dot mark's `states` cannot express it without a
// renderer-DOM reach-in. Dropped citing the D421 scatter-blur precedent.
const MARKER_ACTIVE_SCALE = 1.35;
const MARKER_DIM_OPACITY = 0.5;

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
    const gradientId = hasRing ? gradientIdByKey.get(s.dataKey) : undefined;
    const showActiveHighlight = s.markers?.showActiveHighlight ?? true;
    marks.push(
      dot(renderData, {
        id: `${s.dataKey}__marker`,
        x: (d: ChartDatum) => d[xDataKey] as Date,
        y: (d: ChartDatum) => d[s.dataKey] as number,
        r: outerRadius,
        fill: gradientId ? `url(#${gradientId})` : fill,
        stroke: "none",
        states: [
          // Active (hovered x): scale up, stay full-opacity — CSS-driven
          // 0.15s transition (styles.css), D425 pattern (no transition here).
          {
            when: { focus: "x", source: "pointer" },
            style: { r: showActiveHighlight ? outerRadius * MARKER_ACTIVE_SCALE : outerRadius },
          },
          // Inactive (some OTHER x pointer-focused): dim.
          {
            when: (ctx) => ctx.focus.source === "pointer" && !ctx.matches("x"),
            style: { opacity: MARKER_DIM_OPACITY },
          },
        ],
      }) as unknown as ChartMark<ChartDatum, Date, number>,
    );
  }
  return marks;
}
