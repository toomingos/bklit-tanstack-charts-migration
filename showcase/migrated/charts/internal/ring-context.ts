// Ring shared context: stable spec, scrub layers, hover coordinator, and hooks for carriers.
// Split from ring-chart so ring-center imports without a chart-level cycle.
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import type { RingEnterTransition } from "./enter-transition";
import type { RingHoverCoordinator } from "./ring-hover-chrome";

interface RingData {
  readonly label: string;
  readonly value: number;
  readonly maxValue: number;
  readonly color?: string;
}

interface ScrubRingLayer {
  readonly bgPath: string;
  readonly progressPath: string;
  readonly color: string;
}

interface RingStableValue {
  data: RingData[];
  size: number;
  center: number;
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;
  // Restored legacy payload fields (containerRef/isLoaded/animationKey) for consumer parity; unread inside.
  animationKey: number;
  isLoaded: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  enterTransition?: RingEnterTransition;
  enterStaggerScale: number;
  totalValue: number;
  getColor: (index: number) => string;
  getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  startAngle: number;
  endAngle: number;
  geometryScrubbing: boolean;
  scrubRingLayers: readonly ScrubRingLayer[] | null;
}

/** Legacy RingHoverContextValue shape (ring-context.tsx:47-50). */
interface RingHoverValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

/** Legacy RingContextValue shape (ring-context.tsx:92). */
type RingContextValue = RingStableValue & RingHoverValue;

const RingStableContext = createContext<RingStableValue | undefined>(undefined);
const RingHoverCoordinatorContext = createContext<RingHoverCoordinator | undefined>(undefined);

const useRingStable = (): RingStableValue => {
  const ctx = useContext(RingStableContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

const useRingHoverCoordinator = (): RingHoverCoordinator => {
  const ctx = useContext(RingHoverCoordinatorContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

/** Legacy useRingHover() over the imperative coordinator (useSyncExternalStore; caller-only re-render).
 *
 * @returns {RingHoverValue} Current hovered index plus the setter routing through the coordinator.
 */
const useRingHover = (): RingHoverValue => {
  const coordinator = useRingHoverCoordinator();
  const hoveredIndex = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getHovered,
    coordinator.getHovered,
  );
  const setHoveredIndex = useCallback(
    (index: number | null) => {
      if (index === null) {coordinator.requestUnhover();}
      else {coordinator.requestHover(index);}
    },
    [coordinator],
  );
  return { hoveredIndex, setHoveredIndex };
}

/** Legacy useRing() combiner shape.
 *
 * @returns {RingContextValue} Merged stable context and hover values.
 */
const useRing = (): RingContextValue => ({ ...useRingStable(), ...useRingHover() })

export {
  RingHoverCoordinatorContext,
  RingStableContext,
  useRing,
  useRingHover,
  useRingHoverCoordinator,
  useRingStable,
};
export type {
  RingContextValue,
  RingData,
  RingHoverValue,
  RingStableValue,
  ScrubRingLayer,
};
