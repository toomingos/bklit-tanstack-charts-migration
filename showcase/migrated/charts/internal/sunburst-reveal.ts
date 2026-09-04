import { clockwiseFraction } from './sunburst-geometry';
import type { ArcDatum } from './sunburst-geometry';


interface ArcRevealTiming {
  readonly arcId: string;
  readonly delayMs: number;
}

// Mirrors ReadonlyArcDatum in ./sunburst-geometry (same Omit + readonly trail shape):
// ArcDatum trail is a mutable string array, so neither readonly array form is deeply readonly on its own.
type ReadonlyRevealArc = Readonly<Omit<ArcDatum, "trail">> & { readonly trail: readonly string[] };

// Only the delay math survives; keyframe generators were deleted with the native sunburst mark.
const MIN_STAGGER_SCALE = 0.25;
const RING_STAGGER_SECONDS = 0.12;
const ARC_STAGGER_SECONDS = 0.08;
const MS_PER_SECOND = 1000;

const groupArcsByDepth = (arcs: readonly ReadonlyRevealArc[]): Map<number, ReadonlyRevealArc[]> => {
  const byDepth = new Map<number, ReadonlyRevealArc[]>();

  for (const arc of arcs) {
    const list = byDepth.get(arc.depth) ?? [];
    list.push(arc);
    byDepth.set(arc.depth, list);
  }

  return byDepth;
};

const timeRingArcs = (ringArcs: readonly ReadonlyRevealArc[], scale: number): ArcRevealTiming[] => {
  const sorted = [...ringArcs].toSorted(
    (arcA, arcB) => clockwiseFraction(arcA.a0) - clockwiseFraction(arcB.a0),
  );
  const ringIndex = (sorted[0]?.depth ?? 1) - 1;

  return sorted.map((arc, index): ArcRevealTiming => {
    const delayMs = (ringIndex * RING_STAGGER_SECONDS + index * ARC_STAGGER_SECONDS) * scale * MS_PER_SECOND;
    return { arcId: arc.id, delayMs };
  });
};

const buildRevealTiming = (arcs: readonly ReadonlyRevealArc[], staggerScale = 1): ArcRevealTiming[] => {
  const scale = Math.max(MIN_STAGGER_SCALE, staggerScale);
  const byDepth = groupArcsByDepth(arcs);
  const timing: ArcRevealTiming[] = [];

  for (const [, ringArcs] of byDepth) {
    timing.push(...timeRingArcs(ringArcs, scale));
  }

  return timing.toSorted((timingA, timingB) => timingA.delayMs - timingB.delayMs);
}

const maxRevealDelayMs = (arcs: readonly ReadonlyRevealArc[], staggerScale = 1): number => {
  const timing = buildRevealTiming(arcs, staggerScale);
  const last = timing.at(-1);
  return last?.delayMs ?? 0;
};

export { buildRevealTiming, maxRevealDelayMs };
export type { ArcRevealTiming };
