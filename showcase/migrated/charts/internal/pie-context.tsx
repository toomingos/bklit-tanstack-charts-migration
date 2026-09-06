"use client";

import type { Transition } from "motion/react";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { createHoverSource } from "./hover-motion";
import type { HoverSource } from "./hover-motion";
import { PieHoverCoordinatorContext, PieStableContext } from "./pie-center-context";
import { usePieStable as usePieStableInternal } from "./pie-center-hooks";
import type { PieArcData, PieData } from "./pie-center";

interface PieHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface PieStableContextValue {
  // Data
  data: PieData[];
  arcs: PieArcData[];

  // Dimensions
  size: number;
  center: number;
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;

  // Hover effect
  hoverOffset: number;

  // Animation state
  animationKey: number;
  isLoaded: boolean;
  enterTransition?: Transition;
  enterStaggerScale: number;

  // Container ref for portals
  containerRef: RefObject<HTMLDivElement | null>;

  // Computed values
  totalValue: number;

  // Get color for a slice index
  getColor: (index: number) => string;

  // Get fill for a slice index (supports patterns/gradients)
  getFill: (index: number) => string;

  /**
   * Studio geometry scrub — skip Motion path morphing and use plain SVG paths.
   * @default false
   */
  geometryScrubbing: boolean;

  /** Precomputed slice paths during geometry scrub (one per arc). */
  scrubSlicePaths: readonly string[] | null;
}

type PieContextValue = PieStableContextValue & PieHoverContextValue;

const PieProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: PieContextValue;
}): ReactElement => {
  const stable = useMemo(
    () => ({
      animationKey: value.animationKey,
      arcs: value.arcs,
      center: value.center,
      containerRef: value.containerRef,
      cornerRadius: value.cornerRadius,
      data: value.data,
      enterStaggerScale: value.enterStaggerScale,
      enterTransition: value.enterTransition,
      geometryScrubbing: value.geometryScrubbing,
      getColor: value.getColor,
      getFill: value.getFill,
      hoverOffset: value.hoverOffset,
      innerRadius: value.innerRadius,
      isLoaded: value.isLoaded,
      outerRadius: value.outerRadius,
      padAngle: value.padAngle,
      scrubSlicePaths: value.scrubSlicePaths,
      size: value.size,
      totalValue: value.totalValue,
    }),
    [
      value.animationKey,
      value.arcs,
      value.center,
      value.containerRef,
      value.cornerRadius,
      value.data,
      value.enterStaggerScale,
      value.enterTransition,
      value.geometryScrubbing,
      value.getColor,
      value.getFill,
      value.hoverOffset,
      value.innerRadius,
      value.isLoaded,
      value.outerRadius,
      value.padAngle,
      value.scrubSlicePaths,
      value.size,
      value.totalValue,
    ]
  );

  // Bridge the legacy hover pair onto a hover source (seed, forward, resync).
  // The broadcast store dedupes identical values, so no update loop forms.
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

  return (
    <PieStableContext.Provider value={stable}>
      <PieHoverCoordinatorContext.Provider value={coordinator}>
        {children}
      </PieHoverCoordinatorContext.Provider>
    </PieStableContext.Provider>
  );
};

const usePieHover = (): PieHoverContextValue => {
  const coordinator = useContext(PieHoverCoordinatorContext);
  if (!coordinator) {
    throw new Error(
      "usePieHover must be used within a PieProvider. " +
        "Make sure your component is wrapped in <PieChart>."
    );
  }
  const hoveredIndex = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getHovered,
    coordinator.getHovered
  );
  return useMemo<PieHoverContextValue>(
    () => ({
      hoveredIndex,
      setHoveredIndex: (index: number | null) => {
        coordinator.setHovered(index);
      },
    }),
    [coordinator, hoveredIndex]
  );
};

const usePie = (): PieContextValue => ({ ...usePieStableInternal(), ...usePieHover() });

export { PieProvider, usePie, usePieHover };
export type { PieContextValue, PieHoverContextValue, PieStableContextValue };
