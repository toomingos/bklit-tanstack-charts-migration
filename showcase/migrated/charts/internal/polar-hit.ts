/**
 * App-owned polar hit-test for pie/ring (Phase 6.5 gate, D473).
 *
 * Pointer detection for pie/ring is app-owned again: `pointer: false` on the
 * definition + a `pointermove`/`pointerleave` pair on the chart's own wrapper
 * element, resolved against the STATIC authored geometry below. C5c (D447)
 * routed detection through native focus on a static hitbox twin; at 0.15.0
 * the motion surface hands `interactionPoints()` its in-flight
 * `presentationPoints` while any data transition runs (dist/motion.js:682,
 * dist/renderer.js:763), so the hover-driven definition rebuild made
 * `resolvePointerFocus` miss at an unmoved pointer → `onFocusChange(null)` →
 * unhover → rebuild → re-hit → ... (React #185 at 50 nested updates, the
 * 6.5 pie/ring blank captures). Legacy hit-tested a static transparent path
 * (bklit pie-slice.tsx); this is the arithmetic equivalent with no DOM.
 *
 * Angles use d3-shape's convention (0 at 12 o'clock, clockwise), the same
 * `startAngle`/`endAngle` values pie/ring feed `radialArc`.
 */

export interface PolarHitBand {
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}

const TWO_PI = Math.PI * 2;

/** Angle of (dx, dy) in d3's convention, normalised into
 *  `[startAngle, startAngle + 2π)` so it compares against a band directly. */
function angleFrom(dx: number, dy: number, startAngle: number): number {
  let a = Math.atan2(dx, -dy);
  while (a < startAngle) a += TWO_PI;
  while (a >= startAngle + TWO_PI) a -= TWO_PI;
  return a;
}

/**
 * Index of the LAST band containing `(x, y)` (coordinates relative to the
 * polar centre), or `null`. Last wins so paint-order containment matches
 * the old topmost-hitbox rule when bands overlap (they don't for pie/ring,
 * but the tie-break is defined).
 */
export function hitTestPolarBands(x: number, y: number, bands: readonly PolarHitBand[]): number | null {
  const r = Math.hypot(x, y);
  let hit: number | null = null;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    if (r < b.innerRadius || r > b.outerRadius) continue;
    if (b.endAngle <= b.startAngle) continue;
    const a = angleFrom(x, y, b.startAngle);
    if (a < b.endAngle) hit = i;
  }
  return hit;
}

/** Pointer position relative to the centre of `el`'s box (which pie/ring
 *  render square, `size × size`, centre at `size / 2`). */
export function pointerToCenterOffset(el: Element, clientX: number, clientY: number): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}
