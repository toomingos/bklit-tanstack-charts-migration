// Bklit cubic-bezier(0.85, 0, 0.15, 1) as a JS easing fn (Newton iteration).
const CUBIC_BEZIER_DEGREE = 3;
const CUBIC_BEZIER_DERIVATIVE_MIDDLE_COEFFICIENT = 6;
const NEWTON_MAX_ITERATIONS = 6;
const NEWTON_CONVERGENCE_TOLERANCE = 1e-5;
const BEZIER_X1 = 0.85;
const BEZIER_X2 = 0.15;
const BEZIER_Y1 = 0;
const BEZIER_Y2 = 1;
const cubicBezierX = (bezierT: number, x1: number, x2: number): number => CUBIC_BEZIER_DEGREE * bezierT * (1 - bezierT) * (1 - bezierT) * x1 + CUBIC_BEZIER_DEGREE * bezierT * bezierT * (1 - bezierT) * x2 + bezierT * bezierT * bezierT;
const cubicBezierY = (bezierT: number, y1: number, y2: number): number => CUBIC_BEZIER_DEGREE * bezierT * (1 - bezierT) * (1 - bezierT) * y1 + CUBIC_BEZIER_DEGREE * bezierT * bezierT * (1 - bezierT) * y2 + bezierT * bezierT * bezierT;
const bezierDerivativeX = (solvedT: number, x1: number, x2: number): number => CUBIC_BEZIER_DEGREE * (1 - solvedT) * (1 - solvedT) * x1 + CUBIC_BEZIER_DERIVATIVE_MIDDLE_COEFFICIENT * solvedT * (1 - solvedT) * (x2 - x1) + CUBIC_BEZIER_DEGREE * solvedT * solvedT * (1 - x2);
const solveBezierT = (progress: number, x1: number, x2: number): number => {
  let solvedT = progress;
  for (let i = 0; i < NEWTON_MAX_ITERATIONS; i += 1) {
    const err = cubicBezierX(solvedT, x1, x2) - progress;
    const dx = bezierDerivativeX(solvedT, x1, x2);
    if (Math.abs(err) < NEWTON_CONVERGENCE_TOLERANCE || dx === 0) {break;}
    solvedT -= err / dx;
  }
  return solvedT;
}
export const bezierEasing = (progress: number): number => {
  if (progress <= 0) {return 0;}
  if (progress >= 1) {return 1;}
  const solvedT = solveBezierT(progress, BEZIER_X1, BEZIER_X2);
  return cubicBezierY(solvedT, BEZIER_Y1, BEZIER_Y2);
}
