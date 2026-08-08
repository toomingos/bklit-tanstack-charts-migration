// Shared arc-geometry helpers for PieChart/PieSlice — ports
// repos/bklit-ui/packages/ui/src/charts/pie-chart.tsx's `generatePieArcPath`
// and pie-slice.tsx's identical (duplicated in bklit itself) `generateArcPath`
// + `getSliceOffset` into ONE shared module (avoiding bklit's own
// copy-paste), plus `sliceMidOffset` (bklit's `getSliceOffset`, renamed for
// clarity — it's a translate-offset from the slice's OWN mid-angle, not a
// generic "any angle" helper).
//
// bklit's own source imports `arc` from `@visx/shape` (a thin factory
// wrapper around d3-shape's `arc()`), but `@visx/shape` is only installed
// under bench/app/node_modules, not resolvable from a bare specifier at
// migrated/charts/*'s own location (outside the bench/app root) without a
// dedicated alias — unlike `d3-shape`, which vite.config.ts already aliases
// explicitly for exactly this reason (see that file's comment: "migrated/
// lives outside this app root, so its bare imports don't walk up into our
// node_modules"). Using d3-shape's own `arc()` generator directly instead
// (the same fluent-setter API `@visx/shape`'s wrapper delegates to
// internally) produces byte-identical path geometry with no extra alias
// needed — consistent with how the rest of migrated/charts already imports
// d3-shape/d3-scale/d3-array directly rather than through visx leaf
// packages.
import { arc as arcGenerator } from "d3-shape";

/**
 * Generates one slice's (or the static hitbox's) `d` path — bklit's
 * `generatePieArcPath`/`generateArcPath` verbatim (both pie-chart.tsx and
 * pie-slice.tsx define byte-identical copies of this function; this is the
 * single shared port of both).
 */
export function pieArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
  padAngle: number,
): string {
  const generator = arcGenerator<{ startAngle: number; endAngle: number }>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(cornerRadius)
    .padAngle(padAngle);
  return generator({ startAngle, endAngle }) ?? "";
}

export interface SliceOffset {
  x: number;
  y: number;
}

/**
 * bklit pie-slice.tsx's `getSliceOffset` — the "pop out" translate offset
 * along a slice's own radial (mid-angle) axis. In d3-shape, 0 radians is at
 * 12 o'clock with angles increasing clockwise, so the outward direction is
 * `x = sin(mid), y = -cos(mid)`.
 */
export function sliceMidOffset(
  startAngle: number,
  endAngle: number,
  distance: number,
): SliceOffset {
  const midAngle = (startAngle + endAngle) / 2;
  return {
    x: Math.sin(midAngle) * distance,
    y: -Math.cos(midAngle) * distance,
  };
}
