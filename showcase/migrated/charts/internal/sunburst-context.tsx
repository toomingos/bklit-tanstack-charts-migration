"use client";

import type { Transition } from "motion/react";
import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import type { SunburstEnterTiming } from "./parity/sunburst";
import type { ArcDatum, Focus, SunburstNode } from "./sunburst-types";

interface SunburstHoverContextValue {
  hoveredArcIndex: number | null;
  setHoveredArcIndex: (index: number | null) => void;
  hoveredArc: ArcDatum | null;
  setHoveredArc: (arc: ArcDatum | null) => void;
}

interface SunburstStableContextValue {
  data: SunburstNode;
  arcs: ArcDatum[];
  focusById: Map<string, Focus>;
  rootId: string;
  maxDepth: number;
  radius: number;
  size: number;

  focus: Focus;
  prevFocus: Focus;
  focusId: string;
  zoomTo: (nextId: string) => void;

  zoomT: number;
  enterTiming: SunburstEnterTiming;
  skipEnterAnimation: boolean;
  growAmountForArc: (arcId: string) => number;

  getColor: (categoryIndex: number, nodeColor?: string) => string;
  getFill: (
    arcIndex: number,
    fillOverride?: string,
    colorOverride?: string
  ) => string;
  getFillOpacity: (relativeDepth: number, override?: number) => number;

  isRelated: (arc: ArcDatum) => boolean;
  isDescendant: (arc: ArcDatum, ancestorId: string) => boolean;

  enterTransition?: Transition;
  enterStaggerScale: number;
  playKey: number;
  hoverPop: number;
  maxExpandedThickness: number;

  containerRef: RefObject<HTMLDivElement | null>;
}

type SunburstContextValue = SunburstStableContextValue &
  SunburstHoverContextValue;

const SunburstStableContext = createContext<SunburstStableContextValue | null>(
  null
);
const SunburstHoverContext = createContext<SunburstHoverContextValue | null>(
  null
);

const SunburstProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: SunburstContextValue;
}): ReactElement => {
  const stable = useMemo<SunburstStableContextValue>(
    () => ({
      arcs: value.arcs,
      containerRef: value.containerRef,
      data: value.data,
      enterStaggerScale: value.enterStaggerScale,
      enterTiming: value.enterTiming,
      enterTransition: value.enterTransition,
      focus: value.focus,
      focusById: value.focusById,
      focusId: value.focusId,
      getColor: value.getColor,
      getFill: value.getFill,
      getFillOpacity: value.getFillOpacity,
      growAmountForArc: value.growAmountForArc,
      hoverPop: value.hoverPop,
      isDescendant: value.isDescendant,
      isRelated: value.isRelated,
      maxDepth: value.maxDepth,
      maxExpandedThickness: value.maxExpandedThickness,
      playKey: value.playKey,
      prevFocus: value.prevFocus,
      radius: value.radius,
      rootId: value.rootId,
      size: value.size,
      skipEnterAnimation: value.skipEnterAnimation,
      zoomT: value.zoomT,
      zoomTo: value.zoomTo,
    }),
    [
      value.arcs,
      value.containerRef,
      value.data,
      value.enterStaggerScale,
      value.enterTiming,
      value.enterTransition,
      value.focus,
      value.focusById,
      value.focusId,
      value.getColor,
      value.getFill,
      value.getFillOpacity,
      value.growAmountForArc,
      value.hoverPop,
      value.isDescendant,
      value.isRelated,
      value.maxDepth,
      value.maxExpandedThickness,
      value.playKey,
      value.prevFocus,
      value.radius,
      value.rootId,
      value.size,
      value.skipEnterAnimation,
      value.zoomT,
      value.zoomTo,
    ]
  );

  const hover = useMemo<SunburstHoverContextValue>(
    () => ({
      hoveredArc: value.hoveredArc,
      hoveredArcIndex: value.hoveredArcIndex,
      setHoveredArc: value.setHoveredArc,
      setHoveredArcIndex: value.setHoveredArcIndex,
    }),
    [
      value.hoveredArc,
      value.hoveredArcIndex,
      value.setHoveredArc,
      value.setHoveredArcIndex,
    ]
  );

  return (
    <SunburstStableContext.Provider value={stable}>
      <SunburstHoverContext.Provider value={hover}>
        {children}
      </SunburstHoverContext.Provider>
    </SunburstStableContext.Provider>
  );
}

const useSunburstStable = (): SunburstStableContextValue => {
  const context = useContext(SunburstStableContext);
  if (!context) {
    throw new Error("useSunburstStable must be used within SunburstChart");
  }
  return context;
}

const useSunburstHover = (): SunburstHoverContextValue => {
  const context = useContext(SunburstHoverContext);
  if (!context) {
    throw new Error("useSunburstHover must be used within SunburstChart");
  }
  return context;
}

export { SunburstProvider, useSunburstHover, useSunburstStable };
export type { SunburstContextValue, SunburstHoverContextValue, SunburstStableContextValue };
