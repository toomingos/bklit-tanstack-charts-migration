// Damped-spring driver matching framer-motion's `useSpring` behavior
// (mass 1, F = -stiffness·x - damping·v), used to drive imperative style
// writes from rAF — the migrated hover chrome must not schedule React work
// or import framer in the pointer path (docs/LOG.md D10).
//
// The value trajectory is the ANALYTIC solution sampled through TanStack's
// `createChartSpring` (@tanstack/charts/spring) — the same closed-form
// damped-harmonic-oscillator framer-motion resolves per animation — instead
// of numerically integrating the ODE per frame (P3.12 / T-D10). Sampling is
// by true clock time, so dropped frames never slow motion down; rest
// thresholds mirror framer's generator: done when |value − target| <
// restDelta AND |velocity| < restSpeed, tier picked per retarget from the
// animation amplitude (`isGranularScale = |initialDelta| < 5`). A single
// flat threshold cannot serve both unitless and pixel springs: REST_DELTA =
// 0.05 exceeded RingChart's entire hover amplitude (scale 1 -> 1.03,
// Δ = 0.03) and degenerated those springs into instant snaps (D51).

import { createChartSpring, type ChartSpring } from "@tanstack/charts/spring";

export interface Spring {
  /** Retarget; starts the rAF loop if idle. */
  set(target: number): void;
  /** Snap to a value with no motion (used on show / discrete interaction). */
  jump(value: number): void;
  stop(): void;
}

const GRANULAR_SCALE_MAX_DELTA = 5;
const REST_DELTA_GRANULAR = 0.005;
const REST_SPEED_GRANULAR = 0.01;
const REST_DELTA_DEFAULT = 0.5;
const REST_SPEED_DEFAULT = 2;

export function createSpring(
  initial: number,
  stiffness: number,
  damping: number,
  onUpdate: (value: number) => void,
): Spring {
  let current = initial;
  let velocity = 0; // value units per second, carried across retargets
  let target = initial;
  let frame: number | null = null;
  let startedAt = 0;
  let granular = true;
  // Rest thresholds are baked into the sampler options; rebuilt only when a
  // retarget crosses the granularity boundary (framer picks the tier at
  // animation creation, i.e. per retarget).
  const sampler = () =>
    granular
      ? createChartSpring({
          stiffness,
          damping,
          restDelta: REST_DELTA_GRANULAR,
          restSpeed: REST_SPEED_GRANULAR,
        })
      : createChartSpring({
          stiffness,
          damping,
          restDelta: REST_DELTA_DEFAULT,
          restSpeed: REST_SPEED_DEFAULT,
        });
  let springInstance: ChartSpring = sampler();
  let springState = { from: initial, to: initial, velocity: 0 };

  const step = (now: number) => {
    const sample = springInstance.sample(now - startedAt, springState);
    if (sample.done) {
      current = target;
      velocity = 0;
      frame = null;
      onUpdate(current);
      return;
    }
    current = sample.value;
    velocity = sample.velocity;
    onUpdate(current);
    frame = requestAnimationFrame(step);
  };

  return {
    set(next: number) {
      // Same-value retarget while settled is a no-op (framer's `useSpring`
      // behavior) — without this, every retarget of an already-at-rest spring
      // schedules a one-step rAF whose only effect is rewriting the styles it
      // already wrote.
      if (next === target && frame === null && current === target) return;
      target = next;
      const nextGranular =
        Math.abs(target - current) < GRANULAR_SCALE_MAX_DELTA;
      if (frame === null || nextGranular !== granular) {
        granular = nextGranular;
        springInstance = sampler();
      }
      springState = { from: current, to: target, velocity };
      startedAt = performance.now();
      if (frame === null) {
        frame = requestAnimationFrame(step);
      }
    },
    jump(value: number) {
      target = value;
      current = value;
      velocity = 0;
      springState = { from: value, to: value, velocity: 0 };
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      onUpdate(current);
    },
    stop() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
}
