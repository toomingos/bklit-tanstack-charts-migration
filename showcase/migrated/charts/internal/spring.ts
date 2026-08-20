// Minimal damped-spring integrator matching framer-motion's `useSpring`
// physics (mass 1, F = -stiffness·x - damping·v). Drives imperative style
// writes from rAF — the migrated hover chrome must not schedule React work
// or import framer in the pointer path (docs/LOG.md D10).

export interface Spring {
  /** Retarget; starts the rAF loop if idle. */
  set(target: number): void;
  /** Snap to a value with no motion (used on show / discrete interaction). */
  jump(value: number): void;
  stop(): void;
}

// Rest thresholds mirror framer-motion's spring generator (motion-dom
// springDefaults + `isGranularScale = |initialDelta| < 5`): done when
// |value − target| < restDelta AND |velocity| < restSpeed, with the
// threshold tier picked per retarget from the animation's amplitude.
// A single flat threshold cannot serve both unitless and pixel springs: the
// previous REST_DELTA = 0.05 exceeded RingChart's entire hover amplitude
// (scale 1 -> 1.03, Δ = 0.03), so those springs met the rest condition on
// their first tick and degenerated into instant target snaps — no animation
// at all (docs/LOG.md D51).
const GRANULAR_SCALE_MAX_DELTA = 5;
const REST_DELTA_GRANULAR = 0.005;
const REST_SPEED_GRANULAR = 0.01;
const REST_DELTA_DEFAULT = 0.5;
const REST_SPEED_DEFAULT = 2;
// Springs must advance by true clock time, not per-frame quota: framer's
// JSAnimation samples its generator at `timestamp - startTime`, so dropped
// frames never slow the animation down. A dt cap (previously 64ms/frame)
// put every spring into slow motion whenever the page dipped below ~15fps,
// desyncing the migrated hover chrome from bklit's under load. MAX_STALL_MS
// only bounds integration work after e.g. a background-tab return — a
// spring integrated over 10s of elapsed time is at rest regardless.
const MAX_STALL_MS = 10_000;
const SUBSTEP_S = 1 / 120;

export function createSpring(
  initial: number,
  stiffness: number,
  damping: number,
  onUpdate: (value: number) => void,
): Spring {
  let current = initial;
  let velocity = 0;
  let target = initial;
  let frame: number | null = null;
  let last = 0;
  let restDelta = REST_DELTA_GRANULAR;
  let restSpeed = REST_SPEED_GRANULAR;

  const step = (now: number) => {
    const dt = Math.max(0, Math.min(MAX_STALL_MS, now - last)) / 1000;
    last = now;
    const substeps = Math.max(1, Math.ceil(dt / SUBSTEP_S));
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      velocity += (-stiffness * (current - target) - damping * velocity) * h;
      current += velocity * h;
    }
    if (Math.abs(current - target) < restDelta && Math.abs(velocity) < restSpeed) {
      current = target;
      velocity = 0;
      frame = null;
      onUpdate(current);
      return;
    }
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
      // framer picks the rest tier from |initialDelta| at animation creation,
      // i.e. on every retarget.
      const granular = Math.abs(target - current) < GRANULAR_SCALE_MAX_DELTA;
      restDelta = granular ? REST_DELTA_GRANULAR : REST_DELTA_DEFAULT;
      restSpeed = granular ? REST_SPEED_GRANULAR : REST_SPEED_DEFAULT;
      if (frame === null) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    },
    jump(value: number) {
      target = value;
      current = value;
      velocity = 0;
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
