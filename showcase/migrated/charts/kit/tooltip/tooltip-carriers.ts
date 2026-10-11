// TooltipDot / TooltipIndicator: config carriers, since natively the hover dot and crosshair are the chart's own marks.
// Their style props merge into the tooltip config `buildCartesianDefinition` maps onto them; x / y / visible are ignored.
import { isNumber, isString } from "../guards";
import { defineCarrier } from "../role";
import type { IndicatorFadeEdges, IndicatorWidth } from "../types";
import { propsFor } from "../read-children";
import type { ChildTable } from "../read-children";

export interface TooltipDotProps {
  readonly x?: number;
  readonly y?: number;
  readonly visible?: boolean;
  readonly color?: string;
  readonly size?: number;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
  readonly variant?: "dot" | "ring";
  readonly cornerRadiusFraction?: number;
  readonly springConfig?: { readonly stiffness: number; readonly damping: number };
  readonly animate?: boolean;
}

export interface TooltipIndicatorProps {
  readonly x?: number;
  readonly height?: number;
  readonly visible?: boolean;
  readonly width?: IndicatorWidth;
  readonly span?: number;
  readonly columnWidth?: number;
  readonly colorEdge?: string;
  readonly colorMid?: string;
  readonly fadeEdges?: IndicatorFadeEdges | boolean;
  readonly fadeLength?: number;
  readonly animate?: boolean;
  readonly gradientId?: string;
  readonly springConfig?: { readonly stiffness: number; readonly damping: number };
  readonly strokeDasharray?: string;
}

export const TooltipDot = defineCarrier<TooltipDotProps>("tooltipDot", "TooltipDot");
export const TooltipIndicator = defineCarrier<TooltipIndicatorProps>("tooltipIndicator", "TooltipIndicator");

const fadeEdgesOf = (fadeEdges: TooltipIndicatorProps["fadeEdges"]): IndicatorFadeEdges | "none" | undefined => {
  if (isString(fadeEdges)) {
    return fadeEdges;
  }
  return fadeEdges === false ? "none" : undefined;
};

const WIDTHS: ReadonlyMap<string, number> = new Map([["line", 1], ["thin", 2], ["medium", 4], ["thick", 8]]);

export const resolveIndicatorWidth = (width: IndicatorWidth | undefined): number =>
  isNumber(width) ? width : WIDTHS.get(width ?? "line") ?? 1;

/** Carrier overrides folded into the `<ChartTooltip>` props (explicit ChartTooltip props win). */
export const mergeTooltipCarriers = <T extends object>(tooltip: T | undefined, table: ChildTable): (T & Record<string, unknown>) | undefined => {
  if (tooltip === undefined) {
    return undefined;
  }
  const dot = propsFor<TooltipDotProps>(table, "tooltipDot").at(0);
  const indicator = propsFor<TooltipIndicatorProps>(table, "tooltipIndicator").at(0);
  const fromCarriers: Record<string, unknown> = {};
  if (dot !== undefined) {
    fromCarriers.showDots = dot.visible !== false;
    fromCarriers.dotSize = dot.size;
    fromCarriers.dotStrokeWidth = dot.strokeWidth;
    fromCarriers.dotColor = dot.color;
    fromCarriers.dotVariant = dot.variant;
  }
  if (indicator !== undefined) {
    fromCarriers.showCrosshair = indicator.visible !== false;
    fromCarriers.indicatorColor = indicator.colorEdge;
    fromCarriers.indicatorDasharray = indicator.strokeDasharray;
    fromCarriers.indicatorWidth = indicator.width;
    fromCarriers.indicatorFadeEdges = fadeEdgesOf(indicator.fadeEdges);
    fromCarriers.indicatorFadeLength = indicator.fadeLength;
  }
  const defined = Object.fromEntries(Object.entries(fromCarriers).filter(([, v]) => v !== undefined));
  return { ...defined, ...tooltip };
};
