// Hover indicator model of the cartesian definition: active-marker highlight, crosshair rule, date pill and one dot per series, handed to the
// HoverOverlay (hover-overlay.ts) the host owns. Nothing here is a renderer focus guide: that layer re-serializes and reparses its fragment on every move.
import type { TooltipBoxMotionProps } from "../tooltip/box-motion";
import { resolveIndicatorWidth } from "../tooltip/tooltip-carriers";
import type { IndicatorWidth } from "../types";
import { toNumber } from "./domains";
import type { PillLayout } from "./date-pill";
import type { LineConfig } from "./chart-context";
import type { CartesianInput } from "./input";
import type { HoverOverlayModel, OverlayDot } from "./hover-overlay";
import type { ResolvedSeries, Row } from "./series";
import { shortDateFmt } from "../format";

export interface TooltipProps extends TooltipBoxMotionProps {
  showDatePill?: boolean;
  showCrosshair?: boolean;
  showDots?: boolean;
  dotSize?: number;
  dotStrokeWidth?: number;
  indicatorColor?: string | ((point: Row) => string);
  indicatorDasharray?: string;
  dotColor?: string | ((point: Row, line: LineConfig) => string);
  indicatorWidth?: IndicatorWidth;
}

export interface HoverOverlayContext {
  readonly input: CartesianInput;
  readonly rows: readonly Row[];
  readonly keyOf: (d: Row) => number;
  readonly tooltipProps: TooltipProps;
  readonly pill: PillLayout | null;
  readonly pillActive: boolean;
}

function resolveDotColor(tooltipProps: TooltipProps, s: ResolvedSeries): string {
  const dotColor = tooltipProps.dotColor;
  if (typeof dotColor === "string") {
    return dotColor;
  }
  return s.stroke;
}

const valueOfSeries = (s: ResolvedSeries) => (row: Row): number | undefined => toNumber(row[s.dataKey]);

function activeMarkers(interactive: readonly ResolvedSeries[]): OverlayDot[] {
  const out: OverlayDot[] = [];
  // bklit renders the active marker only with `fadeOnHover` (series-markers.tsx:269-272).
  for (const s of interactive.filter((x) => x.showMarkers && x.marker.fadeOnHover)) {
    // bklit showActiveHighlight redraws the hovered marker 1.35x larger (series-markers.tsx:196, :270-292) in the main svg, under the portalled crosshair svg (tooltip/chart-tooltip.tsx:257-283) and dots svg (:286-311);
    // it jumps to the focused point, only the TooltipDot glides.
    const mk = s.marker;
    const k = mk.showActiveHighlight ? 1.35 : 1;
    const ringOuter = mk.strokeWidth > 0 ? mk.radius + mk.ringGap + mk.strokeWidth : mk.radius;
    const circles = [
      ...(mk.outlineWidth > 0 ? [{ r: (ringOuter + mk.outlineWidth / 2) * k, fill: "none", stroke: mk.outlineColor, strokeWidth: mk.outlineWidth * k }] : []),
      { r: mk.radius * k, fill: mk.fill, stroke: "none", strokeWidth: 0 },
      ...(mk.strokeWidth > 0 ? [{ r: (mk.radius + mk.ringGap + mk.strokeWidth / 2) * k, fill: "none", stroke: mk.stroke, strokeWidth: mk.strokeWidth * k }] : []),
    ];
    out.push({ circles, glide: false, valueOf: valueOfSeries(s), yAxis: s.yAxisId });
  }
  return out;
}

/** Hover indicator: active markers, crosshair rule, date pill, then one dot per series (only with a ChartTooltip). */
export function buildHoverOverlayModel(ctx: HoverOverlayContext): HoverOverlayModel {
  const { tooltipProps } = ctx;
  const showCrosshair = tooltipProps.showCrosshair !== false;
  const showDots = tooltipProps.showDots !== false;
  const interactive = ctx.input.series.filter((s) => s.kind !== "pattern" && (s.kind === "line" || s.showLine !== false || s.kind === "area"));
  const head = interactive[0];
  const labelIndex = new Map<number, number>();
  const labels: string[] = [];
  ctx.rows.forEach((row, i) => {
    labelIndex.set(ctx.keyOf(row), i);
    labels.push(shortDateFmt.format(ctx.keyOf(row)));
  });
  const dotRadius = tooltipProps.dotSize ?? 5;
  return {
    // bklit portals the crosshair as an <svg> over the chart (tooltip/chart-tooltip.tsx:257-283).
    crosshair: head && showCrosshair
      ? { color: typeof tooltipProps.indicatorColor === "string" ? tooltipProps.indicatorColor : "var(--chart-crosshair)", dash: tooltipProps.indicatorDasharray, width: resolveIndicatorWidth(tooltipProps.indicatorWidth) }
      : null,
    dots: showDots
      ? [
          ...activeMarkers(interactive),
          ...(ctx.input.extraDots ?? []),
          ...interactive.map((s): OverlayDot => ({
            circles: [{ r: dotRadius, fill: resolveDotColor(tooltipProps, s), stroke: "var(--chart-background)", strokeWidth: tooltipProps.dotStrokeWidth ?? 2 }],
            glide: true,
            valueOf: valueOfSeries(s),
            yAxis: s.yAxisId,
          })),
        ]
      : [],
    indexOf: (time) => labelIndex.get(time) ?? 0,
    pill: head && ctx.pillActive && tooltipProps.showDatePill !== false ? { labels, layout: ctx.pill } : null,
  };
}
