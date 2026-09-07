"use client";

import { createElement, useMemo } from "react";
import type { ReactElement } from "react";
import type { BrushHost, BrushChromePattern, BrushSelectedBoxStyle } from "./brush-chrome";
import type { BrushSelection } from "./brush-selection";
import type { ChartBrushSelection, ChartBrushSelectionPattern } from "./parity/brush";
import { BrushLayer } from "./brush-layer";
import { useBrushHostInputs } from "./brush-host-inputs";
import { extractChildren } from "./children-extract";
import { useChartChildEntries } from "./chart-child-registry";
import { useStableList } from "./use-stable-list";
import { CHART_ROLE } from "./chart-child-carrier";

type BrushSelectionPattern = BrushChromePattern;
type ChartBrushSelectedBoxStyle = BrushSelectedBoxStyle;

interface ChartBrushProps {
  /** Vestigial (D578): legacy has no `host` prop at all, so nothing reads this; kept so old callers type-check. */
  readonly host?: BrushHost | null;
  readonly onSelectionChange?: (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> } | null) => void;
  /** Vestigial (D578): package `brushX` is X-only (no direction key), so "vertical"/"both" cannot be expressed. Default: "horizontal". */
  readonly brushDirection?: "horizontal" | "vertical" | "both";
  readonly initialSelection?: BrushSelection | null;
  /** Vestigial (D578): legacy destructures this and never reads it either (`selection: _selection`), so ignoring it IS the parity behaviour. */
  readonly selection?: ChartBrushSelection | null;
  /** Accepted divergence (D578): no package surface; legacy re-anchors coordinates in a transformed container, the host owns pointer events here. Default: true. */
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

// Brush carrier mounting its own native brushX control; extraction still reads props off the element.
// Only consumers naming ChartBrush pull the brush graph, so brush-less charts never ship it.
const ChartBrush: ChartBrushCarrier = Object.assign(
  (properties: Readonly<ChartBrushProps>): ReactElement | null => {
    const host = useBrushHostInputs();
    const entries = useChartChildEntries();
    const extracted = useMemo(() => extractChildren(host.tree, entries), [entries, host.tree]);
    const projectionLines = useStableList(extracted.projectionLines);
    const inputs = useMemo(() => ({ data: host.data, xDataKey: host.xDataKey, xDomain: host.xDomain }), [host.data, host.xDataKey, host.xDomain]);
    return createElement(BrushLayer, { brushes: [properties], inputs, projectionLines });
  },
  { [CHART_ROLE]: "brush", displayName: "ChartBrush" },
);

export type { BrushHost } from "./brush-chrome";
export type { BrushSelectionPattern, ChartBrushSelectedBoxStyle, ChartBrushProps };
export { ChartBrush };
