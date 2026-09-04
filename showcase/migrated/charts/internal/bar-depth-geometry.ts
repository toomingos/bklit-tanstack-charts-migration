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

export {
  BAR_DEPTH_MAX_PX,
  BAR_DEPTH_PERSPECTIVE_RATIO,
  BAR_DEPTH_MIN_PX,
  barDepthMaxDepth,
  barDepthAndRise,
};
export type { BarDepthAndRiseResult };
