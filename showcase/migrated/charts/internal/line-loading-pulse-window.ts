// Traveling pulse clip window (pure port of bklit grow/exit transforms).
// DOM-free for headless `qa/unit` asserts; cycle timing from design tokens.
import { bezierEasing } from "./bezier-easing";
import { LINE_LOADING_PULSE_CYCLE_S } from "./design-tokens";

const MS_PER_SECOND = 1000;

// Clip padding past the plot edges (round caps never hard-clip mid-pass).
const PULSE_CLIP_PADDING = 10;

// Normalized progress where growth ends and shrink begins (bklit `:58-72`).
const PULSE_HALF_PROGRESS = 0.5;

// Bklit floors every shortened exit leg at 0.01s (`:93,118`).
const PULSE_MIN_SEGMENT_MS = 10;

type PulseEasing = (progress: number) => number;

interface PulseClipWindow {
  readonly x: number;
  readonly width: number;
}

// Grow-then-shrink clip rect for a normalized cycle progress (bklit `:58-72`).
const pulseClipWindow = (progress: number, innerWidth: number): PulseClipWindow => {
  const paddedFullWidth = innerWidth + PULSE_CLIP_PADDING * 2;
  if (progress <= PULSE_HALF_PROGRESS) {
    return { width: (progress / PULSE_HALF_PROGRESS) * paddedFullWidth, x: -PULSE_CLIP_PADDING };
  }
  const shrink = (progress - PULSE_HALF_PROGRESS) / PULSE_HALF_PROGRESS;
  const width = (1 - shrink) * paddedFullWidth;
  return { width, x: innerWidth + PULSE_CLIP_PADDING - width };
};

interface PulseClipSegment {
  readonly from: PulseClipWindow;
  readonly to: PulseClipWindow;
  readonly durationMs: number;
  /** Segment-local 0 -> 1 map over the domain bklit's own `animate` eases. */
  readonly easing: PulseEasing;
}

const PULSE_CYCLE_MS = LINE_LOADING_PULSE_CYCLE_S * MS_PER_SECOND;

// Bklit half-cycle covers half the loop (`line-loading-pulse.tsx:80`).
const PULSE_HALF_CYCLE_MS = PULSE_CYCLE_MS / 2;

// Loop eases ONE progress across the WHOLE cycle; a half never sees a fresh
// 0 -> 1 ease, and the plain ease is ~7x too wide a quarter into the cycle.
const pulseLoopGrowEasing: PulseEasing = (unit) =>
  bezierEasing(unit / 2) / PULSE_HALF_PROGRESS;

const pulseLoopShrinkEasing: PulseEasing = (unit) =>
  (bezierEasing(PULSE_HALF_PROGRESS + unit / 2) - PULSE_HALF_PROGRESS) / PULSE_HALF_PROGRESS;

// Cycle progress mid-segment, for the owner to hand `pulseExitSegments`.
// Bklit hands over the same value as `progress.get()` (`:113`).
const pulseLoopProgressAt = (segmentIndex: number, elapsedMs: number): number => {
  const unit = Math.min(1, Math.max(0, elapsedMs / PULSE_HALF_CYCLE_MS));
  return bezierEasing((segmentIndex === 0 ? 0 : PULSE_HALF_PROGRESS) + unit / 2);
};

// Halves stay equal in wall time: cubic-bezier(.85,0,.15,1) is symmetric,
// So eased progress crosses 0.5 exactly at the midpoint.
const pulseLoopSegments = (innerWidth: number): readonly [PulseClipSegment, PulseClipSegment] => [
  {
    durationMs: PULSE_HALF_CYCLE_MS,
    easing: pulseLoopGrowEasing,
    from: pulseClipWindow(0, innerWidth),
    to: pulseClipWindow(PULSE_HALF_PROGRESS, innerWidth),
  },
  {
    durationMs: PULSE_HALF_CYCLE_MS,
    easing: pulseLoopShrinkEasing,
    from: pulseClipWindow(PULSE_HALF_PROGRESS, innerWidth),
    to: pulseClipWindow(1, innerWidth),
  },
];

// Enter animates 0 -> 0.5 over a half cycle (`:136-142`), so the grow half
// Takes the plain ease -- unlike the loop above.
const pulseEnterSegments = (innerWidth: number): readonly [PulseClipSegment] => [
  {
    durationMs: PULSE_HALF_CYCLE_MS,
    easing: bezierEasing,
    from: pulseClipWindow(0, innerWidth),
    to: pulseClipWindow(PULSE_HALF_PROGRESS, innerWidth),
  },
];

// Exit finishes the pass from wherever the loop reached (bklit `:112-134`).
// Restarting at zero width re-opens a clip the viewer just watched close.
const pulseExitSegments = (innerWidth: number, fromProgress: number): readonly PulseClipSegment[] => {
  const start = Math.min(1, Math.max(0, fromProgress));
  // Each leg restarts bklit's `animate`, so every one is a plain ease.
  const legMs = (span: number): number =>
    Math.max(PULSE_HALF_CYCLE_MS * (span / PULSE_HALF_PROGRESS), PULSE_MIN_SEGMENT_MS);
  const shrinkLeg = (legStart: number): PulseClipSegment => ({
    durationMs: legMs(1 - legStart),
    easing: bezierEasing,
    from: pulseClipWindow(legStart, innerWidth),
    to: pulseClipWindow(1, innerWidth),
  });
  if (start >= PULSE_HALF_PROGRESS) {
    return [shrinkLeg(start)];
  }
  return [
    {
      durationMs: legMs(PULSE_HALF_PROGRESS - start),
      easing: bezierEasing,
      from: pulseClipWindow(start, innerWidth),
      to: pulseClipWindow(PULSE_HALF_PROGRESS, innerWidth),
    },
    shrinkLeg(PULSE_HALF_PROGRESS),
  ];
};

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
};
export type { PulseClipSegment, PulseClipWindow, PulseEasing };
