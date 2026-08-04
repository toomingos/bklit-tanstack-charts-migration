// Verbatim port of framer-motion's `duration`/`bounce` -> spring-physics
// conversion, sampled once into a shared WAAPI keyframe array reused by
// every candle's reveal tween (docs/LOG.md D19/D10: zero framer-motion or
// React state in the animation path — WAAPI only).
//
// bklit candlestick.tsx `defaultEnter = { type: "spring", duration: 0.8,
// bounce: 0.15 }` (seconds at the public Transition surface). This module
// reproduces motion-dom's exact math (read verbatim from
// node_modules/motion-dom/dist/es/animation/generators/spring/{find,
// index}.mjs), not an approximation:
//
//  1. `findSpringStiffnessDamping` == find.mjs `findSpring`: Newton-iterates
//     (12 iterations, `approximateRoot`) the underdamped envelope/derivative
//     pair to solve for `undampedFreq`, including the literal quirk in the
//     derivative — `g = calcAngularFreq(undampedFreq**2, dampingRatio)`
//     (squaring `undampedFreq` there but NOT in `envelope`'s own `b`) —
//     copied exactly rather than "fixed", since motion-dom ships it this way
//     and our output must match its real behavior bit-for-bit.
//  2. `createSpringResolver` == index.mjs `spring()`'s closed-form
//     `resolveSpring(t)` (t in milliseconds), branching on
//     `dampingRatio = damping / (2*sqrt(stiffness*mass))` exactly like
//     motion-dom.
//  3. `sampleSpringKeyframes` samples `resolveSpring` at `samples` evenly
//     spaced points over `[0, durationMs]`, forcing the value to exactly
//     `target` once `t >= durationMs` — motion's own `generator.next()`
//     snaps `state.value = target` once `state.done = t >= duration` for
//     duration/bounce springs (`isResolvedFromDuration`), and
//     `calcGeneratorDuration` for those springs returns exactly the
//     requested duration, so this reproduces the same "exact snap at the
//     end" behavior instead of leaving a tiny residual gap from the
//     oscillating closed form.
const SAFE_MIN = 0.001;
const ROOT_ITERATIONS = 12;
const MIN_DAMPING_RATIO = 0.05;
const MAX_DAMPING_RATIO = 1;
const MIN_DURATION_SEC = 0.01;
const MAX_DURATION_SEC = 10;

function calcAngularFreq(undampedFreq: number, dampingRatio: number): number {
  return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
}

function approximateRoot(
  envelope: (x: number) => number,
  derivative: (x: number) => number,
  initialGuess: number,
): number {
  let result = initialGuess;
  for (let i = 1; i < ROOT_ITERATIONS; i++) {
    result = result - envelope(result) / derivative(result);
  }
  return result;
}

export interface SpringPhysics {
  stiffness: number;
  damping: number;
  mass: number;
}

/**
 * Port of motion-dom `findSpring`: solves `duration`/`bounce` (+ optional
 * `velocity`/`mass`) for the underlying `{ stiffness, damping }` pair.
 * `durationMs` is milliseconds (framer's public `duration` for a spring
 * Transition is seconds — convert before calling, matching motion-dom's own
 * `springDefaults.duration = 800 // in ms` default for its 0.8s default).
 */
export function findSpringStiffnessDamping(
  durationMs: number,
  bounce: number,
  velocity = 0,
  mass = 1,
): SpringPhysics {
  let envelope: (undampedFreq: number) => number;
  let derivative: (undampedFreq: number) => number;

  let dampingRatio = 1 - bounce;
  dampingRatio = Math.min(
    MAX_DAMPING_RATIO,
    Math.max(MIN_DAMPING_RATIO, dampingRatio),
  );
  const durationSec = Math.min(
    MAX_DURATION_SEC,
    Math.max(MIN_DURATION_SEC, durationMs / 1000),
  );

  if (dampingRatio < 1) {
    // Underdamped spring.
    envelope = (undampedFreq: number) => {
      const exponentialDecay = undampedFreq * dampingRatio;
      const delta = exponentialDecay * durationSec;
      const a = exponentialDecay - velocity;
      const b = calcAngularFreq(undampedFreq, dampingRatio);
      const c = Math.exp(-delta);
      return SAFE_MIN - (a / b) * c;
    };
    derivative = (undampedFreq: number) => {
      const exponentialDecay = undampedFreq * dampingRatio;
      const delta = exponentialDecay * durationSec;
      const d = delta * velocity + velocity;
      const e = dampingRatio ** 2 * undampedFreq ** 2 * durationSec;
      const f = Math.exp(-delta);
      // Literal motion-dom quirk: `undampedFreq**2` here, NOT the same
      // argument shape as `envelope`'s `b` — copied verbatim, see header.
      const g = calcAngularFreq(undampedFreq ** 2, dampingRatio);
      const factor = -envelope(undampedFreq) + SAFE_MIN > 0 ? -1 : 1;
      return (factor * ((d - e) * f)) / g;
    };
  } else {
    // Critically-damped spring (not reached at bklit's bounce=0.15, kept
    // for fidelity with motion-dom's own branch).
    envelope = (undampedFreq: number) => {
      const a = Math.exp(-undampedFreq * durationSec);
      const b = (undampedFreq - velocity) * durationSec + 1;
      return -SAFE_MIN + a * b;
    };
    derivative = (undampedFreq: number) => {
      const a = Math.exp(-undampedFreq * durationSec);
      const b = (velocity - undampedFreq) * (durationSec * durationSec);
      return a * b;
    };
  }

  const initialGuess = 5 / durationSec;
  const undampedFreq = approximateRoot(envelope, derivative, initialGuess);

  if (Number.isNaN(undampedFreq)) {
    // motion-dom's own NaN fallback (springDefaults.stiffness/damping).
    return { stiffness: 100, damping: 10, mass };
  }

  const stiffness = undampedFreq ** 2 * mass;
  const damping = dampingRatio * 2 * Math.sqrt(mass * stiffness);
  return { stiffness, damping, mass };
}

/**
 * Port of motion-dom `spring()`'s closed-form `resolveSpring(t)`, t in
 * milliseconds. `origin`/`target` match framer's `keyframes[0]`/
 * `keyframes[last]`; `initialVelocity` matches framer's (already
 * ms->per-second-negated) `velocity` option — 0 for the mount reveal.
 */
export function createSpringResolver(
  stiffness: number,
  damping: number,
  mass: number,
  origin: number,
  target: number,
  initialVelocity = 0,
): (tMs: number) => number {
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const initialDelta = target - origin;
  // motion-dom: `millisecondsToSeconds(Math.sqrt(stiffness / mass))` — the
  // resulting angular frequency is expressed "per millisecond" so `t` below
  // is consumed directly in milliseconds, matching motion-dom's own usage.
  const undampedAngularFreq = Math.sqrt(stiffness / mass) / 1000;

  if (dampingRatio < 1) {
    const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
    return (t: number): number => {
      const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
      return (
        target -
        envelope *
          (((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) /
            angularFreq) *
            Math.sin(angularFreq * t) +
            initialDelta * Math.cos(angularFreq * t))
      );
    };
  }
  if (dampingRatio === 1) {
    return (t: number): number =>
      target -
      Math.exp(-undampedAngularFreq * t) *
        (initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t);
  }
  const dampedAngularFreq =
    undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
  return (t: number): number => {
    const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
    const freqForT = Math.min(dampedAngularFreq * t, 300);
    return (
      target -
      (envelope *
        ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) *
          Math.sinh(freqForT) +
          dampedAngularFreq * initialDelta * Math.cosh(freqForT))) /
        dampedAngularFreq
    );
  };
}

/**
 * Samples a `duration`/`bounce` spring (origin 0 -> target 1, matching the
 * per-candle reveal's `scaleY` progress) into `samples` evenly spaced
 * keyframe values across `[0, durationMs]`, forcing the last sample to
 * exactly `target` (see header). Reused verbatim across every rect's
 * `element.animate()` call — sampled ONCE per chart, not per candle.
 */
export function sampleSpringKeyframes(
  durationMs: number,
  bounce: number,
  samples = 60,
): number[] {
  const origin = 0;
  const target = 1;
  const { stiffness, damping, mass } = findSpringStiffnessDamping(durationMs, bounce);
  const resolveSpring = createSpringResolver(stiffness, damping, mass, origin, target, 0);
  const values: number[] = [];
  const count = Math.max(2, samples);
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * durationMs;
    values.push(t >= durationMs ? target : resolveSpring(t));
  }
  return values;
}
