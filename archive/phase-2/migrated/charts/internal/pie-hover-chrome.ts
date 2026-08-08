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
//   - "none": geometric offset forced to 0 (translate distance 0) — but
//     opacity fade / glow BELOW still apply. Confirmed via precise re-read
//     of pie-slice.tsx's `renderStaticSlice`: `shouldTranslate = hoverEffect
//     !== "none" && isHovered` gates ONLY translateX/Y; `isFaded`/`showGlow`
//     are unconditional. This is bklit's own nuance, not an invention.
//   - non-hovered slices (while ANY slice is hovered) fade to opacity 0.4,
//     tween 0.15s (`transition={{opacity:{duration:0.15}}}`)
//   - NO glow: bklit's `showGlow` drop-shadow is dead code at runtime (its
//     framer `style.filter` is frozen at mount — see the comment in
//     `paint()` below; docs/LOG.md D49)
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
import { createSpring, type Spring } from "./spring";
import { pieArcPath, sliceMidOffset } from "./pie-geometry";

export type PieSliceHoverEffect = "translate" | "grow" | "none";

const HOVER_SPRING = { stiffness: 400, damping: 25 } as const;
export const FADE_OPACITY = 0.4;
const FULL_OPACITY = "1";
const OPACITY_TRANSITION = "opacity 0.15s ease-in-out";

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
  let hovered: number | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    getHovered: () => hovered,
    requestHover(index) {
      if (isControlled()) {
        onHoverChange(index);
        return;
      }
      hovered = index;
      notify();
    },
    requestUnhover() {
      if (isControlled()) {
        onHoverChange(null);
        return;
      }
      hovered = null;
      notify();
    },
    setHovered(index) {
      hovered = index;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ---------------------------------------------------------------------------
// Per-slice imperative paint runtime
// ---------------------------------------------------------------------------

export interface PieSliceHoverConfig {
  index: number;
  visibleEl: SVGPathElement;
  innerRadius: number;
  outerRadius: number;
  cornerRadius: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  hoverOffset: number;
  hoverEffect: PieSliceHoverEffect;
  showGlow: boolean;
  color: string;
  fill: string;
}

export interface PieSliceHoverRuntime {
  /** Refresh the live geometry/effect config — call on every PieSlice
      render (cheap: just updates closure state read by spring `onUpdate`
      frames and by `paint`). Does NOT itself repaint; call `paint()` after
      if a repaint is needed (e.g. geometry changed while at rest). */
  update(config: PieSliceHoverConfig): void;
  /** Repaint immediately for the given hovered index. Springs animate
      toward their new targets from wherever they currently are; opacity/
      filter are set synchronously (they're plain CSS transitions, not
      rAF-driven). */
  paint(hoveredIndex: number | null): void;
  stop(): void;
}

export function createPieSliceHoverRuntime(): PieSliceHoverRuntime {
  let config: PieSliceHoverConfig | null = null;
  let translateX = 0;
  let translateY = 0;

  const applyTransform = () => {
    if (!config) return;
    config.visibleEl.style.transform = `translate(${translateX}px, ${translateY}px)`;
  };

  const translateXSpring: Spring = createSpring(0, HOVER_SPRING.stiffness, HOVER_SPRING.damping, (v) => {
    translateX = v;
    applyTransform();
  });
  const translateYSpring: Spring = createSpring(0, HOVER_SPRING.stiffness, HOVER_SPRING.damping, (v) => {
    translateY = v;
    applyTransform();
  });
  let currentRadius = 0;
  const writeGrowD = () => {
    if (!config) return;
    const d = pieArcPath(
      config.innerRadius,
      currentRadius,
      config.startAngle,
      config.endAngle,
      config.cornerRadius,
      config.padAngle,
    );
    config.visibleEl.setAttribute("d", d);
  };
  const growSpring: Spring = createSpring(0, HOVER_SPRING.stiffness, HOVER_SPRING.damping, (radius) => {
    currentRadius = radius;
    writeGrowD();
  });
  let growInitialized = false;

  return {
    update(next) {
      config = next;
    },
    paint(hoveredIndex) {
      if (!config) return;
      const isHovered = hoveredIndex === config.index;
      const isFaded = hoveredIndex !== null && !isHovered;
      const el = config.visibleEl;

      el.style.transition = `${OPACITY_TRANSITION}`;
      el.style.opacity = isFaded ? String(FADE_OPACITY) : FULL_OPACITY;
      // bklit's glow is DEAD CODE at runtime: pie-slice.tsx computes
      // `showGlow && isHovered ? drop-shadow(...) : "none"` into the framer
      // `style` prop, but framer-motion snapshots animatable style keys
      // (filter) into MotionValues at mount and never re-reads later static
      // `style` values — verified empirically 2026-07-31 (Playwright: inline
      // filter stays "none" on the hovered slice across repeated hover
      // cycles, every effect/branch, n=1 and n=4) — docs/LOG.md D49. Port
      // the OBSERVED pixels, not the dead source intent (D19 dead-code
      // precedent: decimation, identical-stop "gradients"). `showGlow` and
      // `color` stay in the config so the drop-shadow can be restored
      // verbatim if bklit ever fixes it:
      //   `config.showGlow && isHovered ? drop-shadow(0 0 12px ${config.color}) : "none"`
      el.style.filter = "none";

      // First paint for this instance — settle the radius spring at the
      // resting outer radius with no motion, WHATEVER the effect kind
      // (matches bklit's `useSpring(outerRadius, …)` initial value). The
      // spring is created at 0 only because config isn't known yet; without
      // this, the first `set(outerRadius)` would visibly animate the slice
      // growing in from radius 0 — masked by the WAAPI reveal when
      // `animate` is on, but plainly wrong for `animate={false}`, and
      // per-frame `d`-regeneration waste for every slice either way.
      if (!growInitialized) {
        growInitialized = true;
        growSpring.jump(config.outerRadius);
      }

      if (config.hoverEffect === "grow") {
        // Keep translate at rest so switching effect kinds never leaves a
        // stale offset applied.
        translateXSpring.set(0);
        translateYSpring.set(0);
        // Refresh `d` from the CURRENT spring radius + freshly-updated
        // config synchronously: on a data update React just rewrote the
        // path's `d` with base-radius rest geometry, and if the spring is
        // already settled at its target (e.g. grown, hovered, data tick
        // arrives) `set()` below is a no-op (spring.ts) — the regenerated
        // grown path must not wait a frame or it never gets written at all.
        writeGrowD();
        growSpring.set(isHovered ? config.outerRadius + config.hoverOffset : config.outerRadius);
      } else {
        growSpring.set(config.outerRadius);
        const distance = config.hoverEffect === "none" ? 0 : config.hoverOffset;
        const offset = sliceMidOffset(config.startAngle, config.endAngle, distance);
        translateXSpring.set(isHovered ? offset.x : 0);
        translateYSpring.set(isHovered ? offset.y : 0);
      }
    },
    stop() {
      translateXSpring.stop();
      translateYSpring.stop();
      growSpring.stop();
    },
  };
}
