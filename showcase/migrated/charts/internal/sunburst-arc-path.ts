// Sunburst arc rendering geometry: d-string construction, geometric interpolation, and hover growth.
// Extracted from sunburst-geometry.ts (same module family; re-exported there so the public import path is unchanged).

import type { ArcGeometry } from "./sunburst-types";
import { TWO_PI } from "./sunburst-layout";

const MIN_ARC_THICKNESS_PX = 0.5;
const MIN_ARC_ANGLE_RAD = 0.001;
const POINT_PIN_RADIUS_RATIO = 0.12;
const HOVER_GROW_RING_BUDGET = 0.28;
const HOVER_GROW_SEGMENT_CAP = 0.1;

// ---------------------------------------------------------------------------
// Arc path construction (d-string)
// ---------------------------------------------------------------------------

interface ArcPoints {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const arcOuterPoints = (a0: number, a1: number, outer: number): ArcPoints => ({
  x0: Math.sin(a0) * outer,
  x1: Math.sin(a1) * outer,
  y0: -Math.cos(a0) * outer,
  y1: -Math.cos(a1) * outer,
});

const arcInnerPoints = (a0: number, a1: number, inner: number): ArcPoints => ({
  x0: Math.sin(a0) * inner,
  x1: Math.sin(a1) * inner,
  y0: -Math.cos(a0) * inner,
  y1: -Math.cos(a1) * inner,
});

// Merges the original arcPathFromGeometry + arcPathFromRadii pair into one function taking a
// Single geometry object — same no-null reasoning as geometryFor above; also removes the
// Eslint(max-params) finding the old 4-primitive-argument arcPathFromRadii had.
const arcPathFromGeometry = (geometry: Readonly<ArcGeometry>): string | null => {
  const { a0, a1, innerR, outerR } = geometry;
  if (outerR - innerR < MIN_ARC_THICKNESS_PX || a1 - a0 < MIN_ARC_ANGLE_RAD) {
    return null;
  }

  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const outer = arcOuterPoints(a0, a1, outerR);

  if (innerR < 1) {
    return `M 0 0 L ${outer.x0} ${outer.y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outer.x1} ${outer.y1} Z`;
  }

  const inner = arcInnerPoints(a0, a1, innerR);
  return `M ${outer.x0} ${outer.y0} A ${outerR} ${outerR} 0 ${largeArc} 1 ${outer.x1} ${outer.y1} L ${inner.x1} ${inner.y1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${inner.x0} ${inner.y0} Z`;
};

const arcPath = (geometry: Readonly<ArcGeometry>, progress: number, radialProgress = progress): string | null => {
  // Same no-null/no-undefined/consistent-return conflict as geometryFor above.
  if (progress <= 0 && radialProgress <= 0) {
    return null;
  }

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const clampedRadialProgress = Math.min(1, Math.max(0, radialProgress));
  const { a0, a1, innerR, outerR } = geometry;

  if (clampedProgress >= 1 && clampedRadialProgress >= 1) {
    return arcPathFromGeometry(geometry);
  }

  const span = a1 - a0;
  const currentGeometry: ArcGeometry = {
    a0,
    a1: a0 + span * clampedProgress,
    innerR: innerR < 1 ? 0 : innerR,
    outerR:
      innerR < 1 ? outerR * clampedRadialProgress : innerR + (outerR - innerR) * clampedRadialProgress,
  };

  return arcPathFromGeometry(currentGeometry);
};

// ---------------------------------------------------------------------------
// Geometry interpolation (lerp + transition)
// ---------------------------------------------------------------------------

const lerpAngle = (from: number, to: number, progress: number): number => {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= TWO_PI;
  }
  while (delta < -Math.PI) {
    delta += TWO_PI;
  }
  return from + delta * progress;
};

const lerpGeometry = (from: Readonly<ArcGeometry>, to: Readonly<ArcGeometry>, progress: number): ArcGeometry => {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const fromMid = (from.a0 + from.a1) / 2;
  const toMid = (to.a0 + to.a1) / 2;
  const fromHalf = (from.a1 - from.a0) / 2;
  const toHalf = (to.a1 - to.a0) / 2;
  const mid = lerpAngle(fromMid, toMid, clampedProgress);
  const half = fromHalf + (toHalf - fromHalf) * clampedProgress;

  return {
    a0: mid - half,
    a1: mid + half,
    innerR: from.innerR + (to.innerR - from.innerR) * clampedProgress,
    outerR: from.outerR + (to.outerR - from.outerR) * clampedProgress,
  };
};

const pointGeometry = (source: Readonly<ArcGeometry>): ArcGeometry => {
  const mid = (source.a0 + source.a1) / 2;
  const radius = (source.innerR + source.outerR) / 2;
  const pin = Math.max(0, Math.min(radius * POINT_PIN_RADIUS_RATIO, source.innerR));
  return { a0: mid, a1: mid, innerR: pin, outerR: pin };
};

// ---------------------------------------------------------------------------
// Hover grow
// ---------------------------------------------------------------------------

const hoverGrowForPathSegment = (hoverPop: number, ringWidth: number, pathLength: number): number => {
  const maxTotalGrow = ringWidth * HOVER_GROW_RING_BUDGET;
  const budgetPerSegment = maxTotalGrow / pathLength;
  const perSegmentCap = ringWidth * HOVER_GROW_SEGMENT_CAP;
  return Math.min(hoverPop, perSegmentCap, budgetPerSegment);
};

const defaultSunburstGrowPadding = (maxDepth: number, size: number, hoverPop: number): number => {
  const fullRadius = size / 2;
  const rootRingWidth = fullRadius / Math.max(1, maxDepth);
  const pathLength = Math.max(1, maxDepth - 1);
  const segmentGrow = hoverGrowForPathSegment(hoverPop, rootRingWidth, pathLength);
  return Math.ceil(segmentGrow * pathLength + segmentGrow);
};

export {
  arcPath,
  arcPathFromGeometry,
  defaultSunburstGrowPadding,
  lerpAngle,
  lerpGeometry,
  pointGeometry,
};
