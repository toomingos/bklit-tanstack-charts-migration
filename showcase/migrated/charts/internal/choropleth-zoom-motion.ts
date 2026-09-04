// Choropleth zoom-motion helpers: bezier ease, matrix lerp, and per-frame matrix resolution.
import type { RefObject } from "react";
import type { GenericWheelEvent, Scale, TransformMatrix } from "./zoom-engine";

// Zoom application eases matrix values over 180ms per frame (retired CSS transition's timing).
const ZOOM_EASE_MS = 180;

// Binomial coefficient of the cubic Bernstein basis in the bezier solver below.
const CUBIC_BEZIER_COEFFICIENT = 3;
// Newton-Raphson iteration cap and slope epsilon of the bezier solver.
const BEZIER_SOLVER_MAX_ITERATIONS = 8;
const BEZIER_SOLVER_EPSILON = 1e-6;
// Wheel-zoom step factors per tick, out and in.
const WHEEL_ZOOM_OUT_FACTOR = 0.95;
const WHEEL_ZOOM_IN_FACTOR = 1.05;

// Static prop values hoisted so JSX props below keep a stable identity across renders.
// Wheel step as a scale-delta pair; hoisted so the Zoom prop keeps a stable callback identity.
const resolveWheelZoomDelta = (event: GenericWheelEvent): Scale => {
  const zoomScale = event.deltaY > 0 ? WHEEL_ZOOM_OUT_FACTOR : WHEEL_ZOOM_IN_FACTOR;
  return { scaleX: zoomScale, scaleY: zoomScale };
};

interface CubicBezierCoefficients {
  readonly ax: number;
  readonly bx: number;
  readonly cx: number;
  readonly ay: number;
  readonly by: number;
  readonly cy: number;
}

// Ease-out second control-point x (0, 0, 0.58, 1); the only curve the zoom easing uses.
const EASE_OUT_CONTROL_X2 = 0.58;
// Ease-out control points (0, 0, 0.58, 1); the only curve the zoom easing uses.
const easeOutCoefficients = (): CubicBezierCoefficients => {
  const cx = CUBIC_BEZIER_COEFFICIENT * 0;
  const bx = CUBIC_BEZIER_COEFFICIENT * (EASE_OUT_CONTROL_X2 - 0) - cx;
  const ax = 1 - cx - bx;
  const cy = CUBIC_BEZIER_COEFFICIENT * 0;
  const by = CUBIC_BEZIER_COEFFICIENT * (1 - 0) - cy;
  const ay = 1 - cy - by;
  return { ax, ay, bx, by, cx, cy };
}

const sampleBezierX = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  ((coeffs.ax * curveParam + coeffs.bx) * curveParam + coeffs.cx) * curveParam;

const sampleBezierY = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  ((coeffs.ay * curveParam + coeffs.by) * curveParam + coeffs.cy) * curveParam;

const sampleBezierDX = (coeffs: Readonly<CubicBezierCoefficients>, curveParam: number): number =>
  (CUBIC_BEZIER_COEFFICIENT * coeffs.ax * curveParam + 2 * coeffs.bx) * curveParam + coeffs.cx;

const solveBezierT = (coeffs: Readonly<CubicBezierCoefficients>, time: number): number => {
  let solution = time;
  for (let iteration = 0; iteration < BEZIER_SOLVER_MAX_ITERATIONS; iteration += 1) {
    const dx = sampleBezierDX(coeffs, solution);
    if (Math.abs(dx) < BEZIER_SOLVER_EPSILON) {break;}
    solution -= (sampleBezierX(coeffs, solution) - time) / dx;
  }
  return solution;
}

const cubicBezierEaseOut = (time: number): number => {
  if (time <= 0) {return 0;}
  if (time >= 1) {return 1;}
  const coeffs = easeOutCoefficients();
  return sampleBezierY(coeffs, solveBezierT(coeffs, time));
}

const lerpMatrix = (from: Readonly<TransformMatrix>, to: Readonly<TransformMatrix>, progress: number): TransformMatrix => ({
    scaleX: from.scaleX + (to.scaleX - from.scaleX) * progress,
    scaleY: from.scaleY + (to.scaleY - from.scaleY) * progress,
    skewX: from.skewX + (to.skewX - from.skewX) * progress,
    skewY: from.skewY + (to.skewY - from.skewY) * progress,
    translateX: from.translateX + (to.translateX - from.translateX) * progress,
    translateY: from.translateY + (to.translateY - from.translateY) * progress,
  })

const matricesEqual = (matrixA: Readonly<TransformMatrix>, matrixB: Readonly<TransformMatrix>): boolean => {
    const scaleMatches = matrixA.scaleX === matrixB.scaleX && matrixA.scaleY === matrixB.scaleY;
    const translateMatches = matrixA.translateX === matrixB.translateX && matrixA.translateY === matrixB.translateY;
    const skewMatches = matrixA.skewX === matrixB.skewX && matrixA.skewY === matrixB.skewY;
    return scaleMatches && translateMatches && skewMatches;
  }

type ZoomEaseState = { from: TransformMatrix; start: number };

interface ZoomFrameOptions {
  readonly dragging: boolean;
  readonly easeRef: RefObject<ZoomEaseState | undefined>;
  readonly target: TransformMatrix;
  readonly now: number;
}

const resolveZoomFrameMatrix = (options: Readonly<ZoomFrameOptions>): TransformMatrix => {
  const { dragging, easeRef, target, now } = options;
  const ease = easeRef.current;
  if (dragging || !ease) {return target;}
  const progress = Math.min((now - ease.start) / ZOOM_EASE_MS, 1);
  if (progress >= 1) {
    easeRef.current = undefined;
    return target;
  }
  return lerpMatrix(ease.from, target, cubicBezierEaseOut(progress));
};

// True when the committed zoom snapshot differs (matrix or dragging flag).
interface ZoomSnapshotOptions {
  readonly matrix: TransformMatrix;
  readonly dragging: boolean;
  readonly committedMatrix: Readonly<TransformMatrix>;
  readonly committedDragging: boolean;
}

const zoomSnapshotChanged = (options: Readonly<ZoomSnapshotOptions>): boolean =>
  options.dragging !== options.committedDragging || !matricesEqual(options.matrix, options.committedMatrix);

const queueZoomFrame = (shouldContinue: boolean, frame: (now: number) => void): number | undefined => {
  if (!shouldContinue) {return undefined;}
  return requestAnimationFrame(frame);
};

export {
  matricesEqual,
  queueZoomFrame,
  resolveWheelZoomDelta,
  resolveZoomFrameMatrix,
  zoomSnapshotChanged,
};
