// Reveal-delay math for SunburstChart (C5d, native semantic motion, D-TBD).
//
// This module used to ALSO hold the WAAPI keyframe generators for both the
// entrance sweep (`buildRevealKeyframes`, 64-sample `d`-string keyframes)
// and the zoom morph (`buildZoomKeyframes`, 30-sample `d`-string keyframes,
// bklit's verbatim `transitionGeometry`/`arcPath`) — both DELETED outright
// by C5, not ported. sunburst-chart.tsx now renders a single native
// `sunburst()` mark (`@tanstack/charts/hierarchy/sunburst`, C5d) — the sole
// mark in the whole catalog carrying `[sceneMotionNode]` scene metadata
// (`dist/motion.js`), i.e. a REAL shape-aware `d`-morph
// (`compatiblePathGeometry`/`hierarchyRelatedGeometry`), not the generic
// numeric-token diff a raw-generator `radialArc` mark falls back to. Both
// the entrance sweep (native "enter", stagger delay computed below) and the
// zoom morph (native "update", driven by `rootId: focus.id` on every
// `zoomTo` commit) are the mark's own `motion` callback, zero imperative
// `.animate()` calls. Native derives each rendered node's scene key from its
// hierarchy `id` (`${markId}:node:${valueKey(node.id)}`,
// `hierarchy-sunburst.js`) — an id assigned once from the static tree
// structure (`buildArcs`, `buildSunburstFlatRows`, sunburst-geometry.ts) and
// never dependent on `focus` — so the same node keeps the same key across
// every zoom/focus rebuild, matching the update track instead of replaying
// enter/exit (only nodes native's own `x1 > x0` filter drops — zero-value
// branches — ever have no rendered path at all; see sunburst-chart.tsx's
// file header for why focus/drill logic never reads native mark data).
//
// `buildRevealTiming`/`maxRevealDelayMs` below are unchanged — sunburst's
// entrance delay (native `motion` enter phase, read off `ctx.datum.id`) AND
// the labels overlay's own still-WAAPI reveal (`runLabelsReveal`,
// sunburst-chart.tsx — labels are a separate DOM overlay outside the
// TanStack scene graph, no native mark to hang motion off, out of C5/C5d
// scope) both still need this per-arc ring-staggered delay list.

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
