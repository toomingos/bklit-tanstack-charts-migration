"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { BrushHost } from "./brush-drag";
import { renderPatternPreset } from "./pattern-preset";

const BRUSH_TRACK_OUTER_FADE = 0.15;
const HANDLE_WIDTH_PX = 4;
const HANDLE_HEIGHT_PX = 24;

export interface BrushChromePattern {
  preset: "none" | "diagonal" | "horizontal" | "vertical" | "cross" | "dots" | "accent";
  color?: string;
  opacity?: number;
  scale?: number;
  strokeWidth?: number;
  radius?: number;
  complement?: boolean;
  fill?: string;
  tileBackground?: string;
  dotFill?: boolean;
}

export interface BrushSelectedBoxStyle {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

const DEFAULT_SELECTED_BOX_STYLE: Required<BrushSelectedBoxStyle> = {
  // repos/bklit-ui/packages/ui/src/charts/chart-brush.tsx:203-208
  fill: "transparent",
  fillOpacity: 0,
  stroke: "var(--chart-brush-border)",
  strokeWidth: 1,
};

function BrushTrackChrome({
  host,
  x0,
  x1,
  innerWidth,
  innerHeight,
  blurPx,
  fadeOuterEdges,
  mounted,
}: {
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  blurPx: number;
  fadeOuterEdges: boolean;
  mounted: boolean;
}) {
  const container = host.containerRef.current;
  // repos/bklit-ui/packages/ui/src/charts/chart-brush-track-overlay.tsx:34-36 — clamped [0,5], default 1.5
  const clampedBlur = Math.min(5, Math.max(0, blurPx));
  const fadeStop = `${BRUSH_TRACK_OUTER_FADE * 100}%`;
  // repos/bklit-ui/packages/ui/src/charts/chart-brush-track-overlay.tsx:10,23-29 — fade at OUTER track ends only
  const leftMask = fadeOuterEdges ? `linear-gradient(to right, transparent 0%, black ${fadeStop}, black 100%)` : undefined;
  const rightMask = fadeOuterEdges ? `linear-gradient(to left, transparent 0%, black ${fadeStop}, black 100%)` : undefined;

  if (!(mounted && container)) return null;
  const leftWidth = Math.max(0, Math.min(x0, x1));
  const rightWidth = Math.max(0, innerWidth - Math.max(x0, x1));
  if (leftWidth <= 0 && rightWidth <= 0) return null;

  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {leftWidth > 0 ? (
        <div
          className="absolute"
          style={{
            top: plotTop,
            left: plotLeft,
            width: leftWidth,
            height: innerHeight,
            pointerEvents: "none",
            backdropFilter: clampedBlur > 0 ? `blur(${clampedBlur}px)` : undefined,
            WebkitBackdropFilter: clampedBlur > 0 ? `blur(${clampedBlur}px)` : undefined,
            maskImage: leftMask,
            WebkitMaskImage: leftMask,
          }}
        />
      ) : null}
      {rightWidth > 0 ? (
        <div
          className="absolute"
          style={{
            top: plotTop,
            left: plotLeft + Math.max(x0, x1),
            width: rightWidth,
            height: innerHeight,
            pointerEvents: "none",
            backdropFilter: clampedBlur > 0 ? `blur(${clampedBlur}px)` : undefined,
            WebkitBackdropFilter: clampedBlur > 0 ? `blur(${clampedBlur}px)` : undefined,
            maskImage: rightMask,
            WebkitMaskImage: rightMask,
          }}
        />
      ) : null}
    </div>,
    container,
  );
}

function BrushSelectionPatternChrome({
  host,
  x0,
  x1,
  innerWidth: _innerWidth,
  innerHeight,
  selectionPattern,
  mounted,
}: {
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  selectionPattern?: BrushChromePattern;
  mounted: boolean;
}) {
  const container = host.containerRef.current;
  const patternId = React.useId().replace(/:/g, "");
  // repos/bklit-ui/packages/ui/src/charts/chart-brush-selection-overlay.tsx:47 — only when preset && preset !== "none"
  if (!(mounted && container && selectionPattern?.preset && selectionPattern.preset !== "none")) return null;
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const w = Math.max(0, right - left);
  if (w <= 0) return null;
  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;
  const patternNode = renderPatternPreset(selectionPattern.preset as unknown as Parameters<typeof renderPatternPreset>[0], patternId, {
    color: selectionPattern.color,
    scale: selectionPattern.scale,
    strokeWidth: selectionPattern.strokeWidth,
    radius: selectionPattern.radius,
    complement: selectionPattern.complement,
    fill: selectionPattern.fill,
    tileBackground: selectionPattern.tileBackground,
    dotFill: selectionPattern.dotFill,
  });
  if (!patternNode) return null;
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      <defs>{patternNode}</defs>
      <rect
        fill={`url(#${patternId})`}
        fillOpacity={selectionPattern.opacity ?? 1}
        x={plotLeft + left}
        y={plotTop}
        width={w}
        height={innerHeight}
      />
    </svg>,
    container,
  );
}

function BrushHandleChrome({
  host,
  x0,
  x1,
  innerHeight,
  mounted,
}: {
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  mounted: boolean;
}) {
  const container = host.containerRef.current;
  if (!(mounted && container)) return null;
  // repos/bklit-ui/packages/ui/src/charts/chart-brush-handle.tsx:77 — when x0 === x1 render only ONE handle
  const edges = x0 === x1 ? [x0] : [Math.min(x0, x1), Math.max(x0, x1)];
  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;
  const handleTop = plotTop + (innerHeight - HANDLE_HEIGHT_PX) / 2;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      {edges.map((edgeX) => (
        <div
          key={String(edgeX)}
          className="absolute shrink-0 rounded-lg"
          style={{
            // repos/bklit-ui/packages/ui/src/charts/chart-brush-handle.tsx:9-11,53-104 — visible pill 24x4px
            top: handleTop,
            left: plotLeft + edgeX - HANDLE_WIDTH_PX / 2,
            width: HANDLE_WIDTH_PX,
            height: HANDLE_HEIGHT_PX,
            backgroundColor: "var(--chart-brush-border)",
            cursor: "ew-resize",
          }}
        />
      ))}
    </div>,
    container,
  );
}

function BrushBorderChrome({
  host,
  x0,
  x1,
  innerHeight,
  selectedBoxStyle,
  mounted,
}: {
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  selectedBoxStyle?: BrushSelectedBoxStyle;
  mounted: boolean;
}) {
  const container = host.containerRef.current;
  if (!(mounted && container)) return null;
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const w = Math.max(0, right - left);
  if (w <= 0) return null;
  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;
  const style = { ...DEFAULT_SELECTED_BOX_STYLE, ...selectedBoxStyle };
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      <rect
        x={plotLeft + left}
        y={plotTop}
        width={w}
        height={innerHeight}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
      />
    </svg>,
    container,
  );
}

export interface BrushChromeProps {
  host: BrushHost;
  x0: number;
  x1: number;
  innerWidth: number;
  innerHeight: number;
  blurPx?: number;
  fadeOuterEdges?: boolean;
  selectionPattern?: BrushChromePattern;
  selectedBoxStyle?: BrushSelectedBoxStyle;
}

export function BrushChrome({
  host,
  x0,
  x1,
  innerWidth,
  innerHeight,
  blurPx = 1.5,
  fadeOuterEdges = true,
  selectionPattern,
  selectedBoxStyle,
}: BrushChromeProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (innerWidth <= 0 || innerHeight <= 0) return null;
  const clampedX0 = Math.max(0, Math.min(innerWidth, x0));
  const clampedX1 = Math.max(0, Math.min(innerWidth, x1));
  return (
    <>
      <BrushTrackChrome host={host} x0={clampedX0} x1={clampedX1} innerWidth={innerWidth} innerHeight={innerHeight} blurPx={blurPx} fadeOuterEdges={fadeOuterEdges} mounted={mounted} />
      <BrushSelectionPatternChrome host={host} x0={clampedX0} x1={clampedX1} innerWidth={innerWidth} innerHeight={innerHeight} selectionPattern={selectionPattern} mounted={mounted} />
      <BrushBorderChrome host={host} x0={clampedX0} x1={clampedX1} innerWidth={innerWidth} innerHeight={innerHeight} selectedBoxStyle={selectedBoxStyle} mounted={mounted} />
      <BrushHandleChrome host={host} x0={clampedX0} x1={clampedX1} innerWidth={innerWidth} innerHeight={innerHeight} mounted={mounted} />
    </>
  );
}
