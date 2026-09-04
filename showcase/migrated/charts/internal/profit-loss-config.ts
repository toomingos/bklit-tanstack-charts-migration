import { curveLinear } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import * as React from "react";
import { isChartClipPassthrough } from "./children-extract";

const PROFIT_LOSS_POSITIVE_COLOR = "var(--color-emerald-500)";
const PROFIT_LOSS_NEGATIVE_COLOR = "var(--color-red-500)";
const PROFIT_LOSS_DEFAULT_STROKE_WIDTH = 2.5;

const profitLossColor = (value: number): string => value >= 0 ? PROFIT_LOSS_POSITIVE_COLOR : PROFIT_LOSS_NEGATIVE_COLOR;


const PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK = "Profit/Loss";

const resolveProfitLossTooltipLabel = (label: string): string => {
  const trimmed = label.trim();
  return trimmed || PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK;
}

interface ProfitLossLineConfig {
  dataKey: string;
  xDataKey: string;
  strokeWidth: number;
  positiveColor: string;
  negativeColor: string;
  curve: CurveFactory;
  fadeEdges: boolean | "left" | "right";
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

const appendFlattenedNode = (node: React.ReactNode, out: React.ReactNode[]): void => {
  const flat = [node].flat(Number.POSITIVE_INFINITY);
  for (const child of flat) {out.push(child);}
};

interface ProfitLossHoverState {
  hoveredIndex: number | null;
}

type VisitProfitLossNode = (node: React.ReactNode) => void;

const visitProfitLossChild = (child: React.ReactNode, state: ProfitLossHoverState, visit: VisitProfitLossNode): void => {
  if (!React.isValidElement(child)) {return;}
  // Shared predicate so the legacy string key is honoured here too, not just in children.tsx
  if (isChartClipPassthrough(child.type) && React.isValidElement<{ hoveredIndex?: number | null; children?: React.ReactNode }>(child)) {
    state.hoveredIndex = child.props.hoveredIndex ?? null;
    const nested = child.props.children;
    if (nested !== undefined && nested !== null) {visit(nested);}
    return;
  }
  if (child.type === React.Fragment && React.isValidElement<{ children?: React.ReactNode }>(child)) {
    visit(child.props.children);
  }
}

const extractProfitLossHoveredIndex = (children: React.ReactNode): number | null => {
  const state: ProfitLossHoverState = { hoveredIndex: null };
  const visit: VisitProfitLossNode = (node: React.ReactNode): void => {
    const flat: React.ReactNode[] = [];
    appendFlattenedNode(node, flat);
    for (const child of flat) {visitProfitLossChild(child, state, visit);}
  };
  visit(children);
  return state.hoveredIndex;
}

export {
  PROFIT_LOSS_NEGATIVE_COLOR,
  PROFIT_LOSS_POSITIVE_COLOR,
  PROFIT_LOSS_TOOLTIP_LABEL_FALLBACK,
  extractProfitLossHoveredIndex,
  normalizeProfitLossConfig,
  profitLossColor,
  resolveProfitLossTooltipLabel,
};
export type { ProfitLossLineConfig };
