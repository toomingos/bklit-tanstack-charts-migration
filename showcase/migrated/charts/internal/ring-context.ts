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
  readonly data: RingData[];
  readonly size: number;
  readonly center: number;
  strokeWidth: number;
  readonly ringGap: number;
  readonly baseInnerRadius: number;
  // Restored legacy payload fields (containerRef/isLoaded/animationKey) for consumer parity; unread inside.
  readonly animationKey: number;
  readonly isLoaded: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly enterTransition?: RingEnterTransition;
  readonly enterStaggerScale: number;
  readonly totalValue: number;
  readonly getColor: (index: number) => string;
  readonly getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  readonly startAngle: number;
  readonly endAngle: number;
  readonly geometryScrubbing: boolean;
  readonly scrubRingLayers: readonly ScrubRingLayer[] | null;
}

/** Legacy RingHoverContextValue shape (ring-context.tsx:47-50). */
interface RingHoverValue {
  hoveredIndex: number | null;
  readonly setHoveredIndex: (index: number | null) => void;
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
