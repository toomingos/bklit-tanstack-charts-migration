// Imperative hover chrome for SunburstChart arcs — follows PieHoverCoordinator
// pattern (pie-hover-chrome.ts) exactly.
//
// Architecture:
//   SunburstHoverCoordinator — chart-level singleton that tracks hovered
//   arc index with controlled/uncontrolled split (same interface as
//   PieHoverCoordinator). sunburst-chart.tsx's consolidated hover
//   useLayoutEffect subscribes and calls `applySunburstHoverStyles()` to
//   apply dimming (CSS opacity) + grow (WAAPI d-keyframe) in one pass.
//
//   SunburstSliceHoverRuntime — per-arc config carrier exported for
//   pattern consistency with pie/ring/funnel families. Sunburst's hover
//   model is CSS opacity + WAAPI d-keyframes, with no springs, so the
//   runtime is minimal (no per-frame animation loop). The chart's own
//   consolidated effect handles all arcs in batch.

export const FADE_OPACITY = 0.25;
const OPACITY_TRANSITION = "opacity 0.15s ease-in-out";

// ---------------------------------------------------------------------------
// Chart-level hover coordinator
// ---------------------------------------------------------------------------

export interface SunburstHoverCoordinator {
  getHovered(): number | null;
  /** Pointer-driven request from an arc's path `pointerenter`. In
      uncontrolled mode this updates state directly and notifies subscribers;
      in controlled mode it only calls `onHoverChange`. */
  requestHover(index: number): void;
  requestUnhover(): void;
  /** Imperative controlled-prop push: sets the current hovered index
      WITHOUT invoking `onHoverChange` and notifies subscribers. */
  setHovered(index: number | null): void;
  subscribe(listener: () => void): () => void;
}

export function createSunburstHoverCoordinator(
  onHoverChange: (index: number | null) => void,
  isControlled: () => boolean,
): SunburstHoverCoordinator {
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
// Per-arc runtime (minimal — sunburst has no springs; CSS + WAAPI only)
// ---------------------------------------------------------------------------

export interface SunburstSliceHoverConfig {
  index: number;
  pathEl: SVGPathElement;
}

export interface SunburstSliceHoverRuntime {
  /** Refresh the live config — call after TanStack renders new paths. */
  update(config: SunburstSliceHoverConfig): void;
  /** Apply opacity for the current hover state via CSS transition. */
  paint(isDimmed: boolean): void;
  stop(): void;
}

export function createSunburstSliceHoverRuntime(): SunburstSliceHoverRuntime {
  let config: SunburstSliceHoverConfig | null = null;
  let opacityTransitionSet = false;

  return {
    update(next) {
      config = next;
    },
    paint(isDimmed) {
      if (!config) return;
      if (!opacityTransitionSet) {
        opacityTransitionSet = true;
        config.pathEl.style.transition = OPACITY_TRANSITION;
      }
      config.pathEl.style.opacity = isDimmed ? String(FADE_OPACITY) : "1";
    },
    stop() {
      // No springs to stop — CSS transitions + WAAPI based.
    },
  };
}
