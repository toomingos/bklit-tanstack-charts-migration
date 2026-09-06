// Ring shared context: stable spec, scrub layers, hover coordinator, and hooks for carriers.
// Split from ring-chart so ring-center imports without a chart-level cycle.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import type { RingEnterTransition } from "./parity/animation";
import { createHoverSource } from "./hover-motion";
import type { HoverSource } from "./hover-motion";

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
  readonly scrubRingLayers?: readonly ScrubRingLayer[] | null;
}

/** Legacy RingHoverContextValue shape (ring-context.tsx:47-50). */
interface RingHoverValue {
  hoveredIndex: number | null;
  readonly setHoveredIndex: (index: number | null) => void;
}

/** Legacy RingContextValue shape (ring-context.tsx:92). */
type RingContextValue = RingStableValue & RingHoverValue;

const RingStableContext = createContext<RingStableValue | undefined>(undefined);
const RingHoverCoordinatorContext = createContext<HoverSource | undefined>(undefined);

// Default per-ring colors, in bklit ring-context.tsx order.
const defaultRingColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const useRingStable = (): RingStableValue => {
  const ctx = useContext(RingStableContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

const useRingHoverCoordinator = (): HoverSource => {
  const ctx = useContext(RingHoverCoordinatorContext);
  if (!ctx) {
    throw new Error(
      "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.",
    );
  }
  return ctx;
}

/** Legacy useRingHover() over the package-focus hover source (useSyncExternalStore; caller-only re-render).
 *
 * @returns {RingHoverValue} Current hovered index plus the setter routing through the hover source.
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
      coordinator.setHovered(index);
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

const RingProvider = ({ children, value }: { readonly children: ReactNode; readonly value: RingContextValue }): ReactElement => {
  const stable = useMemo<RingStableValue>(() => ({
    animationKey: value.animationKey,
    baseInnerRadius: value.baseInnerRadius,
    center: value.center,
    containerRef: value.containerRef,
    data: value.data,
    endAngle: value.endAngle,
    enterStaggerScale: value.enterStaggerScale,
    enterTransition: value.enterTransition,
    geometryScrubbing: value.geometryScrubbing,
    getColor: value.getColor,
    getRingRadii: value.getRingRadii,
    isLoaded: value.isLoaded,
    ringGap: value.ringGap,
    scrubRingLayers: undefined,
    size: value.size,
    startAngle: value.startAngle,
    strokeWidth: value.strokeWidth,
    totalValue: value.totalValue,
  }), [
    value.animationKey, value.baseInnerRadius, value.center, value.containerRef,
    value.data, value.endAngle, value.enterStaggerScale, value.enterTransition,
    value.geometryScrubbing, value.getColor, value.getRingRadii, value.isLoaded,
    value.ringGap, value.size, value.startAngle, value.strokeWidth, value.totalValue,
  ]);
  // Bridge the legacy hover pair onto a hover source (seed + forward + resync;
  // The broadcast store dedupes identical values, so no update loop forms).
  const [coordinator] = useState<HoverSource>(() => {
    const source = createHoverSource();
    source.setHovered(value.hoveredIndex);
    return source;
  });
  useEffect(() => {
    coordinator.setHovered(value.hoveredIndex);
  }, [coordinator, value.hoveredIndex]);
  useEffect(
    () =>
      coordinator.subscribe(() => {
        value.setHoveredIndex(coordinator.getHovered());
      }),
    [coordinator, value]
  );
  return createElement(
    RingStableContext.Provider,
    { value: stable },
    createElement(RingHoverCoordinatorContext.Provider, { value: coordinator }, children)
  );
};

export {
  RingHoverCoordinatorContext,
  RingProvider,
  RingStableContext,
  defaultRingColors,
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
