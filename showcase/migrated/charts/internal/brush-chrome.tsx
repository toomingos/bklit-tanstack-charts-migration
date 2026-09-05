"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ReactNode, RefObject, SVGProps } from "react";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import { BrushBorderChrome } from "./brush-border-chrome";
import { BrushHandleChrome } from "./brush-handle-chrome";
import { BrushSelectionPatternChrome } from "./brush-selection-pattern-chrome";
import { BrushTrackChrome } from "./brush-track-chrome";
import type { BrushChromePattern } from "./brush-chrome-helpers";
import { selectionToPixelExtent } from "./brush-chrome-helpers";
import { useChartStable } from "./chart-context";

// Mount subscription for the portal chrome: no events to subscribe to, so the
// Subscribe stays a stable no-op and snapshots flip false (SSR) to true (client).
const subscribeBrushMount = (): (() => void) => (): void => {
  // No events to subscribe to; the snapshot flips on hydration alone.
};
const getBrushMountSnapshot = (): boolean => true;
const getBrushMountServerSnapshot = (): boolean => false;

// Portal chrome for the host-owned native brushX. Bounds come from the host
// Scene (V1.2/G6); callers pass data (container/trackExtent/range), not rects.
interface BrushHost {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly margin: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly trackExtent: readonly [Readonly<Date>, Readonly<Date>];
}

// Full SVG rect prop surface; spread LAST so callers can override geometry (legacy visx parity).
type BrushSelectedBoxStyle = SVGProps<SVGRectElement>;

interface BrushChromeProps {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly trackExtent: readonly [Readonly<Date>, Readonly<Date>] | undefined;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly blurPx?: number;
  readonly fadeOuterEdges?: boolean;
  readonly selectionPattern?: BrushChromePattern;
  readonly selectedBoxStyle?: BrushSelectedBoxStyle;
}

const BrushChrome = ({
  containerRef,
  trackExtent,
  brushRangeValue,
  blurPx = 1.5,
  fadeOuterEdges = true,
  selectionPattern,
  selectedBoxStyle,
}: Readonly<BrushChromeProps>): ReactNode => {
  const mounted = useSyncExternalStore(subscribeBrushMount, getBrushMountSnapshot, getBrushMountServerSnapshot);
  // Plot bounds come from the host scene, never from margin props (V1.2/G6).
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const host: BrushHost | undefined = useMemo(
    (): BrushHost | undefined =>
      trackExtent === undefined
        ? undefined
        : { containerRef, margin, trackExtent },
    [containerRef, margin, trackExtent],
  );
  const innerWidth = plot.width;
  const innerHeight = plot.height;
  if (host === undefined || innerWidth <= 0 || innerHeight <= 0) {return undefined;}
  if (brushRangeValue === undefined) {return undefined;}
  const pixelExtent = selectionToPixelExtent(brushRangeValue, host.trackExtent, innerWidth);
  if (pixelExtent === undefined) {return undefined;}
  const { x0, x1 } = pixelExtent;
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
};

export type { BrushHost, BrushSelectedBoxStyle, BrushChromeProps };
export type { BrushChromePattern } from "./brush-chrome-helpers";
export { BrushChrome };
