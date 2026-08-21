"use client";

import * as React from "react";
import { BrushChrome, type BrushChromePattern, type BrushSelectedBoxStyle } from "./brush-chrome";
import { BrushHostContext, type BrushHost, useBrushDrag } from "./brush-drag";
import type { BrushSelection } from "./brush-selection";
import { CHART_ROLE } from "../children";

export type { BrushHost } from "./brush-drag";
export type BrushSelectionPattern = BrushChromePattern;
export type ChartBrushSelectedBoxStyle = BrushSelectedBoxStyle;

export interface ChartBrushProps {
  host?: BrushHost | null;
  onSelectionChange?: (selection: BrushSelection | null) => void;
  initialSelection?: BrushSelection | null;
  blurPx?: number;
  fadeOuterEdges?: boolean;
  selectionPattern?: BrushChromePattern;
  selectedBoxStyle?: BrushSelectedBoxStyle;
}

let didWarnMissingHost = false;

export function ChartBrush(props: ChartBrushProps) {
  const ctxHost = React.useContext(BrushHostContext);
  const host = props.host ?? ctxHost;
  if (!host) {
    if (!didWarnMissingHost && process.env.NODE_ENV !== "production") {
      didWarnMissingHost = true;
      console.warn("[ChartBrush] missing BrushHost — render inside a brushed LineChart/AreaChart or pass `host` explicitly.");
    }
    return null;
  }
  return <ChartBrushWithHost {...props} host={host} />;
}
(ChartBrush as unknown as Record<symbol, unknown>)[CHART_ROLE] = "brush";
ChartBrush.displayName = "ChartBrush";

function ChartBrushWithHost(props: ChartBrushProps & { host: BrushHost }) {
  const { host, onSelectionChange, initialSelection, blurPx = 1.5, fadeOuterEdges = true, selectionPattern, selectedBoxStyle } = props;
  const { extent, innerWidth, innerHeight } = useBrushDrag(host, {
    initialSelection,
    onSelectionChange,
  });

  if (!extent || innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <BrushChrome
      host={host}
      x0={extent.x0}
      x1={extent.x1}
      innerWidth={innerWidth}
      innerHeight={innerHeight}
      blurPx={blurPx}
      fadeOuterEdges={fadeOuterEdges}
      selectionPattern={selectionPattern}
      selectedBoxStyle={selectedBoxStyle}
    />
  );
}
