"use client";

// bklit profit/loss legend + helpers. Legend hover (0 = Profit, 1 = Loss) is the kit context in
// kit/legend/legend.tsx, which the cartesian kit reads to dim the other sign on ProfitLossLine.
import type { ReactElement } from "react";
import { cn } from "./kit/cn";
import { Legend, LegendItemComponent, LegendLabel, LegendMarker } from "./kit/legend/legend-compose";

export const PROFIT_LOSS_POSITIVE_COLOR = "var(--color-emerald-500)";
export const PROFIT_LOSS_NEGATIVE_COLOR = "var(--color-red-500)";
export const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

export function profitLossColor(value: number): string {
  return value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;
}

export function resolveProfitLossTooltipLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

/** A run of rows sharing one sign (bklit profit-loss-segments.ts:3); the shape bklit's split helper returns. */
export interface ProfitLossSegment {
  data: Record<string, unknown>[];
  isPositive: boolean;
}

export const PROFIT_LOSS_LEGEND_ITEMS = [
  { label: "Profit", value: 0, color: PROFIT_LOSS_POSITIVE_COLOR },
  { label: "Loss", value: 0, color: PROFIT_LOSS_NEGATIVE_COLOR },
] as const;

export interface ProfitLossLegendProps {
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  align?: "start" | "center" | "end";
  className?: string;
}

const LEGEND_ALIGN_CLASSES: Record<NonNullable<ProfitLossLegendProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

export const ProfitLossLegend = ({ hoveredIndex = null, onHoverChange, align = "start", className }: ProfitLossLegendProps): ReactElement => (
    <div className={cn("flex w-full shrink-0 px-1 py-2", LEGEND_ALIGN_CLASSES[align], className)}>
      <Legend className="flex-row flex-wrap gap-4" hoveredIndex={hoveredIndex} items={[...PROFIT_LOSS_LEGEND_ITEMS]} onHoverChange={onHoverChange}>
        <LegendItemComponent className="flex items-center gap-2">
          <LegendMarker className="h-2.5 w-2.5" />
          <LegendLabel className="text-xs" />
        </LegendItemComponent>
      </Legend>
    </div>
  );
