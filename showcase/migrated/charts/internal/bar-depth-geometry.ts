import type { ResolvedScale } from "@tanstack/charts";

const BAR_DEPTH_MAX_PX = 7;
const BAR_DEPTH_PERSPECTIVE_RATIO = 0.45;
const BAR_DEPTH_MIN_PX = 0.5;
const BAR_DEPTH_BANDWIDTH_RATIO = 0.22;

const barDepthMaxDepth = (stepWidth: number, bandWidth: number): number => {
  const gap = Math.max(0, stepWidth - bandWidth);
  return Math.min(bandWidth * BAR_DEPTH_BANDWIDTH_RATIO, Math.max(0, gap - 1), BAR_DEPTH_MAX_PX);
}

interface BarDepthAndRiseResult {
  readonly depth: number;
  readonly perspectiveRise: number;
}

const barDepthAndRise = (absOffset: number, naturalHeight: number, maxDepth: number): BarDepthAndRiseResult => {
  const offset = Math.min(1, Math.max(0, absOffset));
  const cappedMaxDepth = Math.min(maxDepth, Math.max(0, naturalHeight));
  const depth = offset * cappedMaxDepth;
  return { depth, perspectiveRise: depth * BAR_DEPTH_PERSPECTIVE_RATIO };
}

// Perspective trim: shift the front face down so the lid lands on the value.
const barDepthTopTrim = (absOffset: number, naturalHeight: number, maxDepth: number): number => {
  const { perspectiveRise } = barDepthAndRise(absOffset, naturalHeight, maxDepth);
  return Math.min(perspectiveRise, Math.max(0, naturalHeight - 1));
}

// Stacked-bar segments from `<BarDepthProvider segmentsAccessor>` (legacy parity).
// Proportions split `naturalHeight` so side seams line up with the front face.
interface BarDepthSegment {
  readonly value: number;
  readonly color: string;
}

type BarDepthSegmentsAccessor = (datum: Readonly<Record<string, unknown>>) => readonly BarDepthSegment[] | null | undefined;

// Non-zero segments bottom→top; null without accessor (legacy filter parity).
// The `> 0` filter also drops NaN, matching legacy.
const resolveVisibleBarDepthSegments = (
  datum: Readonly<Record<string, unknown>>,
  segmentsAccessor: BarDepthSegmentsAccessor | undefined,
): readonly BarDepthSegment[] | null => segmentsAccessor?.(datum)?.filter((segment) => segment.value > 0) ?? null;

// Trim clamp denominator: topmost segment scaled height, else whole bar.
// Matches legacy `useBarDepthEntries`.
const barDepthTrimClampReference = (
  naturalHeight: number,
  visibleSegments: readonly Pick<BarDepthSegment, "value">[] | null | undefined,
): number => {
  if (visibleSegments && visibleSegments.length > 0) {
    const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
    const topmost = visibleSegments.at(-1);
    if (total > 0 && topmost !== undefined) {return (topmost.value / total) * naturalHeight;}
  }
  return naturalHeight;
}

interface BarDepthTopGeometry {
  readonly naturalHeight: number;
  readonly topYTrim: number;
  readonly isFloored: boolean;
}

interface ResolveBarDepthTopGeometryParams {
  readonly absOffset: number;
  readonly rawHeight: number;
  readonly maxDepth: number;
  readonly minBarHeight?: number;
  readonly visibleSegments?: readonly Pick<BarDepthSegment, "value">[] | null;
}

// Floored height + lid trim in one place (legacy `Math.max` + trim skip).
// Floored bars skip the trim so the tiny front face and lid stay aligned.
const resolveBarDepthTopGeometry = (params: Readonly<ResolveBarDepthTopGeometryParams>): BarDepthTopGeometry | undefined => {
  // Positive bars only (legacy bar-depth.tsx:436-438): `rawHeight` is signed here.
  // An unguarded floor would turn a negative bar into a spurious upward one.
  const naturalHeight = params.rawHeight < 0 ? params.rawHeight : Math.max(params.rawHeight, params.minBarHeight ?? 0);
  if (naturalHeight <= 0) {return undefined;}
  const isFloored = naturalHeight > params.rawHeight;
  if (isFloored) {return { isFloored, naturalHeight, topYTrim: 0 };}
  const clampReference = barDepthTrimClampReference(naturalHeight, params.visibleSegments);
  const { perspectiveRise } = barDepthAndRise(params.absOffset, naturalHeight, params.maxDepth);
  return { isFloored, naturalHeight, topYTrim: Math.min(perspectiveRise, Math.max(0, clampReference - 1)) };
}

// Band geometry resolved at scene build from the package scale (V1.2/G6);
// Marks read this in render instead of a hand-built overlay band.
interface ResolvedBandFrame {
  readonly bandPos: (label: string) => number;
  readonly bandStep: number;
  readonly bandWidth: number;
}

const resolveBandFrame = (scale: ResolvedScale): ResolvedBandFrame => {
  const { bandwidth, domain, map } = scale;
  const bandWidth = bandwidth || 0;
  // Package band map returns band centers; overlays place from band starts.
  const bandPos = (label: string): number => {
    const center = map(label);
    return Number.isFinite(center) ? center - bandWidth / 2 : 0;
  };
  let bandStep = bandWidth;
  if (domain.length >= 2) {
    const first = map(domain[0]);
    const second = map(domain[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {bandStep = Math.abs(second - first);}
  }
  return { bandPos, bandStep, bandWidth };
};

export {
  BAR_DEPTH_MAX_PX,
  BAR_DEPTH_PERSPECTIVE_RATIO,
  BAR_DEPTH_MIN_PX,
  barDepthMaxDepth,
  barDepthAndRise,
  barDepthTopTrim,
  resolveBandFrame,
  resolveVisibleBarDepthSegments,
  barDepthTrimClampReference,
  resolveBarDepthTopGeometry,
};
export type { BarDepthAndRiseResult, BarDepthSegment, BarDepthSegmentsAccessor, BarDepthTopGeometry, ResolvedBandFrame };
