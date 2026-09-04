"use client";

// Split from marker-group-view so the enter-box ref attaches directly; threading it through a helper trips react(refs).
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";
import { Badge } from "./marker-badge";
import { MarkerCircleHtml } from "./marker-circle";
import { renderMarkerFan } from "./marker-fan";
import type { ChartMarker } from "./types";
import { markerEnterStyle, markerGuideLineStyle } from "./marker-group-styles";

// Collapsed (unfanned) marker scale while another bucket is fanned.
const MARKER_COLLAPSED_SCALE = 0.6;

// Fully revealed marker presence, contrasted with the collapsed presence above.
const COLLAPSED_MARKER_OPACITY = 0;
const FULL_MARKER_OPACITY = 1;
const FULL_MARKER_SCALE = 1;

// Guide-line height at or below which there is nothing to draw.
const MIN_LINE_HEIGHT = 0;

// A bucket holds multiple markers when it holds more than a single one.
const SINGLE_MARKER_COUNT = 1;

// Fan-out always slices from the start of the marker list.
const MARKER_SLICE_START_INDEX = 0;

// QA flag set pre-boot by Playwright (see qa/screenshot.mjs); mirrored for SSR reads.
// The double-underscore name is the harness contract.
declare global {
  interface Window {
    readonly __qaSetMarkerFan?: boolean;
  }
  var __qaSetMarkerFan: boolean | undefined;
}

// QA hook: only armed if the flag was already true when this module first evaluated (set pre-boot); later toggles are ignored.
const QA_MARKER_FAN_ARMED = globalThis.__qaSetMarkerFan === true;

const resolveFannedMarkers = (markers: readonly ChartMarker[], maxFanned: number | undefined): readonly ChartMarker[] => (
  maxFanned === undefined ? markers : markers.slice(MARKER_SLICE_START_INDEX, maxFanned)
);

const resolveShouldFanMarkers = (hovered: boolean, hasMultiple: boolean): boolean =>
  (hovered || (QA_MARKER_FAN_ARMED && hasMultiple)) && hasMultiple;

interface CollapsedMarkerPresence {
  readonly opacity: number;
  readonly scale: number;
}

const resolveCollapsedMarkerPresence = (shouldFan: boolean): CollapsedMarkerPresence => ({
  opacity: shouldFan ? COLLAPSED_MARKER_OPACITY : FULL_MARKER_OPACITY,
  scale: shouldFan ? MARKER_COLLAPSED_SCALE : FULL_MARKER_SCALE,
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
  if (!showLine || lineHeight <= MIN_LINE_HEIGHT) {return undefined;}
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

// Inner marker box only tracks its size.
const markerEnterInnerStyle = (size: number): CSSProperties => ({
  height: size,
  position: "relative",
  width: size,
});

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

interface MarkerGroupContentProps {
  readonly animate: boolean;
  readonly bucketKey: string;
  readonly enterElapsed: boolean;
  readonly enterRef: RefObject<HTMLDivElement | null>;
  readonly hovered: boolean;
  readonly isActive: boolean | undefined;
  readonly lineHeight: number;
  readonly markers: readonly ChartMarker[];
  readonly maxFanned: number | undefined;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
  readonly reduced: boolean;
  readonly showLine: boolean;
  readonly size: number;
  readonly x: number;
  readonly y: number;
}

const MarkerGroupContent = (props: Readonly<MarkerGroupContentProps>): ReactElement => {
  const { animate, bucketKey, enterElapsed, enterRef, hovered, isActive, lineHeight, markers, maxFanned, onEnter, onLeave, reduced, showLine, size, x, y } = props;
  const hasMultiple = markers.length > SINGLE_MARKER_COUNT;
  const fanned = resolveFannedMarkers(markers, maxFanned);
  const shouldFan = resolveShouldFanMarkers(hovered, hasMultiple);
  const collapsed = resolveCollapsedMarkerPresence(shouldFan);
  const revealed = !animate || reduced || enterElapsed;
  return (
    <div
      style={markerGroupContentStyle(x, y)}
    >
      {renderMarkerGuideLine({ hovered, isActive: isActive === true, lineHeight, showLine, size, y })}
      <div
        ref={enterRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={markerEnterStyle({ collapsedOpacity: collapsed.opacity, collapsedScale: collapsed.scale, revealed, shouldFan, size })}
      >
        <div style={markerEnterInnerStyle(size)}>
          {renderFirstMarkerCircle({ markers, size })}
          {hasMultiple && !shouldFan ? renderMarkerBadge(markers.length, size) : undefined}
        </div>
      </div>
      {shouldFan ? renderMarkerFan({ bucketKey, fanned, onEnter, onLeave, reduced, size }) : undefined}
    </div>
  );
}

export { MarkerGroupContent };
export type { MarkerGroupContentProps };
