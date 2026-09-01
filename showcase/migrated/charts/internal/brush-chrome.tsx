"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { renderPatternPreset } from "./pattern-preset";

// C6: moved in from the deleted brush-drag.ts (its own module comment ruled
// native brushX non-viable at v0.14 for lack of a second <Chart> host; at
// v0.15 the host chart itself now owns brushX directly, so this shape is
// just "where do I portal the chrome" — containerRef/margin/trackExtent —
// unchanged from before.
export interface BrushHost {
  containerRef: React.RefObject<HTMLElement | null>;
  margin: { top: number; right: number; bottom: number; left: number };
  trackExtent: [Date, Date];
}

const BRUSH_TRACK_OUTER_FADE = 0.15;
const HANDLE_WIDTH_PX = 4;
const HANDLE_HEIGHT_PX = 24;

// C6: moved in from the deleted brush-drag.ts, unchanged. BrushChrome's x0/x1
// are plot-local pixels (0..innerWidth, NOT scene-space) over the host's own
// stable trackExtent — an independent scale from the chart's own (rescaling,
// while brushing) x scale, same reasoning the old NON-VIABLE ruling gave for
// why native brushX couldn't bind directly to it. Previously fed by
// useBrushDrag's live pixel-drag state; now fed by the native controlled
// BrushRange<Date> (see line-chart.tsx / area-chart.tsx).
export function selectionToPixelExtent(
  selection: { start: Date; end: Date },
  trackExtent: [Date, Date],
  innerWidth: number,
): { x0: number; x1: number } | null {
  if (innerWidth <= 0) return null;
  const startMs = trackExtent[0].getTime();
  const endMs = trackExtent[1].getTime();
  const span = endMs - startMs;
  if (span === 0) return null;
  const sMs = selection.start.getTime();
  const eMs = selection.end.getTime();
  const x0Raw = ((sMs - startMs) / span) * innerWidth;
  const x1Raw = ((eMs - startMs) / span) * innerWidth;
  const x0 = Math.max(0, Math.min(innerWidth, x0Raw));
  const x1 = Math.max(0, Math.min(innerWidth, x1Raw));
  const nx0 = Math.min(x0, x1);
  const nx1 = Math.max(x0, x1);
  return { x0: nx0, x1: nx1 };
}

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

// P5.6 BR3 — the full SVG rect prop surface, as legacy types it
// (`repos/bklit-ui/.../chart-brush.tsx:30,61`: `React.SVGProps<SVGRectElement>`).
// This was a 4-field subset (`fill`/`fillOpacity`/`stroke`/`strokeWidth`), which
// silently rejected every other rect prop a legacy caller could set —
// `strokeDasharray` for a dashed selection, `rx` for rounded corners, `mask`,
// `filter`, a `style` object, `className`.
//
// Legacy's chain ends at visx `BrushSelection.js:128-155`, which spreads
// `selectedBoxStyle` LAST over the rect it has already given `x`/`y`/`width`/
// `height`/`className`/handlers — so in legacy the caller can override the
// geometry too. The spread order below is the same, for the same reason.
export type BrushSelectedBoxStyle = React.SVGProps<SVGRectElement>;

const DEFAULT_SELECTED_BOX_STYLE = {
  // repos/bklit-ui/packages/ui/src/charts/chart-brush.tsx:203-208
  fill: "transparent",
  fillOpacity: 0,
  stroke: "var(--chart-brush-border)",
  strokeWidth: 1,
} satisfies BrushSelectedBoxStyle;

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
  // BR3: legacy REPLACES the default style rather than merging into it —
  // `selectedBoxStyle ?? defaultStyle` (`chart-brush.tsx:247`). The merge this
  // used to do was friendlier and wrong: a caller passing only `{ stroke }` got
  // migrated's `fill: "transparent"` for free, where legacy hands visx a style
  // object with no fill at all and the rect paints SVG's default opaque black.
  // Same prop, opposite picture — so the `??` is deliberate, not a slip.
  const style: BrushSelectedBoxStyle = selectedBoxStyle ?? DEFAULT_SELECTED_BOX_STYLE;
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width="100%" height="100%">
      {/* Spread LAST, matching visx `BrushSelection.js:128-155`: the caller can
          override the computed geometry, exactly as in legacy. */}
      <rect
        x={plotLeft + left}
        y={plotTop}
        width={w}
        height={innerHeight}
        {...style}
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
