import { createSpringResolver } from "./candle-spring";

// Framer duration/bounce -> spring-physics sampling for WAAPI spring reveals.
const MS_PER_SECOND = 1000;
const SPRING_SAMPLING_FRAME_RATE = 60;
const SPRING_SETTLE_POSITION = 0.999;
const SPRING_SETTLED_FRAMES_REQUIRED = 8;

// Fixed sampling step derived from the 60fps frame rate above.
const SPRING_FRAME_DT_MS = MS_PER_SECOND / SPRING_SAMPLING_FRAME_RATE;
// Per-frame movement below this counts as settled (paired with the position gate above).
const SPRING_SETTLE_DELTA = 0.001;
const SPRING_MAX_SETTLE_FRAMES = 6000;

type SpringResolver = (tMs: number) => number;

interface SettleProgress {
  readonly tMs: number;
  readonly prev: number;
  readonly settledFrames: number;
}

const INITIAL_SETTLE_PROGRESS: SettleProgress = { prev: 0, settledFrames: 0, tMs: 0 };

// Settled frame = past the position gate and barely moved since the last frame.
const isSettledFrame = (pos: number, prev: number): boolean =>
  pos >= SPRING_SETTLE_POSITION && Math.abs(pos - prev) < SPRING_SETTLE_DELTA;

// Advance the settle tracker by one sampling frame.
// Immutable progress keeps the scan loop body to one assignment plus the gate.
const trackSettleFrame = (resolver: SpringResolver, progress: Readonly<SettleProgress>): SettleProgress => {
  const tMs = progress.tMs + SPRING_FRAME_DT_MS;
  const pos = resolver(tMs);
  if (!isSettledFrame(pos, progress.prev)) {
    return { prev: pos, settledFrames: 0, tMs };
  }
  return { prev: pos, settledFrames: progress.settledFrames + 1, tMs };
}

const estimateSpringSettleMs = (stiffness: number, damping: number, mass: number): number => {
  const resolver = createSpringResolver({ damping, mass, origin: 0, stiffness, target: 1 });
  let progress: SettleProgress = INITIAL_SETTLE_PROGRESS;
  for (let i = 0; i < SPRING_MAX_SETTLE_FRAMES; i += 1) {
    progress = trackSettleFrame(resolver, progress);
    if (progress.settledFrames >= SPRING_SETTLED_FRAMES_REQUIRED) {return progress.tMs;}
  }
  return progress.tMs;
}

interface SpringSampleParams {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly durationMs: number;
  readonly samples: number;
}

const sampleSpringProgress = (params: Readonly<SpringSampleParams>): number[] => {
  const { damping, durationMs, mass, samples, stiffness } = params;
  const out: number[] = [];
  const dt = durationMs / (samples - 1);
  const resolver = createSpringResolver({ damping, mass, origin: 0, stiffness, target: 1 });
  for (let i = 0; i < samples; i += 1) {
    const pos = resolver(i * dt);
    out.push(Math.max(0, Math.min(1, pos)));
  }
  if (out.at(-1) !== 1) {out.push(1);}
  return out;
}

export { estimateSpringSettleMs, sampleSpringProgress };
