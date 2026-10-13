"use client";

// bklit-compatible radar context: lets custom children read geometry and drive hover (bklit exports these hooks publicly).
import { createContext, useContext, useMemo } from "react";
import { useHoverIndex } from "../kit/polar/polar-hover";
import type { HoverSource } from "../kit/polar/polar-hover";
import type { ReactElement, ReactNode } from "react";
import type { RadarData, RadarMetric } from "./rows";

interface RadarHoverContextValue {
  /** Index of the hovered series, or `null` when nothing is hovered. */
  hoveredIndex: number | null;
  /** Sets the hovered series; pass `null` to clear hover. */
  setHoveredIndex: (index: number | null) => void;
}

interface RadarStableContextValue {
  /** The `data` passed to the chart. */
  data: RadarData[];
  /** The `metrics` passed to the chart. */
  metrics: RadarMetric[];
  /** Chart width and height in pixels, or `0` when the chart fills its parent. */
  size: number;
  /** Radius of the outermost grid ring in pixels, or `0` when the chart fills its parent. */
  radius: number;
  /** Number of grid rings. */
  levels: number;
  /** Whether the entrance animation is on. */
  animate: boolean;
  /** Entrance time budget in milliseconds. */
  enterDurationMs: number;
  /** The entrance stagger multiplier. */
  staggerScale: number;
  /** Kept for bklit-ui compatibility; not populated. */
  enterTransition?: unknown;
  /** The key that replays the entrance. */
  motionReplayKey: string;
  /** Returns the colour of the series at the given index: its `color`, or the palette colour. */
  getColor: (index: number) => string;
  /**
   * Returns the angle in radians of the spoke at the given metric index, measured from 3 o'clock, with the first metric at 12 o'clock.
   */
  getAngle: (metricIndex: number) => number;
  /**
   * Returns the `{ x, y }` offset from the centre, in pixels, of a value on the spoke of the given metric index.
   */
  getPointPosition: (metricIndex: number, value: number) => { x: number; y: number };
  /** Converts a value from 0 to 100 into a distance from the centre in pixels. */
  yScale: (value: number) => number;
}

/**
 * Everything `useRadar` returns: the chart geometry, data and helpers, plus the hovered series index and a setter for it.
 */
export type RadarContextValue = RadarStableContextValue & RadarHoverContextValue;
export type RadarProviderValue = RadarStableContextValue & Pick<RadarHoverContextValue, "setHoveredIndex">;

/** @internal */
export const radarCssVars = {
  area1: "var(--chart-1)",
  area2: "var(--chart-2)",
  area3: "var(--chart-3)",
  area4: "var(--chart-4)",
  area5: "var(--chart-5)",
  background: "var(--chart-background)",
  border: "var(--bkm-border)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  grid: "var(--chart-grid)",
  label: "var(--chart-label, oklch(0.65 0.01 260))",
};

const StableContext = createContext<RadarStableContextValue | null>(null);
const HoverContext = createContext<{ readonly source: HoverSource; readonly setHoveredIndex: RadarHoverContextValue["setHoveredIndex"] } | null>(null);

/** @internal */
export const RadarProvider = ({ children, value, source }: { children: ReactNode; value: RadarProviderValue; source: HoverSource }): ReactElement => {
  // Nothing here reads the hovered index: the provider value only holds the store reference, so a hover never re-renders
  // this component or anything wrapped by it. The hook consumers (leaves) subscribe through useHoverIndex.
  const { setHoveredIndex, ...stable } = value;
  const hoverHandle = useMemo(() => ({ setHoveredIndex, source }), [setHoveredIndex, source]);
  const stableMemo = useMemo(() => stable, [value.data, value.metrics, value.size, value.radius, value.levels, value.animate, value.enterDurationMs, value.staggerScale, value.motionReplayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <StableContext.Provider value={stableMemo}>
      <HoverContext.Provider value={hoverHandle}>{children}</HoverContext.Provider>
    </StableContext.Provider>
  );
};

/**
 * Returns the radar geometry and data without the hovered index. Use it in custom children that should not re-render on hover. Must be used inside a `RadarChart`.
 */
export const useRadarStable = (): RadarStableContextValue => {
  const context = useContext(StableContext);
  if (!context) { throw new Error("useRadarStable must be used within a RadarProvider. Make sure your component is wrapped in <RadarChart>."); }
  return context;
};

/**
 * Returns the hovered series index (or `null`) and a setter. Re-renders whenever the hovered series changes. Must be used inside a `RadarChart`.
 */
export const useRadarHover = (): RadarHoverContextValue => {
  const context = useContext(HoverContext);
  if (!context) { throw new Error("useRadarHover must be used within a RadarProvider. Make sure your component is wrapped in <RadarChart>."); }
  const hoveredIndex = useHoverIndex(context.source);
  return useMemo(() => ({ hoveredIndex, setHoveredIndex: context.setHoveredIndex }), [hoveredIndex, context.setHoveredIndex]);
};

/**
 * Returns the radar geometry and data together with the hovered series index and its setter. Must be used inside a `RadarChart`.
 */
export const useRadar = (): RadarContextValue => {
  const stable = useRadarStable();
  const hover = useRadarHover();
  return useMemo(() => ({ ...stable, ...hover }), [stable, hover]);
};
