import type { ChartAnimationOptions } from "@tanstack/charts";

type MotionEasing = NonNullable<ChartAnimationOptions["easing"]>;

const CUBIC_BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/iu;

// Cubic Bernstein basis coefficient (verbatim bklit easing math below).
const CUBIC_BERNSTEIN_COEFFICIENT = 3;
// Middle coefficient of the cubic bezier derivative (verbatim bklit easing math).
const CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT = 6;
// Newton-solve iteration cap and convergence tolerance for cubic-bezier easing.
const NEWTON_MAX_ITERATIONS = 6;
const NEWTON_CONVERGENCE_TOLERANCE = 1e-5;

interface CubicBezierParams {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const cubicXAt = (params: Readonly<CubicBezierParams>, bezierT: number): number =>
  CUBIC_BERNSTEIN_COEFFICIENT * bezierT * (1 - bezierT) * (1 - bezierT) * params.x1
  + CUBIC_BERNSTEIN_COEFFICIENT * bezierT * bezierT * (1 - bezierT) * params.x2
  + bezierT * bezierT * bezierT;

const cubicYAt = (params: Readonly<CubicBezierParams>, bezierT: number): number =>
  CUBIC_BERNSTEIN_COEFFICIENT * bezierT * (1 - bezierT) * (1 - bezierT) * params.y1
  + CUBIC_BERNSTEIN_COEFFICIENT * bezierT * bezierT * (1 - bezierT) * params.y2
  + bezierT * bezierT * bezierT;

const cubicDXAt = (params: Readonly<CubicBezierParams>, solvedT: number): number =>
  CUBIC_BERNSTEIN_COEFFICIENT * (1 - solvedT) * (1 - solvedT) * params.x1
  + CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT * solvedT * (1 - solvedT) * (params.x2 - params.x1)
  + CUBIC_BERNSTEIN_COEFFICIENT * solvedT * solvedT * (1 - params.x2);

// Newton-solves the bezier x for the target progress (verbatim bklit easing math).
const solveBezierT = (params: Readonly<CubicBezierParams>, progress: number): number => {
  let solvedT = progress;
  for (let i = 0; i < NEWTON_MAX_ITERATIONS; i += 1) {
    const err = cubicXAt(params, solvedT) - progress;
    const dx = cubicDXAt(params, solvedT);
    if (Math.abs(err) < NEWTON_CONVERGENCE_TOLERANCE || dx === 0) {break;}
    solvedT -= err / dx;
  }
  return solvedT;
};

const cubicBezierEasing = (params: Readonly<CubicBezierParams>): ((progress: number) => number) => (progress: number) => {
    if (progress <= 0) {return 0;}
    if (progress >= 1) {return 1;}
    return cubicYAt(params, solveBezierT(params, progress));
  };


// Default reveal easing control points (matches REVEAL_EASE_CSS in design-tokens).
const DEFAULT_EASE_X1 = 0.85;
const DEFAULT_EASE_X2 = 0.15;

const DEFAULT_EASING = cubicBezierEasing({ x1: DEFAULT_EASE_X1, x2: DEFAULT_EASE_X2, y1: 0, y2: 1 });

// Named CSS keyword easings pass through to native motion as-is.
const keywordMotionEasing = (trimmed: string): MotionEasing | undefined => {
  // Equality narrowing (not Set.has + `as`): the literal union is a subtype of
  // MotionEasing, so the narrowed value returns with no assertion.
  if (trimmed === "linear" || trimmed === "ease" || trimmed === "ease-in") {return trimmed;}
  if (trimmed === "ease-out" || trimmed === "ease-in-out") {return trimmed;}
  return undefined;
};

// Raw CSS easing strings can't feed native motion; solve cubic-bezier to a progress fn.
const resolveMotionEasing = (css: string | undefined): MotionEasing => {
  if (css === undefined || css.length === 0) {return DEFAULT_EASING;}
  const trimmed = css.trim().toLowerCase();
  const keyword = keywordMotionEasing(trimmed);
  if (keyword !== undefined) {return keyword;}
  // Numbered captures carry the control points (named groups need ES2018+;
  // This package targets ES2017, so positional reads stay).
  const match = CUBIC_BEZIER_RE.exec(trimmed);
  if (match) {
    return cubicBezierEasing({ x1: Number(match[1]), x2: Number(match[3]), y1: Number(match[2]), y2: Number(match[4]) });
  }
  return DEFAULT_EASING;
}

export { resolveMotionEasing };
export type { CubicBezierParams, MotionEasing };
