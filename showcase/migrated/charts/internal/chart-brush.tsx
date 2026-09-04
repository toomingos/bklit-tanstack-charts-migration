"use client";

import type { BrushHost, BrushChromePattern, BrushSelectedBoxStyle } from "./brush-chrome";
import type { BrushSelection } from "./brush-selection";
import { CHART_ROLE } from "../children";

type BrushSelectionPattern = BrushChromePattern;
type ChartBrushSelectedBoxStyle = BrushSelectedBoxStyle;

interface ChartBrushProps {
  /** Vestigial — kept only so callers that still pass `host` type-check; the value is ignored. */
  host?: BrushHost | null;
  onSelectionChange?: (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> } | null) => void;
  initialSelection?: BrushSelection | null;
  blurPx?: number;
  fadeOuterEdges?: boolean;
  selectionPattern?: BrushChromePattern;
  selectedBoxStyle?: BrushSelectedBoxStyle;
}

// Config-carrier marker declared on the component type (children.tsx
// ChartChildComponent pattern), so attaching the role needs no assertion.
interface ChartBrushCarrier {
  (props: Readonly<ChartBrushProps>): null;
  [CHART_ROLE]?: string;
  displayName?: string;
}

// Pure config carrier (never renders): the host chart owns the native brushX control + BrushChrome portal.
const ChartBrush: ChartBrushCarrier = (_props: Readonly<ChartBrushProps>): null => null;

ChartBrush[CHART_ROLE] = "brush";
ChartBrush.displayName = "ChartBrush";

export type { BrushHost } from "./brush-chrome";
export type { BrushSelectionPattern, ChartBrushSelectedBoxStyle, ChartBrushProps };
export { ChartBrush };

// Legacy parity: bklit ships `export default ChartBrush`.
export default ChartBrush;
