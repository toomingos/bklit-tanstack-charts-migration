// Ring public model: data types, the config carrier (Ring), shared contexts, hooks and child classification.
// bklit-compatible names; RingChart provides the contexts, RingCenter and custom children read them.
import { createContext, isValidElement, memo, useMemo } from "react";
import type { NamedExoticComponent, ReactElement, ReactNode, RefObject } from "react";
import { useBridgedCoordinator, useHoverValue, useRequiredContext } from "../kit/polar/hover-context";
import type { PolarHoverValue } from "../kit/polar/hover-context";
import { CHART_PALETTE } from "../kit/palette";
import { classifyPolarChildren } from "../kit/polar/polar-hover";
import { displayNameOf } from "../kit/read-children";
import type { EnterTransition } from "../kit/motion/phase";
import type { HoverSource } from "../kit/polar/polar-hover";

type RingEnterTransition = EnterTransition;
type RingLineCap = "round" | "butt";

// Default per-ring colors, in bklit order.
const defaultRingColors: string[] = [...CHART_PALETTE];

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

type RingHoverValue = PolarHoverValue;

type RingContextValue = RingStableValue & RingHoverValue;

/** Config element for one ring; read by RingChart, renders nothing itself. */
interface RingProps {
  readonly index: number;
  readonly color?: string;
  readonly animate?: boolean;
  readonly showGlow?: boolean;
  readonly lineCap?: RingLineCap;
}

const RingStableContext = createContext<RingStableValue | undefined>(undefined);
const RingHoverCoordinatorContext = createContext<HoverSource | undefined>(undefined);

const MISSING = "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.";

const useRingStable = (): RingStableValue => useRequiredContext(RingStableContext, MISSING);

const useRingHoverCoordinator = (): HoverSource => useRequiredContext(RingHoverCoordinatorContext, MISSING);

const useRingHover = (): RingHoverValue => useHoverValue(useRingHoverCoordinator());

const useRing = (): RingContextValue => ({ ...useRingStable(), ...useRingHover() });

/** Re-provides ring context to a subtree (custom charts reusing RingCenter and friends). */
const RingProvider = ({ children, value }: { readonly children: ReactNode; readonly value: RingContextValue }): ReactElement => {
  const { hoveredIndex, setHoveredIndex, ...stableFields } = value;
  // Rebuilt only when the ring geometry changes: the other fields (refs, getters) change identity every render and must not churn consumers.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react/memo-dependencies -- geometry-only subset: refs and getters change identity every render and must not churn consumers
  const stable = useMemo<RingStableValue>(() => ({ ...stableFields, scrubRingLayers: undefined }), [value.data, value.size, value.baseInnerRadius, value.strokeWidth, value.ringGap, value.totalValue]);
  const coordinator = useBridgedCoordinator(hoveredIndex, setHoveredIndex);
  return (
    <RingStableContext.Provider value={stable}>
      <RingHoverCoordinatorContext.Provider value={coordinator}>{children}</RingHoverCoordinatorContext.Provider>
    </RingStableContext.Provider>
  );
};

const RingConfig = (_props: Readonly<RingProps>): null => null;
const Ring: NamedExoticComponent<Readonly<RingProps>> = memo(RingConfig);
Ring.displayName = "Ring";

interface RingChildConfig {
  readonly index: number;
  readonly color?: string;
  readonly animate: boolean;
  readonly lineCap: RingLineCap;
}

interface RingClassification {
  readonly centerChildren: ReactNode[];
  readonly ringConfigs: RingChildConfig[];
}

const classifyRingChildren = (children: ReactNode, geometryScrubbing: boolean): RingClassification => {
  const { centerChildren, configs } = classifyPolarChildren<RingChildConfig>(children, {
    configOf: (child) => {
      if (geometryScrubbing || displayNameOf(child.type) !== "Ring" || !isValidElement<RingProps>(child)) { return undefined; }
      const { props } = child;
      return { animate: props.animate !== false, color: props.color, index: props.index, lineCap: props.lineCap ?? "round" };
    },
    isCenter: (child) => displayNameOf(child.type) === "RingCenter",
  });
  return { centerChildren, ringConfigs: configs };
};

export { Ring, RingHoverCoordinatorContext, RingProvider, RingStableContext, classifyRingChildren, defaultRingColors, useRing, useRingHover, useRingHoverCoordinator, useRingStable };
export type { RingChildConfig, RingContextValue, RingData, RingEnterTransition, RingLineCap, RingProps, RingStableValue };
