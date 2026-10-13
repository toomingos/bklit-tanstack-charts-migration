"use client";
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
/** Shape of a ring's leading end: `"round"` rounds it, `"butt"` cuts it square. */
type RingLineCap = "round" | "butt";

// Default per-ring colors, in bklit order.
/** Default ring colours, applied in order and repeated: `--chart-1` to `--chart-5`. */
const defaultRingColors: string[] = [...CHART_PALETTE];

/** One ring of a `RingChart`. */
interface RingData {
  /** Display name of the ring. Shown as the label in `RingCenter` while the ring is hovered. */
  readonly label: string;
  /** Current value of the ring. */
  readonly value: number;
  /** Value at which the ring is full. The ring fills `value / maxValue`, limited to 0 to 1. */
  readonly maxValue: number;
  /**
   * Ring colour, any CSS colour or `var(--...)` reference. Defaults to the `--chart-1` to `--chart-5` palette, in order.
   */
  readonly color?: string;
}

interface ScrubRingLayer {
  readonly bgPath: string;
  readonly progressPath: string;
  readonly color: string;
}

interface RingStableValue {
  /** The `data` passed to the chart. */
  readonly data: RingData[];
  /** Chart width and height in pixels. */
  readonly size: number;
  /** Centre of the chart in pixels, on both axes (half of `size`). */
  readonly center: number;
  /** Thickness of each ring in pixels, after any scaling to fit. */
  strokeWidth: number;
  /** Gap between rings in pixels, after any scaling to fit. */
  readonly ringGap: number;
  /** Inner radius of the innermost ring in pixels, after any scaling to fit. */
  readonly baseInnerRadius: number;
  /** Kept for bklit-ui compatibility. Always `0`. */
  readonly animationKey: number;
  /** Kept for bklit-ui compatibility. Always `true`. */
  readonly isLoaded: boolean;
  /** Ref to the chart container element. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** The entrance transition passed to the chart, if any. */
  readonly enterTransition?: RingEnterTransition;
  /** The entrance stagger multiplier. */
  readonly enterStaggerScale: number;
  /** Sum of all ring values. */
  readonly totalValue: number;
  /** Returns the colour of the ring at the given index: its `color`, or the palette colour. */
  readonly getColor: (index: number) => string;
  /** Returns the inner and outer radius in pixels of the ring at the given index. */
  readonly getRingRadii: (index: number) => { innerRadius: number; outerRadius: number };
  /** Start angle in radians. */
  readonly startAngle: number;
  /** End angle of a full ring in radians. */
  readonly endAngle: number;
  /** Whether geometry scrubbing is on. */
  readonly geometryScrubbing: boolean;
  /** Kept for bklit-ui compatibility. Always `null` or `undefined`. */
  readonly scrubRingLayers?: readonly ScrubRingLayer[] | null;
}

/** Hover state shared by ring components: the hovered ring index (or `null`) and a setter. */
type RingHoverValue = PolarHoverValue;

/** Everything `useRing` returns: the chart geometry and data, plus the hovered ring index and a setter for it. */
type RingContextValue = RingStableValue & RingHoverValue;

/** Props for `Ring`. */
interface RingProps {
  /** Index of the ring this element configures, matching its position in the `data` array. */
  readonly index: number;
  /** Colour override for this ring. Takes precedence over the data item's `color`. */
  readonly color?: string;
  /**
   * Play the entrance animation for this ring. Set `false` to draw it without animating.
   * @default true
   */
  readonly animate?: boolean;
  /** Accepted for bklit-ui compatibility. No glow is drawn, which matches how bklit-ui renders. */
  readonly showGlow?: boolean;
  /**
   * Shape of the ring's leading end: `"round"` or `"butt"` (square).
   * @default "round"
   */
  readonly lineCap?: RingLineCap;
}

const RingStableContext = createContext<RingStableValue | undefined>(undefined);
const RingHoverCoordinatorContext = createContext<HoverSource | undefined>(undefined);

const MISSING = "Ring components must be used within <RingChart>. Make sure <Ring>/<RingCenter> are children of a <RingChart>.";

/**
 * Returns the ring geometry and data without the hovered index. Use it in custom children that should not re-render on hover. Must be used inside a `RingChart`.
 */
const useRingStable = (): RingStableValue => useRequiredContext(RingStableContext, MISSING);

const useRingHoverCoordinator = (): HoverSource => useRequiredContext(RingHoverCoordinatorContext, MISSING);

/**
 * Returns the hovered ring index (or `null`) and a setter. Re-renders whenever the hovered ring changes. Must be used inside a `RingChart`.
 */
const useRingHover = (): RingHoverValue => useHoverValue(useRingHoverCoordinator());

/**
 * Returns the ring geometry and data together with the hovered ring index and its setter. Must be used inside a `RingChart`.
 */
const useRing = (): RingContextValue => ({ ...useRingStable(), ...useRingHover() });

/**
 * Re-provides ring context to a subtree (custom charts reusing RingCenter and friends).
 * @internal
 */
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
/**
 * Configures one ring of a `RingChart`. Render one per data item as a child of the chart; it draws nothing itself and only supplies per-ring options such as `color`, `lineCap` and `animate`.
 */
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
