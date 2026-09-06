// Shared hover motion primitives (verbatim from pie-hover-chrome.ts, V2.2).
import { createBroadcastStore } from "./broadcast-store";

type PieSliceHoverEffect = "translate" | "grow" | "none";

// Re-exported so pie/ring charts can drive the same spring via mark-level motion.
const HOVER_SPRING = { damping: 25, stiffness: 400 } as const;
const FADE_OPACITY = 0.4;


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
  createPieHoverCoordinator,
  FADE_OPACITY,
  HOVER_SPRING,
};
export { motionEasingFromCss } from "./parity/animation";
export type { HoverSource, PieHoverCoordinator, PieSliceHoverEffect };
