"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Badge } from "./marker-badge";
import { MarkerCircleHtml } from "./marker-circle";
import { renderMarkerFan } from "./marker-fan";
import type { ChartMarker } from "./types";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { markerEnterStyle, markerGuideLineStyle } from "./marker-group-styles";
// Collapsed (unfanned) marker scale while another bucket is fanned.
const MARKER_COLLAPSED_SCALE = 0.6;

// QA harness flag, set pre-boot by Playwright's addInitScript (see qa/screenshot.mjs).
// Window-mirrored onto globalThis: identical object in browsers, readable during SSR.
// The double-underscore name is the harness contract.
declare global {
  interface Window {
    __qaSetMarkerFan?: boolean;
  }
  var __qaSetMarkerFan: boolean | undefined;
}

// QA hook: only armed if the flag was already true when this module first evaluated (set pre-boot); later toggles are ignored.
const QA_MARKER_FAN_ARMED = globalThis.__qaSetMarkerFan === true;

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

const resolveFannedMarkers = (markers: readonly ChartMarker[], maxFanned: number | undefined): readonly ChartMarker[] => (
  maxFanned === undefined ? markers : markers.slice(0, maxFanned)
);

const resolveShouldFanMarkers = (hovered: boolean, hasMultiple: boolean): boolean =>
  (hovered || (QA_MARKER_FAN_ARMED && hasMultiple)) && hasMultiple;

interface CollapsedMarkerPresence {
  readonly opacity: number;
  readonly scale: number;
}

const resolveCollapsedMarkerPresence = (shouldFan: boolean): CollapsedMarkerPresence => ({
  opacity: shouldFan ? 0 : 1,
  scale: shouldFan ? MARKER_COLLAPSED_SCALE : 1,
});

interface MarkerGuideLineOptions {
  readonly showLine: boolean;
  readonly lineHeight: number;
  readonly y: number;
  readonly size: number;
  readonly hovered: boolean;
  readonly isActive: boolean;
}

const renderMarkerGuideLine = (options: Readonly<MarkerGuideLineOptions>): ReactNode => {
  const { showLine, lineHeight, y, size, hovered, isActive } = options;
  if (!showLine || lineHeight <= 0) {return undefined;}
  return (
    <div
      aria-hidden="true"
      style={markerGuideLineStyle({ hovered, isActive, lineHeight, size, y })}
    />
  );
}

interface FirstMarkerCircleOptions {
  readonly markers: readonly ChartMarker[];
  readonly size: number;
}

const renderFirstMarkerCircle = (options: Readonly<FirstMarkerCircleOptions>): ReactNode => {
  const { markers, size } = options;
  const [firstMarker] = markers;
  const handleFirstMarkerClick = (): void => {
    firstMarker.onClick?.();
  };
  return <MarkerCircleHtml icon={firstMarker.icon} size={size} color={firstMarker.color} onClick={firstMarker.onClick === undefined ? undefined : handleFirstMarkerClick} href={firstMarker.href} target={firstMarker.target} />;
}

const renderMarkerBadge = (count: number, size: number): ReactNode => <Badge count={count} size={size} />;

interface MarkerEnterOptions {
  readonly markers: readonly ChartMarker[];
  readonly size: number;
  readonly revealed: boolean;
  readonly collapsedOpacity: number;
  readonly collapsedScale: number;
  readonly shouldFan: boolean;
  readonly hasMultiple: boolean;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
  readonly attachEnterRef: (element: HTMLDivElement | null) => void;
}

// Inner marker box only tracks its size.
const markerEnterInnerStyle = (size: number): CSSProperties => ({
  height: size,
  position: "relative",
  width: size,
});

const renderMarkerEnter = (options: Readonly<MarkerEnterOptions>): ReactNode => {
  const { markers, size, revealed, collapsedOpacity, collapsedScale, shouldFan, hasMultiple, onEnter, onLeave, attachEnterRef } = options;
  return (
    <div
      ref={attachEnterRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={markerEnterStyle({ collapsedOpacity, collapsedScale, revealed, shouldFan, size })}
    >
      <div style={markerEnterInnerStyle(size)}>
        {renderFirstMarkerCircle({ markers, size })}
        {hasMultiple && !shouldFan ? renderMarkerBadge(markers.length, size) : undefined}
      </div>
    </div>
  );
}

interface MarkerGroupContentOptions {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly showLine: boolean;
  readonly lineHeight: number;
  readonly maxFanned: number | undefined;
  readonly isActive: boolean | undefined;
  readonly markers: readonly ChartMarker[];
  readonly bucketKey: string;
  readonly hovered: boolean;
  readonly revealed: boolean;
  readonly reduced: boolean;
  readonly attachEnterRef: (element: HTMLDivElement | null) => void;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
}

// Group anchor box only tracks its position; everything else is static.
const markerGroupContentStyle = (x: number, y: number): CSSProperties => ({
  height: 0,
  left: x,
  overflow: "visible",
  pointerEvents: "none",
  position: "absolute",
  top: y,
  width: 0,
  zIndex: 5,
});

const renderMarkerGroupContent = (options: Readonly<MarkerGroupContentOptions>): ReactElement => {
  const { x, y, size, showLine, lineHeight, maxFanned, isActive, markers, bucketKey, hovered, revealed, reduced, attachEnterRef, onEnter, onLeave } = options;
  const hasMultiple = markers.length > 1;
  const fanned = resolveFannedMarkers(markers, maxFanned);
  const shouldFan = resolveShouldFanMarkers(hovered, hasMultiple);
  const collapsed = resolveCollapsedMarkerPresence(shouldFan);
  return (
    <div
      style={markerGroupContentStyle(x, y)}
    >
      {renderMarkerGuideLine({ hovered, isActive: isActive === true, lineHeight, showLine, size, y })}
      {renderMarkerEnter({ attachEnterRef, collapsedOpacity: collapsed.opacity, collapsedScale: collapsed.scale, hasMultiple, markers, onEnter, onLeave, revealed, shouldFan, size })}
      {shouldFan ? renderMarkerFan({ bucketKey, fanned, onEnter, onLeave, reduced, size }) : undefined}
    </div>
  );
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
  const attachEnterRef = useCallback((element: HTMLDivElement | null): void => {
    enterRef.current = element;
  }, []);

  useEffect(() => {
    if (!animate || reduced) { return (): void => { /* No timer was scheduled. */ }; }
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

  // Reveal state is derived here during render, not set in the effect above.
  // The props combined with the enter-delay flag keep prop transitions correct.
  // No extra render is needed.
  return renderMarkerGroupContent({ attachEnterRef, bucketKey: bucket.key, hovered, isActive, lineHeight, markers, maxFanned, onEnter, onLeave, reduced, revealed: !animate || reduced || enterElapsed, showLine, size, x, y });
}

export type { Bucket, MarkerGroupViewProps };
export { MarkerGroupView };
