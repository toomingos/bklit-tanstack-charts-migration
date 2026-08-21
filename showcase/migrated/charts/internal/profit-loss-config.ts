import { curveLinear } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import * as React from "react";
import { CHART_CHILD_PASSTHROUGH } from "../children";

export const PROFIT_LOSS_POSITIVE_COLOR = "var(--color-emerald-500)";
export const PROFIT_LOSS_NEGATIVE_COLOR = "var(--color-red-500)";

export function profitLossColor(value: number): string {
  return value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;
}

export const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

export function resolveProfitLossTooltipLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

export interface ProfitLossLineConfig {
  dataKey: string;
  xDataKey: string;
  strokeWidth: number;
  positiveColor: string;
  negativeColor: string;
  curve: CurveFactory;
  fadeEdges: boolean | "left" | "right";
}

export function normalizeProfitLossConfig(
  props: Record<string, unknown> | undefined
): ProfitLossLineConfig | null {
  if (!props || typeof props["dataKey"] !== "string") return null;
  return {
    dataKey: props["dataKey"] as string,
    xDataKey: (props["xDataKey"] as string | undefined) ?? "date",
    strokeWidth: (props["strokeWidth"] as number | undefined) ?? 2.5,
    positiveColor: (props["positiveColor"] as string | undefined) ?? PROFIT_LOSS_POSITIVE_COLOR,
    negativeColor: (props["negativeColor"] as string | undefined) ?? PROFIT_LOSS_NEGATIVE_COLOR,
    curve: (props["curve"] as CurveFactory | undefined) ?? curveLinear,
    fadeEdges: (props["fadeEdges"] as boolean | "left" | "right" | undefined) ?? false,
  };
}

export function extractProfitLossHoveredIndex(children: React.ReactNode): number | null {
  let hoveredIndex: number | null = null;
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      const ct = child.type as unknown as Record<symbol, unknown>;
      if (ct[CHART_CHILD_PASSTHROUGH]) {
        const pp = child.props as { hoveredIndex?: number | null; children?: React.ReactNode };
        hoveredIndex = pp.hoveredIndex ?? null;
        if (pp.children) visit(pp.children);
        continue;
      }
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
      }
    }
  };
  visit(children);
  return hoveredIndex;
}
