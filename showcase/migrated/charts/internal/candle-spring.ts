// Motion-dom duration/bounce -> {stiffness, damping} solver + closed-form resolver, matching its math quirks.
const SAFE_MIN = 0.001;
const ROOT_ITERATIONS = 12;
const MIN_DAMPING_RATIO = 0.05;
const MAX_DAMPING_RATIO = 1;
const MIN_DURATION_SEC = 0.01;
const MAX_DURATION_SEC = 10;
const MS_PER_SECOND = 1000;
const INITIAL_GUESS_NUMERATOR = 5;
const OVERDAMPED_FREQ_TIME_CLAMP = 300;

const calcAngularFreq = (undampedFreq: number, dampingRatio: number): number => undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);


const approximateRoot = (envelope: (x: number) => number, derivative: (x: number) => number, initialGuess: number): number => {
  let result = initialGuess;
  for (let i = 1; i < ROOT_ITERATIONS; i += 1) {
    result -= envelope(result) / derivative(result);
  }
  return result;
}

interface SpringPhysics {
  stiffness: number;
  damping: number;
  mass: number;
}

interface FindSpringParams {
  readonly durationMs: number;
  readonly bounce: number;
  readonly velocity?: number;
  readonly mass?: number;
}

interface SpringSolver {
  readonly envelope: (undampedFreq: number) => number;
  readonly derivative: (undampedFreq: number) => number;
}

interface UnderdampedSolverParams {
  readonly dampingRatio: number;
  readonly durationSec: number;
  readonly velocity: number;
}

interface CriticallyDampedSolverParams {
  readonly durationSec: number;
  readonly velocity: number;
}

const clampDampingRatio = (bounce: number): number => {
  const dampingRatio = 1 - bounce;
  return Math.min(
    MAX_DAMPING_RATIO,
    Math.max(MIN_DAMPING_RATIO, dampingRatio),
  );
}

const clampDurationSec = (durationMs: number): number => Math.min(
  MAX_DURATION_SEC,
  Math.max(MIN_DURATION_SEC, durationMs / MS_PER_SECOND),
);

const createUnderdampedSolver = ({ dampingRatio, durationSec, velocity }: UnderdampedSolverParams): SpringSolver => {
  const envelope = (undampedFreq: number): number => {
    const exponentialDecay = undampedFreq * dampingRatio;
    const delta = exponentialDecay * durationSec;
    const amplitudeNumerator = exponentialDecay - velocity;
    const angularFreq = calcAngularFreq(undampedFreq, dampingRatio);
    const decayFactor = Math.exp(-delta);
    return SAFE_MIN - (amplitudeNumerator / angularFreq) * decayFactor;
  };
  const derivative = (undampedFreq: number): number => {
    const exponentialDecay = undampedFreq * dampingRatio;
    const delta = exponentialDecay * durationSec;
    const velocityTerm = delta * velocity + velocity;
    const dampingTerm = dampingRatio ** 2 * undampedFreq ** 2 * durationSec;
    const decayFactor = Math.exp(-delta);
    // Literal motion-dom quirk (undampedFreq**2, unlike envelope's angularFreq) — kept for bit-for-bit fidelity.
    const quirkAngularFreq = calcAngularFreq(undampedFreq ** 2, dampingRatio);
    const factor = -envelope(undampedFreq) + SAFE_MIN > 0 ? -1 : 1;
    return (factor * ((velocityTerm - dampingTerm) * decayFactor)) / quirkAngularFreq;
  };
  return { derivative, envelope };
}

const createCriticallyDampedSolver = ({ durationSec, velocity }: CriticallyDampedSolverParams): SpringSolver => {
  // Critically-damped branch (unreached at bklit bounce=0.15; motion-dom fidelity).
  const envelope = (undampedFreq: number): number => {
    const decayFactor = Math.exp(-undampedFreq * durationSec);
    const growthFactor = (undampedFreq - velocity) * durationSec + 1;
    return -SAFE_MIN + decayFactor * growthFactor;
  };
  const derivative = (undampedFreq: number): number => {
    const decayFactor = Math.exp(-undampedFreq * durationSec);
    const slopeFactor = (velocity - undampedFreq) * (durationSec * durationSec);
    return decayFactor * slopeFactor;
  };
  return { derivative, envelope };
}

const resolveSpringPhysics = (undampedFreq: number, dampingRatio: number, mass: number): SpringPhysics => {
  if (Number.isNaN(undampedFreq)) {
    return { damping: 10, mass, stiffness: 100 };
  }
  const stiffness = undampedFreq ** 2 * mass;
  const damping = dampingRatio * 2 * Math.sqrt(mass * stiffness);
  return { damping, mass, stiffness };
}

/**
 * Port of motion-dom's `findSpring`; durationMs is milliseconds (framer's public duration is seconds).
 *
 * @param {FindSpringParams} params - Solver inputs; duration is clamped to [0.01s, 10s] and bounce maps to a damping ratio in [0.05, 1].
 * @returns {SpringPhysics} Stiffness/damping/mass triple; NaN roots fall back to stiffness 100 and damping 10.
 */
const findSpringStiffnessDamping = ({ durationMs, bounce, velocity = 0, mass = 1 }: FindSpringParams): SpringPhysics => {
  const dampingRatio = clampDampingRatio(bounce);
  const durationSec = clampDurationSec(durationMs);
  const solver = dampingRatio >= 1
    ? createCriticallyDampedSolver({ durationSec, velocity })
    : createUnderdampedSolver({ dampingRatio, durationSec, velocity });
  const initialGuess = INITIAL_GUESS_NUMERATOR / durationSec;
  const undampedFreq = approximateRoot(solver.envelope, solver.derivative, initialGuess);
  return resolveSpringPhysics(undampedFreq, dampingRatio, mass);
}

interface SpringResolverParams {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly origin: number;
  readonly target: number;
  readonly initialVelocity?: number;
}

interface DampedResolverParams {
  readonly dampingRatio: number;
  readonly undampedAngularFreq: number;
  readonly initialDelta: number;
  readonly initialVelocity: number;
  readonly target: number;
}

const createUnderdampedResolver = ({ dampingRatio, undampedAngularFreq, initialDelta, initialVelocity, target }: DampedResolverParams): ((tMs: number) => number) => {
  const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
  return (tMs: number): number => {
    const envelope = Math.exp(-dampingRatio * undampedAngularFreq * tMs);
    return (
      target -
      envelope *
        (((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) /
          angularFreq) *
          Math.sin(angularFreq * tMs) +
          initialDelta * Math.cos(angularFreq * tMs))
    );
  };
}

const createCriticallyDampedResolver = ({ undampedAngularFreq, initialDelta, initialVelocity, target }: DampedResolverParams): ((tMs: number) => number) =>
  (tMs: number): number => target -
    Math.exp(-undampedAngularFreq * tMs) *
      (initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * tMs);

const createOverdampedResolver = ({ dampingRatio, undampedAngularFreq, initialDelta, initialVelocity, target }: DampedResolverParams): ((tMs: number) => number) => {
  const dampedAngularFreq =
    undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
  return (tMs: number): number => {
    const envelope = Math.exp(-dampingRatio * undampedAngularFreq * tMs);
    const freqForT = Math.min(dampedAngularFreq * tMs, OVERDAMPED_FREQ_TIME_CLAMP);
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
 * Port of motion-dom's closed-form `resolveSpring(t)`; t in ms, per-millisecond frequency.
 *
 * @param {SpringResolverParams} params - Spring constants plus origin/target/initialVelocity; selects the under-, critically, or overdamped branch.
 * @returns {(tMs: number) => number} Position evaluator in chart units for elapsed milliseconds.
 */
const createSpringResolver = ({ stiffness, damping, mass, origin, target, initialVelocity = 0 }: SpringResolverParams): ((tMs: number) => number) => {
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const initialDelta = target - origin;
  const undampedAngularFreq = Math.sqrt(stiffness / mass) / MS_PER_SECOND;
  const params: DampedResolverParams = { dampingRatio, initialDelta, initialVelocity, target, undampedAngularFreq };
  if (dampingRatio < 1) {
    return createUnderdampedResolver(params);
  }
  if (dampingRatio === 1) {
    return createCriticallyDampedResolver(params);
  }
  return createOverdampedResolver(params);
}

// CreateSpringResolver has no in-file caller but is imported directly by internal/radar-spring.ts — keep.

export { createSpringResolver, findSpringStiffnessDamping };
export type { SpringPhysics, FindSpringParams, SpringResolverParams };
