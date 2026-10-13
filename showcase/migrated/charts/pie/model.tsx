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

/**
 * How a hovered slice reacts: `"translate"` moves it outward, `"grow"` extends its outer radius, `"none"` leaves it in place.
 */
type PieSliceHoverEffect = PieHoverEffect;
type PieEnterTransition = EnterTransition;

// 5-entry palette: a 6-cycle would desync after index 5.
/** Default slice colours, applied in order and repeated: `--chart-1` to `--chart-5`. */
const defaultPieColors: string[] = [...CHART_PALETTE];

/** One slice of a `PieChart`. */
interface PieData {
  /** Display name of the slice. Shown as the label in `PieCenter` while the slice is hovered. */
  readonly label: string;
  /** Size of the slice. Its angle is this value's share of the sum of all values. */
  readonly value: number;
  /**
   * Slice colour, any CSS colour or `var(--...)` reference. Defaults to the `--chart-1` to `--chart-5` palette, in order.
   */
  readonly color?: string;
  /**
   * Paint for the slice, for example `url(#patternId)` for a pattern or gradient defined as a child of the chart. Takes precedence over `color`.
   */
  readonly fill?: string;
}

/** Computed geometry of one slice, as available through `usePie`. */
interface PieArcData {
  /** The `PieData` item this arc was computed from. */
  readonly data: PieData;
  /** Position of the arc, matching the index in the `data` array. */
  readonly index: number;
  /** Start angle in radians. */
  readonly startAngle: number;
  /** End angle in radians. */
  readonly endAngle: number;
  /** Padding angle in radians applied to this arc. */
  readonly padAngle: number;
  /** The slice value. */
  readonly value: number;
}

interface PieStableValue {
  /** The `data` passed to the chart. */
  readonly data: PieData[];
  /** Computed arc for each slice, in data order. */
  readonly arcs: PieArcData[];
  /** Chart width and height in pixels. */
  readonly size: number;
  /** Centre of the chart in pixels, on both axes (half of `size`). */
  readonly center: number;
  /** Outer radius in pixels, after reserving room for the hover offset. */
  readonly outerRadius: number;
  /** Inner radius in pixels; `0` for a solid pie. */
  readonly innerRadius: number;
  /** Gap between slices in radians. */
  readonly padAngle: number;
  /** Slice corner radius in pixels. */
  readonly cornerRadius: number;
  /** Distance in pixels a hovered slice moves out. */
  readonly hoverOffset: number;
  /** Kept for bklit-ui compatibility. Always `0`. */
  readonly animationKey: number;
  /** The entrance transition passed to the chart, if any. */
  readonly enterTransition?: PieEnterTransition;
  /** The entrance stagger multiplier. */
  readonly enterStaggerScale: number;
  /** Ref to the chart container element. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** Sum of all slice values. */
  readonly totalValue: number;
  /** Returns the colour of the slice at the given index: its `color`, or the palette colour. */
  readonly getColor: (index: number) => string;
  /** Returns the paint of the slice at the given index: its `fill`, or its colour. */
  readonly getFill: (index: number) => string;
  /** Whether geometry scrubbing is on. */
  readonly geometryScrubbing: boolean;
  /** Kept for bklit-ui compatibility. Always `null`. */
  readonly scrubSlicePaths: readonly string[] | null;
  /** `true` once the chart is mounted and measured in the browser. */
  readonly isLoaded: boolean;
}

/** Hover state shared by pie components: the hovered slice index (or `null`) and a setter. */
type PieHoverValue = PolarHoverValue;

/** Everything `usePie` returns: the chart geometry and data, plus the hovered slice index and a setter for it. */
type PieContextValue = PieStableValue & PieHoverValue;

/** Props for `PieSlice`. */
interface PieSliceProps {
  /** Index of the slice this element configures, matching its position in the `data` array. */
  readonly index: number;
  /**
   * Colour override for this slice. Has no effect in bklit-tanstack-charts; set `color` on the `PieData` item, or use `fill`.
   */
  readonly color?: string;
  /**
   * Paint override for this slice, for example `url(#patternId)` for a pattern or gradient defined as a child of the chart. Takes precedence over the data item's `color` and `fill`.
   */
  readonly fill?: string;
  /**
   * Play the entrance animation for this slice. Set `false` to draw it without animating.
   * @default true
   */
  readonly animate?: boolean;
  /** Accepted for bklit-ui compatibility. No glow is drawn, which matches how bklit-ui renders. */
  readonly showGlow?: boolean;
  /**
   * How the slice reacts when hovered: `"translate"` moves it outward, `"grow"` extends its outer radius, `"none"` leaves it in place.
   * @default "translate"
   */
  readonly hoverEffect?: PieSliceHoverEffect;
  /**
   * Distance in pixels for the hover effect. Defaults to the chart's `hoverOffset`.
   * @default the chart's `hoverOffset`
   */
  readonly hoverOffset?: number;
  /** Accepted for bklit-ui compatibility; has no effect. */
  readonly className?: string;
}

const PieSliceCarrier = (_props: Readonly<PieSliceProps>): null => null;
/**
 * Configures one slice of a `PieChart`. Render one per data item as a child of the chart; it draws nothing itself and only supplies per-slice options such as `hoverEffect`, `fill` and `animate`.
 */
const PieSlice: NamedExoticComponent<Readonly<PieSliceProps>> = memo(PieSliceCarrier);
PieSlice.displayName = "PieSlice";

const PieStableContext = createContext<PieStableValue | null>(null);
const PieHoverCoordinatorContext = createContext<HoverSource | null>(null);

const MISSING = "Pie components must be used within <PieChart>.";

/**
 * Returns the pie geometry and data without the hovered index. Use it in custom children that should not re-render on hover. Must be used inside a `PieChart`.
 */
const usePieStable = (): PieStableValue => useRequiredContext(PieStableContext, MISSING);

const usePieHoverCoordinator = (): HoverSource => useRequiredContext(PieHoverCoordinatorContext, MISSING);

/**
 * Returns the hovered slice index (or `null`) and a setter. Re-renders whenever the hovered slice changes. Must be used inside a `PieChart`.
 */
const usePieHover = (): PieHoverValue => useHoverValue(usePieHoverCoordinator());

/**
 * Returns the pie geometry and data together with the hovered slice index and its setter. Must be used inside a `PieChart`.
 */
const usePie = (): PieContextValue => ({ ...usePieStable(), ...usePieHover() });

/**
 * Re-provides pie context to a subtree (custom charts reusing PieCenter and friends).
 * @internal
 */
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
