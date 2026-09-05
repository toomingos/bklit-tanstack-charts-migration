// Shared hover motion primitives (verbatim from pie-hover-chrome.ts, V2.2).
import { arc as d3Arc } from 'd3-shape';
import type { Arc } from 'd3-shape';
import { path as d3Path } from 'd3-path';
import type { Path } from 'd3-path';
import { createBroadcastStore } from "./broadcast-store";

type PieSliceHoverEffect = "translate" | "grow" | "none";

// Re-exported so pie/ring charts can drive the same spring via mark-level motion.
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


/*
 * D3 arc() only calls moveTo/lineTo/arc/closePath; all other context methods throw.
 */
const unexpectedArcMethod = (name: string): (() => never) => () => {
  throw new Error(`createOffsetArc: d3-shape's arc() called unexpected context method '${name}'`);
};

interface OffsetProxyParams {
  readonly real: Readonly<Path>;
  readonly dx: number;
  readonly dy: number;
}

// Positional args of the canvas arc call, forwarded with the (dx, dy) offset.
type ArcProxyArgs = [x: number, y: number, radius: number, a0: number, a1: number, ccw?: boolean];

// The proxy's own surface, mirroring the Path subset arc() can invoke.
interface OffsetProxy {
  arc: (...args: ArcProxyArgs) => void;
  arcTo: (...args: readonly never[]) => never;
  bezierCurveTo: (...args: readonly never[]) => never;
  closePath: () => void;
  lineTo: (endX: number, endY: number) => void;
  moveTo: (endX: number, endY: number) => void;
  quadraticCurveTo: (...args: readonly never[]) => never;
  rect: (...args: readonly never[]) => never;
}

const createOffsetProxyContext = ({ real, dx, dy }: Readonly<OffsetProxyParams>): OffsetProxy => ({
  arc: (...arcArgs: ArcProxyArgs): void => {
    const [arcX, arcY, radius, a0, a1, ccw = false] = arcArgs;
    real.arc(arcX + dx, arcY + dy, radius, a0, a1, ccw);
  },
  arcTo: unexpectedArcMethod("arcTo"),
  bezierCurveTo: unexpectedArcMethod("bezierCurveTo"),
  closePath: () =>{  real.closePath(); },
  lineTo: (endX: number, endY: number) =>{  real.lineTo(endX + dx, endY + dy); },
  moveTo: (endX: number, endY: number) =>{  real.moveTo(endX + dx, endY + dy); },
  quadraticCurveTo: unexpectedArcMethod("quadraticCurveTo"),
  rect: unexpectedArcMethod("rect"),
});

interface RenderOffsetArcParams<TDatum> {
  readonly base: Arc<unknown, TDatum>;
  readonly datum: TDatum;
  readonly rest: readonly unknown[];
  readonly dx: number;
  readonly dy: number;
}

// Narrows the offset proxy to a canvas context for arc(): the guard checks
// The four methods arc() calls, so no assertion crosses the boundary.
const isCallable = (value: unknown): value is (...args: readonly never[]) => void => typeof value === "function";

const isOffsetCapable = (proxy: OffsetProxy): proxy is OffsetProxy & CanvasRenderingContext2D =>
  isCallable(proxy.arc) && isCallable(proxy.closePath) && isCallable(proxy.lineTo) && isCallable(proxy.moveTo);

const renderOffsetArcString = <TDatum>({ base, datum, rest, dx, dy }: Readonly<RenderOffsetArcParams<TDatum>>): string => {
  const real: Path = d3Path();
  const proxyContext = createOffsetProxyContext({ dx, dy, real });
  if (!isOffsetCapable(proxyContext)) {throw new Error("createOffsetArc: offset proxy lost a CanvasPath method");}
  base.context(proxyContext);
  base(datum, ...rest);
  base.context(null);
  return real.toString();
};

const createOffsetArc = <TDatum>(getOffset: (datum: TDatum, index: number) => { dx: number; dy: number }): Arc<unknown, TDatum> => {
  const base = d3Arc<TDatum>();
  // Generator config methods close over their state and ignore `this`:
  // Copying them onto the wrapper shares one config for offset calls.
  return Object.assign(
    (datum: TDatum, ...rest: readonly [number?, ...unknown[]]): string | null => {
      const index = rest[0] ?? 0;
      const { dx, dy } = getOffset(datum, index);
      if (dx === 0 && dy === 0) {
        base.context(null);
        return base(datum, ...rest);
      }
      return renderOffsetArcString({ base, datum, dx, dy, rest });
    },
    base,
  );
}


interface PieHoverCoordinator {
  readonly getHovered: () => number | null
/** Controlled mode only notifies; uncontrolled updates state. */
  readonly requestHover: (index: number) => void
  readonly requestUnhover: () => void
/** Controlled-prop push: sets without invoking onHoverChange. */
  readonly setHovered: (index: number | null) => void
  readonly subscribe: (listener: () => void) => () => void
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

/*
 * Package-focus hover carrier for center components (CenterStatHoverSource).
 */
interface HoverSource {
  readonly getHovered: () => number | null
  readonly setHovered: (index: number | null) => void
  readonly subscribe: (listener: () => void) => () => void
}

const createHoverSource = (): HoverSource => {
  const store = createBroadcastStore<number | null>({ equals: (current, next) => current === next, initial: null });
  return {
    getHovered: () => store.get(),
    setHovered: (index) => { store.set(index); },
    subscribe: (listener) => store.subscribe(listener),
  };
}


export {
  createHoverSource,
  createOffsetArc,
  createPieHoverCoordinator,
  FADE_OPACITY,
  HOVER_SPRING,
  motionEasingFromCss,
};
export type { HoverSource, PieHoverCoordinator, PieSliceHoverEffect };
