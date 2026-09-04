"use client";

import * as React from "react";
import { Badge } from "./marker-badge";
import { MarkerCircleHtml } from "./marker-circle";
import { renderMarkerFan } from "./marker-fan";
import type { ChartMarker } from "./types";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
// Collapsed (unfanned) marker scale while another bucket is fanned.
const MARKER_COLLAPSED_SCALE = 0.6;
// Guide-line opacity when neither hovered nor crosshair-active.
const MARKER_GUIDE_DIMMED_OPACITY = 0.6;
// Gap between the marker circle edge and the guide-line start.
const MARKER_GUIDE_TOP_OFFSET_PX = 4;
// Pre-reveal scale of the entering marker.
const MARKER_ENTER_INITIAL_SCALE = 0.85;

const MARKER_BLURRED_FILTER = "blur(2px)";
const MARKER_SHARP_FILTER = "blur(0px)";

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

const resolveGuideOpacity = (hovered: boolean, isActive: boolean): number => {
  if (hovered) {return 1;}
  if (isActive === true) {return 0;}
  return MARKER_GUIDE_DIMMED_OPACITY;
};

const resolveMarkerFilter = (revealed: boolean, shouldFan: boolean): string => {
  if (!revealed) {return MARKER_BLURRED_FILTER;}
  if (shouldFan) {return MARKER_BLURRED_FILTER;}
  return MARKER_SHARP_FILTER;
};

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

// Guide-line style is a pure function of its geometry so the render helper stays allocation-free in JSX.
const markerGuideLineStyle = (lineHeight: number, y: number, hovered: boolean, isActive: boolean, size: number): React.CSSProperties => ({
  borderLeft: "1px dashed var(--chart-marker-border)",
  height: lineHeight + Math.abs(y),
  left: 0,
  opacity: resolveGuideOpacity(hovered, isActive),
  pointerEvents: "none",
  position: "absolute",
  top: size / 2 + MARKER_GUIDE_TOP_OFFSET_PX,
  transition: "opacity 200ms ease-out",
  width: 1,
});

const renderMarkerGuideLine = (options: Readonly<MarkerGuideLineOptions>): React.ReactNode => {
  const { showLine, lineHeight, y, size, hovered, isActive } = options;
  if (!showLine || lineHeight <= 0) {return undefined;}
  return (
    <div
      aria-hidden="true"
      style={markerGuideLineStyle(lineHeight, y, hovered, isActive, size)}
    />
  );
}

interface FirstMarkerCircleOptions {
  readonly markers: readonly ChartMarker[];
  readonly size: number;
}

const renderFirstMarkerCircle = (options: Readonly<FirstMarkerCircleOptions>): React.ReactNode => {
  const { markers, size } = options;
  const [firstMarker] = markers;
  const handleFirstMarkerClick = (): void => {
    firstMarker.onClick?.();
  };
  return <MarkerCircleHtml icon={firstMarker.icon} size={size} color={firstMarker.color} onClick={firstMarker.onClick === undefined ? undefined : handleFirstMarkerClick} href={firstMarker.href} target={firstMarker.target} />;
}

const renderMarkerBadge = (count: number, size: number): React.ReactNode => <Badge count={count} size={size} />;

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

// Enter-transition style is a pure function of its reveal inputs; see the guide-line factory above.
const markerEnterStyle = (size: number, revealed: boolean, collapsedOpacity: number, collapsedScale: number, shouldFan: boolean): React.CSSProperties => ({
  cursor: "pointer",
  filter: resolveMarkerFilter(revealed, shouldFan),
  height: size,
  left: -size / 2,
  opacity: revealed ? collapsedOpacity : 0,
  pointerEvents: "auto",
  position: "absolute",
  top: -size / 2,
  transform: `scale(${revealed ? collapsedScale : MARKER_ENTER_INITIAL_SCALE})`,
  transformOrigin: "center center",
  transition: revealed
    ? "opacity 220ms ease-out, transform 220ms ease-out, filter 220ms ease-out"
    : "none",
  width: size,
});

// Inner marker box only tracks its size.
const markerEnterInnerStyle = (size: number): React.CSSProperties => ({
  height: size,
  position: "relative",
  width: size,
});

const renderMarkerEnter = (options: Readonly<MarkerEnterOptions>): React.ReactNode => {
  const { markers, size, revealed, collapsedOpacity, collapsedScale, shouldFan, hasMultiple, onEnter, onLeave, attachEnterRef } = options;
  return (
    <div
      ref={attachEnterRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={markerEnterStyle(size, revealed, collapsedOpacity, collapsedScale, shouldFan)}
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
const markerGroupContentStyle = (x: number, y: number): React.CSSProperties => ({
  height: 0,
  left: x,
  overflow: "visible",
  pointerEvents: "none",
  position: "absolute",
  top: y,
  width: 0,
  zIndex: 5,
});

const renderMarkerGroupContent = (options: Readonly<MarkerGroupContentOptions>): React.ReactElement => {
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
}: MarkerGroupViewProps): React.ReactElement => {
  const [hovered, setHovered] = React.useState(false);
  const { markers } = bucket;
  const reduced = usePrefersReducedMotion();
  const [enterElapsed, setEnterElapsed] = React.useState(false);
  const enterRef = React.useRef<HTMLDivElement | null>(null);
  const attachEnterRef = React.useCallback((element: HTMLDivElement | null): void => {
    enterRef.current = element;
  }, []);

  React.useEffect(() => {
    if (!animate || reduced) { return undefined; }
    const id = globalThis.setTimeout((): void =>{  setEnterElapsed(true); }, delayMs);
    return (): void =>{  globalThis.clearTimeout(id); };
  }, [animate, reduced, delayMs]);

  const onEnter = React.useCallback(() => {
    setHovered(true);
    onMarkerHoverChange?.(markers);
  }, [onMarkerHoverChange, markers]);
  const onLeave = React.useCallback(() => {
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
