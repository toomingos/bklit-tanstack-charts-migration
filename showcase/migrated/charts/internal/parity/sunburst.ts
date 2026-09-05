interface ArcDatum {
  id: string;
  name: string;
  depth: number;
  value: number;
  categoryIndex: number;
  hasChildren: boolean;
  trail: string[];
  parentId: string | null;
  a0: number;
  a1: number;
  arcIndex: number;
  color?: string;
  fill?: string;
}

interface SunburstSegmentEnterDelays {
  delay: number;
}

interface SunburstEnterTiming {
  segmentDelays: Map<string, SunburstSegmentEnterDelays>;
  maxDelay: number;
}

interface SunburstRevealSchedule {
  ringStarts: Map<number, number>;
  ringDuration: number;
  segmentsCompleteAt: number;
  labelsStart: number;
  labelDuration: number;
}

interface RingSweepReveal {
  angular: number;
  radial: number;
}

interface SunburstCenterProps {
  className?: string;
}

const TOP = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;
const MIN_STAGGER_SCALE = 0.25;
const RING_DELAY_STEP = 0.12;
const SEGMENT_DELAY_STEP = 0.08;
const RING_DURATION = 0.6;
const LABEL_DELAY_OFFSET = 0.12;
const LABEL_DURATION = 0.2;
const ANGLE_EPSILON = 1e-9;

const clockwiseFractionForParity = (angle: number): number => {
  let normalized = angle - TOP;
  if (normalized < 0) {
    normalized += TWO_PI;
  }
  return normalized / TWO_PI;
};

const buildSunburstEnterTiming = (
  arcs: ArcDatum[],
  staggerScale = 1,
): SunburstEnterTiming => {
  const scale = Math.max(MIN_STAGGER_SCALE, staggerScale);
  const byDepth = new Map<number, ArcDatum[]>();
  for (const arc of arcs) {
    const list = byDepth.get(arc.depth) ?? [];
    list.push(arc);
    byDepth.set(arc.depth, list);
  }
  const segmentDelays = new Map<string, SunburstSegmentEnterDelays>();
  let maxDelay = 0;
  for (const [, ringArcs] of byDepth) {
    const sorted = ringArcs.toSorted(
      (leftArc, rightArc) =>
        clockwiseFractionForParity(leftArc.a0) -
        clockwiseFractionForParity(rightArc.a0),
    );
    const firstDepth = sorted[0]?.depth ?? 1;
    const ringIndex = firstDepth - 1;
    for (const [index, arc] of sorted.entries()) {
      const delay = (ringIndex * RING_DELAY_STEP + index * SEGMENT_DELAY_STEP) * scale;
      segmentDelays.set(arc.id, { delay });
      maxDelay = Math.max(maxDelay, delay);
    }
  }
  return { maxDelay, segmentDelays };
};

const buildRevealSchedule = (
  arcs: ArcDatum[],
  staggerScale = 1,
): SunburstRevealSchedule => {
  const timing = buildSunburstEnterTiming(arcs, staggerScale);
  const ringStarts = new Map<number, number>();
  for (const arc of arcs) {
    const delays = timing.segmentDelays.get(arc.id);
    if (delays) {
      ringStarts.set(arc.depth, delays.delay);
    }
  }
  return {
    labelDuration: LABEL_DURATION,
    labelsStart: timing.maxDelay + LABEL_DELAY_OFFSET,
    ringDuration: RING_DURATION,
    ringStarts,
    segmentsCompleteAt: timing.maxDelay,
  };
};

const segmentRevealFromRingSweep = (
  ringProgress: number,
  startAngle: number,
  endAngle: number,
): RingSweepReveal => {
  const radial = Math.min(1, Math.max(0, ringProgress));
  const startFrac = clockwiseFractionForParity(startAngle);
  const endFrac = clockwiseFractionForParity(endAngle);
  if (ringProgress <= startFrac) {
    return { angular: 0, radial };
  }
  if (ringProgress >= endFrac) {
    return { angular: 1, radial };
  }
  const angular =
    (ringProgress - startFrac) / Math.max(endFrac - startFrac, ANGLE_EPSILON);
  return { angular, radial };
};

const buildRevealDelays = (arcs: ArcDatum[]): Map<string, number> => {
  const timing = buildSunburstEnterTiming(arcs);
  const map = new Map<string, number>();
  for (const arc of arcs) {
    map.set(arc.id, timing.segmentDelays.get(arc.id)?.delay ?? 0);
  }
  return map;
};

const centroidAngle = (arc: ArcDatum): number => (arc.a0 + arc.a1) / 2;

const localProgress = (
  progress: number,
  delay: number,
  duration: number,
): number => {
  if (progress <= delay) {
    return 0;
  }
  if (duration <= 0) {
    return 1;
  }
  return Math.min(1, (progress - delay) / duration);
};

export {
  buildRevealDelays,
  buildRevealSchedule,
  buildSunburstEnterTiming,
  centroidAngle,
  localProgress,
  segmentRevealFromRingSweep,
};
export type {
  SunburstCenterProps,
  SunburstEnterTiming,
  SunburstRevealSchedule,
  SunburstSegmentEnterDelays,
};
