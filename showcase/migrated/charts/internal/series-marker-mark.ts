"use client";

import { createMark } from "@tanstack/charts";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type { ChartMark } from "@tanstack/charts";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";

// C3->C2 (D452+ ruling): restores bklit's original TWO-LAYER marker chrome
// (series-markers.tsx:240-297) instead of the single reactive-circle
// collapse this file used to do. `ChartDotStateStyle` (dist/types.d.ts:89)
// still cannot express `filter: blur(...)` through a dot mark's `states` —
// that finding stands — but scene nodes carry their own `className` field
// (dist/types.d.ts SceneNodeBase:838) which the SVG renderer emits verbatim
// (dist/svg-renderer.js:93), and `createMark` (dist/mark.d.ts) lets an app
// mark control its own scene nodes. `withMarkerBaseClassName` below wraps
// the plain circle-grid `dot()` mark to stamp `bkm-marker-base`
// (+ `bkm-marker-base--dim` when hovered/legend-dimmed) onto the ONE group
// node `dot()`'s `render` already emits per series (dist/dot.js
// `renderPositions`: `{kind:"group", className:"ts-chart__dot", children}`)
// — CSS in styles.css drives the opacity+blur transition from there, zero
// renderer-DOM reach-in (we only ever read/append `className`, matching the
// className the mark itself produced). The bright/crisp active point is a
// SECOND, separate `dot()` mark filtered to the focused x via `whenFocused`
// (same mechanism as `buildHoverDotMark` in hover-geometry.ts), left
// unblurred/undimmed and drawn after the base layer.
//
// `dimmed` (base-layer class) = pointer focus active anywhere on the chart
// OR legend-hover on a different series (legacy: "a pointer hover or legend
// hover is active" dims the WHOLE base layer, not just the non-hovered
// points — the active point no longer lives in this layer at all, it is the
// separate crisp mark). Computed at mark-BUILD time from React state the
// caller already tracks (line-chart.tsx's `hoveredIndex`/`legendHoveredKey`,
// scatter-chart.tsx's pointer-focus-active state) rather than through native
// `states`, since `states` cannot set `className` (no such field in
// `ChartMarkStateStyle`, dist/types.d.ts:72-89) and a plain per-mark static
// prop can't react to interaction on its own — the caller re-derives the
// mark array (a `React.useMemo` definition dependency) on every
// hover/legend change instead, same as the pre-existing `legendDimmed`
// per-mark `fillOpacity` prop this replaces.
const MARKER_ACTIVE_SCALE = 1.35;

/**
 * Wraps a plain `dot()` mark to stamp `bkm-marker-base`
 * (+ `bkm-marker-base--dim`) onto its rendered group node(s). Exported so
 * scatter-chart.tsx's dot mark can reuse the exact same wrapper (D452+
 * ruling item 4).
 */
export function withMarkerBaseClassName(
  mark: ChartMark<any, any, any>,
  dimmed: boolean,
): ChartMark<any, any, any> {
  const className = dimmed ? "bkm-marker-base bkm-marker-base--dim" : "bkm-marker-base";
  return createMark((ctx) => {
    const inner = mark.initialize(ctx);
    return {
      ...inner,
      render: (renderCtx) => {
        const scene = inner.render(renderCtx);
        return {
          ...scene,
          nodes: scene.nodes.map((node) => ({
            ...node,
            className: node.className ? `${node.className} ${className}` : className,
          })),
        };
      },
    };
  }, mark.motion, mark.renderer);
}

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
  gradientIdByKey: Map<string, string>,
  // C5: legend-hovered series dataKey, or null when no legend entry is
  // hovered — series-markers.tsx:240-244's `isLegendDimmed` term.
  legendHoveredKey?: string | null,
  // C2 (D452+): whether ANY pointer focus is active on the chart right now
  // (line-chart.tsx's `hoveredIndex != null`) — legacy dims/blurs the WHOLE
  // base marker layer on any pointer hover, not just at the non-matched x.
  pointerFocusActive?: boolean,
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
    const legendDimmed = legendHoveredKey != null && legendHoveredKey !== s.dataKey;
    const dimmed = legendDimmed || (pointerFocusActive ?? false);
    const resolvedFill = gradientId ? `url(#${gradientId})` : fill;
    const baseMark = dot(renderData, {
      id: `${s.dataKey}__marker`,
      x: (d: ChartDatum) => d[xDataKey] as Date,
      y: (d: ChartDatum) => d[s.dataKey] as number,
      r: outerRadius,
      fill: resolvedFill,
      stroke: "none",
    }) as unknown as ChartMark<ChartDatum, Date, number>;
    marks.push(withMarkerBaseClassName(baseMark, dimmed) as unknown as ChartMark<ChartDatum, Date, number>);
    // Crisp active point: a SECOND, separate dot mark filtered to the
    // focused x (retarget:true glides the same node between x's, same
    // mechanism as hover-geometry.ts's `buildHoverDotMark`), left out of
    // the base layer entirely so it is never blurred/dimmed. Matches
    // legacy's `ChartMarkerActiveHighlight` (series-markers.tsx:299-320).
    if (showActiveHighlight) {
      const activeMark = dot(renderData, {
        id: `${s.dataKey}__marker-active`,
        x: (d: ChartDatum) => d[xDataKey] as Date,
        y: (d: ChartDatum) => d[s.dataKey] as number,
        r: outerRadius * MARKER_ACTIVE_SCALE,
        fill: resolvedFill,
        stroke: "none",
      });
      marks.push(
        whenFocused(activeMark, { match: "x", retarget: true }) as unknown as ChartMark<ChartDatum, Date, number>,
      );
    }
  }
  return marks;
}
