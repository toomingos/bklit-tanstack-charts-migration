"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { MarkerCircleHtml } from "./marker-circle";
import type { ChartMarker } from "./types";

const FAN_RADIUS = 50;
const FAN_ANGLE = 160;
// Fan opens upward (-90°); degrees-to-radians divisor.
const FAN_START_ANGLE_DEG = -90;
const DEGREES_PER_HALF_CIRCLE = 180;
// Fan hub dot: diameter and offset as fractions of marker size.
const MARKER_FAN_HUB_DIAMETER_SCALE = 0.5;
const MARKER_FAN_HUB_OFFSET_SCALE = 0.25;
// Per-marker stagger of the fan-out transition.
const MARKER_FAN_STAGGER_MS = 40;

interface CirclePosition {
  readonly x: number;
  readonly y: number;
}

const getCirclePosition = (index: number, total: number): CirclePosition => {
  const startAngle = FAN_START_ANGLE_DEG - FAN_ANGLE / 2;
  const angleStep = total > 1 ? FAN_ANGLE / (total - 1) : 0;
  const angle = startAngle + index * angleStep;
  const radians = (angle * Math.PI) / DEGREES_PER_HALF_CIRCLE;
  return { x: Math.cos(radians) * FAN_RADIUS, y: Math.sin(radians) * FAN_RADIUS };
}

const buildFanHubStyle = (size: number): CSSProperties => ({
  backgroundColor: "var(--chart-marker-border)",
  borderRadius: 9999,
  height: size * MARKER_FAN_HUB_DIAMETER_SCALE,
  left: -size * MARKER_FAN_HUB_OFFSET_SCALE,
  opacity: 0.5,
  pointerEvents: "none",
  position: "absolute",
  top: -size * MARKER_FAN_HUB_OFFSET_SCALE,
  width: size * MARKER_FAN_HUB_DIAMETER_SCALE,
});

const renderFanHub = (size: number): ReactNode => (
  <div
    style={buildFanHubStyle(size)}
  />
);

interface FannedMarkerStyleOptions {
  readonly center: CirclePosition;
  readonly fanIndex: number;
  readonly reduced: boolean;
  readonly size: number;
}

const buildFannedMarkerStyle = (options: Readonly<FannedMarkerStyleOptions>): CSSProperties => {
  const { center, fanIndex, reduced, size } = options;
  return {
    height: size,
    left: center.x - size / 2,
    position: "absolute",
    top: center.y - size / 2,
    transition: reduced ? undefined : `transform 220ms ease-out ${fanIndex * MARKER_FAN_STAGGER_MS}ms, opacity 220ms ease-out ${fanIndex * MARKER_FAN_STAGGER_MS}ms`,
    width: size,
  };
};

interface FannedMarkerOptions {
  readonly bucketKey: string;
  readonly marker: Readonly<ChartMarker>;
  readonly fanIndex: number;
  readonly fanTotal: number;
  readonly size: number;
  readonly reduced: boolean;
}

const renderFannedMarker = (options: Readonly<FannedMarkerOptions>): ReactElement => {
  const { bucketKey, marker, fanIndex, fanTotal, size, reduced } = options;
  const { onClick: handleMarkerClick } = marker;
  const pos = getCirclePosition(fanIndex, fanTotal);
  const fannedMarkerStyle = buildFannedMarkerStyle({ center: pos, fanIndex, reduced, size });
  return (
    <div
      key={`${bucketKey}-${marker.title}-${fanIndex}`}
      style={fannedMarkerStyle}
    >
      <MarkerCircleHtml icon={marker.icon} size={size} color={marker.color} onClick={handleMarkerClick} href={marker.href} target={marker.target} />
    </div>
  );
}

interface MarkerFanOptions {
  readonly fanned: readonly ChartMarker[];
  readonly bucketKey: string;
  readonly size: number;
  readonly reduced: boolean;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
}

const buildMarkerFanStyle = (size: number): CSSProperties => ({
  height: FAN_RADIUS * 2 + size,
  left: -(FAN_RADIUS + size / 2),
  pointerEvents: "auto",
  position: "absolute",
  top: -(FAN_RADIUS + size / 2),
  width: FAN_RADIUS * 2 + size,
});

const buildMarkerFanInnerStyle = (size: number): CSSProperties => ({
  height: 0,
  left: FAN_RADIUS + size / 2,
  overflow: "visible",
  position: "absolute",
  top: FAN_RADIUS + size / 2,
  width: 0,
});

const renderMarkerFan = (options: Readonly<MarkerFanOptions>): ReactNode => {
  const { fanned, bucketKey, size, reduced, onEnter, onLeave } = options;
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={buildMarkerFanStyle(size)}
    >
      <div style={buildMarkerFanInnerStyle(size)}>
        {renderFanHub(size)}
        {fanned.map((marker, fanIndex) => renderFannedMarker({ bucketKey, fanIndex, fanTotal: fanned.length, marker, reduced, size }))}
      </div>
    </div>
  );
}

export { renderMarkerFan };
