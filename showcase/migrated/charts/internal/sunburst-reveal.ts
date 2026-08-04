// WAAPI reveal and zoom animation helpers for SunburstChart.
//
// Rewritten for the radialArc architecture (D81): keyframes still use bklit's
// verbatim `arcPath` for the d-string computation (compatible with d3's arc
// output format that TanStack's radialArc produces). The caller queries
// `[data-ts-key="sunburst-arcs"]` and imperatively animates each <path> child.
//
// --- Reveal ---
// Ring-staggered angular-sweep: each arc sweeps from its start angle (zero
// visual width) to full angle over 1100ms with bezier easing. 64-sample
// keyframes avoid CSS `d` discrete-interpolation bugs (D51 precedent).
//
// --- Zoom ---
// 750ms d-keyframe tween interpolating between from-geometry and to-geometry
// for every arc (30 frames, 25ms per frame).

import {
  transitionGeometry,
  geometryFor,
  arcPath,
  clockwiseFraction,
  type ArcDatum,
  type ArcGeometry,
  type Focus,
} from "./sunburst-geometry";

export { transitionGeometry, geometryFor } from "./sunburst-geometry";

// ---------------------------------------------------------------------------
// Reveal timing
// ---------------------------------------------------------------------------

const TWEEN_SAMPLES = 64;

export interface ArcRevealTiming {
  arcId: string;
  delayMs: number;
}

/**
 * Builds ring-staggered reveal delays matching bklit's
 * `buildSunburstEnterTiming` (sunburst.ts).
 */
export function buildRevealTiming(
  arcs: ArcDatum[],
  staggerScale = 1,
): ArcRevealTiming[] {
  const scale = Math.max(0.25, staggerScale);
  const byDepth = new Map<number, ArcDatum[]>();

  for (const arc of arcs) {
    const list = byDepth.get(arc.depth) ?? [];
    list.push(arc);
    byDepth.set(arc.depth, list);
  }

  const timing: ArcRevealTiming[] = [];

  for (const [, ringArcs] of byDepth) {
    const sorted = [...ringArcs].sort(
      (a, b) => clockwiseFraction(a.a0) - clockwiseFraction(b.a0),
    );
    const ringIndex = (sorted[0]?.depth ?? 1) - 1;

    for (const [index, arc] of sorted.entries()) {
      const delayMs = (ringIndex * 0.12 + index * 0.08) * scale * 1000;
      timing.push({ arcId: arc.id, delayMs });
    }
  }

  return timing.sort((a, b) => a.delayMs - b.delayMs);
}

/** Maximum reveal delay across all arcs (for settle detection). */
export function maxRevealDelayMs(arcs: ArcDatum[], staggerScale = 1): number {
  const timing = buildRevealTiming(arcs, staggerScale);
  return timing.length > 0
    ? timing[timing.length - 1]!.delayMs
    : 0;
}

/**
 * Builds 64-sample WAAPI keyframes for a sunburst arc reveal.
 * Progress 0 → 1 sweeps from start angle to full angle, with full radial
 * extent (radialProgress = 1 throughout — arcs start fully thick, only the
 * angular sweep animates).
 *
 * The path format uses bklit's `arcPath` which produces d-strings compatible
 * with d3's `arc()` output (what TanStack's radialArc renders).
 */
export function buildRevealKeyframes(
  geometry: ArcGeometry | null,
  samples: number = TWEEN_SAMPLES,
): Keyframe[] | null {
  if (!geometry) return null;

  const span = geometry.a1 - geometry.a0;
  if (span < 0.001 || geometry.outerR - geometry.innerR < 0.5) return null;

  const keyframes: Keyframe[] = [];
  for (let i = 0; i < samples; i++) {
    const p = i / (samples - 1);
    if (p === 0) {
      // Zero-angle sliver: degenerate path — use "none" to fully hide
      keyframes.push({ d: "none" });
      continue;
    }
    const currentA1 = geometry.a0 + span * p;
    const currentInner = geometry.innerR < 1 ? 0 : geometry.innerR;
    const d = arcPath({
      a0: geometry.a0,
      a1: currentA1,
      innerR: currentInner,
      outerR: geometry.outerR,
    }, 1, 1);
    if (d) {
      keyframes.push({ d: `path('${d.replace(/'/g, "\\'")}')` });
    } else {
      keyframes.push({ d: "none" });
    }
  }

  return keyframes;
}

// ---------------------------------------------------------------------------
// Zoom animation
// ---------------------------------------------------------------------------

const ZOOM_SAMPLES = 30;

/**
 * Builds 30-sample WAAPI keyframes for a zoom morph from `fromFocus` to
 * `toFocus`. Uses bklit's verbatim `transitionGeometry()`.
 */
export function buildZoomKeyframes(
  arc: ArcDatum,
  fromFocus: Focus,
  toFocus: Focus,
  maxDepth: number,
  radius: number,
  samples: number = ZOOM_SAMPLES,
): Keyframe[] | null {
  const from = geometryFor(arc, fromFocus, maxDepth, radius);
  const to = geometryFor(arc, toFocus, maxDepth, radius);

  // If arc is not visible in either focus, no animation needed for it
  if (!from && !to) return null;

  const keyframes: Keyframe[] = [];
  for (let i = 0; i < samples; i++) {
    const p = i / (samples - 1);
    const geom = transitionGeometry(arc, fromFocus, toFocus, maxDepth, radius, p);
    if (geom) {
      const d = arcPath(geom, 1, 1);
      if (d) {
        keyframes.push({ d: `path('${d.replace(/'/g, "\\'")}')` });
        continue;
      }
    }
    keyframes.push({ d: "none" });
  }

  return keyframes;
}
