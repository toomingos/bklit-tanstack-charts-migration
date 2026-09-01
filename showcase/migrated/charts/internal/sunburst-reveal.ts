// Reveal-delay math for SunburstChart (C5, native motion, Phase 6, D432).
//
// This module used to ALSO hold the WAAPI keyframe generators for both the
// entrance sweep (`buildRevealKeyframes`, 64-sample `d`-string keyframes)
// and the zoom morph (`buildZoomKeyframes`, 30-sample `d`-string keyframes,
// bklit's verbatim `transitionGeometry`/`arcPath`) — both DELETED outright
// by C5, not ported. sunburst-chart.tsx's `radialArc<SunburstArcRow>` mark
// already declares real d3-arc accessors on its `generator`
// (`.startAngle`/`.endAngle`/`.innerRadius`/`.outerRadius`, keyed
// `sunburst-arc-{playKey}-{arcIndex}`), which is the confirmed mechanism
// (gauge C4 precedent, `dist/motion.js`'s `addSemanticPathUpdateTrack` /
// `compatiblePathGeometry`) native reads to interpolate a matched keyed
// path's `d` attribute directly — so both the entrance sweep (native
// "enter", stagger delay computed below) and the zoom morph (native
// "update", arcRows recomputing off `focus` on every zoomTo commit) are now
// the mark's own `motion` callback, zero imperative `.animate()` calls.
// arcIndex is assigned once from the static tree structure (`buildArcs`,
// sunburst-geometry.ts) and never depends on `focus` — so the same arc
// keeps the same key across every zoom/focus rebuild, matching the update
// track instead of replaying enter/exit (verified by reading `buildArcs`;
// only genuinely-degenerate arcs crossing the culling threshold exit/enter).
//
// `buildRevealTiming`/`maxRevealDelayMs` below are unchanged — sunburst's
// entrance delay (native `motion` enter phase) AND the labels overlay's own
// still-WAAPI reveal (`runLabelsReveal`, sunburst-chart.tsx — labels are a
// separate DOM overlay outside the TanStack scene graph, no native
// mark to hang motion off, out of C5 scope) both still need this per-arc
// ring-staggered delay list.

import {
  clockwiseFraction,
  type ArcDatum,
} from "./sunburst-geometry";

// ---------------------------------------------------------------------------
// Reveal timing
// ---------------------------------------------------------------------------

export interface ArcRevealTiming {
  arcId: string;
  delayMs: number;
}

/**
 * Builds ring-staggered reveal delays matching bklit's
 * `buildSunburstEnterTiming` (sunburst.ts) — retired in P3.6's split outcome
 * (LOG.md D276); the migrated equivalent is this module's `buildRevealTiming`.
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
