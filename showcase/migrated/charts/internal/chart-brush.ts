"use client";

import type { ReactElement } from "react";
import type { BrushHost, BrushChromePattern, BrushSelectedBoxStyle } from "./brush-chrome";
import type { BrushSelection } from "./brush-selection";
import type { ChartBrushSelection, ChartBrushSelectionPattern } from "./parity/brush";
import { CHART_ROLE } from "./chart-child-carrier";

type BrushSelectionPattern = BrushChromePattern;
type ChartBrushSelectedBoxStyle = BrushSelectedBoxStyle;

interface ChartBrushProps {
  /** Vestigial — kept only so callers that still pass `host` type-check; the value is ignored. */
  readonly host?: BrushHost | null;
  readonly onSelectionChange?: (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> } | null) => void;
  /** Brush direction. Default: "horizontal" for time range selection. */
  readonly brushDirection?: "horizontal" | "vertical" | "both";
  readonly initialSelection?: BrushSelection | null;
  /** Current selection (e.g. from parent state). Accepted for parity; the host owns the visible selection. */
  readonly selection?: ChartBrushSelection | null;
  /** Accepted for parity; the host owns pointer events. Default: true for brush-in-strip. */
  readonly useWindowMoveEvents?: boolean;
  readonly blurPx?: number;
  readonly fadeOuterEdges?: boolean;
  readonly selectionPattern?: ChartBrushSelectionPattern;
  readonly selectedBoxStyle?: BrushSelectedBoxStyle;
}

// Config-carrier marker declared on the component type (children.tsx
// ChartChildComponent pattern), so attaching the role needs no assertion.
interface ChartBrushCarrier {
  (props: Readonly<ChartBrushProps>): ReactElement | null;
  [CHART_ROLE]?: string;
  displayName: string;
}

// Pure config carrier (never renders): the host chart owns the native brushX control + BrushChrome portal.
const ChartBrush: ChartBrushCarrier = Object.assign(
  (_props: Readonly<ChartBrushProps>): ReactElement | null => null,
  { [CHART_ROLE]: "brush", displayName: "ChartBrush" },
);

export type { BrushHost } from "./brush-chrome";
export type { BrushSelectionPattern, ChartBrushSelectedBoxStyle, ChartBrushProps };
export { ChartBrush };
