"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { MarkerGroupContent } from "./marker-group-content";
import type { ChartMarker } from "./types";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

interface Bucket {
  key: string;
  markers: ChartMarker[];
  date: Date;
}

interface MarkerGroupViewProps {
  bucket: Bucket;
  x: number;
  y: number;
  size: number;
  showLine: boolean;
  lineHeight: number;
  animate: boolean;
  delayMs: number;
  maxFanned?: number;
  /** True while the chart crosshair/tooltip sits on this bucket's date; hides the guide line so it doesn't fight the crosshair indicator. */
  isActive?: boolean;
  onMarkerHoverChange?: (markers: ChartMarker[] | null) => void;
}

const MarkerGroupView = ({
  bucket,
  x,
  y,
  size,
  showLine,
  lineHeight,
  animate,
  delayMs,
  maxFanned,
  isActive,
  onMarkerHoverChange,
}: MarkerGroupViewProps): ReactElement => {
  const [hovered, setHovered] = useState(false);
  const { markers } = bucket;
  const reduced = usePrefersReducedMotion();
  const [enterElapsed, setEnterElapsed] = useState(false);
  const enterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!animate || reduced) {
      return (): void => {
        // No timer was scheduled.
      };
    }
    const id = globalThis.setTimeout((): void =>{  setEnterElapsed(true); }, delayMs);
    return (): void =>{  globalThis.clearTimeout(id); };
  }, [animate, reduced, delayMs]);

  const onEnter = useCallback(() => {
    setHovered(true);
    onMarkerHoverChange?.(markers);
  }, [onMarkerHoverChange, markers]);
  const onLeave = useCallback(() => {
    setHovered(false);
    onMarkerHoverChange?.(null);
  }, [onMarkerHoverChange]);

  return (
    <MarkerGroupContent
      animate={animate} bucketKey={bucket.key} enterElapsed={enterElapsed} enterRef={enterRef}
      hovered={hovered} isActive={isActive} lineHeight={lineHeight} markers={markers}
      maxFanned={maxFanned} onEnter={onEnter} onLeave={onLeave} reduced={reduced}
      showLine={showLine} size={size} x={x} y={y}
    />
  );
}

export type { Bucket, MarkerGroupViewProps };
export { MarkerGroupView };
