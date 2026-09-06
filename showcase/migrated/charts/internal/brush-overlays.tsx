// V3.4b parity: legacy brush overlay names over the migrated renderer.
"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";
import { createPortal } from "react-dom";
import { useChartStable } from "./chart-context";
import type { Margin } from "./chart-context";
import { renderPatternPreset } from "./pattern-preset-render";
import type {
  ChartBrushSelectionOverlayProps,
  ChartBrushTrackOverlayProps,
  ChartBrushTrackOverlayStyle,
} from "./parity/brush";

interface ChartBrushOverlayHost {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly margin: Margin;
}

// Portal targets exist only on the client; the server snapshot stays false.
// Both renders agree on null because the first server render is null.
const unsubscribeBrushOverlay = (): void => {
  // No events to unsubscribe from; the mount itself is the signal.
};
const subscribeBrushOverlay = (): (() => void) => unsubscribeBrushOverlay;
const getBrushOverlaySnapshot = (): boolean => true;
const getBrushOverlayServerSnapshot = (): boolean => false;

const useBrushOverlayMounted = (): boolean =>
  useSyncExternalStore(subscribeBrushOverlay, getBrushOverlaySnapshot, getBrushOverlayServerSnapshot);

/** Fade dimming panes at the outer track ends; matches series edge fade. */
const BRUSH_TRACK_OUTER_FADE = 0.15;
const BRUSH_TRACK_FADE_STOP_PCT = 100;
const BRUSH_TRACK_MAX_BLUR_PX = 5;
const BRUSH_TRACK_MIN_BLUR_PX = 0;
const BRUSH_TRACK_DEFAULT_BLUR_PX = 1.5;
const BRUSH_PATTERN_DEFAULT_OPACITY = 1;

const resolveTrackMask = (edge: "left" | "right", fadeOuterEdges: boolean): string | undefined => {
  if (!fadeOuterEdges) {
    return undefined;
  }
  const fadeStop = `${BRUSH_TRACK_OUTER_FADE * BRUSH_TRACK_FADE_STOP_PCT}%`;
  if (edge === "left") {
    return `linear-gradient(to right, transparent 0%, black ${fadeStop}, black 100%)`;
  }
  return `linear-gradient(to left, transparent 0%, black ${fadeStop}, black 100%)`;
};

const outsidePaneStyle = (edge: "left" | "right", style: Required<ChartBrushTrackOverlayStyle>): CSSProperties => {
  const mask = resolveTrackMask(edge, style.fadeOuterEdges);
  const blur = style.blurPx > 0 ? `blur(${style.blurPx}px)` : undefined;
  return {
    WebkitBackdropFilter: blur,
    WebkitMaskImage: mask,
    backdropFilter: blur,
    maskImage: mask,
    pointerEvents: "none",
  };
};

interface SelectionOverlayContentProps {
  readonly overlay: ChartBrushSelectionOverlayProps;
  readonly host: ChartBrushOverlayHost;
}

// Pattern fill between brush handles (`z-[1]`, above blur panes).
const ChartBrushSelectionOverlayContent = ({
  overlay,
  host,
}: SelectionOverlayContentProps): ReactElement | null => {
  const mounted = useBrushOverlayMounted();
  const patternId = useId().replaceAll(":", "");
  const containerNode = host.containerRef.current;
  const { innerWidth, innerHeight, selectionX0, selectionX1, pattern } = overlay;

  if (!mounted || containerNode === null || pattern === undefined || pattern.preset === "none") {
    return null;
  }

  const left = Math.max(0, Math.min(selectionX0, selectionX1, innerWidth));
  const right = Math.max(left, Math.min(Math.max(selectionX0, selectionX1), innerWidth));
  const selectionWidth = right - left;
  if (selectionWidth <= 0) {
    return null;
  }

  const patternNode = renderPatternPreset(pattern.preset, patternId, {
    color: pattern.color,
    complement: pattern.complement,
    fill: pattern.fill,
    radius: pattern.radius,
    scale: pattern.scale,
    strokeWidth: pattern.strokeWidth,
    tileBackground: pattern.tileBackground,
  });
  if (patternNode === undefined || patternNode === null) {
    return null;
  }

  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" height="100%" width="100%">
      <defs>{patternNode}</defs>
      <rect
        fill={`url(#${patternId})`}
        fillOpacity={pattern.opacity ?? BRUSH_PATTERN_DEFAULT_OPACITY}
        height={innerHeight}
        width={selectionWidth}
        x={host.margin.left + left}
        y={host.margin.top}
      />
    </svg>,
    containerNode,
  );
};

const ChartBrushSelectionOverlay = (props: ChartBrushSelectionOverlayProps): ReactElement => {
  const { containerRef, margin } = useChartStable();
  const host = useMemo((): ChartBrushOverlayHost => ({ containerRef, margin }), [containerRef, margin]);
  return <ChartBrushSelectionOverlayContent host={host} overlay={props} />;
};

interface TrackOverlayContentProps {
  readonly overlay: ChartBrushTrackOverlayProps;
  readonly host: ChartBrushOverlayHost;
}

const ChartBrushTrackOverlayContent = ({ overlay, host }: TrackOverlayContentProps): ReactElement | null => {
  const mounted = useBrushOverlayMounted();
  const containerNode = host.containerRef.current;
  const { innerWidth, innerHeight, selectionX0, selectionX1 } = overlay;
  const blurPx = overlay.blurPx ?? BRUSH_TRACK_DEFAULT_BLUR_PX;
  const fadeOuterEdges = overlay.fadeOuterEdges ?? true;
  const clampedBlur = Math.min(BRUSH_TRACK_MAX_BLUR_PX, Math.max(BRUSH_TRACK_MIN_BLUR_PX, blurPx));
  const left = Math.max(0, Math.min(selectionX0, selectionX1, innerWidth));
  const right = Math.max(left, Math.min(Math.max(selectionX0, selectionX1), innerWidth));
  const leftWidth = Math.max(0, left);
  const rightWidth = Math.max(0, innerWidth - right);
  const plotLeft = host.margin.left;
  const plotTop = host.margin.top;
  const leftPaneStyle = useMemo(
    (): CSSProperties => ({
      ...outsidePaneStyle("left", { blurPx: clampedBlur, fadeOuterEdges }),
      height: innerHeight,
      left: plotLeft,
      top: plotTop,
      width: leftWidth,
    }),
    [clampedBlur, fadeOuterEdges, innerHeight, leftWidth, plotLeft, plotTop],
  );
  const rightPaneStyle = useMemo(
    (): CSSProperties => ({
      ...outsidePaneStyle("right", { blurPx: clampedBlur, fadeOuterEdges }),
      height: innerHeight,
      left: plotLeft + right,
      top: plotTop,
      width: rightWidth,
    }),
    [clampedBlur, fadeOuterEdges, innerHeight, plotLeft, plotTop, right, rightWidth],
  );

  if (!mounted || containerNode === null) {
    return null;
  }
  if (leftWidth <= 0 && rightWidth <= 0) {
    return null;
  }

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      {leftWidth > 0 ? <div className="absolute" style={leftPaneStyle} /> : undefined}
      {rightWidth > 0 ? <div className="absolute" style={rightPaneStyle} /> : undefined}
    </div>,
    containerNode,
  );
};

const ChartBrushTrackOverlay = (props: ChartBrushTrackOverlayProps): ReactElement => {
  const { containerRef, margin } = useChartStable();
  const host = useMemo((): ChartBrushOverlayHost => ({ containerRef, margin }), [containerRef, margin]);
  return <ChartBrushTrackOverlayContent host={host} overlay={props} />;
};

export { ChartBrushSelectionOverlay, ChartBrushTrackOverlay };
