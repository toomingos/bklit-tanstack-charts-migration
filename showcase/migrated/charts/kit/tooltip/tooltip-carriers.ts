"use client";
// TooltipDot / TooltipIndicator: config carriers, since natively the hover dot and crosshair are the chart's own marks.
// Their style props merge into the tooltip config `buildCartesianDefinition` maps onto them; x / y / visible are ignored.
import { isNumber, isString } from "../guards";
import { defineCarrier } from "../role";
import type { IndicatorFadeEdges, IndicatorWidth } from "../types";
import { propsFor } from "../read-children";
import type { ChildTable } from "../read-children";

/**
 * Props of `TooltipDot`. They are merged into the chart's `ChartTooltip` dot options; an explicit `ChartTooltip` prop wins.
 */
export interface TooltipDotProps {
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly x?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly y?: number;
  /**
   * Show the dots. Same as `showDots` on `ChartTooltip`.
   * @default true
   */
  readonly visible?: boolean;
  /** Fill color of the dots. Defaults to each series' color. */
  readonly color?: string;
  /**
   * Dot radius in px. Same as `dotSize`.
   * @default 5
   */
  readonly size?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly strokeColor?: string;
  /**
   * Stroke width of the dots in px. Same as `dotStrokeWidth`.
   * @default 2
   */
  readonly strokeWidth?: number;
  /**
   * `"dot"` or `"ring"`. Same as `dotVariant`; read by `BarChart` only.
   * @default "dot"
   */
  readonly variant?: "dot" | "ring";
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly cornerRadiusFraction?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly springConfig?: { readonly stiffness: number; readonly damping: number };
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly animate?: boolean;
}

/**
 * Props of `TooltipIndicator`. They are merged into the chart's `ChartTooltip` crosshair options; an explicit `ChartTooltip` prop wins.
 */
export interface TooltipIndicatorProps {
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly x?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly height?: number;
  /**
   * Show the crosshair. Same as `showCrosshair` on `ChartTooltip`.
   * @default true
   */
  readonly visible?: boolean;
  /**
   * Thickness of the crosshair: a width in px, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px).
   * @default "line"
   */
  readonly width?: IndicatorWidth;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly span?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly columnWidth?: number;
  /**
   * Color of the crosshair. Same as `indicatorColor`.
   * @default "var(--chart-crosshair)"
   */
  readonly colorEdge?: string;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly colorMid?: string;
  /** Accepted so bklit-ui code compiles. Has no effect. The crosshair is solid. */
  readonly fadeEdges?: IndicatorFadeEdges | boolean;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly fadeLength?: number;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly animate?: boolean;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly gradientId?: string;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly springConfig?: { readonly stiffness: number; readonly damping: number };
  /** Dash pattern of the crosshair. Omit for a solid line. Same as `indicatorDasharray`. */
  readonly strokeDasharray?: string;
}

/**
 * Styles the dots drawn on each series at the hovered position. It renders nothing itself; place it as a child of the chart next to `ChartTooltip`. Equivalent to the `dot*` props of `ChartTooltip`.
 */
export const TooltipDot = /* @__PURE__ */ defineCarrier<TooltipDotProps>("tooltipDot", "TooltipDot");
/**
 * Styles the vertical crosshair at the hovered position. It renders nothing itself; place it as a child of the chart next to `ChartTooltip`. Equivalent to the `indicator*` props of `ChartTooltip`.
 */
export const TooltipIndicator = /* @__PURE__ */ defineCarrier<TooltipIndicatorProps>("tooltipIndicator", "TooltipIndicator");

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
