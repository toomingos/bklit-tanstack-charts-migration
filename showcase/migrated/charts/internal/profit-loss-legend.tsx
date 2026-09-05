"use client";

import type { ReactElement } from "react";
import { cn } from "./cn";
import { Legend } from "./legend";
import { ProfitLossLegendTemplate } from "./profit-loss-legend-template";
import {
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
} from "./profit-loss-config";

const PROFIT_LOSS_LEGEND_ITEMS = [
  { color: PROFIT_LOSS_POSITIVE_COLOR, label: "Profit", value: 0 },
  { color: PROFIT_LOSS_NEGATIVE_COLOR, label: "Loss", value: 0 },
] as const;

interface ProfitLossLegendProps {
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
}

const LEGEND_ALIGN_CLASSES = {
  center: "justify-center",
  end: "justify-end",
  start: "justify-start",
} as const satisfies Record<
  NonNullable<ProfitLossLegendProps["align"]>,
  string
>;

const ProfitLossLegend = ({
  hoveredIndex = null,
  onHoverChange,
  align = "start",
  className,
}: Readonly<ProfitLossLegendProps>): ReactElement => (
    <div
      className={cn(
        "flex w-full shrink-0 px-1 py-2",
        LEGEND_ALIGN_CLASSES[align],
        className
      )}
    >
      <Legend
        className="flex-row flex-wrap gap-4"
        hoveredIndex={hoveredIndex}
        items={PROFIT_LOSS_LEGEND_ITEMS}
        onHoverChange={onHoverChange}
      >
        <ProfitLossLegendTemplate />
      </Legend>
    </div>
  );

export type { ProfitLossLegendProps };
export { PROFIT_LOSS_LEGEND_ITEMS, ProfitLossLegend };

