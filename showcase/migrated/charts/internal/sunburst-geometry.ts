/*
 * Verbatim from repos/bklit-ui/packages/ui/src/charts/sunburst.ts, trimmed to what
 * sunburst-chart.tsx and sunburst-reveal.ts use so migrated/charts imports nothing from repos/.
 */

import type { ArcDatum, ArcGeometry, Focus } from "./sunburst-types";
import { ID_SEP, TOP, TWO_PI } from "./sunburst-layout";
import { lerpGeometry, pointGeometry } from "./sunburst-arc-path";

const DRILL_CENTER_SCALE = 0.65;
const DRILL_CENTER_DEPTH_SHRINK = 0.08;
const MIN_DRILL_CENTER_SCALE = 0.45;
const FOCUS_SPAN_EPSILON = 1e-9;
// Depth of the root focus; ring layout collapses to a single centered ring here.
const ROOT_FOCUS_DEPTH = 0;
// Depth offset past the first drill level; the center stops shrinking after this.
const FIRST_DRILL_DEPTH_OFFSET = 1;
// At least one ring stays visible no matter how deep the focus drills.
const MIN_VISIBLE_RINGS = 1;
// Zero-based index base converting a 1-based relative depth into a ring offset.
const RING_INDEX_BASE = 1;
// Mean of two arc bounds gives the centroid, so the angular/radial sums halve.
const CENTROID_DIVISOR = 2;
// Clockwise fractions start at 12 o'clock; negative normalized angles wrap past this.
const CLOCKWISE_ORIGIN = 0;

// Same reasoning as ReadonlySunburstNode: ArcDatum.trail (sunburst-types.ts) is a mutable
// Array upstream, and the geometry helpers below never mutate it.
type ReadonlyArcDatum = Readonly<Omit<ArcDatum, "trail">> & { readonly trail: readonly string[] };

interface RingOptions {
  readonly centerR: number;
  readonly ringWidth: number;
}

const ringOptions = (focusDepth: number, maxDepth: number, radius: number): RingOptions => {
  const oneLevelCenterR = radius / maxDepth;
  if (focusDepth === ROOT_FOCUS_DEPTH) {
    return { centerR: 0, ringWidth: oneLevelCenterR };
  }
  const depthPastFirstDrill = Math.max(ROOT_FOCUS_DEPTH, focusDepth - FIRST_DRILL_DEPTH_OFFSET);
  const centerScale = Math.max(
    MIN_DRILL_CENTER_SCALE,
    DRILL_CENTER_SCALE - depthPastFirstDrill * DRILL_CENTER_DEPTH_SHRINK,
  );
  const centerR = oneLevelCenterR * centerScale;
  const visibleRings = Math.max(MIN_VISIBLE_RINGS, maxDepth - focusDepth);
  const ringWidth = (radius - centerR) / visibleRings;
  return { centerR, ringWidth };
};

/*
 * Called with 4 positional args by sunburst-chart.tsx; bundling would break public call signature.
 */
const geometryFor = (
  arc: ReadonlyArcDatum,
  focus: Readonly<Focus>,
  maxDepth: number,
  radius: number,
): ArcGeometry | null => {
  /*
   * Null marks "no geometry" by contract; callers compare against null explicitly.
   */
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
    innerR: centerR + (relativeDepth - RING_INDEX_BASE) * ringWidth,
    outerR: centerR + relativeDepth * ringWidth,
  };
};

const geomCentroidAngle = (geometry: Readonly<ArcGeometry>): number => (geometry.a0 + geometry.a1) / CENTROID_DIVISOR;

const geomCentroidRadius = (geometry: Readonly<ArcGeometry>): number => (geometry.innerR + geometry.outerR) / CENTROID_DIVISOR;

// Normalized clockwise angle from 12 o'clock (0 → 1).
const clockwiseFraction = (angle: number): number => {
  let normalized = angle - TOP;
  if (normalized < CLOCKWISE_ORIGIN) {
    normalized += TWO_PI;
  }
  return normalized / TWO_PI;
};

/*
 * Zoom morph lerps matching arcs; entering/exiting arcs collapse to a point.
 */
interface TransitionGeometryOptions {
  readonly arc: ReadonlyArcDatum;
  readonly fromFocus: Readonly<Focus>;
  readonly toFocus: Readonly<Focus>;
  readonly maxDepth: number;
  readonly radius: number;
  readonly progress: number;
}

const transitionGeometry = (
  options: Readonly<TransitionGeometryOptions>,
): ArcGeometry | null => {
  const { arc, fromFocus, maxDepth, progress, radius, toFocus } = options;
  const from = geometryFor(arc, fromFocus, maxDepth, radius);
  const to = geometryFor(arc, toFocus, maxDepth, radius);

  // Same no-null/no-undefined/consistent-return conflict as geometryFor above.
  if (from === null) {
    return to === null ? null : lerpGeometry(pointGeometry(to), to, progress);
  }
  return to === null ? lerpGeometry(from, pointGeometry(from), progress) : lerpGeometry(from, to, progress);
};

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
export type { TransitionGeometryOptions };
