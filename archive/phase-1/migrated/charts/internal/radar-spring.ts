// Spring physics sampling for WAAPI-based spring reveal animations.
// Port of framer-motion's `duration`/`bounce` → spring-physics conversion.
// Used by pie-reveal.ts, ring-reveal.ts, gauge-reveal.ts, and funnel-reveal.ts.

import { createSpringResolver } from "./candle-spring";

export function estimateSpringSettleMs(
  stiffness: number,
  damping: number,
  mass: number,
): number {
  const resolver = createSpringResolver(stiffness, damping, mass, 0, 0);
  let tMs = 0;
  let prev = 0;
  let settledFrames = 0;
  const dtFrames = 1000 / 60;
  const settleThreshold = 0.001;
  const maxFrames = 6000;
  for (let i = 0; i < maxFrames; i++) {
    tMs += dtFrames;
    const pos = resolver(tMs);
    if (pos >= 0.999 && Math.abs(pos - prev) < settleThreshold) {
      settledFrames++;
      if (settledFrames >= 8) return tMs;
    } else {
      settledFrames = 0;
    }
    prev = pos;
  }
  return tMs;
}

export function sampleSpringProgress(
  stiffness: number,
  damping: number,
  mass: number,
  durationMs: number,
  samples: number,
): number[] {
  const out: number[] = [];
  const dt = durationMs / (samples - 1);
  const resolver = createSpringResolver(stiffness, damping, mass, 0, 0);
  for (let i = 0; i < samples; i++) {
    const pos = resolver(i * dt);
    out.push(Math.max(0, Math.min(1, pos)));
  }
  if (out[out.length - 1] !== 1) out.push(1);
  return out;
}
