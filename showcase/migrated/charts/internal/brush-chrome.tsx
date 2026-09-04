"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode, RefObject, SVGProps } from "react";
import { BrushBorderChrome } from "./brush-border-chrome";
import { BrushHandleChrome } from "./brush-handle-chrome";
import { BrushSelectionPatternChrome } from "./brush-selection-pattern-chrome";
import { BrushTrackChrome } from "./brush-track-chrome";
import type { BrushChromePattern } from "./brush-chrome-helpers";

// Mount subscription for the portal chrome: no events to subscribe to, so the
// Subscribe stays a stable no-op and snapshots flip false (SSR) to true (client).
const subscribeBrushMount = (): (() => void) => (): void => {
  // No events to subscribe to; the snapshot flips on hydration alone.
};
const getBrushMountSnapshot = (): boolean => true;
const getBrushMountServerSnapshot = (): boolean => false;

// Portal chrome for the host-owned native brushX: container/margin/trackExtent only.
interface BrushHost {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly margin: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly trackExtent: readonly [Readonly<Date>, Readonly<Date>];
}

// Full SVG rect prop surface; spread LAST so callers can override geometry (legacy visx parity).
type BrushSelectedBoxStyle = SVGProps<SVGRectElement>;

interface BrushChromeProps {
  readonly host: BrushHost;
  readonly x0: number;
  readonly x1: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly blurPx?: number;
  readonly fadeOuterEdges?: boolean;
  readonly selectionPattern?: BrushChromePattern;
  readonly selectedBoxStyle?: BrushSelectedBoxStyle;
}

const BrushChrome = ({
  host,
  x0,
  x1,
  innerWidth,
  innerHeight,
  blurPx = 1.5,
  fadeOuterEdges = true,
  selectionPattern,
  selectedBoxStyle,
}: Readonly<BrushChromeProps>): ReactNode => {
  const mounted = useSyncExternalStore(subscribeBrushMount, getBrushMountSnapshot, getBrushMountServerSnapshot);
  if (innerWidth <= 0 || innerHeight <= 0) {return undefined;}
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
