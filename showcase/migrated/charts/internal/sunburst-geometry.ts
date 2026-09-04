// Sunburst geometry, focus, hover, and layout functions — verbatim from
// repos/bklit-ui/packages/ui/src/charts/sunburst.ts.
// Copied here so migrated/charts has zero imports from repos/.
// Only the functions/types actually used by sunburst-chart.tsx and
// sunburst-reveal.ts are included.

import type { ArcDatum, ArcGeometry, Focus } from "./sunburst-types";
import { ID_SEP, TOP, TWO_PI } from "./sunburst-layout";
import { lerpGeometry, pointGeometry } from "./sunburst-arc-path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRILL_CENTER_SCALE = 0.65;
const DRILL_CENTER_DEPTH_SHRINK = 0.08;
const MIN_DRILL_CENTER_SCALE = 0.45;
const FOCUS_SPAN_EPSILON = 1e-9;

// Same reasoning as ReadonlySunburstNode: ArcDatum.trail (sunburst-types.ts) is a mutable
// Array upstream, and the geometry helpers below never mutate it.
type ReadonlyArcDatum = Readonly<Omit<ArcDatum, "trail">> & { readonly trail: readonly string[] };

// ---------------------------------------------------------------------------
// Ring layout
// ---------------------------------------------------------------------------

interface RingOptions {
  centerR: number;
  ringWidth: number;
}

const ringOptions = (focusDepth: number, maxDepth: number, radius: number): RingOptions => {
  const oneLevelCenterR = radius / maxDepth;
  if (focusDepth === 0) {
    return { centerR: 0, ringWidth: oneLevelCenterR };
  }
  const depthPastFirstDrill = Math.max(0, focusDepth - 1);
  const centerScale = Math.max(
    MIN_DRILL_CENTER_SCALE,
    DRILL_CENTER_SCALE - depthPastFirstDrill * DRILL_CENTER_DEPTH_SHRINK,
  );
  const centerR = oneLevelCenterR * centerScale;
  const visibleRings = Math.max(1, maxDepth - focusDepth);
  const ringWidth = (radius - centerR) / visibleRings;
  return { centerR, ringWidth };
};

// ---------------------------------------------------------------------------
// Geometry per arc
// ---------------------------------------------------------------------------

// Arc/focus/maxDepth/radius: exported and called with 4 positional args by sunburst-chart.tsx
// (outside this batch) — bundling them into an options object would break that public call
// Signature, so the eslint(max-params) finding here is left and reported; readonly-ness is still
// Tightened via ReadonlyArcDatum/Readonly<Focus>.
const geometryFor = (
  arc: ReadonlyArcDatum,
  focus: Readonly<Focus>,
  maxDepth: number,
  radius: number,
): ArcGeometry | null => {
  // Returns null (not undefined) for "no geometry": unicorn(no-null) wants undefined here, but
  // Eslint(no-undefined) (also active, no exceptions) bans the undefined literal, and
  // Typescript(consistent-return) rejects a function that sometimes returns a value and
  // Sometimes returns nothing (a bare `return;`). Null is the only return shape that satisfies
  // Consistent-return and no-undefined at once — the resulting no-null findings below (and on
  // Every other "maybe nothing" return in this file) are a genuine rule-config conflict, not a
  // Fixable code defect; see the batch report.
  if (arc.depth <= focus.depth) {
    return null;
  }
  if (arc.id !== focus.id && !arc.id.startsWith(`${focus.id}${ID_SEP}`)) {
    return null;
  }

  const { centerR, ringWidth } = ringOptions(focus.depth, maxDepth, radius);
  const relativeDepth = arc.depth - focus.depth;
  const focusSpan = focus.a1 - focus.a0;
  const mapAngle = (angle: number): number => {
    if (focusSpan <= FOCUS_SPAN_EPSILON) {
      return TOP;
    }
    return TOP + ((angle - focus.a0) / focusSpan) * TWO_PI;
  };

  return {
    a0: mapAngle(arc.a0),
    a1: mapAngle(arc.a1),
    innerR: centerR + (relativeDepth - 1) * ringWidth,
    outerR: centerR + relativeDepth * ringWidth,
  };
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const geomCentroidAngle = (geometry: Readonly<ArcGeometry>): number => (geometry.a0 + geometry.a1) / 2;

const geomCentroidRadius = (geometry: Readonly<ArcGeometry>): number => (geometry.innerR + geometry.outerR) / 2;

// Normalized clockwise angle from 12 o'clock (0 → 1).
const clockwiseFraction = (angle: number): number => {
  let normalized = angle - TOP;
  if (normalized < 0) {
    normalized += TWO_PI;
  }
  return normalized / TWO_PI;
};

// Arc/fromFocus/toFocus/maxDepth/radius/progress: exported and called with 6 positional args by
// Sunburst-chart.tsx (outside this batch) — bundling them would break that public call signature,
// So the eslint(max-params) finding here is left and reported; readonly-ness is still tightened
// Via ReadonlyArcDatum/Readonly<Focus>.
// Zoom morph — lerps matching arcs; entering/exiting arcs collapse to a point.
const transitionGeometry = (
  arc: ReadonlyArcDatum,
  fromFocus: Readonly<Focus>,
  toFocus: Readonly<Focus>,
  maxDepth: number,
  radius: number,
  progress: number,
): ArcGeometry | null => {
  const from = geometryFor(arc, fromFocus, maxDepth, radius);
  const to = geometryFor(arc, toFocus, maxDepth, radius);

  // Same no-null/no-undefined/consistent-return conflict as geometryFor above.
  if (from === null) {
    return to === null ? null : lerpGeometry(pointGeometry(to), to, progress);
  }
  return to === null ? lerpGeometry(from, pointGeometry(from), progress) : lerpGeometry(from, to, progress);
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { buildArcs, buildSunburstFlatRows, nodeId, sumValues } from "./sunburst-layout";
export { arcPath, defaultSunburstGrowPadding, lerpGeometry } from "./sunburst-arc-path";
export {
  clockwiseFraction,
  geomCentroidAngle,
  geomCentroidRadius,
  geometryFor,
  ringOptions,
  transitionGeometry,
};
export type { SunburstFlatRow, SunburstLayout } from "./sunburst-layout";
export type { ArcDatum, ArcGeometry, Focus, SunburstNode } from "./sunburst-types";
