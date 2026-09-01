// Imperative, zero-React-state, zero-framer-motion hover chrome for
// PieChart's slices — ports repos/bklit-ui/packages/ui/src/charts/
// pie-slice.tsx's `motion.path` hover behavior (docs/LOG.md D10):
//   - "translate": pop the slice outward along its own mid-angle axis by
//     `hoverOffset` px, spring {stiffness:400, damping:25} on x AND y
//     independently (bklit's `transition={{x:{type:"spring",...}, y:{...}}}`)
//   - "grow": extend the slice's OWN outer radius by `hoverOffset` px,
//     spring {400,25} morphing the radius, regenerating the arc `d` on every
//     frame (bklit's `useSpring(outerRadius,{400,25})` retargeted in a
//     `useEffect`, feeding `useTransform` -> `generateArcPath`)
//   - "none": geometric offset forced to 0 (translate distance 0) — the
//     GROW/translate effect is the only thing this file still owns.
//   - non-hovered slices (while ANY slice is hovered) fade to opacity 0.4,
//     tween 0.15s (`transition={{opacity:{duration:0.15}}}`) — C1
//     (states+legend) moved this OFF an imperative `el.style.opacity`
//     mutation and onto pie-chart.tsx's reactive `definition` (per-datum
//     `fill` alpha channel, since radialArc's `opacity` mark option is a
//     single number for the whole mark, not a per-datum VisualChannel —
//     polar.d.ts). `FADE_OPACITY` stays exported from here as the fade
//     value's source of truth; the 0.15s fill transition lives in styles.css
//     (`[data-bkm-chart="pie"]` rule). This file no longer applies either.
//   - NO glow: bklit's `showGlow` drop-shadow was dead code at runtime (its
//     framer `style.filter` was frozen at mount — docs/LOG.md D49) and is
//     deleted outright by C1, not ported as observed (always-"none") pixels.
//
// Architecture differs from radar-hover-chrome.ts's centralized
// "requery-DOM-then-sync(elements[])" model: TanStack's mark reconciliation
// forces radar to re-bind hover chrome to freshly-rendered DOM nodes after
// every render. PieSlice is a REAL, individually-mounted React component
// (not a mark-rendered/reconciled node) with a stable lifetime of its own,
// so each PieSlice instance owns ONE `PieSliceHoverRuntime` (created once via
// a ref) that persists across its own re-renders, subscribing to a single,
// chart-level `PieHoverCoordinator` (created once per `PieChart` via a ref,
// passed through context so its identity never changes and mounting it
// triggers no re-renders).
import { arc as d3Arc, type Arc } from "d3-shape";
import { path as d3Path, type Path } from "d3-path";
import { createBroadcastStore } from "./broadcast-store";

export type PieSliceHoverEffect = "translate" | "grow" | "none";

// C2 (D432, native motion): the hover spring constants below are re-exported
// (not just kept private) so pie-chart.tsx's `definition` can hand them to a
// mark-level `motion` transition (`ChartMotionSpringTransition`) instead of
// this file's own imperative `createSpring` runtime — the same physical
// spring, just driven by the TanStack motion renderer's keyed-`d`
// interpolation rather than a per-frame `el.setAttribute('d', …)` write.
export const HOVER_SPRING = { stiffness: 400, damping: 25 } as const;
// C1 (states+legend): fade value, now consumed by pie-chart.tsx's reactive
// `definition` (per-datum `fill` alpha) instead of this file's `paint()`.
// The matching 0.15s fill transition is a styles.css rule.
export const FADE_OPACITY = 0.4;

// C2 (D432, native motion): `ChartMotionTweenTransition['easing']` (dist/
// types.d.ts:427-430) only accepts a named CSS keyword or a JS progress
// function — never a raw CSS string — but `resolveEnterTransition`
// (./enter-transition.ts) always produces `ResolvedTiming.easingCss` as a
// `cubic-bezier(x1,y1,x2,y2)` string (either the design-tokens default or
// one built from a caller's `enterTransition.ease` 4-tuple — see that
// module's `resolveEnterTransition`/`clipRevealTiming`, which only ever
// join 4 numbers into `cubic-bezier(...)`; no other CSS easing syntax is
// ever produced). This is the same Newton-iteration cubic-bezier solve
// `./bezier-easing.ts` hardcodes for the one default curve, generalized
// over arbitrary control points — written locally (not imported from
// another executor's `./reveal-easing.ts`, which is scoped to
// bar/candlestick/scatter) since pie/ring are the only C5 charts that need
// to feed an arbitrary caller-supplied `cubic-bezier(...)` string through
// a mark's native `motion` transition.
const CUBIC_BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/i;

export function motionEasingFromCss(css: string): (progress: number) => number {
  const match = CUBIC_BEZIER_RE.exec(css.trim());
  const [x1, y1, x2, y2] = match
    ? [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
    : [0.85, 0, 0.15, 1]; // REVEAL_EASE_POINTS (design-tokens.ts) fallback
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
    const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
    let t = p;
    for (let i = 0; i < 6; i++) {
      const err = bx(t) - p;
      if (Math.abs(err) < 1e-5) break;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
      if (dx === 0) break;
      t -= err / dx;
    }
    return by(t);
  };
}

// ---------------------------------------------------------------------------
// Offset arc generator — native replacement for the "translate" hover effect
// ---------------------------------------------------------------------------

/**
 * C2 (D432, native motion): `RadialArcOptions` (polar.d.ts) has no
 * transform/translate channel — arc geometry is always centered on the
 * polar origin (innerRadius/outerRadius/padRadius/cornerRadius only). bklit's
 * DEFAULT pie hover effect ("translate", see PieChart's `hoverEffect ??
 * "translate"`) is a rigid XY pop-out along the slice's own mid-angle axis
 * (`sliceMidOffset`), which a pure radius change can't express (growing the
 * radius changes the slice's SHAPE, not its position).
 *
 * This wraps a real d3-shape `arc()` generator so its output can carry a
 * per-datum (dx, dy) offset while still producing an ordinary `d` path
 * string — which is what makes it usable as `RadialArcOptions.generator`
 * (polar.d.ts: "Keep its context null so it returns SVG path data") AND what
 * lets the native motion renderer's keyed-`d` diffing interpolate the
 * translate smoothly under a spring (fact: `d` and `transform` are both
 * interpolable, but only `d` is reachable from a mark's own generator).
 *
 * Mechanism: d3-shape's `arc()` generator, when given a rendering context,
 * calls ONLY `moveTo`, `lineTo`, `arc`, and `closePath` on it (verified
 * against the installed d3-shape@3.2.0 source, node_modules/d3-shape/src/
 * arc.js — no quadraticCurveTo/bezierCurveTo/arcTo/rect for this generator).
 * A per-call proxy context intercepts exactly those four methods, shifts the
 * x/y arguments of the three coordinate-bearing ones by the datum's offset,
 * and delegates to a real `d3-path` `Path` — the same primitive `arc()` uses
 * internally when given no context — to build the final string. `d3-path` is
 * not a direct package.json dependency but resolves at both build and
 * runtime (this project's `node-linker=hoisted`, package.json:36-40 lists
 * only d3-array/d3-geo/d3-sankey/d3-scale/d3-shape as direct `d3-*` deps;
 * d3-path is d3-shape's own transitive dependency, hoisted flat).
 *
 * A zero-offset fast path skips the context entirely (returns straight from
 * `base(d)`) so the ~99% of never-hovered slices pay no extra allocation.
 */
export function createOffsetArc<TDatum>(
  getOffset: (d: TDatum, index: number) => { dx: number; dy: number },
): Arc<unknown, TDatum> {
  const base = d3Arc<TDatum>();
  const unexpectedMethod = (name: string) => () => {
    throw new Error(`createOffsetArc: d3-shape's arc() called unexpected context method '${name}'`);
  };
  const wrapped = ((d: TDatum, ...rest: unknown[]) => {
    const index = typeof rest[0] === "number" ? rest[0] : 0;
    const { dx, dy } = getOffset(d, index);
    if (dx === 0 && dy === 0) {
      base.context(null);
      return (base as unknown as (d: TDatum, ...rest: unknown[]) => string | null)(d, ...rest);
    }
    const real: Path = d3Path();
    const proxyContext: Path = {
      moveTo: (x: number, y: number) => real.moveTo(x + dx, y + dy),
      lineTo: (x: number, y: number) => real.lineTo(x + dx, y + dy),
      arc: (x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) =>
        real.arc(x + dx, y + dy, r, a0, a1, ccw),
      closePath: () => real.closePath(),
      quadraticCurveTo: unexpectedMethod("quadraticCurveTo"),
      bezierCurveTo: unexpectedMethod("bezierCurveTo"),
      arcTo: unexpectedMethod("arcTo"),
      rect: unexpectedMethod("rect"),
    };
    // @types/d3-shape narrowly types `context()` as `CanvasRenderingContext2D
    // | null` even though d3-shape's runtime only needs the CanvasPath-like
    // duck type d3-path's `Path` satisfies (verified above: arc.js calls
    // only moveTo/lineTo/arc/closePath) — the same cast idiom used wherever
    // a `d3-path` Path is handed to a d3-shape generator's `.context()`.
    base.context(proxyContext as unknown as CanvasRenderingContext2D);
    (base as unknown as (d: TDatum, ...rest: unknown[]) => void)(d, ...rest);
    base.context(null);
    return real.toString();
  }) as unknown as Arc<unknown, TDatum>;
  // Chainable config (getter/setter) methods TanStack's polar internals read
  // directly off the generator for point geometry (independent of the `d`
  // string) — delegated straight through to the real generator, unmodified.
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
  for (const method of chainableMethods) {
    (wrapped as unknown as Record<string, (...args: unknown[]) => unknown>)[method] = (...args: unknown[]) => {
      const target = base as unknown as Record<string, (...a: unknown[]) => unknown>;
      if (args.length === 0) return target[method]!();
      target[method]!(...args);
      return wrapped;
    };
  }
  // `centroid` is a compute-and-return method (not chainable) — always
  // forwarded with its arguments, unmodified (no dx/dy offset: focus/tooltip
  // are disabled on every chart that uses this helper, so an un-offset
  // centroid has no observable effect today).
  (wrapped as unknown as { centroid: (...args: unknown[]) => unknown }).centroid = (...args: unknown[]) =>
    (base as unknown as { centroid: (...a: unknown[]) => unknown }).centroid(...args);
  return wrapped;
}

// ---------------------------------------------------------------------------
// Chart-level hover coordinator
// ---------------------------------------------------------------------------

export interface PieHoverCoordinator {
  getHovered(): number | null;
  /** Pointer-driven request from a slice's hitbox (`pointerenter`). In
      uncontrolled mode this updates state directly and notifies subscribers;
      in controlled mode it only calls `onHoverChange` (bklit's own
      `isControlled ? onHoverChange?.(index) : setInternalHoveredIndex(index)`
      split, radar-hover-chrome.ts precedent). */
  requestHover(index: number): void;
  requestUnhover(): void;
  /** Imperative controlled-prop push: sets the current hovered index
      WITHOUT invoking `onHoverChange` (that prop is the caller's own — it
      already knows) and notifies subscribers. Call from a `useEffect` on the
      `hoveredIndex` prop, same as radar's `setHovered`. */
  setHovered(index: number | null): void;
  /** Every mounted `PieSlice`/`PieCenter` subscribes on mount, unsubscribes
      on cleanup. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function createPieHoverCoordinator(
  onHoverChange: (index: number | null) => void,
  isControlled: () => boolean,
): PieHoverCoordinator {
  // No comparator: every set notifies — pie has NO dedup guard, and that
  // absence is load-bearing for controlled-mode re-dispatch semantics.
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

// ---------------------------------------------------------------------------
// (C2, D432, native motion, cleanup pass) The per-slice imperative paint
// runtime that used to live here (`createPieSliceHoverRuntime` /
// `PieSliceHoverRuntime` / `PieSliceHoverConfig` — a per-instance pair of
// `createSpring` runtimes driving `style.transform` for "translate" and a
// per-frame `pieArcPath`-regenerated `d` for "grow") was fully superseded by
// C2's native motion conversion: `createOffsetArc` (above) now expresses
// BOTH effects as ordinary `d`-string geometry that the native motion
// renderer interpolates itself under a `ChartMotionSpringTransition`
// (HOVER_SPRING) — see pie-chart.tsx's `definition` (`gen`/`motion` on its
// `radialArc` mark). Confirmed zero live importers repo-wide (only this
// file's own definition and a historical doc-comment in pie-chart.tsx
// referenced it) before deleting; `createSpring`/`Spring` (./spring) and
// `pieArcPath`/`sliceMidOffset` (./pie-geometry) were exclusive to this dead
// runtime and are no longer imported here.
// ---------------------------------------------------------------------------
