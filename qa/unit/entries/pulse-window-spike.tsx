// Spike entry: exposes the pure pulse window math plus the migrated easing to
// node tests. Bundled by qa/unit/lib/render.mjs; never imported directly by
// node (tsx needs esbuild, and the sources use extensionless imports).
export {
  PULSE_CLIP_PADDING,
  PULSE_CYCLE_MS,
  PULSE_HALF_CYCLE_MS,
  PULSE_HALF_PROGRESS,
  pulseClipWindow,
  pulseEnterSegments,
  pulseExitSegments,
  pulseLoopProgressAt,
  pulseLoopSegments,
} from '../../../showcase/migrated/charts/internal/line-loading-pulse-window';
export type {
  PulseClipSegment,
  PulseClipWindow,
} from '../../../showcase/migrated/charts/internal/line-loading-pulse-window';
export { bezierEasing } from '../../../showcase/migrated/charts/internal/bezier-easing';
