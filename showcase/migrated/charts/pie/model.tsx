"use client";
// Pie public model: data types, the config carrier (PieSlice), shared contexts and hooks.
// bklit-compatible names; PieChart provides the contexts, PieCenter and custom children read them.
import { createContext, memo, useMemo } from "react";
import type { NamedExoticComponent, ReactElement, ReactNode, RefObject } from "react";
import { useBridgedCoordinator, useHoverValue, useRequiredContext } from "../kit/polar/hover-context";
import type { PolarHoverValue } from "../kit/polar/hover-context";
import { CHART_PALETTE } from "../kit/palette";
import type { EnterTransition } from "../kit/motion/phase";
import type { HoverSource } from "../kit/polar/polar-hover";
import type { PieHoverEffect } from "./arc";

type PieSliceHoverEffect = PieHoverEffect;
type PieEnterTransition = EnterTransition;

// 5-entry palette: a 6-cycle would desync after index 5.
const defaultPieColors: string[] = [...CHART_PALETTE];

interface PieData {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
  readonly fill?: string;
}

interface PieArcData {
  readonly data: PieData;
  readonly index: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly padAngle: number;
  readonly value: number;
}

interface PieStableValue {
  readonly data: PieData[];
  readonly arcs: PieArcData[];
  readonly size: number;
  readonly center: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly padAngle: number;
  readonly cornerRadius: number;
  readonly hoverOffset: number;
  readonly animationKey: number;
  readonly enterTransition?: PieEnterTransition;
  readonly enterStaggerScale: number;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly totalValue: number;
  readonly getColor: (index: number) => string;
  readonly getFill: (index: number) => string;
  readonly geometryScrubbing: boolean;
  readonly scrubSlicePaths: readonly string[] | null;
  /** The chart is mounted and measured; the pie has no entrance gate, so this is the closest to bklit's post-reveal flag. */
  readonly isLoaded: boolean;
}

type PieHoverValue = PolarHoverValue;

type PieContextValue = PieStableValue & PieHoverValue;

/** Config element for one slice; read by PieChart, renders nothing itself. */
interface PieSliceProps {
  readonly index: number;
  readonly color?: string;
  readonly fill?: string;
  readonly animate?: boolean;
  readonly showGlow?: boolean;
  readonly hoverEffect?: PieSliceHoverEffect;
  readonly hoverOffset?: number;
  readonly className?: string;
}

const PieSliceCarrier = (_props: Readonly<PieSliceProps>): null => null;
const PieSlice: NamedExoticComponent<Readonly<PieSliceProps>> = memo(PieSliceCarrier);
PieSlice.displayName = "PieSlice";

const PieStableContext = createContext<PieStableValue | null>(null);
const PieHoverCoordinatorContext = createContext<HoverSource | null>(null);

const MISSING = "Pie components must be used within <PieChart>.";

const usePieStable = (): PieStableValue => useRequiredContext(PieStableContext, MISSING);

const usePieHoverCoordinator = (): HoverSource => useRequiredContext(PieHoverCoordinatorContext, MISSING);

const usePieHover = (): PieHoverValue => useHoverValue(usePieHoverCoordinator());

const usePie = (): PieContextValue => ({ ...usePieStable(), ...usePieHover() });

/** Re-provides pie context to a subtree (custom charts reusing PieCenter and friends). */
const PieProvider = ({ children, value }: { readonly children: ReactNode; readonly value: PieContextValue }): ReactElement => {
  const { hoveredIndex, setHoveredIndex, ...stableFields } = value;
  const stable = useMemo<PieStableValue>(() => stableFields, [value.data, value.arcs, value.size, value.innerRadius, value.totalValue]); // eslint-disable-line react-hooks/exhaustive-deps
  const coordinator = useBridgedCoordinator(hoveredIndex, setHoveredIndex);
  return (
    <PieStableContext.Provider value={stable}>
      <PieHoverCoordinatorContext.Provider value={coordinator}>{children}</PieHoverCoordinatorContext.Provider>
    </PieStableContext.Provider>
  );
};

export { PieHoverCoordinatorContext, PieProvider, PieSlice, PieStableContext, defaultPieColors, usePie, usePieHover, usePieHoverCoordinator, usePieStable };
export type { PieArcData, PieContextValue, PieData, PieEnterTransition, PieSliceHoverEffect, PieSliceProps, PieStableValue };
