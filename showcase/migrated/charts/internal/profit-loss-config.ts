import { curveLinear } from "d3-shape";
import type { CurveFactory } from "d3-shape";

const PROFIT_LOSS_POSITIVE_COLOR = "var(--color-emerald-500)";
const PROFIT_LOSS_NEGATIVE_COLOR = "var(--color-red-500)";
const PROFIT_LOSS_DEFAULT_STROKE_WIDTH = 2.5;

const profitLossColor = (value: number): typeof PROFIT_LOSS_POSITIVE_COLOR | typeof PROFIT_LOSS_NEGATIVE_COLOR => value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;


const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

const resolveProfitLossTooltipLabel = (label: string): string => {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

interface ProfitLossLineConfig {
  readonly dataKey: string;
  readonly xDataKey: string;
  strokeWidth: number;
  readonly positiveColor: string;
  readonly negativeColor: string;
  readonly curve: CurveFactory;
  readonly fadeEdges: boolean | "left" | "right";
}

// Raw profit-loss props as they arrive from extracted children: every field is
// Optional at the boundary, so the normalizer below fills defaults explicitly.
interface ProfitLossConfigSource {
  readonly curve?: CurveFactory;
  readonly dataKey?: string;
  readonly fadeEdges?: boolean | "left" | "right";
  readonly negativeColor?: string;
  readonly positiveColor?: string;
  readonly strokeWidth?: number;
  readonly xDataKey?: string;
}

const isString = (value: string | undefined): value is string => typeof value === "string";

const normalizeProfitLossConfig = (props: Readonly<ProfitLossConfigSource> | undefined): ProfitLossLineConfig | null => {
  if (!props) {return null;}
  const { curve, dataKey, fadeEdges, negativeColor, positiveColor, strokeWidth, xDataKey } = props;
  if (!isString(dataKey)) {return null;}
  return {
    curve: curve ?? curveLinear,
    dataKey,
    fadeEdges: fadeEdges ?? false,
    negativeColor: negativeColor ?? PROFIT_LOSS_NEGATIVE_COLOR,
    positiveColor: positiveColor ?? PROFIT_LOSS_POSITIVE_COLOR,
    strokeWidth: strokeWidth ?? PROFIT_LOSS_DEFAULT_STROKE_WIDTH,
    xDataKey: xDataKey ?? "date",
  };
}

export {
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  normalizeProfitLossConfig,
  profitLossColor,
  resolveProfitLossTooltipLabel,
};
export type { ProfitLossLineConfig };
