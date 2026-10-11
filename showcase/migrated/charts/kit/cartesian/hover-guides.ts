// Hover indicator of the cartesian definition: active-marker highlight, crosshair rule, date pill and one dot per series,
// all native focus guides (declared after the base marks, so they land in the "over" layer in declaration order).
import { BKLIT_GUIDE_SPRING, guideMotion } from "../motion/guide-motion";
import { crosshair } from "@tanstack/charts/crosshair";
import type { TooltipBoxMotionProps } from "../tooltip/box-motion";
import { resolveIndicatorWidth } from "../tooltip/tooltip-carriers";
import type { IndicatorWidth } from "../types";
import { toNumber } from "./domains";
import { crosshairGradient, crosshairRuleMark, datePillGuides, dotGuideMark } from "./date-pill";
import type { PillLayout } from "./date-pill";
import { yScaleOf } from "./build-state";
import type { BuildState } from "./build-state";
import type { LineConfig } from "./chart-context";
import type { CartesianInput } from "./input";
import type { ResolvedSeries, Row } from "./series";

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

/** Hover guides (crosshair, dots) glide like bklit's tooltipSpring, and appear under the pointer on entry. */
const GUIDE_MOTION = guideMotion(BKLIT_GUIDE_SPRING);

/** bklit's active marker highlight is a plain scaled element: it jumps to the focused point, only the TooltipDot glides. */
const ACTIVE_MARKER_MOTION = guideMotion({ type: "tween", duration: 0 });

export interface HoverGuideContext {
  readonly input: CartesianInput;
  readonly rows: readonly Row[];
  readonly xAccessor: (d: Row) => Date;
  readonly keyOf: (d: Row) => number;
  readonly tooltipProps: TooltipProps;
  readonly pill: PillLayout | null;
  readonly state: BuildState;
}

function resolveDotColor(tooltipProps: TooltipProps, s: ResolvedSeries): string {
  const dotColor = tooltipProps.dotColor;
  if (typeof dotColor === "string") {
    return dotColor;
  }
  return s.stroke;
}

function pushActiveMarkers(ctx: HoverGuideContext, interactive: readonly ResolvedSeries[], valueAtOf: ValueAtOf): void {
  const { marks } = ctx.state;
  // bklit renders the active marker only with `fadeOnHover` (series-markers.tsx:269-272).
  for (const s of interactive.filter((x) => x.showMarkers && x.marker.fadeOnHover)) {
    // bklit showActiveHighlight redraws the hovered marker 1.35x larger (series-markers.tsx:196, :270-292) in the main svg, under the portalled crosshair svg (tooltip/chart-tooltip.tsx:257-283) and dots svg (:286-311);
    // declared ahead of the crosshair so the over layer's declaration order (charts-core scene.ts:422-428, focus-layer.ts:51-68) keeps the rule on top.
    const valueAt = valueAtOf(s);
    const mk = s.marker;
    const k = mk.showActiveHighlight ? 1.35 : 1;
    const ringOuter = mk.strokeWidth > 0 ? mk.radius + mk.ringGap + mk.strokeWidth : mk.radius;
    if (mk.outlineWidth > 0) {
      marks.push(dotGuideMark({ id: `${s.id}:active-outline`, ...yScaleOf(s), valueAt, motion: ACTIVE_MARKER_MOTION, marker: { radius: (ringOuter + mk.outlineWidth / 2) * k, fill: "none", stroke: mk.outlineColor, strokeWidth: mk.outlineWidth * k } }));
    }
    marks.push(dotGuideMark({ id: `${s.id}:active-core`, ...yScaleOf(s), valueAt, motion: ACTIVE_MARKER_MOTION, marker: { radius: mk.radius * k, fill: mk.fill, stroke: "none", strokeWidth: 0 } }));
    if (mk.strokeWidth > 0) {
      marks.push(dotGuideMark({ id: `${s.id}:active-ring`, ...yScaleOf(s), valueAt, motion: ACTIVE_MARKER_MOTION, marker: { radius: (mk.radius + mk.ringGap + mk.strokeWidth / 2) * k, fill: "none", stroke: mk.stroke, strokeWidth: mk.strokeWidth * k } }));
    }
  }
}

function pushCrosshair(ctx: HoverGuideContext): void {
  const { tooltipProps, state } = ctx;
  // bklit portals the crosshair as an <svg> over the chart (tooltip/chart-tooltip.tsx:257-283): above grid, pattern and series, under the dots svg (:286-311) and z-50 date pill (:418-423).
  // A guide declared after the base marks lands in the native "over" layer in declaration order, so the rule goes ahead of the pill and dot guides.
  const indicatorColor = typeof tooltipProps.indicatorColor === "string" ? tooltipProps.indicatorColor : "var(--chart-crosshair)";
  const indicatorWidth = resolveIndicatorWidth(tooltipProps.indicatorWidth);
  if (tooltipProps.indicatorDasharray) {
    // bklit draws a dashed indicator as a plain stroked line (no fade).
    state.marks.push(
      crosshair({
        id: "crosshair",
        x: { stroke: indicatorColor, strokeOpacity: 1, strokeWidth: indicatorWidth, strokeDasharray: tooltipProps.indicatorDasharray.replace(",", " "), label: false },
        y: false,
        motion: GUIDE_MOTION,
      }),
    );
    return;
  }
  // A rect with the fade gradient (a zero-width rule cannot take a bbox gradient; see crosshairRuleMark). The chart's idPrefix is the uid.
  state.gradients.push(crosshairGradient("crosshair", indicatorColor));
  state.marks.push(crosshairRuleMark({ id: "crosshair", paint: `url(#${ctx.input.uid}-crosshair)`, width: indicatorWidth, motion: GUIDE_MOTION }));
}

function pushDatePill(ctx: HoverGuideContext, head: ResolvedSeries): void {
  ctx.state.marks.push(
    ...datePillGuides({
      rows: ctx.rows,
      x: ctx.xAccessor,
      y: (d: Row) => toNumber(d[head.dataKey]),
      key: ctx.keyOf,
      ...yScaleOf(head),
      // bklit pins the pill 4px above the container bottom (centre = plot bottom + margin.bottom - 20); the native label box lands 0.2px low at the default offset.
      offset: ctx.input.margin.bottom - 19.8,
      motion: GUIDE_MOTION,
    }, ctx.pill),
  );
}

function pushDots(ctx: HoverGuideContext, interactive: readonly ResolvedSeries[], valueAtOf: ValueAtOf): void {
  const dotRadius = ctx.tooltipProps.dotSize ?? 5;
  for (const s of interactive) {
    const dotFill = resolveDotColor(ctx.tooltipProps, s);
    const valueAt = valueAtOf(s);
    ctx.state.marks.push(
      dotGuideMark({
        id: `${s.id}:dot`,
        ...yScaleOf(s),
        valueAt,
        motion: GUIDE_MOTION,
        marker: { radius: dotRadius, fill: dotFill, stroke: "var(--chart-background)", strokeWidth: ctx.tooltipProps.dotStrokeWidth ?? 2 },
      }),
    );
  }
}

type ValueAtOf = (s: ResolvedSeries) => (xValue: unknown) => number | undefined;

/** Hover indicator: active markers, crosshair rule, date pill, then one dot per series (only with a ChartTooltip). */
export function pushHoverGuides(ctx: HoverGuideContext): void {
  const { tooltipProps } = ctx;
  const showCrosshair = tooltipProps.showCrosshair !== false;
  const showDots = tooltipProps.showDots !== false;
  const showPill = tooltipProps.showDatePill !== false;
  const interactive = ctx.input.series.filter((s) => s.kind !== "pattern" && (s.kind === "line" || s.showLine !== false || s.kind === "area"));
  const head = interactive[0];
  const rowAtTime = new Map<number, Row>(ctx.rows.map((row) => [ctx.keyOf(row), row]));
  const valueAtOf: ValueAtOf = (s) => (xValue) => {
    const row = rowAtTime.get(xValue instanceof Date ? xValue.getTime() : Number(xValue));
    return row ? toNumber(row[s.dataKey]) : undefined;
  };
  if (showDots) {
    pushActiveMarkers(ctx, interactive, valueAtOf);
  }
  if (head && showCrosshair) {
    pushCrosshair(ctx);
  }
  if (head && showPill) {
    pushDatePill(ctx, head);
  }
  if (showDots) {
    pushDots(ctx, interactive, valueAtOf);
  }
}
