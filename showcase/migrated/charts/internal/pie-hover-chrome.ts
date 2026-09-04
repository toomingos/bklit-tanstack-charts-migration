// Zero-React-state hover chrome for pie slices (translate/grow/none + 0.4 dim).
// Each PieSlice owns one runtime subscribed to a chart-level coordinator.
import { arc as d3Arc } from 'd3-shape';
import type { Arc } from 'd3-shape';
import { path as d3Path } from 'd3-path';
import type { Path } from 'd3-path';
import { createBroadcastStore } from "./broadcast-store";

type PieSliceHoverEffect = "translate" | "grow" | "none";

// Re-exported so pie-chart can drive the same spring via mark-level motion.
const HOVER_SPRING = { damping: 25, stiffness: 400 } as const;
const FADE_OPACITY = 0.4;

// Easing adapter: mark motion takes a progress fn, not a CSS string, so cubic-bezier
// Strings from resolveEnterTransition are Newton-solved to fns here.
const CUBIC_BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/iu;

// Cubic Bernstein basis coefficient (verbatim easing math below).
const CUBIC_BERNSTEIN_COEFFICIENT = 3;
// Middle coefficient of the cubic bezier derivative (verbatim easing math).
const CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT = 6;
// Newton-solve iteration cap and convergence tolerance for cubic-bezier easing.
const NEWTON_MAX_ITERATIONS = 6;
const NEWTON_CONVERGENCE_TOLERANCE = 1e-5;
// Reveal-ease fallback control points (REVEAL_EASE_POINTS in design-tokens.ts).
const FALLBACK_EASE_X1 = 0.85;
const FALLBACK_EASE_X2 = 0.15;

interface CubicBezierControlPoints {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const parseBezierControlPoints = (css: string): CubicBezierControlPoints => {
  const match = CUBIC_BEZIER_RE.exec(css.trim());
  // Numbered groups, not named: named capture groups are ES2018 and this project targets ES2017.
  if (!match) {
    // REVEAL_EASE_POINTS (design-tokens.ts) fallback
    return { x1: FALLBACK_EASE_X1, x2: FALLBACK_EASE_X2, y1: 0, y2: 1 };
  }
  return { x1: Number(match[1]), x2: Number(match[3]), y1: Number(match[2]), y2: Number(match[4]) };
}

const cubicBernstein = (bezierT: number, weight1: number, weight2: number): number => CUBIC_BERNSTEIN_COEFFICIENT * bezierT * (1 - bezierT) * (1 - bezierT) * weight1 + CUBIC_BERNSTEIN_COEFFICIENT * bezierT * bezierT * (1 - bezierT) * weight2 + bezierT * bezierT * bezierT;

const solveBezierT = (progress: number, x1: number, x2: number): number => {
  let solverT = progress;
  for (let newtonIter = 0; newtonIter < NEWTON_MAX_ITERATIONS; newtonIter += 1) {
    const err = cubicBernstein(solverT, x1, x2) - progress;
    const dx = CUBIC_BERNSTEIN_COEFFICIENT * (1 - solverT) * (1 - solverT) * x1 + CUBIC_DERIVATIVE_MIDDLE_COEFFICIENT * solverT * (1 - solverT) * (x2 - x1) + CUBIC_BERNSTEIN_COEFFICIENT * solverT * solverT * (1 - x2);
    if (Math.abs(err) < NEWTON_CONVERGENCE_TOLERANCE || dx === 0) {break;}
    solverT -= err / dx;
  }
  return solverT;
}

const motionEasingFromCss = (css: string): ((progress: number) => number) => {
  const { x1, y1, x2, y2 } = parseBezierControlPoints(css);
  return (progress: number) => {
    if (progress <= 0) {return 0;}
    if (progress >= 1) {return 1;}
    return cubicBernstein(solveBezierT(progress, x1, x2), y1, y2);
  };
}


// D3 arc() calls only moveTo/lineTo/arc/closePath: a proxy context offsets (dx,dy)
// Per datum while emitting a plain d string (zero-offset fast path skips the proxy).
// Throws for context methods d3-shape's arc() never calls (arcTo/bezier/quadratic/rect).
const unexpectedArcMethod = (name: string): (() => never) => () => {
  throw new Error(`createOffsetArc: d3-shape's arc() called unexpected context method '${name}'`);
};

interface OffsetProxyParams {
  readonly real: Readonly<Path>;
  readonly dx: number;
  readonly dy: number;
}

const createOffsetProxyContext = ({ real, dx, dy }: Readonly<OffsetProxyParams>): Path => ({
  arc: (arcX: number, arcY: number, radius: number, a0: number, a1: number, ccw = false) =>{  real.arc(arcX + dx, arcY + dy, radius, a0, a1, ccw); },
  arcTo: unexpectedArcMethod("arcTo"),
  bezierCurveTo: unexpectedArcMethod("bezierCurveTo"),
  closePath: () =>{  real.closePath(); },
  lineTo: (endX: number, endY: number) =>{  real.lineTo(endX + dx, endY + dy); },
  moveTo: (endX: number, endY: number) =>{  real.moveTo(endX + dx, endY + dy); },
  quadraticCurveTo: unexpectedArcMethod("quadraticCurveTo"),
  rect: unexpectedArcMethod("rect"),
});

// SAFETY: D3-shape's arc() only invokes the CanvasPath subset (moveTo/lineTo/arc/closePath).
// Each call on its context is forwarded with the (dx, dy) offset to the real d3-path Path above.
// All remaining Path methods throw via unexpectedArcMethod.
// That covers every context method arc() can reach (see module header).
interface RenderOffsetArcParams<TDatum> {
  readonly base: Arc<unknown, TDatum>;
  readonly datum: TDatum;
  readonly rest: readonly unknown[];
  readonly dx: number;
  readonly dy: number;
}

const renderOffsetArcString = <TDatum>({ base, datum, rest, dx, dy }: Readonly<RenderOffsetArcParams<TDatum>>): string => {
  const real: Path = d3Path();
  const proxyContext = createOffsetProxyContext({ dx, dy, real });
// SAFETY: D3-shape's arc() only invokes the CanvasPath subset (moveTo/lineTo/arc/closePath), each
// Forwarded with the (dx, dy) offset to the real d3-path Path above; the rest throw.
  base.context(proxyContext as CanvasRenderingContext2D);
  base(datum, ...rest);
  base.context(null);
  return real.toString();
};

// The nine chainable Arc members createOffsetArc forwards (module scope: one shared tuple).
const chainableMethods = [
  "innerRadius",
  "outerRadius",
  "cornerRadius",
  "padRadius",
  "startAngle",
  "endAngle",
  "padAngle",
  "context",
  "digits",
] as const;

// Outcome of invoking a forwarded chainable: the live getter value with no args,
// The wrapper itself after forwarding a set for chaining.
type ArcChainableOutcome<TDatum> =
  | Arc<unknown, TDatum>
  | CanvasRenderingContext2D
  | ((...accessorArgs: readonly unknown[]) => number)
  | number
  | string
  | boolean
  | null;

type ArcChainableSlot<TDatum> = (...args: readonly unknown[]) => ArcChainableOutcome<TDatum>;

const createOffsetArc = <TDatum>(getOffset: (datum: TDatum, index: number) => { dx: number; dy: number }): Arc<unknown, TDatum> => {
  const base = d3Arc<TDatum>();
// SAFETY: The closure below plus the centroid and nine chainable forwarders after it form
// The full Arc<unknown, TDatum> surface TanStack's radialArc generator consumes.
// String-returning invocation with a null context and offset replay onto a d3-path Path
// With a path context are both covered, as are centroid and every chainable accessor.
// D3-shape passes the datum index as the first extra call argument, hence the tuple.
// The assertion only bridges the methods attached after creation, not the call shape.
  const wrapped = ((datum: TDatum, ...rest: readonly [number?, ...unknown[]]) => {
    const index = rest[0] ?? 0;
    const { dx, dy } = getOffset(datum, index);
    if (dx === 0 && dy === 0) {
      base.context(null);
      return base(datum, ...rest);
    }
    return renderOffsetArcString({ base, datum, dx, dy, rest });
  }) as Arc<unknown, TDatum>;
  for (const method of chainableMethods) {
    const forwarder = (...args: readonly unknown[]): ArcChainableOutcome<TDatum> => {
      // SAFETY: `method` ranges over the nine chainable Arc member names above.
      // Every one of those exists on each D3-shape arc generator with get/set overloads.
      // Reflect.get returns the live member, typed here as the chainable slot it is.
      // A missing entry throws a descriptive error before anything is called.
      const fn = Reflect.get(base, method) as ArcChainableSlot<TDatum> | undefined;
      if (fn === undefined) {throw new Error(`createOffsetArc: missing arc method '${method}'`);}
      if (args.length === 0) {return fn();}
      fn(...args);
      return wrapped;
    };
    // Same own-property assignment as the indexed write, without an open dictionary type.
    Reflect.set(wrapped, method, forwarder);
  }
  // Forwarder passes arguments through untouched so labels match the configured geometry
  // (typed directly against Arc's centroid signature, so no assertion is needed here).
  wrapped.centroid = (datum: TDatum, ...args: readonly unknown[]): [number, number] => base.centroid(datum, ...args);
  return wrapped;
}


interface PieHoverCoordinator {
  getHovered: () => number | null
/** Controlled mode only notifies; uncontrolled updates state. */
  requestHover: (index: number) => void
  requestUnhover: () => void
/** Controlled-prop push: sets without invoking onHoverChange. */
  setHovered: (index: number | null) => void
  subscribe: (listener: () => void) => () => void
}

const createPieHoverCoordinator = (onHoverChange: (index: number | null) => void, isControlled: () => boolean): PieHoverCoordinator => {
// No dedup: every set notifies (load-bearing for controlled re-dispatch).
  const store = createBroadcastStore<number | null>({ initial: null });
  return {
    getHovered: () => store.get(),
    requestHover(index) {
      if (isControlled()) {
        onHoverChange(index);
        return;
      }
      store.set(index);
    },
    requestUnhover() {
      if (isControlled()) {
        onHoverChange(null);
        return;
      }
      store.set(null);
    },
    setHovered(index) {
      store.set(index);
    },
    subscribe(listener) {
      return store.subscribe(listener);
    },
  };
}


export {
  createOffsetArc,
  createPieHoverCoordinator,
  FADE_OPACITY,
  HOVER_SPRING,
  motionEasingFromCss,
};
export type { PieHoverCoordinator, PieSliceHoverEffect };
