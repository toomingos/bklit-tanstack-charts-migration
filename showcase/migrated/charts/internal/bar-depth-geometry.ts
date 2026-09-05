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
};
export type { BarDepthAndRiseResult, ResolvedBandFrame };
