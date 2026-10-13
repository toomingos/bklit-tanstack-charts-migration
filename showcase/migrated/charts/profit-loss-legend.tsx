"use client";

// bklit profit/loss legend + helpers. Legend hover (0 = Profit, 1 = Loss) is the kit context in
// kit/legend/legend.tsx, which the cartesian kit reads to dim the other sign on ProfitLossLine.
import type { ReactElement } from "react";
import { cn } from "./kit/cn";
import { Legend, LegendItemComponent, LegendLabel, LegendMarker } from "./kit/legend/legend-compose";

/** @internal */
export const PROFIT_LOSS_POSITIVE_COLOR = "var(--color-emerald-500, oklch(69.6% 0.17 162.48))";
/** @internal */
export const PROFIT_LOSS_NEGATIVE_COLOR = "var(--color-red-500, oklch(63.7% 0.237 25.331))";
/** @internal */
export const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

/** @internal */
export function profitLossColor(value: number): string {
  return value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;
}

/** @internal */
export function resolveProfitLossTooltipLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

/** A run of consecutive rows that share one sign. */
export interface ProfitLossSegment {
  /** The rows of the run. */
  data: Record<string, unknown>[];
  /** Whether the run is at or above zero. */
  isPositive: boolean;
}

/** @internal */
export const PROFIT_LOSS_LEGEND_ITEMS = [
  { label: "Profit", value: 0, color: PROFIT_LOSS_POSITIVE_COLOR },
  { label: "Loss", value: 0, color: PROFIT_LOSS_NEGATIVE_COLOR },
] as const;

/** Props of `ProfitLossLegend`. */
export interface ProfitLossLegendProps {
  /**
   * Controlled hovered item: `0` is Profit, `1` is Loss, `null` is none.
   * @default null
   */
  hoveredIndex?: number | null;
  /** Called with the hovered item index (`0` Profit, `1` Loss), or `null` when the pointer leaves. */
  onHoverChange?: (index: number | null) => void;
  /**
   * Horizontal alignment of the legend.
   * @default "start"
   */
  align?: "start" | "center" | "end";
  /** Extra class names added to the legend wrapper. */
  className?: string;
}

const LEGEND_ALIGN_CLASSES: Record<NonNullable<ProfitLossLegendProps["align"]>, string> = {
  start: "bk-justify-start",
  center: "bk-justify-center",
  end: "bk-justify-end",
};

/**
 * A two-item legend (Profit in green, Loss in red) for a `ProfitLossLine`. Hovering an item dims the line segments of the other sign.
 */
export const ProfitLossLegend = ({ hoveredIndex = null, onHoverChange, align = "start", className }: ProfitLossLegendProps): ReactElement => (
    <div className={cn("bk-pl-legend", LEGEND_ALIGN_CLASSES[align], className)}>
      <Legend className="bk-legend-inline" hoveredIndex={hoveredIndex} items={[...PROFIT_LOSS_LEGEND_ITEMS]} onHoverChange={onHoverChange}>
        <LegendItemComponent className="bk-legend-item-flex">
          <LegendMarker className="bk-marker-size" />
          <LegendLabel className="bk-text-xs" />
        </LegendItemComponent>
      </Legend>
    </div>
  );
